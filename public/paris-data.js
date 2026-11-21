import {selectedWorld} from './world-link.js';
import {selectBridgeDecks} from './enfer-bridges.js';
import {selectSectorTerrain,selectRiverbanks,baseTerrainHeight} from './terrain-height.js';
import {bundledSectors} from './sector-crossing.js';
import {readMapArchive} from './map-archive.js';
import {commercialBuildings} from './enfer-retail.js';
import {railStationBuildings} from './enfer-rail.js';
async function readPreset(key) {
  const d=await readMapArchive(key);
  return {
    metadata:key==='enfer'?d.metadata:{...d.metadata,sector:{...d.metadata.sector,preset:key}},
    relief:d.relief,
    buildings:d.buildings.map(([id,poly,h,kind,holes,observed])=>({id,poly,h,kind,holes:holes||[],observedHeight:!!observed})),
    streets:d.streets.map(([id,path,w,kind,name,level,oneway=0,deck])=>({id,path,w,kind,name,level,bridge:level>0,oneway,deck})),
    water:d.water.map(([poly,holes,elevation,kind])=>({poly,holes,elevation,kind})),
    green:d.green.map(([poly,holes,kind])=>({poly,holes,kind}))
  };
}
async function loadData(lon,lat,name){
  if(!Number.isFinite(lon)||!Number.isFinite(lat))throw Error('Coordonnées géographiques invalides.');
  const preset=bundledSectors.find(p=>Math.abs(p.lon-lon)<.00002&&Math.abs(p.lat-lat)<.00002);
  if(preset && typeof DecompressionStream!=='undefined'){
    try{return await readPreset(preset.key);}catch{/* A live IGN extraction can replace a missing archive. */}
  }
  const {loadSector}=await import('./paris-sector.js');
  return loadSector(lon,lat,name);
}
export async function preloadTravelSector({key,lon,lat,name}){
  if(key==='core'){
    // Warm the static module without changing the current terrain.
    await import('./paris-core.js');
    return;
  }
  await loadData(lon,lat,name);
}
async function selectData(){
  const q=typeof location==='undefined'?null:new URLSearchParams(location.search);
  if(q&&selectedWorld(location.href||'https://maille.test/'+location.search)==='enfer')return readPreset('enfer');
  if(!q?.has('lon')||!q.has('lat'))return import('./paris-core.js');
  const lon=Number(q.get('lon')),lat=Number(q.get('lat'));
  const name=String(q.get('lieu')||'Grand Paris').slice(0,70);
  const info=typeof document==='undefined'?null:document.getElementById('loadingText');
  if(info)info.textContent='Chargement de '+name+'…';
  return loadData(lon,lat,name);
}
const data=await selectData();
selectSectorTerrain(data.relief);
export const {buildings,streets,water,green,metadata}=data;
export const isEnfer=metadata.world==='enfer';
export const enclosureRows=isEnfer?(await import('./enfer-enclosures.js')).enclosureRows:[];
if(isEnfer){
  buildings.push(...commercialBuildings,...railStationBuildings);
  selectRiverbanks(water);
  selectBridgeDecks(streets,water,baseTerrainHeight);
}
