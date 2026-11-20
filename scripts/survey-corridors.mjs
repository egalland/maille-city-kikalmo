// Choose shared itineraries along the surveyed IGN lanes. Outside trips enter/leave
// at the map edge. Internal trips close via legal intersections, never a mid-road U-turn.
import {readFile,writeFile} from 'node:fs/promises';
import {makeRoadGraph,corridorSection,corridorTurn} from '../public/traffic-roads.js';
import {enferDistrict} from '../public/enfer-places.js';
globalThis.location=new URL('https://maille.test/');
globalThis.fetch=async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url)));
const {streets,metadata}=await import('../public/paris-data.js');
const {trafficSurveyBlocked,parkedCars,vehicleContactNormal,coreDestinations}=await import('../public/paris-world.js');
const {vehicleSpec}=await import('../public/vehicle-types.js');
const length=path=>path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-path[i][0],p[1]-path[i][1]),0);
const records=streets.map(road=>({id:String(road.id),road,path:road.path,length:length(road.path)}));
const {directions,nodes}=makeRoadGraph(records,true);
const bounds=metadata.boundary,west=Math.min(...bounds.map(a=>a[0])),east=Math.max(...bounds.map(a=>a[0])),north=Math.min(...bounds.map(a=>a[1])),south=Math.max(...bounds.map(a=>a[1]));
const border=([x,y])=>Math.min(x-west,east-x,y-north,south-y)<1;
const parked=new Map(),key=(x,y)=>Math.floor(x/40)+4096*Math.floor(y/40);
for(const p of parkedCars){
  const spec=vehicleSpec(p.type),hull={...p,halfLength:spec.halfLength+.82,halfWidth:spec.halfWidth+.49};
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
    const k=key(p.x+a*40,p.y+b*40);if(!parked.has(k))parked.set(k,[]);parked.get(k).push(hull);
  }
}
const light={halfLength:2.37,halfWidth:1.02},heavy={halfLength:3.74,halfWidth:1.22};
function clearance(points,spec){
  for(let i=1;i<points.length;i++){
    const [ax,ay]=points[i-1],[bx,by]=points[i],dx=bx-ax,dy=by-ay,dist=Math.hypot(dx,dy);
    const count=Math.max(1,Math.ceil(dist/12)),angle=Math.atan2(dy,dx),shape={angle,halfWidth:spec.halfWidth+.10,halfLength:spec.halfLength+.18+dist/(2*count)};
    for(let j=0;j<count;j++){
      const mix=(j+.5)/count,x=ax+mix*dx,y=ay+mix*dy;
      if(trafficSurveyBlocked(x,y,shape))return false;
      for(const p of parked.get(key(x,y))||[])if(vehicleContactNormal({x,y,...shape},p)[2]<.12)return false;
    }
  }
  return true;
}
const oldTown=coreDestinations[0];
const edges=[...directions.values()].flat(),terminals=[...nodes.values()].filter(n=>border(n.point));
for(const e of edges){
  const {road}=e.record;e.section=corridorSection(e);e.use=0;e.turns=new Map();
  e.weight=road.kind==='residential'?1.6:road.kind==='secondary'?1.07:.86;
  const p=road.path[road.path.length>>1];
  e.value=e.record.length*(road.kind==='residential'?.22:1)*(enferDistrict(...p)==='Vallée des Aulnes'?1.6:.83);
  // Through services follow the boulevards around the old town. Local trips
  // already serve the narrow shopping lanes and the medieval market streets.
  const localStreet=road.w<6&&['residential','secondary'].includes(road.kind)&&
    road.path.some(([x,y])=>Math.hypot(x-oldTown.x,y-oldTown.y)<365);
  e.capacity=!localStreet&&clearance(e.section.points,light)?1:0;
  if(e.capacity&&(road.oneway||road.w>=4.82)&&clearance(e.section.points,heavy))e.capacity=2;
}
function canTurn(a,b,capacity){
  if(b.capacity<capacity||a.record===b.record)return false;
  if(!a.turns.has(b)){
    const p=corridorTurn(a,b);
    const cap=p.length&&clearance(p,light)?(a.capacity===2&&b.capacity===2&&clearance(p,heavy)?2:1):0;
    a.turns.set(b,cap);
  }
  return a.turns.get(b)>=capacity;
}
// Small binary min-heap for successive shortest paths under lane capacity limits.
function add(heap,entry){let i=heap.length;heap.push(entry);while(i){const p=(i-1)>>1;if(heap[p].cost<=entry.cost)break;heap[i]=heap[p];i=p;}heap[i]=entry;}
function pop(heap){
  const root=heap[0],end=heap.pop();if(!heap.length)return root;
  let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=end.cost)break;heap[i]=heap[c];i=c;}heap[i]=end;return root;
}
const limit=3,itineraries=[];
function search(first,capacity,cycle){
  let best;const seen=new Map(),queue=[];
  const starts=cycle?[first]:first.out.filter(e=>e.capacity>=capacity&&e.use<limit);
  for(const e of starts){add(queue,{e,cost:e.record.length,prev:null});seen.set(e,e.record.length);}
  while(queue.length){
    const state=pop(queue),{e,cost}=state;if(cost!==seen.get(e))continue;
    if(cycle?e.to===first.from&&canTurn(e,first,capacity):border(e.to.point)&&e.to!==first){
      const path=[];for(let s=state;s;s=s.prev)path.push(s.e);path.reverse();
      const metres=path.reduce((n,v)=>n+v.record.length,0);
      const fresh=path.reduce((n,v)=>n+(!v.use?v.value:0),0);
      if(fresh>180&&metres>(cycle?450:850)){
        const score=fresh/Math.sqrt(metres);
        if(!best||score>best.score)best={path,score,metres};
      }
      if(cycle)return best;
      continue;
    }
    for(const next of e.to.out){
      if(next.use>=limit||!canTurn(e,next,capacity)||(cycle&&next.record===first.record))continue;
      const bend=1-Math.cos(e.endAngle-next.startAngle);
      const total=cost+next.record.length*next.weight*(1+next.use*1.4)+bend*20;
      if(total>75000||total>=(seen.get(next)??Infinity))continue;
      seen.set(next,total);add(queue,{e:next,cost:total,prev:state});
    }
  }
  return best;
}
function book(trip,capacity){
  if(!trip)return false;
  trip.path.forEach(e=>e.use++);
  // Freight shares the road with other civil vehicles. The numbers are metres
  // between unslowed vehicles on this service, not allocated agents per region.
  itineraries.push([capacity,trip.path.map(e=>e.tag),capacity===2?176:194]);return true;
}
for(const cap of [2,1,2,1])for(const n of terminals)book(search(n,cap,false),cap);
for(const cap of [2,1]){
  const candidates=edges.filter(e=>e.capacity>=cap&&e.value>110).sort((a,b)=>b.value-a.value||a.tag.localeCompare(b.tag));
  for(const e of candidates)if(!e.use)book(search(e,cap,true),cap);
}
const source='// Directed road identifiers surveyed by scripts/survey-corridors.mjs.\nexport const corridorPlans=[\n  '+itineraries.map(a=>JSON.stringify(a)).join(',\n  ')+'\n];\n';
await writeFile(new URL('../public/enfer-corridors.js',import.meta.url),source);
console.log(itineraries.length+' services, '+itineraries.filter(([cap])=>cap===2).length+' truck-capable, '+new Set(edges.filter(e=>e.use).map(e=>e.record.id)).size+' shared road sections.');
