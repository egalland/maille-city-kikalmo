// World coordinates and heights are metres. XY are east/south. Source: IGN BD TOPO road Z.
import {bridgeGround,bridgeDeckHeight,roadGround} from './enfer-bridges.js';
import {riverbanks} from './riverbanks.js';
import {grid,waterLevels} from './paris-heights.js';
import {auchanFront,auchanGrade} from './auchan-layout.js';
import {containsPoint} from './collision-ring.js';

const bytes=Uint8Array.from(atob(grid.data),char=>char.charCodeAt(0));
const data=new DataView(bytes.buffer);
const packaged={...grid,values:Float32Array.from({length:bytes.length/2},(_,i)=>data.getInt16(i*2,true)/10)};
let surface=packaged,buildingBases=new WeakMap(),shoreGround=null,auchanFloor=null,auchanFootprint=null;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));

function surveyHeight(x,y){
  const {cols,rows,step,values}=surface;
  const u=clamp((x-surface.x)/step,0,cols-1),v=clamp((y-surface.y)/step,0,rows-1);
  const i=Math.floor(u),j=Math.floor(v),t=u-i,s=v-j;
  const i0=Math.max(0,i-1),i2=Math.min(cols-1,i+1),i3=Math.min(cols-1,i+2);
  const row=k=>{const n=k*cols;return cubic(values[n+i0],values[n+i],values[n+i2],values[n+i3],t);};
  return cubic(row(Math.max(0,j-1)),row(j),row(Math.min(rows-1,j+1)),row(Math.min(rows-1,j+2)),s);
}
const rawGround=(x,y)=>shoreGround?shoreGround(x,y):surveyHeight(x,y);
export function baseTerrainHeight(x,y){
  const raw=rawGround(x,y);
  if(auchanFloor===null)return raw;
  const apron=auchanGrade(x,y,raw,auchanFloor);
  const f=auchanFootprint;
  if(!f||x<f.minX||x>f.maxX||y<f.minY||y>f.maxY)return apron;
  if(containsPoint(x,y,f.poly))return auchanFloor;
  // Keep the exterior hill and bury the rear wall, with a narrow transition
  // outside the footprint so the terrain mesh cannot cross the shop floor.
  let distance=5;
  for(let i=0;i<f.poly.length;i++){
    const [ax,ay]=f.poly[i],[bx,by]=f.poly[(i+1)%f.poly.length],dx=bx-ax,dy=by-ay;
    const t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  const weight=clamp((distance-1.2)/3.8,0,1);
  return auchanFloor+(apron-auchanFloor)*weight*weight*(3-2*weight);
}
export function selectAuchanGrade(poly){
  auchanFloor=rawGround(auchanFront.x,auchanFront.y);
  auchanFootprint=poly?{poly,minX:Math.min(...poly.map(p=>p[0]))-5,maxX:Math.max(...poly.map(p=>p[0]))+5,
    minY:Math.min(...poly.map(p=>p[1]))-5,maxY:Math.max(...poly.map(p=>p[1]))+5}:null;
  return auchanFloor;
}
export function selectRiverbanks(waters){shoreGround=waters?.length?riverbanks(waters,surveyHeight,waterLevel).ground:null;}
export function terrainHeight(x,y,heading,previousHeight){return bridgeGround(x,y,baseTerrainHeight(x,y),heading,previousHeight);}
export function aircraftDeck(x,y){return bridgeDeckHeight(x,y,baseTerrainHeight(x,y));}
export function roadHeight(road,index,x,y){return roadGround(road,index,x,y,baseTerrainHeight(x,y));}
export function terrainGradient(x,y,heading){
  const h=Number.isFinite(heading)?terrainHeight(x,y,heading):undefined;
  return {x:(terrainHeight(x+1,y,heading,h)-terrainHeight(x-1,y,heading,h))*.5,y:(terrainHeight(x,y+1,heading,h)-terrainHeight(x,y-1,heading,h))*.5};
}

// A level roof uses the same origin for rendering and traversal, including unusually long buildings.
export function buildingGround(poly){
  if(buildingBases.has(poly))return buildingBases.get(poly);
  const n=poly.length;let x=0,y=0;
  for(const point of poly){x+=point[0];y+=point[1];}
  const base=baseTerrainHeight(x/n,y/n);buildingBases.set(poly,base);return base;
}
export function selectSectorTerrain(field){
  buildingBases=new WeakMap();shoreGround=null;auchanFloor=null;auchanFootprint=null;
  if(field&&field.values?.length===field.cols*field.rows)surface=field;
  else surface=packaged;
}

// On-demand districts arrive as 3D WFS polylines. Accumulate their height samples in
// a small metric lattice while the feature collection is still available, then cache it.
export function sectorHeightGrid(lines,bounds){
  const step=32,x=Math.floor(bounds[0]/step)*step-step,y=Math.floor(bounds[1]/step)*step-step;
  const cols=Math.ceil((bounds[2]-x)/step)+2,rows=Math.ceil((bounds[3]-y)/step)+2;
  const length=cols*rows,sums=new Float64Array(length),weights=new Float64Array(length);
  for(const line of lines)for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i];
    if(!Number.isFinite(a[2]+b[2])||Math.min(a[2],b[2])<5||Math.max(a[2],b[2])>260)continue;
    const dx=(b[0]-a[0])*73190,dy=(a[1]-b[1])*111320,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/14));
    for(let j=0;j<=n;j++){
      const t=j/n,u=((a[0]-2.25)*73190+dx*t-x)/step,v=((48.88-a[1])*111320+dy*t-y)/step;
      const z=a[2]+(b[2]-a[2])*t;
      for(let iy=Math.max(0,Math.floor(v)-4);iy<=Math.min(rows-1,Math.ceil(v)+4);iy++){
        for(let ix=Math.max(0,Math.floor(u)-4);ix<=Math.min(cols-1,Math.ceil(u)+4);ix++){
          const d2=(ix-u)**2+(iy-v)**2,w=Math.exp(-d2*.33),k=ix+cols*iy;
          sums[k]+=w*z;weights[k]+=w;
        }
      }
    }
  }
  const values=Array(length),nearest=[],missing=[];
  for(let i=0;i<length;i++){
    if(weights[i]>.001){values[i]=Math.round(10*sums[i]/weights[i])/10;nearest.push(i);}
    else missing.push(i);
  }
  if(!nearest.length)return null;
  for(const i of missing){
    let best=nearest[0],dist=Infinity;
    for(const q of nearest){const d=(q%cols-i%cols)**2+(Math.floor(q/cols)-Math.floor(i/cols))**2;if(d<dist){best=q;dist=d;}}
    values[i]=values[best];
  }
  return {x,y,cols,rows,step,values};
}

// Water is level at the 3D shoreline's median elevation, independent of its bridge deck.
// Legacy offline outlines without an elevation use the nearby shore as an estimate.
export function waterLevel(w){
  const measured=w.elevation??waterLevels[w.poly[0].join(',')];
  if(Number.isFinite(measured))return measured;
  let low=Infinity,left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const [x,y] of w.poly){low=Math.min(low,surveyHeight(x,y));left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return Math.max(right-left,bottom-top)>650?Math.min(low-1.5,25.7+(left+right)*.0001):low-.45;
}

export function walkingPose(e){
  if(Number.isFinite(e.slope)||!e.moving)return e;
  const slope=terrainGradient(e.x,e.y,e.angle),angle=e.angle||0;
  return {...e,slope:slope.x*Math.cos(angle)+slope.y*Math.sin(angle)};
}
