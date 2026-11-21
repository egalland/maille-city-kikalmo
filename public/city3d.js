import {heritageByFootprint,heritagePlinth} from './enfer-heritage.js';
import {heritageModel} from './heritage-models.js';
import {lampState,pedestrianGreen} from './street-signals.js';
import {streetFurniture} from './street-furniture.js';
import {drawBoundary} from './residential-boundaries.js';
import {vehicleSpec} from './vehicle-types.js';
import {nearbySignals,nearbyEnclosures,nearbyParkedCars,railCrossings} from './paris-world.js';
import {pavementRuns} from './curb-clearance.js';
import {frontageSigns,frontageStyle,namedFronts,montRenaudPaving,montRenaudPoint} from './enfer-frontage.js';
import {railXY,railSections,railStations,railSpacing,railGaugeOffsets,railwayPlatformOffset,railwayPlatformLength} from './enfer-rail.js';
import {parkingLots,lotPoint,parkingWidth,parkingDepth,parkingMarkings,parkingSign,parkingDriveways} from './enfer-parking-lots.js';
import {workshopId,workshopEdge,bayDoor,headroom} from './workshop.js';
import {storeByBuilding,shopHeadroom,shopOpening,shopFixture} from './enfer-retail.js';
import {drawStreetTree} from './street-trees.js';
import {cityViewRange,streetViewRange} from './view-range.js';
import {streetFabric} from './street-fabric.js';
import {feltSlate as slates,shopCloths as stripMaterials} from './paris-applique.js';
import {cityClimate} from './city-climate.js';
import {gradedRoad} from './enfer-bridges.js';
import {terrainHeight,baseTerrainHeight,roadHeight,buildingGround,waterLevel} from './terrain-height.js';
import {terracePanels} from './street-terraces.js';
import {propWearProfile,propWearStage,trackPropWear} from './prop-wear.js';
import * as T from './three.js';
import * as source from './paris-data.js';
const {buildings,streets,water,isEnfer}=source;
import {enferStyle,enferStyles,enferRoof,roofPitch} from './enfer-architecture.js';
import {cityMaterials} from './city-materials.js';
import {famousLandmark,parisLandmarks} from './city-landmarks.js';
const specialParisIds=new Set(parisLandmarks.flatMap(item=>item.ids));

