#!/usr/bin/python3
"""Bake a fine IGN BD TOPO® map of Noyon and the Oise valley. Requires GDAL, NumPy and SciPy."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from importlib.util import spec_from_file_location,module_from_spec
from pathlib import Path
import gzip,json,math,tempfile
import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.spatial import cKDTree

root=Path(__file__).resolve().parents[1]
spec=spec_from_file_location('extract',root/'scripts/geo-extract.py')
geo=module_from_spec(spec)
spec.loader.exec_module(geo)
geo.CACHE=Path(tempfile.gettempdir())/'maille-city-ign-noyonnais-v1'
geo.CACHE.mkdir(exist_ok=True)
# Compact local metres for the independent game world, north up.
west,south,east,north=2.970,49.551,3.085,49.610
geo.project=lambda lon,lat:((lon-3.000)*72300,(49.580-lat)*111230)
ring=[geo.project(lon,lat) for lon,lat in [(west,north),(east,north),(east,south),(west,south)]]
outline=geo.geometry('Polygon',[[[west,north],[east,north],[east,south],[west,south],[west,north]]])
jobs=[]
for i in range(3):
    for j in range(3):
        box=[west+(east-west)*i/3,south+(north-south)*j/3,west+(east-west)*(i+1)/3,south+(north-south)*(j+1)/3]
        jobs.extend((f'n{i}-{j}',layer,box) for layer in ('batiment','troncon_de_route'))
jobs.extend(('vallee',layer,[west,south,east,north]) for layer in ('surface_hydrographique','zone_de_vegetation'))
features={key:{} for key in geo.LAYERS}
with ThreadPoolExecutor(max_workers=7) as pool:
    for layer,items in pool.map(geo.acquire,jobs):
        features[layer].update((f['properties']['cleabs'],f) for f in items if f.get('geometry'))
print('projecting', {k:len(v) for k,v in features.items()},flush=True)

uses={'Résidentiel':'residential','Religieux':'religious','Agricole':'agricultural','Industriel':'industrial',
      'Annexe':'annex','Commercial et services':'commercial','Sportif':'sports'}
def points(g,closed=False):
    out=[]
    for x,y,*_ in g.GetPoints():
        p=[round(x,1),round(y,1)]
        if not out or p!=out[-1]:out.append(p)
    if closed and out and out[0]==out[-1]:out.pop()
    return out
def samples(g):
    coords=g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
    for line in coords:
        for aa,bb in zip(line,line[1:]):
            if len(aa)<3 or len(bb)<3 or not 15<min(aa[2],bb[2])<=max(aa[2],bb[2])<260:continue
            x,y=geo.project(*aa[:2]);u,v=geo.project(*bb[:2])
            n=max(1,math.ceil(math.hypot(u-x,v-y)/11))
            for j in range(n+1):
                t=j/n
                yield (x+(u-x)*t,y+(v-y)*t,aa[2]+(bb[2]-aa[2])*t)

buildings=[];streets=[];water=[];green=[];z=[];observed=0
for layer,items in features.items():
    for fid,f in sorted(items.items()):
        p,g=f['properties'],f['geometry']
        if p.get('etat_de_l_objet') not in (None,'En service'):continue
        geometry=geo.geometry(g['type'],g['coordinates'])
        if not geometry or not outline.Intersects(geometry):continue
        ident=geo.ids(fid)
        if layer=='troncon_de_route':
            level=int(p.get('position_par_rapport_au_sol') or 0)
            if level<0:continue
            if not level:z.extend(samples(g))
            nature=p.get('nature') or ''
            path=nature in ('Sentier','Escalier','Chemin','Piste cyclable')
            rank=int(p.get('importance') or 6)
            kind='path' if path else 'motorway' if nature in ('Autoroute','Bretelle','Type autoroutier') else 'primary' if rank<=3 else 'secondary' if rank==4 else 'residential'
            width=p.get('largeur_de_chaussee') or (2.3 if path else max(4,(p.get('nombre_de_voies') or (2 if rank<=4 else 1))*3.25))
            name=next((p[k] for k in ('nom_voie_ban_gauche','nom_voie_ban_droite','nom_collaboratif_gauche','nom_collaboratif_droite') if p.get(k)),'')
            original=[l.GetPoints() for l in geo.lines(geometry)]
            for i,l in enumerate(geo.lines(geometry.Intersection(outline).Simplify(.25))):
                row=points(l)
                if len(row)>=2:streets.append([ident+(f'-{i}' if i else ''),row,round(width,1),kind,name,level,geo.travel_direction(p.get('sens_de_circulation'),row,original)])
            continue
        detail=.22 if layer=='batiment' else .9
        cut=geometry.SimplifyPreserveTopology(detail) if layer=='batiment' else geometry.Intersection(outline).SimplifyPreserveTopology(detail)
        water_z=[]
        if layer=='surface_hydrographique':
            polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
            water_z=[p[2] for poly in polys for p in poly[0] if len(p)>2 and 15<p[2]<210]
        for i,poly in enumerate(geo.polygons(cut)):
            outer=points(poly.GetGeometryRef(0),True)
            if len(outer)<3 or poly.GetArea()<3:continue
            holes=[points(poly.GetGeometryRef(j),True) for j in range(1,poly.GetGeometryCount())]
            holes=[hole for hole in holes if len(hole)>=3]
            if layer=='batiment':
                h=p.get('hauteur');known=bool(h and .65<h<160)
                if not known:h=max(2.5,(p.get('nombre_d_etages') or (2 if p.get('usage_1')=='Résidentiel' else 1))*3.1)
                buildings.append([ident+(f'-{i}' if i else ''),outer,round(h,1),uses.get(p.get('usage_1'),'mixed'),holes or None,int(known)])
                observed+=known
            elif layer=='surface_hydrographique':
                water.append([outer,holes,round(float(np.median(water_z)),1) if water_z else None])
            else:green.append([outer,holes,p.get('nature')])

geo_points=np.array(z)
step=24
x,y=(int(math.floor(min(p[d] for p in ring)/step)-1)*step for d in range(2))
mx,my=(int(math.ceil(max(p[d] for p in ring)/step)+1)*step for d in range(2))
xx,yy=np.meshgrid(np.arange(x,mx+1,step),np.arange(y,my+1,step))
dist,ix=cKDTree(geo_points[:,:2]).query(np.c_[xx.ravel(),yy.ravel()],k=14)
weight=(dist**2+13**2)**-1.6
field=gaussian_filter((np.sum(weight*geo_points[ix,2],axis=1)/weight.sum(axis=1)).reshape(xx.shape),1.02,mode='nearest')
relief={'x':x,'y':y,'cols':xx.shape[1],'rows':xx.shape[0],'step':step,'values':np.round(field.ravel(),1).tolist()}
axis=[list(geo.project(*p)) for p in [(2.987,49.581),(3.002,49.581),(3.030,49.573),(3.065,49.559)]]
meta=dict(world='enfer',source='IGN • BD TOPO®',attribution='© IGN, BD TOPO® · Licence Ouverte 2.0',
  url='https://www.ign.fr/geoservices/bd-topo',license='https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
  extracted=datetime.now(timezone.utc).date().isoformat(),projection='XY en mètres. Origine 3° E, 49.58° N.',
  axis=axis,mapAxis=axis,boundary=ring, observedHeight=observed,estimatedHeight=len(buildings)-observed,
  counts=dict(buildings=len(buildings),streets=len(streets),water=len(water),green=len(green)))
bundle=dict(metadata=meta,buildings=buildings,streets=streets,water=water,green=green,relief=relief)
raw=json.dumps(bundle,separators=(',',':'),ensure_ascii=False).encode()
(root/'public'/'map-enfer.gz').write_bytes(gzip.compress(raw,compresslevel=7,mtime=0))
print('packaged',meta['counts'],'heights',observed,'grid',xx.shape,flush=True)
