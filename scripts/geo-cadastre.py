#!/usr/bin/env python3
"""Derive plausible garden boundaries from open Etalab parcel geometry.

Requires Shapely 2. Supply the downloaded Noyon and Pont-l'Évêque
cadastre GeoJSON gzip files, in that order. Output coordinates are in decimetres.
"""

from collections import defaultdict
import gzip
import json
import math
from pathlib import Path
import re
import subprocess
import sys
from zlib import crc32

from shapely import STRtree, line_merge, make_valid
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import nearest_points, substring, unary_union


ROOT = Path(__file__).resolve().parents[1]


def cadastral_geometry(feature):
    geometry = feature["geometry"]
    polygons = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [polygons]
    for shell, *holes in polygons:
        def project(ring):
            return [((x - 3) * 72300, (49.58 - y) * 111230) for x, y in ring]

        yield make_valid(Polygon(project(shell), [project(ring) for ring in holes]))


def line_parts(shape):
    if shape.geom_type == "LineString":
        if not shape.is_empty:
            yield shape
    elif hasattr(shape, "geoms"):
        for item in shape.geoms:
            yield from line_parts(item)


def grid_cells(shape):
    a, b, c, d = shape.bounds
    for x in range(math.floor(a / 32), math.floor(c / 32) + 1):
        for y in range(math.floor(b / 32), math.floor(d / 32) + 1):
            yield x, y


def main(files):
    data = json.loads(gzip.decompress((ROOT / "public/map-enfer.gz").read_bytes()))
    roads = []
    road_clearance = []
    for _, path, width, kind, _, level, *rest in data["streets"]:
        if level or len(path) < 2:
            continue
        road = LineString(path)
        if kind != "path":
            roads.append(road)
        road_clearance.append(road.buffer(width / 2 + (1.3 if kind == "path" else 3.0)))
    road_index = STRtree(roads)
    homes = []
    clearance = road_clearance
    for _, outer, _, kind, holes, *_ in data["buildings"]:
        building = make_valid(Polygon(outer, holes or []))
        clearance.append(building.buffer(1.35))
        if kind != "residential" or building.area < 23:
            continue
        home = building.representative_point()
        homes.append(home)
        road = roads[road_index.nearest(home)]
        if road.distance(home) < 58:
            front, access = nearest_points(building, road)
            if not front.equals(access):
                clearance.append(LineString([front, access]).buffer(2.2))
            # Keep a clear route in front of the street-facing facade as well
            # as the closest corner of the surveyed footprint.
            candidates = []
            for a, b in zip(outer, outer[1:] + outer[:1]):
                edge = LineString([a, b])
                if edge.length >= 3:
                    mid = edge.interpolate(.5, normalized=True)
                    if road.distance(mid) < front.distance(road) + 4.0:
                        candidates.append((road.distance(mid) - min(10, edge.length) * .22, mid))
            if candidates:
                _, mid = min(candidates, key=lambda option: option[0])
                curb = nearest_points(mid, road)[1]
                if not mid.equals(curb):
                    clearance.append(LineString([mid, curb]).buffer(1.68))
    home_index = STRtree(homes)

    original = (ROOT / "public/enfer-enclosures.js").read_text(encoding="utf-8")
    rows = json.loads(re.search(r"export const enclosureRows=(\[.*\]);", original, re.S)[1])
    for _, _, _, coords in rows:
        clearance.append(LineString([(x / 10, y / 10) for x, y in zip(coords[::2], coords[1::2])]).buffer(1.25))
    route_and_sites = subprocess.check_output(
        ["node", "--input-type=module", "-e",
         "import {railSections} from './public/enfer-rail.js';"
         "import {parkingLots} from './public/enfer-parking-lots.js';"
         "import {careerPlaces} from './public/career-catalog.js';"
         "import {airfields} from './public/airfield.js';"
         "console.log(JSON.stringify([railSections.map(p=>[p.x,p.y]),"
         "[...parkingLots,...Object.values(careerPlaces),...airfields].map(p=>[p.x,p.y,(p.width||16)/2+9])]))"],
        cwd=ROOT, text=True,
    )
    rail, points = json.loads(route_and_sites)
    clearance.append(LineString(rail + rail[:1]).buffer(13))
    clearance.extend(Point(x, y).buffer(radius) for x, y, radius in points)
    clearance.append(box(-1900, 960, -1460, 1305))  # The hand-built Mont Renaud.
    for outer, holes, *_ in data["water"]:
        if len(outer) >= 3:
            clearance.append(make_valid(Polygon(outer, holes or [])).buffer(2))
    avoid = STRtree(clearance)

    accepted = defaultdict(list)
    result = []
    for file in files:
        survey = json.loads(gzip.decompress(Path(file).read_bytes()))
        for feature in sorted(survey["features"], key=lambda row: row["properties"]["id"]):
            identity = feature["properties"]["id"]
            seed = crc32(identity.encode())
            if seed % 100 >= 73 or not feature.get("geometry"):
                continue
            for parcel in cadastral_geometry(feature):
                if parcel.geom_type != "Polygon" or not 100 <= parcel.area <= 2700:
                    continue
                if not len(home_index.query(parcel, predicate="contains")):
                    continue
                border = parcel.exterior.simplify(.34)
                constraints = [clearance[i] for i in avoid.query(border, predicate="intersects")]
                pieces = border.difference(unary_union(constraints)) if constraints else border
                used = 0
                runs = sorted(line_parts(line_merge(pieces)), key=lambda piece: -piece.length)
                for run in runs:
                    if run.length < 7.2 or used >= 2:
                        break
                    start = 1.55 + (seed % 9) * .19
                    end = min(run.length - 2.0, start + 30 + seed % 12)
                    if end - start < 4:
                        continue
                    line = substring(run, start, end)
                    near_cells = list(grid_cells(line.buffer(1)))
                    nearby = {item for cell in near_cells for item in accepted[cell]}
                    overlap = [item for item in nearby if line.intersects(item)]
                    if overlap:
                        leftover = line.difference(unary_union(overlap))
                        line = max(line_parts(leftover), key=lambda part: part.length, default=None)
                    if line is None or line.length < 4:
                        continue
                    buffer = line.buffer(1.05)
                    for cell in grid_cells(buffer):
                        accepted[cell].append(buffer)
                    coords = [round(v * 10) for point in line.coords for v in point]
                    style = "hedge" if seed % 5 != 0 else "brick"
                    result.append([f"cadastre-{seed:08x}-{used}", style, 10 + seed % 5, coords])
                    used += 1

    header = ("// DGFiP · Cadastre Etalab · Licence Ouverte 2.0\n"
              "// Decorative walls and hedges inferred for the game. Generated by scripts/geo-cadastre.py.\n")
    payload = ",\n".join(json.dumps(row, separators=(",", ":")) for row in result)
    (ROOT / "public/enfer-cadastre-borders.js").write_text(
        header + "export const cadastralBorders=[\n" + payload + "\n];\n", encoding="utf-8"
    )
    print(len(result), "garden boundaries")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1:])