const arc={x:3296.7,z:693.2,yaw:1.126};
const grande={x:-1034.4,z:-1399.0,yaw:1.019};
const tau=Math.PI*2, white='#ffffff';
const stones=['#fffbef','#ffe8cc','#f9eedd','#ffeddd','#f4e6cf','#f8eae0','#fff6e5','#ecdfd8'];
const masonry=[ '#ead5ad','#d9bc9d','#f5e1b9','#b39183','#997e80' ];
const materialColors=new Map();
function color(val){
  if(!materialColors.has(val))materialColors.set(val,new T.Color(val));
  return materialColors.get(val);
}
function hash(id){
  let n=2166136261;
  for(const ch of String(id)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}
  return n>>>0;
}
function mean(points){
  let x=0,z=0;
  for(const p of points){x+=p[0];z+=p[1];}
  return [x/points.length,z/points.length];
}
function distinct(points){
  const result=[];
  for(const p of points||[]){if(!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))continue;
    const last=result.at(-1);if(!last||Math.hypot(last[0]-p[0],last[1]-p[1])>.12)result.push(p);
  }
  if(result.length>1&&Math.hypot(result[0][0]-result.at(-1)[0],result[0][1]-result.at(-1)[1])<.15)result.pop();
  return result;
}
function triIndex(poly) {
  if(poly.length<3)return [];
  return T.ShapeUtils.triangulateShape(poly.map(p=>new T.Vector2(p[0],p[1])),[]);
}
const defaultUV=[[0,0],[1,0],[1,1],[0,1]];
class Batch {
  constructor(){this.buffers=new Map();this.base=0;this.drape=false;this.foundation=false;}
  lift(p){
    const base=this.road?roadHeight(this.road.street,this.road.i,p[0],p[2]):this.railGround?baseTerrainHeight(p[0],p[2]):this.drape?terrainHeight(p[0],p[2]):this.base;
    const floor=this.foundation&&p[1]===0?Math.min(base,baseTerrainHeight(p[0],p[2]))-.18:base;
    return [p[0],p[1]+floor,p[2]];
  }
  tri(mat,a,b,c,col=white,uv=defaultUV) {
    let buf=this.buffers.get(mat);
    if(!buf){buf={pos:[],colors:[],tex:[]};this.buffers.set(mat,buf);}
    buf.pos.push(...this.lift(a),...this.lift(b),...this.lift(c));
    const k=color(col);buf.colors.push(k.r,k.g,k.b,k.r,k.g,k.b,k.r,k.g,k.b);
    for(let i=0;i<3;i++)buf.tex.push(uv[i][0],uv[i][1]);
  }
  face(mat,a,b,c,d,col=white,uv=defaultUV){
    this.tri(mat,a,b,c,col,[uv[0],uv[1],uv[2]]);this.tri(mat,a,c,d,col,[uv[0],uv[2],uv[3]]);
  }
  quad(mat,points,height,col,scale=1) {
    if(points.length!==4)return;
    const verts=points.map(p=>[p[0],height,p[1]]),uv=points.map(p=>[p[0]/scale,p[1]/scale]);
    this.face(mat,...verts,col,uv);
  }
  flat(mat,poly,h,col=white,scale=1) {
    const v=poly.map(([x,z])=>[x,h,z]),coords=poly.map(([x,z])=>[x/scale,z/scale]);
    for(const [i,j,k] of triIndex(poly))this.tri(mat,v[k],v[j],v[i],col,[coords[k],coords[j],coords[i]]);
  }
  wall(mat,a,b,h1,h2,col,tiles=1,floors=1) {
    if(Math.abs(h2-h1)<.02)return;
    this.face(mat,[a[0],h1,a[1]],[b[0],h1,b[1]],[b[0],h2,b[1]],[a[0],h2,a[1]],col,[[0,0],[tiles,0],[tiles,floors],[0,floors]]);
  }
  box(x,h,z,w,ht,d,col,mat='felt') {
    const a=x-w/2,b=x+w/2,c=z-d/2,e=z+d/2,top=h+ht;
    this.wall(mat,[a,c],[b,c],h,top,col,w/2.4,ht/2.4);this.wall(mat,[b,c],[b,e],h,top,col,d/2.4,ht/2.4);
    this.wall(mat,[b,e],[a,e],h,top,col,w/2.4,ht/2.4);this.wall(mat,[a,e],[a,c],h,top,col,d/2.4,ht/2.4);
    this.quad(mat,[[a,c],[a,e],[b,e],[b,c]],top,col,2.4);
    this.quad(mat,[[a,c],[b,c],[b,e],[a,e]],h,col,2.4);
  }
  tube(p,q,r,s,col,n=8,mat='felt'){
    const delta=new T.Vector3(q[0]-p[0],q[1]-p[1],q[2]-p[2]);if(delta.lengthSq()<.000001)return;
    const len=delta.length();delta.normalize();
    const side=new T.Vector3().crossVectors(delta,Math.abs(delta.y)>.88?new T.Vector3(0,0,1):new T.Vector3(0,1,0)).normalize();
    const up=new T.Vector3().crossVectors(delta,side).normalize();
    function vertex(pt,radius,i) {const u=radius*Math.cos(i*tau/n),v=radius*Math.sin(i*tau/n);return [pt[0]+side.x*u+up.x*v,pt[1]+side.y*u+up.y*v,pt[2]+side.z*u+up.z*v];}
    for(let i=0;i<n;i++){
      const a=vertex(p,r,i),b=vertex(p,r,i+1),c=vertex(q,s,i+1),d=vertex(q,s,i);
      this.face(mat,a,b,c,d,col,[[i/n,0],[(i+1)/n,0],[(i+1)/n,len/2],[i/n,len/2]]);
      this.tri(mat,p,b,a,col);this.tri(mat,q,d,c,col);
    }
  }
  ball(x,y,z,sx,sy,sz,col,segments=8,rings=5,mat='felt'){
    const v=(u,v)=>{const a=tau*u,b=Math.PI*v;return [x+sx*Math.cos(a)*Math.sin(b),y-sy*Math.cos(b),z+sz*Math.sin(a)*Math.sin(b)];};
    for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
      const a=i/segments,b=(i+1)/segments,c=j/rings,d=(j+1)/rings;
      this.face(mat,v(a,c),v(b,c),v(b,d),v(a,d),col,[[a*3,c*2],[b*3,c*2],[b*3,d*2],[a*3,d*2]]);
    }
  }
  mesh(materials){
    const group=new T.Group();
    for(const [name,b] of this.buffers){
      if(!b.pos.length)continue;
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(b.tex,2));g.setAttribute('color',new T.Float32BufferAttribute(b.colors,3));
      g.computeVertexNormals();g.computeBoundingSphere();
      group.add(new T.Mesh(g,materials[name]));
    }
    this.buffers.clear();
    return group;
  }
}
function ring(batch,x,z,inner,outer,h,col,mat='plain',n=80){
  for(let i=0;i<n;i++){const a=i*tau/n,b=(i+1)*tau/n;const pt=(r,a)=>[x+r*Math.cos(a),z+r*Math.sin(a)];
    batch.quad(mat,[pt(inner,a),pt(inner,b),pt(outer,b),pt(outer,a)],h,col,8);}
}
// Each landmark uses the geographic footprint center, the local z axis follows the historical axis.
function historicArch() {
  const b=new Batch(), p='#e4ccaa', shade='#987d77',light='#f3dfb8';
  for(const side of [-1,1])for(const sideZ of [-1,1]){
    const x=14.91*side,z=7.61*sideZ;
    b.box(x,0,z,15.18,1.1,6.78,'#b7a09a');
    b.box(x,1.1,z,14.94,22.15,6.6,p);
    b.box(x,3.35,z,15.32,.44,7.02,light);
    b.box(x,19.56,z,15.13,.37,6.94,light);
    for(let i=0;i<4;i++){b.box(x,5.5+i*3.15,z,15.01,.095,6.8,'#c6ad99');}
  }
  // Smaller transverse passage under the outer piers.
  for(const sign of [-1,1]){
    for(let i=0;i<10;i++){
      const a=-4.22+i*8.44/10,bz=a+8.44/10;
      const h0=14.46+Math.sqrt(Math.max(0,4.22**2-a*a)),h1=14.46+Math.sqrt(Math.max(0,4.22**2-bz*bz));
      const l=sign<0?-22.5:7.31,r=sign<0?-7.31:22.5;
      b.face('felt',[l,h0,a],[r,h0,a],[r,h1,bz],[l,h1,bz],shade);
      for(const xx of [l,r])b.face('felt',[xx,h0,a],[xx,h1,bz],[xx,32,bz],[xx,32,a],p);
    }
    b.box(sign*14.9,23,-.01,15.19,9.1,22,p);
  }
  const r=7.31,low=21.88,top=33;
  for(let i=0;i<22;i++){
    const a=Math.PI*i/22,c=Math.PI*(i+1)/22;
    let ax=Math.cos(a)*r,ay=low+Math.sin(a)*r,cx=Math.cos(c)*r,cy=low+Math.sin(c)*r;
    b.face('felt',[ax,ay,-11],[ax,ay,11],[cx,cy,11],[cx,cy,-11],shade);
    for(const z of [-11.02,11.02]){
      b.face('felt',[ax,ay,z],[cx,cy,z],[cx,top,z],[ax,top,z],p);
      const med=Math.sign(z)*.15;
      const at=(a,r,layer=1)=>[Math.cos(a)*r,low+Math.sin(a)*r,z+med*layer];
      b.face('felt',at(a,r+.10),at(c-.008,r+.10),at(c-.008,r+1.1),at(a,r+1.1),i%3===0?light:'#d8ba9b');
      b.face('felt',at(a+.018,r+.34,1.4),at(c-.03,r+.53,1.4),at(c-.03,r+.7,1.4),at(a+.018,r+.51,1.4),'#f2dbb5');
    }
  }
  b.box(0,32,0,45,5.4,22,p);
  b.box(0,35.2,0,45.7,.6,22.5,shade);
  b.box(0,35.8,0,46.6,.6,23.1,light);
  b.box(0,36.5,0,45.5,4.15,22.45,'#d6ba97');
  b.box(0,40,0,46.5,.8,23.1,shade);b.box(0,40.8,0,47.15,.77,23.85,light);
  b.box(0,41.56,0,45.5,5.72,22.1,p);
  b.box(0,47.35,0,47,.55,23.3,light);b.box(0,47.9,0,45.6,1.07,22.4,'#cdb49a');
  b.box(0,48.97,0,44.7,.45,22.0,light);
  for(const side of [-1,1]){
    const z=side*11.11;
    // Medal frieze, attic cartouches and the quatre sculptural groups.
    for(let i=-10;i<=10;i++){
      const x=i*2.12;
      b.ball(x,39,z+.18*side,.63,.69,.27,i%2===0?'#bda18a':'#e7ccaa',6,3);
      b.box(x,37.1,z+.17*side,.4,.68,.27,'#b69a86');
    }
    for(let i=-4;i<=4;i++){
      const x=i*4.8;
      b.box(x,42.4,z,.17,3.95,.34,'#bea487');b.box(x+.35,42.36,z,.14,4.04,.35,light);
      b.box(x+2.38,43.27,z,2.65,1.84,.3,'#e1c8a8');b.box(x+2.38,43.67,z+.205*side,1.58,.17,.08,'#baa18c');
    }
    for(const s of [-1,1]){
      const x=s*15.02,z2=11.4*side;
      b.box(x,4.25,z2,10,.83,2.35,shade);b.box(x,5.06,z2,9.72,.46,2.28,light);
      b.box(x,20.5,z+.12*side,11.43,5.4,.52,'#b49a85');b.box(x,20.87,z+.42*side,10.82,4.67,.56,'#ddc3a1');
      for(let n=0;n<5;n++){const px=x+(n-2)*1.79;
        b.ball(px,23+Math.sin(n*.9)*.39,z+.91*side,.43,.55,.22,'#b29681',7,4);
        b.tube([px-.25,21.5,z+.91*side],[px+.23,22.74,z+1.02*side],.32,.49,'#c7aa91',6);
      }
      for(let j=0;j<5;j++){
        const dx=(j-2)*1.46,boost=1-Math.abs(j-2)*.17,h=5.7+boost*5.4;
        b.ball(x+dx*.7,h+2,z2+.32*side,.68*boost,.82*boost,.61,'#e3c9a9',8,4);
        b.tube([x+dx*1.08,5.61,z2+.44*side],[x+dx*.72,h+1.31,z2+.33*side],1.16*boost,.71*boost,'#c4a98f',7);
        b.tube([x+dx*.82,h+.85,z2+.52*side],[x+dx*1.24,h+1.92+Math.sin(j)*1.1,z2+.8*side],.4,.31,light,6);
      }
      b.ball(x,15.88,z2,.92,1.06,.71,light,8,4);
      b.tube([x-1.4,12.5,z2],[x-.12,15.1,z2+.2*side],1.28,.83,'#dfc1a0',7);
      b.tube([x-.1,14.32,z2+.27*side],[x+2.2*s,17.36,z2+.45*side],.47,.28,'#f0d7b3',7);
      b.tube([x+1.95*s,16.7,z2+.46*side],[x+3.42*s,19.2,z2+.50*side],.12,.045,'#a08878',5);
    }
  }
  // One narrow Tricolore on the parapet; its fishtail has three folded fabric panels.
  b.tube([11,49.4,-1],[11,54.15,-1],.11,.08,'#a99482',7);
  ['#50688b','#f3e6cf','#c95160'].forEach((col,i)=>{
    const a=11+i*1.2,c=11+(i+1)*1.2;
    b.face('felt',[a,53.9,-1+Math.sin(i)*.4],[c,53.7,-1+Math.sin(i+1)*.4],[c,51.95,-1+Math.sin(i+1)*.4],[a,52.15,-1+Math.sin(i)*.4],col);
  });
  return b;
}
function futureArch(){
  const b=new Batch(),face='#e2e1e0',trim='#aab8c7',deep='#748d9f', silver='#d1d5db';
  for(const s of [-1,1]){
    b.box(s*42.75,0,0,21.5,109,109,face);
    for(const z of [-54.8,54.8]){
      b.box(s*42.8,2.4,z,16.7,104,.55,'#d0d3d8');
      for(let y=3;y<107;y+=3.5)b.box(s*42.8,y,z,17.2,.24,.85,trim,'plain');
    }
    for(const x of [s*32.04,s*53.7])for(let z=-50;z<53;z+=5.5)b.box(x,2,z,.46,103,.34,trim,'plain');
  }
  b.box(0,89,0,106.8,20.2,109,face);b.box(0,88.4,0,64,.62,109,deep);
  for(let x=-49;x<52;x+=5)b.box(x,89,-54.7,.32,19,.62,trim,'plain');
  b.box(0,108.4,0,107.4,1.25,110,silver);
  // Blanket stitches bind the curved corners of the light felt inner face.
  for(const sign of [-1,1])for(const z of [-54.72,54.72]){
    for(let y=3.5;y<88;y+=4.7){
      b.face('felt',[sign*32.18,y,z],[sign*33.65,y+.8,z],[sign*33.65,y+1.25,z],[sign*32.18,y+.45,z],'#91a6ad');
    }
  }
  return b;
}
const pyramid={x:(2.33585-2.25)*73190,z:(48.88-48.86101)*111320};
const obelisk={x:5206,z:1617};
const LouvreIds=new Set(['245184969','253248239','253248246','253248248']);
function pyramidForm(){
  const b=new Batch(),w=17.5,y=21.6;
  const corners=[[-w,0,-w],[w,0,-w],[w,0,w],[-w,0,w]];
  for(let i=0;i<4;i++){
    const a=corners[i],c=corners[(i+1)%4],t=[0,y,0];
    b.tri('glass',a,c,t,'#c9dde3',[[0,0],[7,0],[3.5,7]]);
    for(let j=0;j<=9;j++){
      const f=j/10,lerp=(a,d,t)=>a.map((v,i)=>v+(d[i]-v)*t);
      b.tube(lerp(a,t,f),lerp(c,t,f),.10,.1,'#c1c6cb',4,'plain');
      b.tube(lerp(a,c,f),lerp(a,t,1-f),.10,.10,'#b3bdc8',4,'plain');
      b.tube(lerp(c,a,f),lerp(c,t,1-f),.10,.10,'#b3bdc8',4,'plain');
    }
  } return b;
}
function obeliskForm(){
  const b=new Batch();b.box(0,0,0,7,1.15,7,'#b3a19a');
  b.box(0,1.15,0,5.4,3.4,5.4,'#b9a298');b.box(0,4.55,0,4.1,.55,4.1,'#d3b7a5');
  const sq=(s,y)=>[[-s,y,-s],[s,y,-s],[s,y,s],[-s,y,s]];
  const bottom=sq(1.34,5.1),top=sq(.77,25.16);
  for(let i=0;i<4;i++){
    const j=(i+1)%4;b.face('felt',bottom[i],bottom[j],top[j],top[i],'#d5af83');
    b.tri('plain',top[i],top[j],[0,27.1,0],'#e7bf62');
  }
  return b;
}
function specialFootprint(id,x,z) {
  if(isEnfer)return false;
  return specialParisIds.has(id)||id==='157326'||id==='444657'||id==='245198908'||LouvreIds.has(id)||Math.hypot(x-arc.x,z-arc.z)<10||
    Math.hypot(x-grande.x,z-grande.z)<19||Math.hypot(x-pyramid.x,z-pyramid.z)<8||Math.hypot(x-obelisk.x,z-obelisk.z)<4;
}
function flatWithHoles(batch,mat,poly,holes,height,col,scale=1){
  const ring=distinct(poly),hh=(holes||[]).map(distinct).filter(r=>r.length>=3);
  if(!hh.length){batch.flat(mat,ring,height,col,scale);return;}
  const idx=T.ShapeUtils.triangulateShape(ring.map(p=>new T.Vector2(...p)),hh.map(h=>h.map(p=>new T.Vector2(...p))));
  const pts=ring.concat(...hh),uv=pts.map(p=>[p[0]/scale,p[1]/scale]);
  for(const [a,b,c] of idx){const ids=[c,b,a];batch.tri(mat,...ids.map(i=>[pts[i][0],height,pts[i][1]]),col,ids.map(i=>uv[i]));}
}
// Architectural trim follows the local wall plane on surveyed, often skewed footprints.
function facadeRelief(b,a,d,len,outward,bays,floors,eaves,index,entry,shop){
  if(len<2.3)return;
  const dx=(d[0]-a[0])/len,dz=(d[1]-a[1])/len,nx=dz*outward,nz=-dx*outward;
  const at=(t,off,y)=>[a[0]+dx*t+nx*off,y,a[1]+dz*t+nz*off];
  function ledge(u,v,bottom,top,depth,tint){
    b.face('felt',at(u,depth,bottom),at(v,depth,bottom),at(v,depth,top),at(u,depth,top),tint);
    b.face('felt',at(u,0,top),at(v,0,top),at(v,depth,top),at(u,depth,top),tint);
  }
  const stone=index===4?'#d0bba1':index<2?'#c99779':'#d2b799';
  ledge(0,len,eaves-.18,eaves+.01,.20,stone);
  const width=len/bays,storey=eaves/floors,mat='enfer'+index;
  if(width<2.2)return;
  for(let i=0;i<bays;i++){
    const origin=i*width,mid=origin+.5*width;
    for(let j=0;j<floors;j++){
      if(shop&&j===0&&Math.abs(mid-len*.5)<2.1+.35*width)continue;
      if(entry&&i===0&&j===0){
        const half=width*.15,top=storey*.73;
        ledge(mid-half-.10,mid+half+.10,.03,.14,.32,'#b9a48b');
        ledge(mid-half-.08,mid+half+.08,top,top+.12,.18,stone);
        for(const side of [-1,1]){
          const x=mid+half*side;
          b.face('felt',at(x,.013,.13),at(x+.062*side,.105,.13),at(x+.062*side,.105,top),at(x,.013,top),stone);
        }
        continue;
      }
      const y=j*storey;
      if(index===4){
        ledge(mid-width*.20,mid+width*.20,y+storey*.2-.07,y+storey*.2+.07,.23,stone);
        continue;
      }
      const low=y+storey*23/96,high=y+storey*77/96;
      ledge(mid-width*.264,mid+width*.264,low-.12,low-.015,.21,'#d7bea1');
      for(const side of [-1,1]){
        // Draw the shutter with the same louvre pattern at both levels of detail.
        const hinge=mid+side*width*22/96,edge=mid+side*width*34/96;
        const depth=.16+.07*((i+j+index+(side>0?1:0))%3);
        const uv1=side<0?26/96:70/96,uv2=side<0?14/96:82/96;
        b.face(mat,at(hinge,.046,low),at(edge,depth,low),at(edge,depth,high),at(hinge,.046,high),white,
          [[uv1,23/96],[uv2,23/96],[uv2,77/96],[uv1,77/96]]);
        const frame=mid+side*width*20/96,inside=mid+side*width*18/96;
        b.face('felt',at(frame,.122,low),at(inside,.018,low),at(inside,.018,high),at(frame,.122,high),stone);
      }
      b.face('felt',at(mid-width*20/96,.122,high),at(mid+width*20/96,.122,high),
        at(mid+width*18/96,.018,high-.05),at(mid-width*18/96,.018,high-.05),'#997e6c');
    }
  }
}

