// Build longitudinal profiles on the surveyed road network. XY and chainage are metres.
const cellSize=32,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
const key=(x,y)=>Math.floor(x/cellSize)+4096*Math.floor(y/cellSize);
const cells=new Map(),nearbyRoads=new Map();
let profiles=new WeakMap();

function visitCells(a,b,r,visit){
  for(let x=Math.floor((Math.min(a[0],b[0])-r)/cellSize);x<=Math.floor((Math.max(a[0],b[0])+r)/cellSize);x++)
    for(let y=Math.floor((Math.min(a[1],b[1])-r)/cellSize);y<=Math.floor((Math.max(a[1],b[1])+r)/cellSize);y++)visit(x+4096*y);
}
function insert(map,id,value){
  if(!map.has(id))map.set(id,[]);
  map.get(id).push(value);
}
function inside(x,y,ring){
  let yes=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
}
function section(a,b,start,profile){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  return {a,b,x:dx/(length||1),y:dy/(length||1),length,start,profile};
}
function projection(s,x,y){
  return clamp((x-s.a[0])*s.x+(y-s.a[1])*s.y,0,s.length);
}
function profileFor(road){
  let p=profiles.get(road);
  if(p)return p;
  p={length:0,sections:[],approaches:[],width:road.w*.5+Math.min(3,road.w*.3)};
  for(let i=1;i<road.path.length;i++){
    const s=section(road.path[i-1],road.path[i],p.length,p);
    p.sections.push(s);p.length+=s.length;
  }
  profiles.set(road,p);
  return p;
}

function approachFor(profile,anchor){
  let link=profile.approaches.find(r=>r.anchor===anchor);
  if(!link){link={anchor,fromStart:Infinity,fromEnd:Infinity};profile.approaches.push(link);}
  return link;
}
function approachDistance(p,r,start,end=start){
  const fromPin=r.station==null?Infinity:Math.max(0,start-r.station,r.station-end);
  return Math.min(r.fromStart+start,r.fromEnd+p.length-end,fromPin);
}

