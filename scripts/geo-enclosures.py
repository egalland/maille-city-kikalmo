#!/usr/bin/python3
"""Bake the separate ODbL boundary layer, leaving every designated access open.
Uses Python 3 + GDAL/GEOS. Optionally pass two saved Overpass JSON responses
(barriers and access ways) to reproduce a fixed survey instead of downloading.
"""
from collections import Counter, defaultdict
import gzip
import json
import math
from pathlib import Path
import re
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from osgeo import ogr

ROOT = Path(__file__).resolve().parents[1]
BBOX = (49.516, 2.949, 49.631, 3.104)
BOX = ",".join(map(str, BBOX))
URL = "https://overpass.openstreetmap.fr/api/interpreter"
BARRIERS = f'(way["barrier"~"^(fence|wall|retaining_wall)$"]({BOX});node["barrier"~"^(gate|entrance|lift_gate|swing_gate|kissing_gate|stile)$"]({BOX}););'
ACCESS = f'way["highway"~"^(service|footway|path|steps|track|pedestrian|cycleway)$"]({BOX});'

def read_osm(query, number):
    if len(sys.argv) > number:
        return json.loads(Path(sys.argv[number]).read_text())
    url = URL + "?" + urlencode({"data": "[out:json][timeout:90];" + query + "out tags geom;"})
    with urlopen(Request(url, headers={"User-Agent":"MailleCity offline cartography"}), timeout=120) as response:
        return json.load(response)

def xy(node):
    return ((node["lon"]-3)*72300, (49.58-node["lat"])*111230)

def line(points):
    geometry = ogr.Geometry(ogr.wkbLineString)
    for x,y in points:
        geometry.AddPoint_2D(x,y)
    return geometry

def cells(shape):
    x,u,y,v = shape.GetEnvelope()
    for i in range(math.floor(x/32),math.floor(u/32)+1):
        for j in range(math.floor(y/32),math.floor(v/32)+1):
            yield (i,j)

def polygon(rings):
    result = ogr.Geometry(ogr.wkbPolygon)
    for ring in rings:
        contour = ogr.Geometry(ogr.wkbLinearRing)
        for x,y in ring:
            contour.AddPoint_2D(x,y)
        contour.CloseRings()
        result.AddGeometry(contour)
    return result

def lines(shape):
    if shape.IsEmpty():
        return
    if shape.GetGeometryName() == "LINESTRING":
        yield shape
    else:
        for i in range(shape.GetGeometryCount()):
            yield from lines(shape.GetGeometryRef(i))

def style_of(tags):
    if tags["barrier"] == "retaining_wall": return "stone"
    if tags["barrier"] == "wall": return "stone" if tags.get("material") in ("stone","concrete") else "brick"
    raw = (tags.get("fence_type","")+" "+tags.get("material","")).lower()
    if "wood" in raw or "palisade" in raw: return "board"
    if raw.strip(): return "mesh"
    return "fence"

def main():
    features = read_osm(BARRIERS,1)
    access = read_osm(ACCESS,2)
    if "remark" in features or "remark" in access:
        raise ValueError("Overpass returned an incomplete survey")
    data = json.loads(gzip.decompress((ROOT/"public/map-enfer.gz").read_bytes()))
    avoid = defaultdict(list)
    def protect(shape):
        for key in cells(shape): avoid[key].append(shape)
    for _,path,width,kind,_,level,*_rest in data["streets"]:
        if not level: protect(line(path).Buffer(width/2+(0.58 if kind=="path" else 1.55),3))
    for _,outer,_,_,holes,*_rest in data["buildings"]:
        # The game uses these exact IGN facades. Remove overlapping OSM linework.
        protect(polygon([outer]+(holes or [])).Buffer(.26,2))
    for way in access["elements"]:
        tags=way["tags"]
        if tags.get("bridge","no")!="no" or tags.get("tunnel","no")!="no" or tags.get("layer","0")!="0": continue
        protect(line(map(xy,way["geometry"])).Buffer(1.95 if tags["highway"] in ("service","track") else 1.00,4))
    for gate in features["elements"]:
        if gate["type"]!="node": continue
        p=ogr.Geometry(ogr.wkbPoint); p.AddPoint_2D(*xy(gate))
        protect(p.Buffer(2.35 if gate["tags"]["barrier"] not in ("kissing_gate","stile") else 1.05,8))

    rows=[]; total=0
    coverage=polygon([data["metadata"]["boundary"]])
    for wall in features["elements"]:
        tags=wall["tags"]
        if wall["type"]!="way" or tags.get("barrier") not in ("wall","retaining_wall","fence"): continue
        shape=line(map(xy,wall["geometry"])).Simplify(.17).Intersection(coverage)
        if shape.IsEmpty(): continue
        near={id(obj):obj for k in cells(shape) for obj in avoid.get(k,())}
        for obstacle in near.values():
            if not shape.IsEmpty() and shape.Intersects(obstacle):shape=shape.Difference(obstacle)
        style=style_of(tags)
        height=tags.get("height","").strip().replace(",",".")
        dm=round(float(height.rstrip("m").strip())*10) if re.fullmatch(r'\d+(?:\.\d+)?\s*m?',height) else 0
        dm=dm if 4<=dm<=35 else 0
        for part in lines(shape):
            if part.Length()<.85: continue
            coords=[]
            for x,y,*_ in part.GetPoints():
                a,b=round(x*10),round(y*10)
                if not coords or coords[-2:]!=[a,b]: coords.extend([a,b])
            if len(coords)<4: continue
            rows.append([wall["id"],style,dm,coords]);total+=part.Length()
    kinds=Counter(row[1] for row in rows)
    header="// © OpenStreetMap contributors · ODbL 1.0 · https://www.openstreetmap.org/copyright\n"
    header+="// OSM way ID, barrier style, tagged height (dm, zero = unknown), local east/south coordinates (dm).\n"
    header+="// Prepared by scripts/geo-enclosures.py from "+features["osm3s"]["timestamp_osm_base"]+".\n"
    (ROOT/"public/enfer-enclosures.js").write_text(header+"export const enclosureRows=[\n"+",\n".join(json.dumps(r,separators=(",",":")) for r in rows)+"\n];\n")
    print(len({r[0] for r in rows}),"OSM ways,",len(rows),"open runs,",round(total),"metres",kinds)

if __name__=="__main__": main()
