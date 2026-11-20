// Bake usable kerbside spaces once. All clients load the same positions and the
// game never has to search thousands of street/building polygons on startup.
import {readFile,writeFile} from 'node:fs/promises';
import {vehicleSpec,vehicleDoorways} from '../public/vehicle-types.js';
import {careerPlaces} from '../public/career-catalog.js';
import {airfields} from '../public/airfield.js';
globalThis.location=new URL('https://maille.test/');
globalThis.fetch=async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url)));
const {streets,buildings}=await import('../public/paris-data.js');
const {terrainHeight}=await import('../public/terrain-height.js');
const {parkedCars,coreDestinations,clearsTrafficAtRest,contactAt,nearbySignals,streetAt}=await import('../public/paris-world.js');

const sqDistance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
function grid(){
  const cells=new Map();
  const keys=(x0,y0,x1,y1,fn)=>{
    for(let x=Math.floor(x0/50);x<=Math.floor(x1/50);x++)for(let y=Math.floor(y0/50);y<=Math.floor(y1/50);y++)fn(x+':'+y);
  };
  return {
    insert(x0,y0,x1,y1,value){keys(x0,y0,x1,y1,k=>{if(!cells.has(k))cells.set(k,[]);cells.get(k).push(value);});},
    near(x,y,r){const result=new Set();keys(x-r,y-r,x+r,y+r,k=>cells.get(k)?.forEach(v=>result.add(v)));return result;}
  };
}
const homes=grid(),roadways=grid();
for(const b of buildings){
  if(!['residential','commercial','mixed'].includes(b.kind))continue;
  for(const [x,y] of b.poly)homes.insert(x,y,x,y,b);
}
const seeds=[];
for(const road of streets)for(let i=1;i<road.path.length;i++){
  const [ax,ay]=road.path[i-1],[bx,by]=road.path[i],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
  if(len<.1)continue;
  const seg={ax,ay,dx,dy,len,road};
  roadways.insert(Math.min(ax,bx),Math.min(ay,by),Math.max(ax,bx),Math.max(ay,by),seg);
  if(road.level!==0||!['secondary','residential'].includes(road.kind)||len<20)continue;
  const n=Math.max(1,Math.floor(len/38));
  for(let j=0;j<n;j++){
    const key=road.id+'-'+i+'-'+j,t=(j+.5)/n;
    seeds.push({key,rank:hash(key),x:ax+t*dx,y:ay+t*dy,angle:Math.atan2(dy,dx),road});
  }
}
function segmentDistance(x,y,{ax,ay,dx,dy,len}){
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(len*len)));
  return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}
const landmarks=[...Object.values(careerPlaces),...airfields,...coreDestinations,...parkedCars.filter(p=>!p.bay)];
const used=[],fleet=['compact','sedan','estate','scooter','car','compact','pickup','van','motorbike','taxi'];
const colors=['#7bafb0','#b2625d','#d1b28b','#748fa5','#72948a','#b68391','#b8a074','#9eabba'];
function findSpace(seed,type){
  if(used.some(p=>sqDistance(seed,p)<112**2)||landmarks.some(p=>sqDistance(seed,p)<18**2))return;
  if([...homes.near(seed.x,seed.y,40)].filter(b=>b.poly.some(([x,y])=>(x-seed.x)**2+(y-seed.y)**2<40**2)).length<2)return;
  if(nearbySignals(seed.x,seed.y,20).length)return;
  const {halfLength,halfWidth}=vehicleSpec(type);
  const neighbours=[...roadways.near(seed.x,seed.y,24)].filter(n=>n.road!==seed.road);
  if(neighbours.some(n=>segmentDistance(seed.x,seed.y,n)<n.road.w/2+10))return;
  const preferred=seed.road.oneway?Math.sign(seed.road.oneway):((seed.rank&8)?1:-1);
  const curb=seed.road.w/2,pavement=Math.min(3,seed.road.w*.30);
  const offsets=[];
  if(seed.road.w>=(seed.road.oneway?5.8:8.6))offsets.push([curb-halfWidth-.15,'curb']);
  // Narrow streets keep both traffic lanes and their walkway. Use a short
  // driveway apron in the clear setback beyond the pavement.
  offsets.push([curb+pavement+halfWidth+.44,'apron']);
  for(const [offset,bay] of offsets)for(const side of seed.road.oneway?[preferred]:[preferred,-preferred]){
    const c=Math.cos(seed.angle),s=Math.sin(seed.angle),x=seed.x-s*side*offset,y=seed.y+c*side*offset;
    const angle=seed.angle+(side<0?Math.PI:0),p={x,y,angle,type};
    if(neighbours.some(n=>segmentDistance(x,y,n)<halfLength+n.road.w/2+1))continue;
    if(contactAt(x,y,{angle,halfWidth:halfWidth+.45,halfLength:halfLength+.68}))continue;
    if(!vehicleDoorways(p,.82).every(d=>!contactAt(d.x,d.y,{radius:.44})))continue;
    let clear=true;
    for(let a=0;a<=offset+.1;a+=.5){
      const at=Math.min(a,offset);
      if(contactAt(seed.x-s*side*at,seed.y+c*side*at,{angle,halfLength:halfLength+.2,halfWidth:.36})){clear=false;break;}
    }
    if(!clear||!clearsTrafficAtRest(p,type))continue;
    const slope=Math.max(...[-1,1].map(d=>Math.abs(terrainHeight(x+c*d*halfLength,y+s*d*halfLength)-terrainHeight(x,y))/halfLength));
    if(slope>.11||Math.abs(terrainHeight(seed.x,seed.y)-terrainHeight(x,y))>.42)continue;
    return {...p,x:+x.toFixed(3),y:+y.toFixed(3),angle:+angle.toFixed(5),id:'park-'+seed.key,bay,color:colors[(seed.rank>>>9)%colors.length]};
  }
}
for(const [type,at,color] of [['gt',careerPlaces.garage,'#8d4b59'],['supercar',careerPlaces.quay,'#43958e']]){
  const near=seeds.filter(s=>sqDistance(s,at)<280**2).sort((a,b)=>sqDistance(a,at)-sqDistance(b,at)||a.rank-b.rank);
  let space;
  for(const s of near){space=findSpace(s,type);if(space)break;}
  if(!space)throw Error('No accessible parking near '+at.name);
  used.push({...space,color});
  console.log(type,streetAt(space.x,space.y),Math.round(Math.sqrt(sqDistance(space,at)))+' m de '+at.name);
}
for(const s of seeds.sort((a,b)=>a.rank-b.rank)){
  if(used.length>=160)break;
  const p=findSpace(s,fleet[(s.rank>>>8)%fleet.length]);if(p)used.push(p);
}
const rows=used.map(({id,x,y,angle,type,color,bay})=>JSON.stringify([id,x,y,angle,type,color,bay]));
await writeFile(new URL('../public/street-parking.js',import.meta.url),'// Surveyed in scripts/survey-parking.mjs. Coordinates in metres; angle in radians.\nexport const streetParking=[\n  '+rows.join(',\n  ')+'\n];\n');
console.log(used.length+' places');