export function selectBridgeDecks(streets,water,ground){
  cells.clear();nearbyRoads.clear();profiles=new WeakMap();
  const links=new Map(),anchors=new Map(),decks=streets.filter(s=>s.bridge&&s.path.length>1);
  const wet=water.map(w=>({w,minX:Math.min(...w.poly.map(p=>p[0])),maxX:Math.max(...w.poly.map(p=>p[0])),
    minY:Math.min(...w.poly.map(p=>p[1])),maxY:Math.max(...w.poly.map(p=>p[1]))}));
  for(const road of streets){
    if(road.path.length<2)continue;
    insert(links,road.path[0].join(),{road,reverse:false});
    insert(links,road.path.at(-1).join(),{road,reverse:true});
  }
  const used=new Set();
  for(const road of decks){
    const p=profileFor(road);
    let waterFloor=-Infinity;
    for(const s of p.sections){
      const steps=Math.max(1,Math.ceil(s.length/5));
      for(let i=0;i<=steps;i++){
        const d=i*s.length/steps,x=s.a[0]+s.x*d,y=s.a[1]+s.y*d;
        for(const {w,minX,maxX,minY,maxY} of wet)
          if(Number.isFinite(w.elevation)&&x>=minX&&x<=maxX&&y>=minY&&y<=maxY&&inside(x,y,w.poly)&&!w.holes?.some(h=>inside(x,y,h)))waterFloor=Math.max(waterFloor,w.elevation+2.4);
      }
    }
    p.ends=[road.path[0],road.path.at(-1)].map(point=>{
      const [x,y]=point,id=point.join();
      let dist=Infinity,survey=-Infinity;
      for(const [u,v,z] of road.deck||[]){
        const delta=Math.hypot(u-x,v-y);
        if(delta<dist){survey=z;dist=delta;}
      }
      let anchor=anchors.get(id);
      if(!anchor){anchor={id,point,z:-Infinity};anchors.set(id,anchor);}
      anchor.z=Math.max(anchor.z,ground(x,y),waterFloor,survey);
      return anchor;
    });
    used.add(p);
  }
  // Relief is a coarse raster and sometimes includes part of the overpass in the
  // ground below it. Preserve a usable opening where surveyed road lines cross.
  const upperCells=new Map(),intersections=[];
  for(const p of used)for(const s of p.sections)visitCells(s.a,s.b,0,id=>insert(upperCells,id,s));
  for(const road of streets){
    if(road.bridge)continue;
    for(let i=1;i<road.path.length;i++){
      const a=road.path[i-1],b=road.path[i],dx=b[0]-a[0],dy=b[1]-a[1],seen=new Set();
      visitCells(a,b,0,id=>{
        for(const s of upperCells.get(id)||[]){
          if(seen.has(s))continue;
          seen.add(s);
          const den=dx*s.y-dy*s.x;
          if(Math.abs(den)<.001)continue;
          const rx=s.a[0]-a[0],ry=s.a[1]-a[1],t=(rx*s.y-ry*s.x)/den,u=(rx*dy-ry*dx)/den;
          if(t<.00001||t>.99999||u<.001||u>s.length-.001)continue;
          const floor=ground(a[0]+dx*t,a[1]+dy*t),clearance=road.kind==='path'?2.65:4.35;
          intersections.push({upper:s,station:s.start+u,road,index:i-1,t,floor,clearance});
        }
      });
    }
  }
  const raises=new Map();
  for(const {upper,station,floor,clearance} of intersections){
    const raise=floor+clearance-heightAt(upper.profile,station,floor);
    if(raise>.001)for(const end of upper.profile.ends)raises.set(end,Math.max(raise,raises.get(end)||0));
  }
  for(const [anchor,raise] of raises)anchor.z+=raise;
  for(const a of anchors.values())a.reach=clamp(20+Math.abs(a.z-ground(...a.point))*14,24,100);
  // Pin the lower lane to its own ground. Otherwise a nearby ramp could rise back
  // through its deck where a towpath loops around to meet the main road.
  for(const {road,index,t} of intersections){
    const p=profileFor(road),s=p.sections[index],station=s.start+s.length*t;
    const anchor={lower:true,reach:80};
    approachFor(p,anchor).station=station;used.add(p);anchors.set(anchor,anchor);
    anchor.starts=[[road.path[0].join(),station],[road.path.at(-1).join(),p.length-station]];
  }
  // Walk both ends along actual bends, continuing through junctions and short road records.
  // A terminal at the boundary of an extract has no outgoing geometry to follow.
  for(const anchor of anchors.values()){
    const distances=new Map(anchor.starts||[[anchor.id,0]]),pending=[...distances.keys()];
    while(pending.length){
      const id=pending.pop(),distance=distances.get(id);
      for(const {road,reverse} of links.get(id)||[]){
        if(road.bridge)continue;
        const p=profileFor(road),far=road.path[reverse?0:road.path.length-1].join();
        const ramp=approachFor(p,anchor),direction=reverse?'fromEnd':'fromStart';
        ramp[direction]=Math.min(ramp[direction],distance);
        used.add(p);
        const next=distance+p.length;
        if(next<anchor.reach&&next<(distances.get(far)??Infinity)){distances.set(far,next);pending.push(far);}
      }
    }
    if(links.get(anchor.id)?.length===1){
      const {road,reverse}=links.get(anchor.id)[0],p=profileFor(road);
      const reach=58,edge=reverse?p.sections.at(-1):p.sections[0],sign=reverse?1:-1,[x,y]=anchor.point;
      const stub={w:road.w,path:[[x,y],[x+sign*edge.x*reach,y+sign*edge.y*reach]]};
      const q=profileFor(stub),ramp=approachFor(q,anchor);
      ramp.fromStart=0;ramp.limit=reach;used.add(q);
    }
  }
  for(const p of used)for(const s of p.sections){
    if(!s.length||(!p.ends&&!p.approaches.some(r=>approachDistance(p,r,s.start,s.start+s.length)<Math.min(r.limit??Infinity,r.anchor.reach))))continue;
    s.active=true;
    visitCells(s.a,s.b,p.width+2,id=>insert(cells,id,s));
  }
  // Add ordinary roads only to already affected cells. At a stacked crossing the two
  // alignments identify the correct floor for traffic, including travel in reverse.
  for(const road of streets){
    const p=profiles.get(road);
    for(let i=1;i<road.path.length;i++){
      if(p?.sections[i-1].active)continue;
      const a=road.path[i-1],b=road.path[i],width=road.w*.5+Math.min(3,road.w*.3);
      let s;
      visitCells(a,b,width+2,id=>{
        if(!cells.has(id))return;
        s??=section(a,b,0,{width,approaches:[]});
        insert(nearbyRoads,id,s);
      });
    }
  }
}
function heightAt(p,station,base){
  if(p.ends){
    const [a,b]=p.ends;
    return a.z+(b.z-a.z)*smooth(clamp(station/(p.length||1),0,1));
  }
  let weighted=0,total=0;
  for(const r of p.approaches){
    const d=approachDistance(p,r,station);
    const reach=Math.min(r.limit??Infinity,r.anchor.reach);
    if(d>=reach)continue;
    const z=r.anchor.lower?base:r.anchor.z;
    if(d<.001)return z;
    const fade=smooth(d/reach),weight=(1-fade)/fade;
    weighted+=z*weight;total+=weight;
  }
  return (base+weighted)/(1+total);
}
// Geometry carries its road identity even if two streets occupy the same XY position.
export function gradedRoad(road,index){return !!profiles.get(road)?.sections[index]?.active;}
export function roadGround(road,index,x,y,base){
  const s=profiles.get(road)?.sections[index];
  return s?.active?heightAt(s.profile,s.start+projection(s,x,y),base):base;
}
export function bridgeGround(x,y,base,heading,previousHeight){
  const id=key(x,y),here=cells.get(id);
  if(!here)return base;
  const oriented=Number.isFinite(heading),ux=oriented?Math.cos(heading):0,uy=oriented?Math.sin(heading):0;
  let best=Infinity,height=base;
  function consider(s){
    const t=projection(s,x,y),distance=Math.hypot(x-s.a[0]-s.x*t,y-s.a[1]-s.y*t);
    const margin=distance-s.profile.width;
    if(margin>=2)return;
    // A steering or lane offset must not move a car onto a transverse road above it.
    const alignment=oriented?Math.abs(ux*s.x+uy*s.y):1;
    const z=s.active?heightAt(s.profile,s.start+t,base):base;
    const level=base+(z-base)*(1-smooth(clamp(margin/2,0,1)));
    const continuity=Number.isFinite(previousHeight)?Math.min(12,Math.abs(level-previousHeight))*3:0;
    const cost=distance+(1-alignment)*24+continuity;
    if(cost<best){best=cost;height=level;}
  }
  for(const s of here)consider(s);
  if(oriented)for(const s of nearbyRoads.get(id)||[])consider(s);
  return height;
}