function roofFront(b,a,d,len,outward,eaves,shape,index,seed,dormerFootprint){
  const dx=(d[0]-a[0])/len,dz=(d[1]-a[1])/len;
  const at=(x,off,y)=>[a[0]+dx*x+outward*dz*off,y,a[1]+dz*x-outward*dx*off];
  // A thin fascia and folded zinc gutter at the low edge, flush with the roof.
  b.face('plain',at(0,.02,eaves+.07),at(len,.02,eaves+.07),at(len,.26,eaves-.04),at(0,.26,eaves-.04),'#695f60');
  b.face('plain',at(0,.26,eaves-.04),at(len,.26,eaves-.04),at(len,.26,eaves-.14),at(0,.26,eaves-.14),'#938c82');
  if(seed%3===0&&len>3.8){
    const x=.42;
    b.tube(at(x,.22,eaves-.095),at(x,.095,eaves-.40),.062,.055,'#858781',5,'plain');
    b.tube(at(x,.095,eaves-.40),at(x,.095,.30),.055,.055,'#858781',5,'plain');
  }
  if(!dormerFootprint||len<6.2)return;
  const x=len*(seed%2?.40:.60),half=.71;
  const heightAt=(u,off)=>{const [px,,pz]=at(u,off,0);return shape.top([px,pz]);};
  const front=-.65,back=-2.05,bottom=heightAt(x,front)-.05,shoulder=bottom+.91,peak=shoulder+.44;
  const backHeight=heightAt(x,back);
  // The two rear corners can otherwise protrude from a narrow or bevelled roof.
  for(const u of [x-half-.09,x+half+.09]){
    const [px,,pz]=at(u,back,0);
    if(dormerFootprint.some((p,i)=>{
      const q=dormerFootprint[(i+1)%dormerFootprint.length];
      return ((q[0]-p[0])*(pz-p[1])-(q[1]-p[1])*(px-p[0]))*outward<0;
    }))return;
  }
  if(backHeight<=bottom+.32||backHeight>=peak-.06)return;
  const l=x-half,r=x+half;
  const bl=at(l,front,bottom),br=at(r,front,bottom),tl=at(l,front,shoulder),tr=at(r,front,shoulder);
  const ridge=at(x,front,peak);
  b.face('enfer'+index,bl,br,tr,tl,white,[[.234,.20],[.766,.20],[.766,.87],[.234,.87]]);
  b.tri('felt',tl,tr,ridge,'#c5ae92');
  for(const side of [-1,1]){
    const u=x+side*half,foot=heightAt(u,back)-.035,edge=Math.max(foot+.025,shoulder);
    b.face('felt',at(u,front,bottom),at(u,back,foot),at(u,back,edge),at(u,front,shoulder),'#988879');
    b.face('plain',at(u+side*.09,front+.10,shoulder),at(u+side*.09,back,edge),at(x,back,peak),at(x,front+.10,peak),'#5b5b65');
  }
}
function storefront(b,a,d,outward,height,index){
  const len=Math.hypot(d[0]-a[0],d[1]-a[1]),item=frontageSigns[index];
  if(!item||len<3.6||height<2.5)return;
  const dx=(d[0]-a[0])/len,dz=(d[1]-a[1])/len;
  const p=(k,off,h)=>[a[0]+dx*k+dz*outward*off,h,a[1]+dz*k-dx*outward*off];
  const center=len*.5,bay=Math.min(item.wares?5.4:4.1,len*.84),l=center-bay*.5,r=center+bay*.5,cap=Math.min(3.15,height-.10);
  b.face('felt',p(l,.026,.08),p(r,.026,.08),p(r,.026,cap+.05),p(l,.026,cap+.05),item.color);
  b.face('felt',p(l+.15,.048,.69),p(r-.15,.048,.69),p(r-.15,.048,cap-.55),p(l+.15,.048,cap-.55),'#47615d');
  for(const x of [l+.16,center-.36,center+.36,r-.16])
    b.face('felt',p(x-.034,.063,.52),p(x+.034,.063,.52),p(x+.034,.063,cap-.53),p(x-.034,.063,cap-.53),'#e4ccaa');
  const signDepth=item.wares?.205:.074;
  const low=p(l+.09,signDepth,cap-.49),right=p(r-.09,signDepth,cap-.49);
  const upper=p(r-.09,signDepth,cap-.01),left=p(l+.09,signDepth,cap-.01);
  b.face('sign'+index,low,right,upper,left,'#ffffff',outward<0?[[0,0],[1,0],[1,1],[0,1]]:[[1,0],[0,0],[0,1],[1,1]]);
  if(item.wares){
    const panel=(x,width,base,top,color,depth=.082)=>b.face('felt',p(x-width/2,depth,base),
      p(x+width/2,depth,base),p(x+width/2,depth,top),p(x-width/2,depth,top),color);
    panel(center,bay-.38,.82,.90,'#e0b58b');
    panel(center,.63,.18,cap-.52,item.color);
    panel(center+.10,.045,.97,1.15,'#e8c890',.118);
    for(const side of [-1,1])for(let i=0;i<4;i++){
      const x=center+side*(.52+i*(bay*.42-.52)/3);
      if(item.wares==='books'){
        const tint=['#c99d64','#abc6b0','#bc7880','#d3b3cb'][i];
        panel(x,.13,.90,1.22+i*.075,tint);
        panel(x,.08,1.55,1.83+(3-i)*.04,tint);
      }else if(item.wares==='bread'){
        for(const level of [.97,1.55]){
          const [wx,wy,wz]=p(x,.112,level);
          b.ball(wx,wy,wz,.125,.085+(i%2)*.045,.082,'#dba76e',8,5);
        }
      }else{
        panel(x,.115,.91,1.14,'#b87761');panel(x,.075,1.14,1.47,'#93b08c');
        const [wx,wy,wz]=p(x,.113,1.51+i%2*.13);
        b.ball(wx,wy,wz,.125,.11,.071,['#e5a2ae','#dfbc74','#a7a0ce','#e4d0a4'][i],8,5);
      }
    }
    if(item.wares!=='flowers')panel(center,bay-.39,1.49,1.55,'#d0ac81');
  }
  if(index===2)return;
  const y=cap-.52,steps=10;
  for(let i=0;i<steps;i++){
    const f=l+i*bay/steps,t=l+(i+1)*bay/steps,tint=i%2?'#eaccaa':item.awning;
    b.face('felt',p(f,.065,y),p(t,.065,y),p(t,.84,y-.27),p(f,.84,y-.27),tint);
    b.face('felt',p(f,.84,y-.27),p(t,.84,y-.27),p(t,.84,y-.38),p(f,.84,y-.38),tint);
  }
}
function frontageDetails(b,a,d,side,seed,store){
  const dx=d[0]-a[0],dz=d[1]-a[1],len=Math.hypot(dx,dz),nx=side*dz/len,nz=-side*dx/len;
  const t=store?.70:.62,x=a[0]+dx*t+nx*.27,z=a[1]+dz*t+nz*.27;
  if(store){
    b.box(x,.18,z,.58,.31,.34,'#785744');
    b.box(x,.48,z,.43,.49,.095,'#45404c');
    for(let i=0;i<3;i++)b.box(x,.55-i*.079,z+nz*.062,.28-i*.035,.018,.096,'#c4b39c');
  }else{
    b.box(x,.12,z,.46,.24,.39,seed%2?'#986758':'#8f7767');
    for(let i=-1;i<=1;i++){
      b.tube([x+i*.12,.26,z],[x+i*.135,.51+Math.abs(i)*.04,z+nz*.06],.087,.052,'#5d7555',5,'felt');
      b.tube([x+i*.135,.49,z+nz*.06],[x+i*.148,.58,z+nz*.06],.047,.029,seed%2?'#d3a395':'#dbc67b',5,'felt');
    }
  }
}

function addHeritageBuilding(batch,site,building,detail,skyline){
  batch.base=baseTerrainHeight(site.x,site.y);batch.road=null;batch.drape=false;batch.foundation=true;
  const material=skyline?'plain':'felt',color=site.key==='mairie-briques'?'#a25e50':'#cbbb9e';
  const base=heritagePlinth(site,building);
  for(const outline of [base.poly,...building.holes||[]])for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    batch.wall(material,a,b,0,base.height,color,Math.hypot(a[0]-b[0],a[1]-b[1])/3,base.height/3);
  }
  flatWithHoles(batch,material,base.poly,building.holes,base.height,'#9a8981',3);
  if(String(building.id)!==site.ids[0])return;
  for(const {p,color,mat} of heritageModel(site,skyline?'silhouette':detail)){
    // Choose UV axes from the surface itself so the stitches remain the same
    // physical size on a bell tower and on the face of a dormer.
    const dx=p[1][0]-p[0][0],dz=p[1][2]-p[0][2],len=Math.hypot(dx,dz);
    const vertical=Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]))>.05;
    const uv=p.map(v=>vertical&&len>.001?[(v[0]*dx+v[2]*dz)/(3*len),v[1]/3]:[v[0]/3,v[2]/3]);
    for(let i=1;i<p.length-1;i++)batch.tri(skyline?'plain':mat,p[0],p[i],p[i+1],color,[uv[0],uv[i],uv[i+1]]);
  }
}
function retailInterior(b,poly,store){
  const drape=b.drape;
  b.drape=true;b.flat('pave',poly,.065,store.large?'#bdb8a5':'#b58d75',2.4);b.drape=drape;
  for(const [i,j,k] of triIndex(poly)){
    b.tri('felt',...[i,j,k].map(n=>[poly[n][0],shopHeadroom,poly[n][1]]),'#e5d3ae');
  }
  for(const [across,depth] of store.large?[[0,2.8],[0,5.4],[-5,7],[5,7]]:[[0,1.6],[0,3.2]]){
    const light=(x,y)=>store.point(across+x,depth+y);
    b.quad('signalLight',[light(-.35,-.17),light(.35,-.17),light(.35,.17),light(-.35,.17)],shopHeadroom-.06,'#ffe4a9');
  }
  for(const fixture of [store.booth,...store.furnishings]){
    const ring=shopFixture(store,fixture),counter=fixture===store.booth;
    const baseColor=counter?store.tint:'#99745e';
    for(let i=0;i<ring.length;i++)b.wall('felt',ring[i],ring[(i+1)%4],0,fixture.h,baseColor);
    b.flat('felt',ring,fixture.h,'#dac19c');
    const count=counter?3:Math.max(4,Math.round(fixture.width+fixture.depth)),long=fixture.depth>fixture.width;
    for(let i=0;i<count;i++){
      const fraction=(i+.5)/count-.5;
      const [x,z]=store.point(fixture.offset+(long?0:fraction*fixture.width),fixture.at+(long?fraction*fixture.depth:0));
      const colors=['#bd7962','#e8b36e','#77907d','#9c839e'];
      b.box(x,fixture.h,z,.26,.19+(i%3)*.075,.21,colors[i%colors.length]);
    }
  }
}
function retailFacade(b,a,d,left,right,outward,eaves,store){
  const len=Math.hypot(d[0]-a[0],d[1]-a[1]),dx=(d[0]-a[0])/len,dz=(d[1]-a[1])/len;
  const item=frontageSigns[store.style],p=(u,v,h)=>[a[0]+dx*u+dz*outward*v,h,a[1]+dz*u-dx*outward*v];
  const center=len/2,width=Math.min(store.large?10.5:5.4,len-.24),top=Math.min(eaves,3.55);
  const panel=(l,r,low,high,depth,col,mat='felt',uv)=>
    b.face(mat,p(l,depth,low),p(r,depth,low),p(r,depth,high),p(l,depth,high),col,uv);
  b.wall('felt',a,left,0,eaves,item.color);b.wall('felt',right,d,0,eaves,item.color);
  b.wall('felt',left,right,shopHeadroom,eaves,item.color);
  for(const side of [-1,1]){
    const inner=center+side*(store.halfWidth+.12),outer=center+side*(width/2-.08);
    panel(Math.min(inner,outer),Math.max(inner,outer),.77,2.42,.045,'#769591');
    panel(inner-.035,inner+.035,.15,shopHeadroom,.075,'#e7cba5');
  }
  panel(center-width/2,center+width/2,top-.48,top-.035,.14,white,'sign'+store.style,
    outward<0?[[0,0],[1,0],[1,1],[0,1]]:[[1,0],[0,0],[0,1],[1,1]]);
  b.face('felt',p(center-width/2,.10,top-.5),p(center+width/2,.10,top-.5),
    p(center+width/2,.85,top-.69),p(center-width/2,.85,top-.69),item.awning);
}
function addEnferBuilding(b,building,poly,detail,skyline,h){
  const index=enferStyle(building),{wall,roof,bay}=enferStyles[index];
  const sections=[poly,...(building.holes||[])];
  const roofShape=!skyline?enferRoof(poly,h,index):null,eaves=roofShape?.wall??h;
  const mat=skyline?'plain':'enfer'+index;
  const vertex=([x,z],height)=>[x,height,z];
  const venue=namedFronts.get(String(building.id)),garage=String(building.id)===workshopId;
  const store=!skyline&&storeByBuilding.get(String(building.id));
  const business=skyline?null:venue?.style??(detail?frontageStyle(building):null);
  let shopEdge=-1,bestFront=-Infinity;
  if(venue&&business!=null)shopEdge=venue.edge;
  else if(business!=null)poly.forEach((p,i)=>{
    const q=poly[(i+1)%poly.length],score=Math.hypot(p[0]-q[0],p[1]-q[1])-.024*Math.hypot((p[0]+q[0])*.5+3,(p[1]+q[1])*.5+282);
    if(score>bestFront){bestFront=score;shopEdge=i;}
  });
  const outward=Math.sign(poly.reduce((sum,[x,z],i)=>{const d=poly[(i+1)%poly.length];return sum+x*d[1]-z*d[0];},0))||1;
  const seed=hash(building.id);
  // The dormer's back corners must stay inside a simple convex footprint.
  const acceptsDormer=detail&&roofShape&&index<3&&h>4.9&&seed%3!==1&&sections.length===1&&poly.length===4&&
    poly.every((p,i)=>{const q=poly[(i+1)%4],r=poly[(i+2)%4];return ((q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]))*outward>0;});
  for(const ring of sections){
    for(let i=0;i<ring.length;i++){
      const a=ring[i],d=ring[(i+1)%ring.length],len=Math.hypot(a[0]-d[0],a[1]-d[1]);
      if(len<.15)continue;
      const bays=Math.max(1,Math.round(len/bay)),floors=index===4?1:Math.max(1,Math.round(eaves/2.75));
      const inset=store?(q=>[q[0]-(d[1]-a[1])*outward/len*.072,q[1]+(d[0]-a[0])*outward/len*.072]):null;
      const entry=detail&&ring===poly&&index<3&&len>3.1&&(i+hash(building.id))%3===0;
      if(garage&&ring===poly&&i===workshopEdge&&!skyline){
        const {left,right}=bayDoor(poly);
        b.wall('felt',a,left,0,eaves,'#9d6655');
        b.wall('felt',right,d,0,eaves,'#9d6655');
        b.wall('felt',left,right,headroom,eaves,'#59817b');
        const nx=(d[1]-a[1])*outward/len,nz=(a[0]-d[0])*outward/len;
        const signPoint=(p,h)=>[p[0]+nx*.12,h,p[1]+nz*.12];
        b.face('sign5',signPoint(left,headroom),signPoint(right,headroom),signPoint(right,headroom+.66),signPoint(left,headroom+.66),white,outward>0?[[0,0],[1,0],[1,1],[0,1]]:[[1,0],[0,0],[0,1],[1,1]]);
        continue;
      }
      if(store&&ring===poly&&i===shopEdge){
        const [left,right]=shopOpening(poly,store);
        retailFacade(b,a,d,left,right,outward,eaves,store);
        b.wall('felt',inset(left),inset(a),0,shopHeadroom,'#d9be98');
        b.wall('felt',inset(d),inset(right),0,shopHeadroom,'#d9be98');
      }else if(entry){
        const split=[a[0]+(d[0]-a[0])/bays,a[1]+(d[1]-a[1])/bays],bottom=eaves/floors;
        b.wall('enferEntry'+index,a,split,0,bottom,white);
        if(bays>1)b.wall(mat,split,d,0,bottom,white,bays-1,1);
        b.wall(mat,a,d,bottom,eaves,white,bays,floors-1);
      }else b.wall(mat,a,d,0,eaves,skyline?wall:white,bays,floors);
      if(store&&i!==shopEdge)b.wall('felt',inset(d),inset(a),0,shopHeadroom,store.large?'#adc0ad':'#d9be98');
      if(ring===poly&&i===shopEdge&&!store)storefront(b,a,d,outward,eaves,business);
      if(detail&&ring===poly&&len>3.7&&(entry||i===shopEdge)&&!(store&&i===shopEdge))frontageDetails(b,a,d,outward,hash(building.id+i),i===shopEdge);
      if(detail&&ring===poly&&index!==3&&!(store&&i===shopEdge))facadeRelief(b,a,d,len,outward,bays,floors,eaves,index,entry,i===shopEdge);
      if(!roofShape)continue;
      if(detail&&ring===poly&&len>1.8&&Math.max(roofShape.top(a),roofShape.top(d))-eaves<.11)
        roofFront(b,a,d,len,outward,eaves,roofShape,index,seed+i,acceptsDormer?poly:null);
      const splits=[a,d],left=roofShape.ridge(a),right=roofShape.ridge(d);
      if(left*right<0){const t=left/(left-right);splits.splice(1,0,[a[0]+(d[0]-a[0])*t,a[1]+(d[1]-a[1])*t]);}
      for(let j=1;j<splits.length;j++){
        const u=splits[j-1],v=splits[j];
        const topU=roofShape.top(u),topV=roofShape.top(v);
        if(Math.max(topU,topV)-eaves>.018)
          b.face('felt',vertex(u,eaves),vertex(v,eaves),vertex(v,topV),vertex(u,topU),wall);
      }
    }
  }
  if(store)retailInterior(b,poly,store);
  if(garage&&!skyline){
    const oldDrape=b.drape;b.drape=true;b.flat('pave',poly,.045,'#a09783',3);b.drape=oldDrape;
    b.flat('plain',poly,headroom,'#b6a68f');
    // Floor markings lead inward from the rolled-up shutter.
    const {left,right}=bayDoor(poly),dx=right[0]-left[0],dz=right[1]-left[1],n=Math.hypot(dx,dz);
    for(const t of [.15,.85]){
      const x=left[0]+t*dx,z=left[1]+t*dz,ex=x-dz/n*outward*4.8,ez=z+dx/n*outward*4.8;
      b.drape=true;b.quad('plain',[[x,z],[x+dx/n*.10,z+dz/n*.10],[ex+dx/n*.10,ez+dz/n*.10],[ex,ez]],.06,'#e3bd62');b.drape=oldDrape;
    }
  }
  if(!roofShape){flatWithHoles(b,skyline?'plain':'roof',poly,building.holes,h,roof,3.4);return;}
  const holes=sections.slice(1).map(distinct),all=poly.concat(...holes);
  const triangles=T.ShapeUtils.triangulateShape(poly.map(p=>new T.Vector2(...p)),holes.map(r=>r.map(p=>new T.Vector2(...p))));
  for(const triangle of triangles){
    const points=triangle.slice().reverse().map(i=>all[i]);
    for(const side of [-1,1]){
      const facet=roofPitch(points,roofShape.ridge,side);
      for(let i=2;i<facet.length;i++){
        const face=[facet[0],facet[i-1],facet[i]];
        const [a,d,c]=face;
        if(Math.abs((d[0]-a[0])*(c[1]-a[1])-(d[1]-a[1])*(c[0]-a[0]))<.004)continue;
        b.tri('tileRoof',...face.map(p=>vertex(p,roofShape.top(p))),roof,face.map(([x,z])=>[x/3.2,z/3.2]));
      }
    }
  }
  if(detail&&index<3&&poly.length<=8&&h>4){
    const [x,z]=mean(poly);
    b.box(x,roofShape.top([x,z])-.4,z,.59,1.28,.67,'#a65e4a');
    b.box(x,roofShape.top([x,z])+.81,z,.73,.16,.76,'#5c4949');
  }
}
function addBuilding(b,building,detail,skyline=false,heritageDetail=false){
  const poly=distinct(building.poly);if(poly.length<3)return;
  const [cx,cz]=mean(poly);
  b.base=buildingGround(building.poly);b.foundation=true;
  if(specialFootprint(String(building.id),cx,cz))return;
  const id=hash(building.id),h=Math.max(1.9,Math.min(260,Number(building.h)||14));
  if(isEnfer){
    if(building.station){paintStationBuilding(b,building,detail&&!skyline);return;}
    const site=heritageByFootprint.get(String(building.id));
    if(site)addHeritageBuilding(b,site,building,detail||heritageDetail,skyline);
    else addEnferBuilding(b,building,poly,detail,skyline,h);
    return;
  }
  const glass=h>48||(cx< -135&&cz< -625&&h>24);
  const stone=glass?['#d0d1d4','#c8c6d6','#aabdc2','#ccced5'][id%4]:stones[id%stones.length];
  const roof=slates[(id>>>3)%slates.length];
  const crown=glass?Math.min(3.1,h*.05):Math.min(3.55,h*.19),eaves=h-crown;
  const count=poly.length;
  if(!detail){
    for(let i=0;i<count;i++){
      const a=poly[i],c=poly[(i+1)%count],len=Math.hypot(a[0]-c[0],a[1]-c[1]);
      const mat=skyline?'plain':glass?'glass':'facade';
      b.wall(mat,a,c,0,h-.5,stone,Math.max(1,Math.round(len/(glass?4.8:7.1))),Math.max(1,Math.round(h/(glass?4:3.6))));
    }
    flatWithHoles(b,'plain',poly,building.holes,h-.48,glass?'#9398a8':roof);
    return;
  }
  const mansard=!glass&&h>9&&!building.holes?.length, pinch=mansard?Math.min(.14,2.4/Math.max(11,Math.sqrt(Math.abs(T.ShapeUtils.area(poly.map(p=>new T.Vector2(...p))))))):0;
  const inset=poly.map(([x,z])=>[x+(cx-x)*pinch,z+(cz-z)*pinch]);
  const floorCount=Math.max(1,Math.round((eaves-3.6)/3.15));
  const cross=T.ShapeUtils.area(poly.map(p=>new T.Vector2(...p)))>0?1:-1;
  for(let i=0;i<count;i++){
    const a=poly[i],d=poly[(i+1)%count],r=inset[i],s=inset[(i+1)%count],dx=d[0]-a[0],dz=d[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.12)continue;
    if(glass){b.wall('glass',a,d,0,h,stone,Math.max(1,Math.round(length/3.7)),Math.max(1,Math.round(h/3.7)));continue;}
    if(h<6.8){
      b.wall('felt',a,d,0,eaves,stone,length/4,1);b.wall('roof',a,d,eaves,h,roof,length/3,1);continue;
    }
    const base=Math.min(3.65,eaves*.55), win=Math.max(1,Math.round(length/7.1));
    if(length>4.1){
      const shops=Math.max(1,Math.round(length/8.8));
      for(let k=0;k<shops;k++){
        const aa=[a[0]+dx*k/shops,a[1]+dz*k/shops],bb=[a[0]+dx*(k+1)/shops,a[1]+dz*(k+1)/shops];
        b.wall('shop'+((id%8+i*3+k*5)%8),cross>0?bb:aa,cross>0?aa:bb,.02,base,white);
      }
    }else b.wall('felt',a,d,0,base,stone,1,1);
    b.wall('facade',a,d,base,eaves,stone,win,floorCount);
    const uv=[[0,0],[win,0],[win,1],[0,1]];
    b.face('roof',[a[0],eaves,a[1]],[d[0],eaves,d[1]],[s[0],h,s[1]],[r[0],h,r[1]],roof,uv);
    const outX=dz/length*cross,outZ=-dx/length*cross;
    if(length>5){
      const aa=[a[0]+outX*.24,a[1]+outZ*.24],dd=[d[0]+outX*.24,d[1]+outZ*.24];
      b.wall('felt',aa,dd,eaves-.25,eaves+.1,'#d4c5ba',length/4,.12);
      if(h>13&&length>7){
        const balcony=base+(eaves-base)*Math.max(1,floorCount-1)/floorCount-.05;
        b.wall('felt',aa,dd,balcony-.17,balcony+.075,'#d7c4b3',length/4,.12);
        if(mansard)for(let k=0;k<Math.min(4,Math.floor(length/5.7));k++){
          const t=(k+.65)/Math.max(1,Math.floor(length/5.7)),px=a[0]+dx*t,pz=a[1]+dz*t;
          const lt=[px-dx/length*.58,pz-dz/length*.58],rt=[px+dx/length*.58,pz+dz/length*.58];
          b.wall('glass',lt,rt,eaves+.35,eaves+1.48,'#cabfae');
          b.tri('felt',[lt[0],eaves+1.45,lt[1]],[rt[0],eaves+1.45,rt[1]],[px,eaves+2.15,pz],'#d7c7b4');
        }
      }
    }
    if(length>=8 && (id+i)%3===0){
      const n=Math.min(4,Math.floor(length/6)),awColor=stripMaterials[(id+i)%stripMaterials.length];
      for(let k=0;k<n;k++){
        const t=(k+.5)/n,w=Math.min(3.3,length/n*.75);
        const mid=[a[0]+dx*t,a[1]+dz*t],left=[mid[0]-dx/length*w/2,mid[1]-dz/length*w/2];
        for(let st=0;st<6;st++){
          const oa=[left[0]+dx/length*w*st/6,left[1]+dz/length*w*st/6],ob=[oa[0]+dx/length*w/6,oa[1]+dz/length*w/6],
            fa=[oa[0]+outX*.95,oa[1]+outZ*.95],fb=[ob[0]+outX*.95,ob[1]+outZ*.95];
          const c=st%2?awColor:'#e9d2af';
          b.face('felt',[oa[0],base-.46,oa[1]],[ob[0],base-.46,ob[1]],[fb[0],base-.94,fb[1]],[fa[0],base-.94,fa[1]],c);
          const sag=[(fa[0]+fb[0])*.5,base-1.35,(fa[1]+fb[1])*.5];
          b.wall('felt',fa,fb,base-1.15,base-.94,c);
          b.tri('felt',[fa[0],base-1.15,fa[1]],[fb[0],base-1.15,fb[1]],sag,c);
        }
      }
    }
  }
  for(const hole of building.holes||[])for(let i=0;i<hole.length;i++)b.wall('facade',hole[i],hole[(i+1)%hole.length],0,eaves,stone,2,floorCount+1);
  flatWithHoles(b,'roof',inset,building.holes,h,glass?'#a3afbb':roof,3.8);
  if(mansard&&h>12&&count>3&&(id%4!==0)){
    const ax=cx+(poly[0][0]-cx)*.42,az=cz+(poly[0][1]-cz)*.42;
    b.box(ax,h-.15,az,1.32,.8,.76,'#c2ae9d');for(const offset of [-.37,.38])b.box(ax+offset,h+.62,az,.3,.75,.39,'#ab786c');
  }
}
function strip(batch,mat,a,d,width,h,col,scale=5,xOffset=0){
  const dx=d[0]-a[0],dz=d[1]-a[1],len=Math.hypot(dx,dz);if(len<.04)return;
  if(len>18){
    const steps=Math.ceil(len/18);
    for(let j=0;j<steps;j++)strip(batch,mat,[a[0]+dx*j/steps,a[1]+dz*j/steps],[a[0]+dx*(j+1)/steps,a[1]+dz*(j+1)/steps],width,h,col,scale,xOffset);
    return;
  }
  const nx=-dz/len,nz=dx/len,w=width/2;
  const points=[[a,-w],[a,w],[d,w],[d,-w]].map(([p,off])=>[p[0]+nx*(off+xOffset),p[1]+nz*(off+xOffset)]);
  batch.quad(mat,points,h,col,scale);
}
function paintRailSection(b,{start,end},detail){
  strip(b,'pave',railXY(start),railXY(end),7.15,.085,'#908887',2);
  if(detail)for(let d=Math.ceil(start/.8)*.8;d<end;d+=.8)for(const side of [-1,1]){
    const center=side*railSpacing/2;
    strip(b,'felt',railXY(d,center-1.13),railXY(d,center+1.13),.20,.14,'#6a5551',1);
  }
  for(const off of railGaugeOffsets){
    const a=railXY(start,off),d=railXY(end,off);
    strip(b,'plain',a,d,.17,.168,'#514a4d',1);
    strip(b,'plain',a,d,.084,.198,'#b8afa8',1);
  }
}
function paintRailStation(b,station){
  const d=station.d,h=railwayPlatformLength/2,signStyle=station.style;
  const p=(along,across)=>railXY(d+along,across);
  for(const side of [-1,1]){
    const v=side*railwayPlatformOffset,edge=v-side*1.44;
    strip(b,'pave',p(-h,v),p(h,v),3.2,.13,'#bcb09e',2);
    strip(b,'plain',p(-h,edge),p(h,edge),.12,.15,'#ffe086');
    for(const along of [-8,8]){
      const [x,z]=p(along,v+side*.9);
      b.box(x,.13,z,.18,3.02,.18,'#446061');
      const [u,w]=p(along,v+side*.15);
      b.box(u,.13,w,.14,3.02,.14,'#446061');
    }
    strip(b,'felt',p(-9,v+side*.46),p(9,v+side*.46),2.12,3.14,'#54666b');
    strip(b,'plain',p(-9,v-side*.58),p(9,v-side*.58),.13,3.12,'#d4ad79');
    for(const facing of [-1,1]){
      const face=(along,h)=>{const [x,z]=p(-7+along*facing,v+side*.89+facing*.045);return [x,h,z];};
      b.face('sign'+signStyle,face(-1.93,2.48),face(1.93,2.48),face(1.93,3.03),face(-1.93,3.03),
        white,[[0,0],[1,0],[1,1],[0,1]]);
    }
  }
  strip(b,'pave',p(-19,-7.55),p(-19,7.55),2.3,.22,'#ae9c88',1);
  strip(b,'pave',p(0,station.side*7.1),p(0,station.side*10.82),5.6,.115,'#bcb09e',2);
}
function paintStationBuilding(b,building,detail){
  const station=building.station,big=station.style===16,glass=station.style===19;
  const wide=big?13.5:glass?10.5:7.1,depth=big?8.5:6.5,eaves=big?5.72:4.05;
  const faceColor=big?'#a45e51':glass?'#627e82':'#a88b72',roof=big?'#525963':'#52666b';
  const base=(u,v)=>railXY(station.d+u,station.side*(10.8+v));
  const point=(u,v,h)=>{const [x,y]=base(u,v);return [x,h,y];};
  const panel=(l,r,lo,hi,v,color,mat='felt')=>{
    const a=point(l,v,lo),d=point(r,v,lo),e=point(r,v,hi),f=point(l,v,hi);
    const uv=[[1,0],[0,0],[0,1],[1,1]];
    if(station.side>0)b.face(mat,d,a,f,e,color,uv);
    else b.face(mat,a,d,e,f,color,uv);
  };
  for(let i=0;i<4;i++){
    const a=building.poly[i],d=building.poly[(i+1)%4];
    b.wall(big?'enfer0':'felt',a,d,0,eaves,big?white:faceColor,5,2);
    b.wall('felt',a,d,0,.38,'#8d8b84');
  }
  const crest=building.h,mid=depth/2;
  for(const side of [-1,1]){
    const u=side*wide;
    b.tri('felt',point(u,0,eaves),point(u,depth,eaves),point(u,mid,crest),faceColor);
    b.tri('felt',point(u,depth,eaves),point(u,0,eaves),point(u,mid,crest),faceColor);
  }
  for(const [front,frontH,back,backH] of [[0,eaves,mid,crest],[mid,crest,depth,eaves]]){
    const a=point(-wide-.22,front,frontH),d=point(wide+.22,front,frontH),e=point(wide+.22,back,backH),f=point(-wide-.22,back,backH);
    b.face('tileRoof',a,d,e,f,roof,[[0,0],[8,0],[8,2],[0,2]]);
    b.face('tileRoof',f,e,d,a,roof,[[0,2],[8,2],[8,0],[0,0]]);
  }
  if(!detail)return;
  panel(-wide,wide,eaves-.23,eaves-.05,-.035,'#d9c29e');
  panel(-2.8,2.8,.05,eaves-.98,-.07,'#49686e');
  for(const x of [-2.52,0,2.52])panel(x-.055,x+.055,.03,eaves-1.0,-.10,'#d9d1b7');
  panel(-2.63,2.63,2.24,2.34,-.11,'#d9d1b7');
  for(const x of [-wide+2.16,-wide*.48,wide*.48,wide-2.16]){
    for(const floor of big?[0,1]:[0]){
      const sill=1.05+floor*2.57;
      panel(x-.82,x+.82,sill-.13,sill+1.41,-.05,'#e0c7a8');
      panel(x-.68,x+.68,sill,sill+1.26,-.071,'#658990');
      panel(x-.045,x+.045,sill,sill+1.27,-.102,'#ddd2b4');
    }
  }
  panel(-3.45,3.45,eaves-.88,eaves-.29,-.13,white,'sign'+station.style);
  const front=point(0,-.19,eaves+.84);
  const cap=Math.min(wide*.63,8.4);
  b.face('felt',point(-cap,-3.0,3.04),point(cap,-3.0,3.04),point(cap,-.05,3.43),point(-cap,-.05,3.43),'#556d72');
  b.face('felt',point(-cap,-.05,3.43),point(cap,-.05,3.43),point(cap,-3.0,3.04),point(-cap,-3.0,3.04),'#45585e');
  for(const u of [-cap+.36,cap-.36]){
    const [x,z]=base(u,-2.78);b.box(x,0,z,.18,3.15,.18,'#394e56');
  }
  if(big){
    const a=point(-2.55,0,eaves),d=point(2.55,0,eaves),peak=point(0,-.035,eaves+2.08);
    const reverse=station.side>0;
    b.tri('felt',...(reverse?[d,a,peak]:[a,d,peak]),'#bd7965');
    const [x,y,z]=front;b.ball(x,y,z,.5,.5,.055,'#f1d6a4',14,7,'plain');
    panel(-.036,.036,eaves+.84,eaves+1.17,-.255,'#384253');
    panel(0,.29,eaves+.815,eaves+.875,-.258,'#384253');
  }
}
function paintMallPylon(b){
  const point=(u,h,off=0)=>{const [x,z]=montRenaudPoint(u,-3.9+off);return [x,h,z];};
  for(const u of [-7.9,-6.05]){
    const [x,,z]=point(u,0);b.box(x,0,z,.16,4.26,.16,'#56535b');
  }
  for(let i=0;i<4;i++){
    const h=1.46+i*.69,style=15-i;
    for(const facing of [-1,1]){
      const side=facing*.045,face=(u,y)=>point(-6.975+u*facing,y,side);
      b.face('sign'+style,face(-.995,h),face(.995,h),face(.995,h+.60),face(-.995,h+.60),
        white,[[0,0],[1,0],[1,1],[0,1]]);
    }
  }
}
function disc([x,z],r,sides){
  return Array.from({length:sides},(_,i)=>[x+Math.cos(i*tau/sides)*r,z+Math.sin(i*tau/sides)*r]);
}
function addRoad(b,seg,neighbours){
  b.base=0;b.foundation=false;b.drape=true;
  const {a,d,street:s,i}=seg,dx=d[0]-a[0],dz=d[1]-a[1],len=Math.hypot(dx,dz);
  if(len<.2)return;
  const path=s.kind==='path',w=Number(s.w)||5;
  const bridge=s.bridge;
  // Rounded joins keep adjacent curb strips contiguous where a road bends.
  const pad=Math.min(1.15,w*.13,len*.07),a1=[a[0]-dx/len*pad,a[1]-dz/len*pad],d1=[d[0]+dx/len*pad,d[1]+dz/len*pad];
  if(path&&!bridge){
    strip(b,'pave',a1,d1,Math.max(1.45,w),.027,'#f5e9d2',streetFabric.paving.meters);return;
  }
  const y=.074;
  const pavement=w+Math.min(6,w*.6);
  if(isEnfer){
    const yCurb=.185;
    const drive=parkingDriveways.get(s.id),crossings=drive?[...neighbours,...drive]:neighbours;
    for(const side of [-1,1]){
      const width=(pavement-w)*.5;
      for(const [start,end] of pavementRuns(a,d,side*(pavement+w)*.25,width*.5,crossings)){
        strip(b,'pave',start,end,width,yCurb,white,streetFabric.paving.meters,side*(pavement+w)*.25);
        const dx0=-dz/len*side*w*.5,dz0=dx/len*side*w*.5;
        b.wall('felt',[start[0]+dx0,start[1]+dz0],[end[0]+dx0,end[1]+dz0],y-.02,yCurb,'#a99788',len/2,.2);
      }
    }
    for(const [at,joint] of [[a,seg.joinStart],[d,seg.joinEnd]]){
      if(!joint)continue;
      b.flat('pave',disc(at,pavement*.5,10),y-.015,white,streetFabric.paving.meters);
    }
  }
  strip(b,'pave',a1,d1,w+Math.min(6,w*.6),y-.018,white,streetFabric.paving.meters);
  if(!isEnfer)strip(b,'road',a1,d1,w+.40,y-.002,'#dfceaf',streetFabric.road.meters);
  strip(b,'road',a1,d1,w,y,white,streetFabric.road.meters);
  if(isEnfer)for(const [at,joint] of [[a,seg.joinStart],[d,seg.joinEnd]]){
    if(joint)b.flat('road',disc(at,w*.5,12),y+.002,white,streetFabric.road.meters);
  }
  if(w>5&&(!bridge || w>9)){
    const nx=dx/len,nz=dz/len,spacing=Math.max(9,Math.min(13,len/2));
    for(let s0=3;s0+1.85<len;s0+=spacing){
      const s1=Math.min(s0+2.8,len-.5);strip(b,'plain',[a[0]+nx*s0,a[1]+nz*s0],[a[0]+nx*s1,a[1]+nz*s1],.14,y+.011,'#cdbfaf',2);
    }
  }
  if(isEnfer&&gradedRoad(s,i)){
    // Carry the approach down to the bank. The bridge itself has a thin slab with
    // open space underneath, so a path or canal can continue through the crossing.
    const nx=-dz/len,nz=dx/len,radius=pavement*.5;
    if(bridge)strip(b,'felt',a,d,pavement,-.36,'#9a8a81',3);
    for(const side of [-1,1]){
      const ax=a[0]+nx*radius*side,az=a[1]+nz*radius*side,bx=d[0]+nx*radius*side,bz=d[1]+nz*radius*side;
      const bottom=(x,z)=>bridge?-.36:Math.min(0,baseTerrainHeight(x,z)-roadHeight(s,i,x,z))-.07;
      const za=bottom(ax,az),zb=bottom(bx,bz);
      if(bridge||Math.min(za,zb)<-.18)
        b.face('felt',[ax,za,az],[bx,zb,bz],[bx,y-.018,bz],[ax,y-.018,az],bridge?'#998a85':'#9d8b71');
    }
  }
  // The elevated deck uses the same walking surface as the street physics.
  if(bridge&&(isEnfer||w>6)&&!onNeuillyDeck((a[0]+d[0])/2,(a[1]+d[1])/2)){
    for(const sign of [-1,1]){
      const edge=isEnfer?(pavement-w)*.5-.12:2.15;
      const nx=-dz/len*sign*(w*.5+edge),nz=dx/len*sign*(w*.5+edge);
      b.wall('felt',[a[0]+nx,a[1]+nz],[d[0]+nx,d[1]+nz],isEnfer?-.36:-1.5,.67,'#b6aab0',len/3,1);
      b.tube([a[0]+nx,.85,a[1]+nz],[d[0]+nx,.85,d[1]+nz],.08,.08,'#625661',5,'plain');
      if(isEnfer)for(let t=.5;t<len;t+=2.4){
        const x=a[0]+dx*t/len+nx,z=a[1]+dz*t/len+nz;
        b.tube([x,.12,z],[x,.86,z],.05,.05,'#5e5961',5,'plain');
      }
    }
  }
}
const chunkSize=160;
function key(x,z){return Math.floor(x/chunkSize)+','+Math.floor(z/chunkSize);}
const railChunks=new Map();
for(const section of railSections){
  const id=key(section.x,section.y);
  if(!railChunks.has(id))railChunks.set(id,[]);
  railChunks.get(id).push(section);
}
function makeIndex(){
  const groups=new Map(),towers=[],roads=new Map(),bucket=24;
  function get(x,z){const k=key(x,z);if(!groups.has(k))groups.set(k,{buildings:[],segments:[]});return groups.get(k);}
  for(const b of buildings){
    if(!b.poly?.length)continue;
    const [x,z]=mean(b.poly);
    if(b.h>68&&!specialFootprint(String(b.id),x,z))towers.push(b);else get(x,z).buildings.push(b);
  }
  for(const street of streets){
    const path=street.path||[];
    for(let i=0;i<path.length-1;i++){
      const p=path[i],q=path[i+1],parts=Math.max(1,Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/(gradedRoad(street,i)?3:18)));
      let a=p;
      for(let j=1;j<=parts;j++){
        const t=j/parts,d=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
        const seg={a,d,street,i,joinStart:j===1,joinEnd:j===parts};
        get((a[0]+d[0])/2,(a[1]+d[1])/2).segments.push(seg);
        if(isEnfer&&street.kind!=='path'){
          const reach=street.w*.5+10;
          for(let x=Math.floor((Math.min(a[0],d[0])-reach)/bucket);x<=Math.floor((Math.max(a[0],d[0])+reach)/bucket);x++)
            for(let y=Math.floor((Math.min(a[1],d[1])-reach)/bucket);y<=Math.floor((Math.max(a[1],d[1])+reach)/bucket);y++){
              const k=x+4096*y;if(!roads.has(k))roads.set(k,[]);roads.get(k).push(seg);
            }
        }
        a=d;
      }
    }
  }
  function adjacent(seg){
    const x=Math.floor((seg.a[0]+seg.d[0])*.5/bucket),y=Math.floor((seg.a[1]+seg.d[1])*.5/bucket);
    const candidates=new Set();
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const other of roads.get(x+i+4096*(y+j))||[]){
      if(other===seg||other.street===seg.street&&other.i===seg.i)continue;
      if((other.street.level||0)!==(seg.street.level||0)||!!other.street.bridge!==!!seg.street.bridge)continue;
      const midpointX=(other.a[0]+other.d[0]-seg.a[0]-seg.d[0])*.5,midpointY=(other.a[1]+other.d[1]-seg.a[1]-seg.d[1])*.5;
      if(Math.hypot(midpointX,midpointY)<21+(other.street.w+seg.street.w)*.5)candidates.add(other);
    }
    return [...candidates];
  }
  return {groups,towers,adjacent};
}
function frayDecoration(batch,kind,stage){
  const spec=propWearProfile(kind);
  if(!stage||!spec)return;
  const amount=stage===1?.3:1;
  const [lining,,shadow]=spec.yarn;
  function looseStitch(a,b,c){
    const width=stage===1?.026:.036;
    batch.tube(a,b,width,width*.9,shadow,5);
    batch.tube(b,c,width*.83,.012,lining,5);
  }
  if(kind==='bench'||kind==='postbox'||kind==='crate'){
    const depth=kind==='bench'?.2:0,halfDepth=kind==='bench'?.055:kind==='crate'?.40:.2;
    const width=kind==='bench'?.53:.21;
    for(const side of [-1,1])for(let i=0;i<stage+1;i++){
      const x=(i-.75)*width*.57,z=depth+side*(halfDepth+.008);
      looseStitch([x,spec.seam+.09,z],[x+.06,spec.seam-.018,z+side*.025],[x+.03,spec.seam-.10-.045*i,z+side*.07]);
    }
  }else{
    const r=spec.radius,count=stage===1?5:8;
    for(let i=0;i<count;i++){
      const a=i*tau/count,h=spec.seam+.027*Math.cos(i*2.4);
      const point=(angle,radius,y)=>[Math.cos(angle)*radius,y,Math.sin(angle)*radius];
      looseStitch(point(a,r,h+.05),point(a+.30,r+.025,h-.035),point(a+.48,r+.075*stage,h-.06-.04*stage));
    }
  }
  // Bend the whole connected upper section around the torn seam, while its
  // base (and hence its contact with the ground) stays planted.
  for(const {pos} of batch.buffers.values())for(let i=0;i<pos.length;i+=3){
    const upper=Math.max(0,pos[i+1]-spec.pivot)*amount;
    pos[i]+=upper*spec.lean;pos[i+2]+=upper*spec.lean*.31;pos[i+1]-=upper*spec.drop;
  }
}
export function decoration(kind,variant,stage,distant=false) {
  const b=new Batch(),metal='#3c4e54',edge='#596967';
  if(terracePanels[kind]){
    for(const panel of terracePanels[kind])b.face('felt',...panel.points,panel.color);
  }else if(kind==='tree'){
    drawStreetTree(b,variant,stage,distant);
  }else if(kind==='signal'){
    b.tube([0,.04,0],[0,3.14,0],.115,.074,metal,7);
    b.tube([0,.06,0],[0,.37,0],.185,.15,edge,7);
    b.box(0,2.40,0,.33,1.05,.48,'#263d40');
    for(let i=0;i<3;i++){
      const y=3.23-i*.31,active=variant%4===i;
      b.ball(.179,y,0,.053,.114,.117,active?['#ff624d','#ffc247','#47f2a7'][i]:'#48514e',8,4,active?'signalLight':'plain');
      b.box(.167,y+.13,0,.19,.048,.30,'#344749');
    }
    b.box(0,1.64,0,.28,.46,.31,'#344749');
    b.ball(0,1.89,.165,.088,.106,.033,variant>=4?'#56f7b2':'#ef7669',7,4,'signalLight');
  }else{
    streetFurniture(b,kind,stage,isEnfer);
  }
  frayDecoration(b,kind,stage);
  return b;
}
const deckStart=[203,-800],deckEnd=[447,-681];
function onNeuillyDeck(x,z){
  if(isEnfer)return false;
  const dx=deckEnd[0]-deckStart[0],dz=deckEnd[1]-deckStart[1],cx=x-deckStart[0],cz=z-deckStart[1];
  const t=(cx*dx+cz*dz)/(dx*dx+dz*dz);
  return t>=-.03&&t<=1.03&&Math.abs(cx*dz-cz*dx)/Math.hypot(dx,dz)<23;
}
function neuillyDeck(b){
  const a=deckStart,d=deckEnd,dx=d[0]-a[0],dz=d[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
  const offset=(p,n)=>[p[0]+nx*n,p[1]+nz*n];
  strip(b,'pave',a,d,41,.053,'#d1c8c2',4.5);
  strip(b,'road',a,d,30,.056,white,6);
  strip(b,'pave',a,d,3.3,.082,'#a6a2a7',3.1);
  for(const sign of [-1,1]){
    const v=offset(a,sign*20.4),parts=Math.ceil(len/12);
    const v3=(p,h)=>[p[0],h,p[1]];
    for(let j=0;j<parts;j++){
      const from=[v[0]+dx*j/parts,v[1]+dz*j/parts],to=[v[0]+dx*(j+1)/parts,v[1]+dz*(j+1)/parts];
      b.wall('felt',from,to,-1.7,.35,'#a8a0a6',len/(parts*3),1);
      b.tube(v3(from,.94),v3(to,.94),.09,.09,'#829295',6,'plain');
      b.tube(v3(from,.63),v3(to,.63),.047,.047,'#9da6a5',5,'plain');
    }
    for(let i=0;i<len;i+=4.8){const f=i/len,x=v[0]+dx*f,z=v[1]+dz*f;
      b.tube([x,.28,z],[x,.98,z],.045,.045,'#728389',5,'plain');}
    for(const offs of [.71,1.31])strip(b,'plain',a,d,.10,.088,'#b7aa9d',3,sign*offs);
  }
}
function makePlazas(b){
  // The Étoile's central forecourt and radial boulevards have separate pavements.
  for(let r=0;r<118;r+=10)ring(b,arc.x,arc.z,Math.max(.01,r),Math.min(118,r+10),.026,white,'road',112);
  ring(b,arc.x,arc.z,33.4,35.8,.082,'#e8d6c0','pave');
  for(let r=0;r<33.5;r+=7)ring(b,arc.x,arc.z,Math.max(.01,r),Math.min(33.5,r+7),.082,'#e0c8b9','pave');
  for(const r of [36.0,115.5])ring(b,arc.x,arc.z,r,r+.18,.086,'#d7c9b9');
  for(const r of [55,76,94]){
    for(let i=0;i<96;i++){
      const a=i*tau/96,b1=a+.023;
      const p=(x,n)=>[arc.x+x*Math.cos(n),arc.z+x*Math.sin(n)];
      b.quad('plain',[p(r,a),p(r,b1),p(r+.16,b1),p(r+.16,a)],.058,'#d7c7b3');
    }
  }
  // Central parvis paving is continuous below the two sides of the Grande Arche.
  const x=grande.x,z=grande.z,yaw=grande.yaw,pt=(a,d)=>[x+Math.cos(yaw)*a+Math.sin(yaw)*d,z-Math.sin(yaw)*a+Math.cos(yaw)*d];
  for(let a=-51;a<51;a+=12)for(let d=-57;d<172;d+=12){const x1=Math.min(a+12,51),z1=Math.min(d+12,172);b.quad('pave',[pt(a,d),pt(x1,d),pt(x1,z1),pt(a,z1)],.046,'#e1d8cd',5.15);}
}
function inRing(x,z,points){
  let yes=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],c=points[j];
    if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])yes=!yes;
  } return yes;
}
function surfaceAreas(features){
  return features.filter(a=>a.poly?.length>2).map(a=>{
    let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
    for(const [x,z] of a.poly){minX=Math.min(x,minX);maxX=Math.max(x,maxX);minZ=Math.min(z,minZ);maxZ=Math.max(z,maxZ);}
    return {a,minX,maxX,minZ,maxZ,level:features===water?waterLevel(a):0};
  });
}
function containsArea(item,x,z){
  return x>=item.minX&&x<=item.maxX&&z>=item.minZ&&z<=item.maxZ&&inRing(x,z,item.a.poly)&&!(item.a.holes||[]).some(h=>inRing(x,z,h));
}
function groundTile(batch,x0,z0,n,lakes,parks,country){
  const near=item=>item.maxX>=x0&&item.minX<=x0+chunkSize&&item.maxZ>=z0&&item.minZ<=z0+chunkSize;
  const wet=lakes.filter(near),green=parks.filter(near),points=[];
  if(wet.length&&!country)n=Math.max(n,32);
  else if(wet.length)n=Math.max(n,16);
  const step=chunkSize/n;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const x=x0+i*step,z=z0+j*step,lake=wet.find(q=>containsArea(q,x,z));
    points.push([x,lake?lake.level-.85:baseTerrainHeight(x,z)-.07,z]);
  }
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=j*(n+1)+i,a=points[k],b=points[k+n+1],c=points[k+n+2],d=points[k+1];
    const park=country||green.some(q=>containsArea(q,a[0]+step*.5,a[2]+step*.5)),tex=park?streetFabric.park.meters:streetFabric.paving.meters;
    const uv=[a,b,c,d].map(p=>[p[0]/tex,p[2]/tex]);
    batch.face(park?'park':'pave',a,b,c,d,park?white:'#f4e5d4',uv);
  }
}
function makeGround(b) {
  b.quad('pave',[[-13000,-12000],[-13000,13000],[17000,13000],[17000,-12000]],-.12,'#f4e5d4',streetFabric.paving.meters);

  for(const w of water){
    const poly=distinct(w.poly);if(poly.length<3)continue;
    b.base=waterLevel(w);
    flatWithHoles(b,'water',poly,w.holes,.004,white,streetFabric.water.meters);
    for(const ring of [poly,...(w.holes||[])])for(let i=0;i<ring.length;i++){
      const a=ring[i],d=ring[(i+1)%ring.length],length=Math.hypot(d[0]-a[0],d[1]-a[1]);
      if(length<.06)continue;
      b.wall('felt',a,d,-.26,.16,'#9f9477',Math.max(1,length/2.2),1);
      strip(b,'plain',a,d,.26,.010,'#8bb1a8',1);
    }
    const px=poly.map(p=>p[0]),pz=poly.map(p=>p[1]),x0=Math.min(...px),z0=Math.min(...pz),x1=Math.max(...px),z1=Math.max(...pz);
    for(let z=z0+4;z<z1;z+=12)for(let x=x0+((Math.floor(z/11)%5)*4);x<x1;x+=24){
      if(!inRing(x,z,poly)||(w.holes||[]).some(h=>inRing(x,z,h)))continue;
      const seed=hash(Math.round(x)+','+Math.round(z));const l=1.0+(seed%25)*.18;
      b.quad('plain',[[x,z],[x+l,z+.8],[x+l+.4,z+.95],[x+.5,z+.29]],.012,seed%3?'#a9c2c2':'#688f9f');
    }
  }
  b.base=0;b.drape=true;if(!isEnfer){makePlazas(b);neuillyDeck(b);}
}
// A reusable outer mesh carries the skyline beyond the high-detail street chunks.
function distantGround(root){
  const spacing=80,n=44,geometry=new T.PlaneGeometry(n*spacing,n*spacing,n,n);
  geometry.rotateX(-Math.PI/2);
  const positions=geometry.getAttribute('position'),indices=geometry.getIndex(),outer=[];
  for(let i=0;i<indices.count;i+=3){
    const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);
    if(Math.hypot(positions.getX(a),positions.getZ(a))>360)outer.push(a,b,c);
  }
  geometry.setIndex(outer);
  const material=new T.MeshLambertMaterial({color:'#c4b1a1'}),mesh=new T.Mesh(geometry,material);
  root.add(mesh);let lastX=Infinity,lastZ=Infinity;
  return {update(x,z){
    const cx=spacing*Math.round(x/spacing),cz=spacing*Math.round(z/spacing);
    if(cx===lastX&&cz===lastZ)return;
    lastX=cx;lastZ=cz;
    for(let i=0;i<positions.count;i++){
      const px=cx+positions.getX(i),pz=cz+positions.getZ(i);
      // Stay beneath the fine mesh and the shoreline where the two resolutions overlap.
      const h=Math.min(terrainHeight(px,pz),terrainHeight(px-30,pz),terrainHeight(px+30,pz),terrainHeight(px,pz-30),terrainHeight(px,pz+30))-8;
      positions.setY(i,h);
    }
    positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();mesh.position.set(cx,0,cz);
  },dispose(){material.dispose();}};
}
function pickProps(props,pos,visibleLimit){
  const found=[];
  for(const p of props||[]){
    const dist=(p.x-pos.x)**2+(p.y-pos.y)**2;
    if(dist<=visibleLimit**2)found.push([dist,p]);
  }
  found.sort((a,b)=>a[0]-b[0]);
  return found.slice(0,460).map(pair=>pair[1]);
}
function disposeGroup(group){
  group.traverse(n=>{if(n.geometry)n.geometry.dispose();});group.removeFromParent();
}
export function createCity3D(scene,{software=false}={}){
  const materials=cityMaterials(isEnfer), index=makeIndex(),root=new T.Group();root.name=isEnfer?'Maille City':'Maille City · Paris';
  if(isEnfer)materials.signalLight=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false});
  root.userData.cpuStaticCity=software;root.userData.cpuRevision=0;
  const terrain=new Batch();makeGround(terrain);
  const base=terrain.mesh(materials);
  if(isEnfer)for(const surface of base.children)surface.receiveShadow=true;
  root.add(base);
  const distant=distantGround(root);
  function landmark(batch,site,yaw=site.yaw||0,scale=1){
    const g=batch.mesh(materials);g.rotation.y=yaw;g.position.set(site.x,terrainHeight(site.x,site.z),site.z);g.scale.setScalar(scale);root.add(g);
  }
  if(!isEnfer){
    landmark(historicArch(),arc);landmark(futureArch(),grande);
    for(const site of parisLandmarks)landmark(famousLandmark(site.key,Batch),site);
    for(const building of buildings){
      if(!LouvreIds.has(String(building.id)))continue;
      const poly=building.poly,[x,z]=mean(poly),a=poly[0],c=poly[1];
      const side=Math.hypot(c[0]-a[0],c[1]-a[1]);
      landmark(pyramidForm(),{x,z},-Math.atan2(c[1]-a[1],c[0]-a[0]),String(building.id)==='245184969'?1:side/35);
    }
    if(buildings.some(b=>String(b.id)==='245198908'))landmark(obeliskForm(),obelisk,-.38);
  }
  const towerBatch=new Batch();
  for(const b of index.towers)addBuilding(towerBatch,b,false);
  root.add(towerBatch.mesh(materials));
  scene.add(root);
  const chunks=new Map(), propGroups=new Map(), propModels=new Map(), helper=new T.Object3D();
  const wearChanged=trackPropWear();
  let lastX=Infinity,lastZ=Infinity,targets=[],tick=0,propX=Infinity,propZ=Infinity,destroyCount=-1,stamp=0,lastPropCount=-1;
  const groundShadows=new T.InstancedMesh(new T.CircleGeometry(1,12),new T.MeshBasicMaterial({color:0x695666,transparent:true,opacity:.19,depthWrite:false,side:T.DoubleSide}),460);
  groundShadows.count=0;groundShadows.frustumCulled=false;groundShadows.renderOrder=1;root.add(groundShadows);
  const lakes=surfaceAreas(water),parks=surfaceAreas(source.green||[]);
  function buildChunk(target){
    const geo=index.groups.get(target.key)||{buildings:[],segments:[]};
    const b=new Batch();
    const [ix,iz]=target.key.split(',').map(Number);
    groundTile(b,ix*chunkSize,iz*chunkSize,target.detail?16:target.skyline?4:8,lakes,parks,isEnfer&&geo.buildings.length<15);
    for(const building of geo.buildings)addBuilding(b,building,target.detail,target.skyline,target.heritageDetail);
    for(const seg of geo.segments){
      b.road=seg;
      if(!target.skyline)addRoad(b,seg,isEnfer?index.adjacent(seg):[]);
      else if(seg.street.w>=8){
        b.base=0;b.foundation=false;b.drape=true;
        strip(b,'plain',seg.a,seg.d,seg.street.w,.03,'#827e84');
      }
    }
    b.road=null;
    if(isEnfer && !target.skyline){
      b.base=0;b.foundation=false;b.drape=true;
      b.railGround=true;
      for(const section of railChunks.get(target.key)||[])paintRailSection(b,section,target.detail);
      for(const site of railCrossings)if(key(site.x,site.y)===target.key)
        b.quad('pave',site.deck,.185,'#65636a',2);
      b.railGround=false;
      for(const station of railStations){
        if(key(station.x,station.y)===target.key)paintRailStation(b,station);
      }
      if(key(...montRenaudPoint(-7,-3.9))===target.key)paintMallPylon(b);
      for(const {a,b:d,width} of montRenaudPaving){
        if(key((a[0]+d[0])/2,(a[1]+d[1])/2)===target.key)
          strip(b,'pave',a,d,width,.10,'#c7b39d',streetFabric.paving.meters);
      }
      for(const lot of parkingLots){
        if(key(lot.x,lot.y)!==target.key)continue;
        const at=(u,v)=>lotPoint(lot,u,v);
        strip(b,'pave',at(-parkingWidth/2,0),at(parkingWidth/2,0),parkingDepth,.11,'#999ba0',streetFabric.paving.meters);
        strip(b,'pave',at(0,-6.55),at(0,-4.6),6.4,.12,'#baa99b',streetFabric.paving.meters);
        for(const [a,d] of parkingMarkings(lot))strip(b,'plain',a,d,.09,.133,'#e4d5b5',1);
        const [sx,sz]=parkingSign(lot),c=Math.cos(lot.angle),s=Math.sin(lot.angle);
        b.box(sx,.68,sz,.075,1.47,.075,'#46515e');
        const sign=(along,h)=>[sx+along*c,h,sz+along*s];
        b.face('parkingMarker',sign(-.38,1.37),sign(.38,1.37),sign(.38,2.13),sign(-.38,2.13),'#ffffff');
      }
      for(const slot of nearbyParkedCars((ix+.5)*chunkSize,(iz+.5)*chunkSize,chunkSize/2+1)){
        if(!slot.bay||slot.bay==='lot'||key(slot.x,slot.y)!==target.key)continue;
        const spec=vehicleSpec(slot.type),l=spec.halfLength+.53,w=spec.halfWidth+.30;
        const c=Math.cos(slot.angle),s=Math.sin(slot.angle);
        const at=(u,v)=>[slot.x+c*u-s*v,slot.y+s*u+c*v];
        const h=slot.bay==='apron'?.068:.095;
        if(slot.bay==='apron')strip(b,'pave',at(-l,0),at(l,0),w*2,h,'#cec3b6',streetFabric.paving.meters);
        if(target.detail)for(const end of [-1,1])for(const side of [-1,1]){
          const corner=at(end*(l-.08),side*(w-.09));
          strip(b,'plain',corner,at(end*(l-.60),side*(w-.09)),.075,h+.012,'#e4d7b9',1);
          strip(b,'plain',corner,at(end*(l-.08),side*(w-.39)),.075,h+.012,'#e4d7b9',1);
        }
      }
      for(const span of nearbyEnclosures((ix+.5)*chunkSize,(iz+.5)*chunkSize,chunkSize/2+1)){
        if(key(span.x,span.y)===target.key)drawBoundary(b,span,target.detail&&!software);
      }
      for(const signal of nearbySignals((ix+.5)*chunkSize,(iz+.5)*chunkSize,chunkSize*.56)){
        if(key(signal.x,signal.y)!==target.key)continue;
        for(const arm of signal.arms){
          const c=Math.cos(arm.angle),s=Math.sin(arm.angle),w=arm.width/2-.38;
          for(let offset=-w+.22;offset<w;offset+=.90){
            const x=arm.x+c*arm.setback-s*offset,z=arm.y+s*arm.setback+c*offset;
            strip(b,'plain',[x-c*.95,z-s*.95],[x+c*.95,z+s*.95],.46,.105,'#e5d9bd',1);
          }
        }
      }
    }
    const object=b.mesh(materials);
    if(isEnfer&&!target.skyline)for(const surface of object.children){
      surface.receiveShadow=true;
      surface.castShadow=target.detail&&surface.material!==materials.park&&surface.material!==materials.pave&&surface.material!==materials.road;
    }
    root.add(object);root.userData.cpuRevision++;
    const before=chunks.get(target.key);if(before)disposeGroup(before.object);
    chunks.set(target.key,{object,detail:target.detail,skyline:target.skyline,heritageDetail:target.heritageDetail});
  }
  const monumentChunks=new Map();
  if(isEnfer)for(const building of buildings){
    const site=heritageByFootprint.get(String(building.id));
    if(site?.ids[0]!==String(building.id))continue;
    const [x,z]=mean(building.poly),k=key(x,z);
    if(!monumentChunks.has(k))monumentChunks.set(k,[]);
    monumentChunks.get(k).push(site);
  }
  function setTargets(pos){
    const sx=Math.floor(pos.x/chunkSize),sz=Math.floor(pos.y/chunkSize),keys=new Set(),next=[];
    const span=Math.ceil(cityViewRange/chunkSize);
    for(let i=-span;i<=span;i++)for(let j=-span;j<=span;j++){
      const cx=sx+i,cz=sz+j,k=cx+','+cz;
      const dd=Math.hypot((cx+.5)*chunkSize-pos.x,(cz+.5)*chunkSize-pos.y);
      if(dd>(software?440:cityViewRange)||dd>streetViewRange&&!index.groups.has(k))continue;
      const detail=dd<(software?130:245),skyline=dd>(software?280:streetViewRange);
      const heritageDetail=monumentChunks.get(k)?.some(s=>Math.hypot(s.x-pos.x,s.y-pos.y)<155)||false;
      keys.add(k);next.push({key:k,detail,skyline,heritageDetail,dist:dd});
    }
    for(const [k,entry] of chunks)if(!keys.has(k)){disposeGroup(entry.object);chunks.delete(k);root.userData.cpuRevision++;}
    targets=next.filter(t=>!chunks.has(t.key)||chunks.get(t.key).detail!==t.detail||chunks.get(t.key).skyline!==t.skyline||chunks.get(t.key).heritageDetail!==t.heritageDetail).sort((a,b)=>a.dist-b.dist);
    lastX=pos.x;lastZ=pos.y;
  }
  function propSet(kind,variant,stage,distant){
    const k=kind+variant+'/'+stage+'/'+distant;if(propModels.has(k))return propModels.get(k);
    const group=decoration(kind,variant,stage,distant).mesh(materials),instances=[];
    for(const templ of group.children){
      const mesh=new T.InstancedMesh(templ.geometry,templ.material,460);mesh.count=0;mesh.frustumCulled=false;
      if(isEnfer){mesh.castShadow=!distant;mesh.receiveShadow=true;}
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);instances.push(mesh);
    }
    propModels.set(k,instances);return instances;
  }
  let visibleSignal=false,lastSignalTick=-1;
  function updateProps(pos,state){
    root.userData.cpuRevision++;
    visibleSignal=false;propGroups.clear();let shadowIndex=0;
    for(const prop of pickProps(state?.props,pos,software?78:220)){
      if(state.destroyed?.has?.(prop.id))continue;
      if(prop.type==='signal')visibleSignal=true;
      const type=prop.type||prop.kind||'bollard',h=hash(prop.id),variant=type==='tree'?h%3:type==='signal'?
        ['red','amber','green'].indexOf(lampState(prop.signal,prop.angle,state.epoch))+(pedestrianGreen(prop.signal,state.epoch)?4:0):0;
      const stage=propWearStage(state.propHealth?.get(prop.id));
      const treeDetailDistance=software?34:58;
      const distant=type==='tree'&&(prop.x-pos.x)**2+(prop.y-pos.y)**2>treeDetailDistance**2,k=type+variant+'/'+stage+'/'+distant;
      if(!propGroups.has(k))propGroups.set(k,{items:[],type,variant,stage,distant});
      propGroups.get(k).items.push(prop);
      const tree=type==='tree',lamp=type==='lamp',radius=tree?1.38:lamp?.42:.45;
      helper.position.set(prop.x+radius*.55,(tree?baseTerrainHeight(prop.x+radius*.55,prop.y+radius*.13):terrainHeight(prop.x+radius*.55,prop.y+radius*.13))+.035,prop.y+radius*.13);helper.rotation.set(-Math.PI/2,0,-.30);
      helper.scale.set(radius*(tree?1.8:1.5),radius*.76,1);helper.updateMatrix();
      if(shadowIndex<460)groundShadows.setMatrixAt(shadowIndex++,helper.matrix);
    }
    groundShadows.count=shadowIndex;groundShadows.instanceMatrix.needsUpdate=true;
    for(const list of propModels.values())for(const m of list)m.count=0;
    for(const {items,type,variant,stage,distant} of propGroups.values()){
      const meshes=propSet(type,variant,stage,distant);
      items.forEach((p,i)=>{
        const h=hash(p.id),scale=type==='tree'?.87+(h%41)/100:1;
        helper.position.set(p.x,type==='tree'?baseTerrainHeight(p.x,p.y)-.10:terrainHeight(p.x,p.y),p.y);helper.rotation.set(0,p.angle===undefined?(h%628)/100:-p.angle,0);helper.scale.setScalar(scale);helper.updateMatrix();
        for(const m of meshes)m.setMatrixAt(i,helper.matrix);
      });
      for(const m of meshes){m.count=items.length;m.instanceMatrix.needsUpdate=true;}
    }
  }
  const update=(pos,time,worldState={})=>{
    if(!pos||!Number.isFinite(pos.x+pos.y))return;
    const initial=lastX===Infinity;distant.update(pos.x,pos.y);
    if(isEnfer){
      const weather=cityClimate(worldState.epoch??Date.now());
      materials.lantern.emissiveIntensity=weather.lamps*1.4;
      materials.road.roughness=.94-.38*weather.rain;
      materials.water.map.offset.set(time*.018,time*.009);
    }
    if(initial||Math.hypot(lastX-pos.x,lastZ-pos.y)>38)setTargets(pos);
    const start=performance.now();let count=0;
    while(targets.length&&count<(initial?2:3)&&(count===0||performance.now()-start<(initial?26:4))){buildChunk(targets.shift());count++;}
    tick++;const size=worldState.destroyed?.size||0,n=worldState.props?.length||0;
    const changed=wearChanged(worldState.props||[],worldState.propHealth,worldState.propDamageRevision);
    const signalTick=Math.floor((worldState.epoch??Date.now())/1000);
    if(stamp===0||(signalTick!==lastSignalTick&&visibleSignal)||Math.hypot(propX-pos.x,propZ-pos.y)>2.8||size!==destroyCount||n!==lastPropCount||changed||tick-stamp>=33){
      lastSignalTick=signalTick;updateProps(pos,{...worldState,epoch:worldState.epoch??Date.now()});propX=pos.x;propZ=pos.y;destroyCount=size;lastPropCount=n;stamp=tick;
    }
  };
  return {update,dispose(){
    disposeGroup(root);distant.dispose();groundShadows.material.dispose();
    for(const m of Object.values(materials)){m.map?.dispose();m.dispose();}
  }};
}
