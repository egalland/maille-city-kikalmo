import {createWorldCamera} from './world-camera.js';
import {frontageSigns,namedFronts,paintFrontageSign} from './enfer-frontage.js';
import {storeByBuilding,shopOpening,shopHeadroom,shopFixture} from './enfer-retail.js';
import {parkingLots,lotPoint,parkingWidth,parkingDepth,parkingMarkings,parkingSign} from './enfer-parking-lots.js';
import {heritageByFootprint,heritagePlinth} from './enfer-heritage.js';
import {heritageModel} from './heritage-models.js';
import {emotePatch} from './emote-art.js';
import {canvasViewRange,detailedCanvasRange,streetViewRange} from './view-range.js';
import {paintSkyView} from './textile-sky.js';
import {paintStreetProp} from './street-props-art.js';
import {furnitureSprite} from './street-furniture-sprite.js';
import {paintStreetFabric,streetFabric} from './street-fabric.js';
import {feltStone as stone,feltSlate as roofs,windowCloth,glassCloth,shopCloth,zincCloth,marbleCloth} from './paris-applique.js';
import {paintKnit as knitArchitecture} from './wool-art.js';
import {createBleedFibers} from './bleed-fibers.js';
import {fiberLifetime,impactFibers} from './puppet-combat.js';
import {gradedRoad} from './enfer-bridges.js';
import {baseTerrainHeight,terrainHeight,terrainGradient,roadHeight,buildingGround,waterLevel,walkingPose} from './terrain-height.js';
import {terracePanels} from './street-terraces.js';
import {propDebris,propWearProfile,propWearStage,trackPropWear} from './prop-wear.js';
import {buildShotEffect,effectDuration,muzzleFlash} from './weapon-effects.js';
import {isAircraft} from './airfield.js';
import { vehicleSpec } from './vehicle-types.js';
// Perspective software renderer for browsers without a WebGL 2 context.
// It projects the same metre-space data, props, actors and camera boom as the GPU view.
import {enferStyle,enferStyles,enferWall,enferRoof,roofPitch} from './enfer-architecture.js';
import {buildings,streets,water,green,isEnfer} from './paris-data.js';
import {enclosureStrip} from './enclosure-textiles.js';
import {monuments,cameraDistance,nearbyProps,nearbyEnclosures,swimmingSurface} from './paris-world.js';
import {drawCanvasPuppet,drawCanvasCar} from './canvas-puppets.js';
import {pickupPatch,pickupStyle,pickupLift,pickupPhase,pickupRange,pickupMarkerWidth} from './pickup-art.js';
import {grandParisModels,skipLandmark} from './canvas-landmarks.js';

const swimGround=(x,y)=>swimmingSurface(x,y,true)??terrainHeight(x,y);
const tau=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),near=.32;
const mix=(a,b,t)=>a+(b-a)*t;
function tint(hex,f){
  const a=parseInt(hex.slice(1),16);
  const k=n=>Math.round(clamp(n*f,0,255));
  return 'rgb('+k(a>>16)+','+k((a>>8)&255)+','+k(a&255)+')';
}
function loopBounds(path){
  let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
  for(const p of path){l=Math.min(l,p[0]);r=Math.max(r,p[0]);t=Math.min(t,p[1]);b=Math.max(b,p[1]);}
  return {x:(l+r)*.5,y:(t+b)*.5,r:Math.hypot(r-l,b-t)*.5+1,l,t,rr:r,b};
}
function cells(){
  const map=new Map(),cell=126;
  return {
    add(o){const b=o.bounds;for(let x=Math.floor(b.l/cell);x<=Math.floor(b.rr/cell);x++)for(let y=Math.floor(b.t/cell);y<=Math.floor(b.b/cell);y++){const key=x+':'+y;let s=map.get(key);if(!s){s=[];map.set(key,s);}s.push(o);}},
    around(x0,y0,r){const out=new Set();for(let x=Math.floor((x0-r)/cell);x<=Math.floor((x0+r)/cell);x++)for(let y=Math.floor((y0-r)/cell);y<=Math.floor((y0+r)/cell);y++){const s=map.get(x+':'+y);if(s)for(const o of s)out.add(o);}return [...out];}
  };
}
let spatial=null;
function getSpatial(){
  if(spatial)return spatial;
  const blocks=cells(),ways=cells();
  for(const o of buildings){
    const bounds=loopBounds(o.poly);
    if(!isEnfer&&(skipLandmark(o.id)||String(o.id)==='157326'||String(o.id)==='444657'||['245184969','245198908'].includes(String(o.id))))continue;
    let area=0;for(let i=0;i<o.poly.length;i++){const a=o.poly[i],b=o.poly[(i+1)%o.poly.length];area+=a[0]*b[1]-b[0]*a[1];}
    blocks.add({o,bounds,ground:buildingGround(o.poly),wind:Math.sign(area),seed:Math.abs(Math.floor(Number(o.id)||bounds.x+bounds.y))});
  }
  for(const way of streets){if(way.level<0)continue;
    for(let i=1;i<way.path.length;i++){
      const a=way.path[i-1],b=way.path[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      if(len<.4)continue;
      const bounds=loopBounds([a,b]),w=Math.max(1.8,way.w||4);bounds.r+=w;bounds.l-=w;bounds.rr+=w;bounds.t-=w;bounds.b+=w;
      ways.add({a,b,nx:-dy/len,ny:dx/len,len,w,way,index:i-1,bounds});
    }
  }
  spatial={blocks,ways};return spatial;
}
const facadeImages=new Map();
let facadeArea=0;
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function facade(seed,levels,shade,glass,detail){
  const style=glass?0:seed%(detail===0?4:8);
  const key=[style,levels,shade,glass,detail].join('|');
  const cached=facadeImages.get(key);
  if(cached){facadeImages.delete(key);facadeImages.set(key,cached);return cached;}
  const w=detail===2?160:detail===1?80:40,floorH=Math.round(w*.49),shopH=Math.round(w*.52),h=levels*floorH+shopH;
  const c=makeCanvas(w,h),g=c.getContext('2d');
  if(glass){
    const pane=glassCloth();
    const size=w/4;for(let y=0;y<h;y+=size)for(let x=0;x<w;x+=size)g.drawImage(pane,x,y,size,size);
  }else{
    for(let floor=0;floor<levels;floor++)for(let col=0;col<2;col++){
      const variant=(style+col*3+(floor===0||floor===levels-2?0:2))%8;
      g.drawImage(windowCloth(variant),col*w/2,floor*floorH,w/2,floorH);
    }
    g.drawImage(shopCloth(style),0,h-shopH,w,shopH);
  }
  if(!shade){g.fillStyle='rgba(57,49,66,.18)';g.fillRect(0,0,w,h);}
  while(facadeArea+w*h>2750000&&facadeImages.size){
    const [old,img]=facadeImages.entries().next().value;facadeArea-=img.width*img.height;facadeImages.delete(old);
  }
  facadeArea+=w*h;facadeImages.set(key,c);return c;
}
const patternImages=new Map(),patternIds=new WeakMap();
let patternArea=0,nextPatternId=0;
function repeatFacade(img,count) {
  if(count<=1)return img;
  if(!patternIds.has(img))patternIds.set(img,++nextPatternId);
  const id=patternIds.get(img)+':'+count;
  const old=patternImages.get(id);
  if(old){patternImages.delete(id);patternImages.set(id,old);return old;}
  const c=makeCanvas(img.width*count,img.height),ctx=c.getContext('2d');
  ctx.fillStyle=ctx.createPattern(img,'repeat-x');ctx.fillRect(0,0,c.width,c.height);
  patternImages.set(id,c);patternArea+=c.width*c.height;
  // The large software atlas is shared by all visible faces and bounded across long journeys.
  while(patternArea>4000000 && patternImages.size>1){
    const [first,tile]=patternImages.entries().next().value;
    patternArea-=tile.width*tile.height;patternImages.delete(first);
  }
  return c;
}


let arcArt;
function illustratedArc(){
  if(arcArt)return arcArt;
  const w=464,h=510,c=makeCanvas(w,h),g=c.getContext('2d'),X=w/2,R=76,spring=318;
  const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#ead4af');grad.addColorStop(.55,'#d5b79a');grad.addColorStop(1,'#a9877f');
  const stroke=(x1,y1,x2,y2,col,th=1)=>{g.strokeStyle=col;g.lineWidth=th;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();};
  const circle=(x,y,r,col)=>{g.fillStyle=col;g.beginPath();g.arc(x,y,r,0,tau);g.fill();};
  const body=new Path2D();body.rect(0,0,w,h);
  const opening=new Path2D();opening.moveTo(X-R,h+3);opening.lineTo(X-R,spring);opening.arc(X,spring,R,Math.PI,0);opening.lineTo(X+R,h+3);opening.closePath();
  body.addPath(opening);g.clip(body,'evenodd');g.fillStyle=grad;g.fillRect(0,0,w,h);
  knitArchitecture(g,0,0,w,h,{step:10,opacity:.52,seed:31});
  for(let y=2;y<h;y+=10){
    stroke(0,y,w,y,'rgba(115,92,84,.33)',.65);
    for(let x=13*((y/10|0)%2);x<w;x+=35)stroke(x,y,x,y+10,'rgba(129,98,83,.33)',.65);
  }
  for(let y=3;y<h;y+=9)for(let x=5+(y%7);x<w;x+=19){stroke(x,y,x+3,y+1.7,'rgba(255,232,197,.38)',.65);stroke(x+3,y+1.7,x+5,y-.15,'rgba(164,125,96,.27)',.55);}
  const band=(y,hh,c1,c2)=>{g.fillStyle=c1;g.fillRect(0,y,w,hh);stroke(0,y,w,y,'#f2daba',1.7);stroke(0,y+hh,w,y+hh,c2,1.7);};
  band(1,7,'#e4c8a7','#957d76');band(10,3,'#c7aa94','#b0917d');
  for(let i=0;i<9;i++){
    const x=9+i*50;g.fillStyle='#b49782';g.fillRect(x,17,44,54);
    g.fillStyle='#e8cdab';g.fillRect(x+2,18,40,51);
    g.fillStyle='#ccb19a';g.fillRect(x+5,21,34,44);g.strokeStyle='#eed8b7';g.lineWidth=1;g.strokeRect(x+7,23,30,40);
    for(let j=0;j<4;j++){const jj=8+j;stroke(x+12,28+jj*2,x+32,28+jj*2,'rgba(120,105,91,.5)',.7);}
    circle(x+22,33,3.6,'#bca18a');circle(x+22,32,2.3,'#e4c9a5');
  }
  band(75,6,'#e9ceb0','#b69c88');band(83,7,'#cfb296','#8e776e');
  g.fillStyle='#998474';g.fillRect(0,92,w,5);g.fillStyle='#e4c8a5';for(let x=2;x<w;x+=9)g.fillRect(x,91,6,5);
  band(99,31,'#c2a38c','#9b8374');
  for(let i=0;i<49;i++){
    const x=i*9.7,y=118+Math.sin(i*9)*2;circle(x+2,y-9,2.4,'#e6caac');
    stroke(x+2,y-6,x+(i%2?1:4),y+2,i%2?'#a68b76':'#ead2ae',3);
    stroke(x+2,y-3,x+7,y-7,'#ddbf9e',1.8);stroke(x+1,y+1,x-2,y+7,'#d6b89d',1.8);stroke(x+2,y+1,x+7,y+7,'#a08775',1.8);
  }
  band(132,6,'#e6c9a7','#9b8472');band(141,3,'#d0b297','#baa18c');
  g.fillStyle='#c9ae93';for(let x=6;x<w;x+=14)g.fillRect(x,146,6,1.2);
  for(const sign of [-1,1]){
    const mid=X+sign*151;
    g.fillStyle='#b79a84';g.fillRect(mid-43,217,86,43);
    g.fillStyle='#e7c9a7';g.fillRect(mid-42,215,84,40);
    for(let j=0;j<9;j++){
      const x=mid-36+j*8.4,y=242-Math.sin(j*5)*3;
      circle(x,y-13,3.2,'#c5a48b');circle(x-.8,y-14,1.9,'#e6c9a5');
      stroke(x,y-10,x+1,y-2,'#b3957d',4);stroke(x,y-7,x+4,y-11,'#e3c4a2',2);
      stroke(x+1,y-1,x-3,y+8,'#c9a88d',2.8);stroke(x+1,y-1,x+5,y+8,'#b49981',2);
    }
    const px=mid-45,py=299;g.fillStyle='#ab8e79';g.fillRect(px,py,90,158);g.fillStyle='#c6ab90';g.fillRect(px+2,py+1,86,154);
    // Cluster of bas-relief figures and the allegorical figure above them.
    for(let j=0;j<8;j++){
      const sc=.7+.37*Math.sin(j*1.54),x=mid+(j-3.5)*9.5,y=425-((j*11)%18);
      circle(x,y-23*sc,4.6*sc,'#8f776b');circle(x-1,y-24*sc,4*sc,'#e5c4a2');
      stroke(x-.7,y-18*sc,x+1.5,y-1*sc,'#ad8f7b',8*sc);
      stroke(x+1,y-15*sc,x-7*sc,y-11*sc,'#dfbd9c',3.7*sc);
      stroke(x+1,y-15*sc,x+8*sc,y-21*sc,'#d5b497',3*sc);
      stroke(x,y-2*sc,x-5*sc,y+18*sc,'#a18675',4*sc);stroke(x,y-1*sc,x+6*sc,y+17*sc,'#dfbd9a',3.6*sc);
    }
    const x=mid;circle(x,329,6,'#a98b76');circle(x-1,327,5,'#e7c49b');
    g.fillStyle='#ad8b77';g.beginPath();g.moveTo(x-4,333);g.quadraticCurveTo(x-11,351,x-19,364);g.lineTo(x-2,358);g.lineTo(x+13,371);g.lineTo(x+7,334);g.fill();
    stroke(x-5,336,x-16,344,'#e5bc94',5);stroke(x-16,344,x-20,334,'#c6a28a',3);
    stroke(x+2,334,x+15,323,'#e4bd97',4.5);stroke(x+15,323,x+26,306,'#ae907c',1.6);
    for(const ss of [-1,1])for(let j=0;j<4;j++)stroke(x+ss*5,336+j*1.8,x+ss*(15+j*3),321+j*1.7,'#dabb9e',3.5);
    band(472,3,'#d5b99e','#9f8976');
    const mx=X+sign*114;circle(mx,183,12,'#ba9980');circle(mx-.6,182,10,'#ecd0a6');circle(mx,182,7.2,'#c4a486');
    for(const dx of [-2.2,2.2])for(const dy of [-2.2,2.2])circle(mx+dx,182+dy,1.55,'#8e7368');
    stroke(mx-2.2,179.8,mx+2.2,184.2,'#f1d3a9',1.8);stroke(mx+2.2,179.8,mx-2.2,184.2,'#e2bd93',1.8);
  }
  for(let j=0;j<=29;j++){
    const ang=Math.PI+j/29*Math.PI,cs=Math.cos(ang),sn=Math.sin(ang);
    stroke(X+R*cs,spring+R*sn,X+(R+14)*cs,spring+(R+14)*sn,j%3?'#a78a77':'#e8caaa',j%3?.8:1.4);
  }
  for(const offset of [2,7,13,17]){g.lineWidth=offset===17?2.5:1.4;g.strokeStyle=offset%2?'#e7cbac':'#a88e7b';
    g.beginPath();g.moveTo(X-R-offset,h);g.lineTo(X-R-offset,spring);g.arc(X,spring,R+offset,Math.PI,0);g.lineTo(X+R+offset,h);g.stroke();}
  // The running stitch follows the cutout like the bound edge of a felt appliqué.
  const edge=new Path2D();edge.moveTo(X-R-9,h);edge.lineTo(X-R-9,spring);edge.arc(X,spring,R+9,Math.PI,0);edge.lineTo(X+R+9,h);
  g.lineCap='round';g.strokeStyle='#a88878';g.lineWidth=4;g.stroke(edge);
  g.setLineDash([4,4]);g.strokeStyle='#f6ddb4';g.lineWidth=2.5;g.stroke(edge);g.setLineDash([]);
  band(496,7,'#d3b99c','#a08574');arcArt=c;return c;
}
const propArt=new Map();
function propImage(type,seed,stage){
  const key=type+(seed%3)+'/'+stage;if(propArt.has(key))return propArt.get(key);
  const c=makeCanvas(104,146),g=c.getContext('2d');g.lineCap='round';g.lineJoin='round';
  paintStreetProp(g,type,seed,stage);
  let image=c;
  const profile=propWearProfile(type);
  if(stage&&profile){
    const seam={tree:[50,118],lamp:[51,111],bench:[42,66],hydrant:[55,86],postbox:[53,65],bin:[55,77],bollard:[52,82],crate:[48,69]}[type];
    const [x,y]=seam,size=stage===1?1:1.6;
    g.lineWidth=3*size;g.strokeStyle=profile.yarn[2];g.beginPath();g.moveTo(x-4,y-5);
    g.lineTo(x+2,y);g.lineTo(x-2,y+3);g.lineTo(x+5,y+7);g.stroke();
    g.strokeStyle=profile.yarn[0];g.lineWidth=2*size;
    for(let i=0;i<=stage;i++){
      g.beginPath();g.moveTo(x+i*3-3,y+i*2);g.quadraticCurveTo(x+(i+2)*4,y+i*4-4,x+(i+1)*6,y+6+i*5);g.stroke();
    }
    image=makeCanvas(c.width,c.height);
    const paint=image.getContext('2d'),pivot=Math.round(c.height*(1-profile.pivot/profile.height));
    const amount=stage===1?.3:1,dx=Math.min(13,pivot*profile.lean*.8)*amount,sag=amount*profile.drop;
    paint.drawImage(c,0,pivot,c.width,c.height-pivot,0,pivot,c.width,c.height-pivot);
    paint.transform(1,0,-dx/pivot,1-sag,dx,pivot*sag);
    paint.drawImage(c,0,0,c.width,pivot,0,0,c.width,pivot);
  }
  propArt.set(key,image);return image;
}
function monumentModel(m){
  const faces=[],arc=m.id==='arc',side=m.side,depth=m.depth,gap=m.innerSide,cy=arc?18.7:0;
  const c=Math.cos(m.yaw),s=Math.sin(m.yaw);
  const world=([x,h,z])=>[m.x+x*c+z*s,m.y-x*s+z*c,h];
  const face=(pts,color,textile=null)=>{const p=pts.map(world);faces.push({p,color,textile,x:p.reduce((a,v)=>a+v[0],0)/p.length,y:p.reduce((a,v)=>a+v[1],0)/p.length});};
  function block(l,r,d,f,b,t,palette){
    const weave=len=>!arc?[Math.max(2,Math.round(len/6)),Math.max(2,Math.round((t-b)/5))]:null;
    face([[l,b,d],[r,b,d],[r,t,d],[l,t,d]],palette[0],weave(r-l));
    face([[l,b,f],[r,b,f],[r,t,f],[l,t,f]],palette[0],weave(r-l));
    face([[l,b,d],[l,b,f],[l,t,f],[l,t,d]],palette[1],weave(f-d));
    face([[r,b,d],[r,b,f],[r,t,f],[r,t,d]],palette[1],weave(f-d));
    face([[l,t,d],[r,t,d],[r,t,f],[l,t,f]],palette[2]);
  }
  const limestone=['#dfc4a2','#bca59b','#edddbb'],tinted=['#cfad94','#ae9387','#eed1ad'],trim=['#e7cdad','#c5b0a1','#f3e2c1'];
  if(arc){
    for(const lr of [[-side,-gap],[gap,side]])for(const fb of [[-depth,-4.2],[4.2,depth]])block(...lr,...fb,0,30,limestone);
    // Voussoirs on the main barrel. Each sculpted wedge is dimensioned in metres.
    for(let j=0;j<16;j++){
      const a=Math.PI*j/16,b=Math.PI*(j+1)/16,ix=gap*Math.cos(a),jx=gap*Math.cos(b),ih=cy+gap*Math.sin(a),jh=cy+gap*Math.sin(b);
      const xx=(gap+1.15)*Math.cos(a),zx=(gap+1.15)*Math.cos(b),xh=cy+(gap+1.15)*Math.sin(a),zh=cy+(gap+1.15)*Math.sin(b);
      for(const z of [-depth,depth]){
        face([[ix,ih,z],[jx,jh,z],[jx,31,z],[ix,31,z]],limestone[0]);
        face([[ix,ih,z*1.003],[jx,jh,z*1.003],[zx,zh,z*1.003],[xx,xh,z*1.003]],j%2?'#e9d1ac':'#d6b99e');
      }
      face([[ix,ih,-depth],[jx,jh,-depth],[jx,jh,depth],[ix,ih,depth]],'#9a8b83');
    }
    for(const z of [-depth,depth])for(const sign of [-1,1]){
      const mx=sign*(side+gap)*.5,zz=z*1.004;
      face([[mx-5.1,2,zz],[mx+5.1,2,zz],[mx+5.1,17.4,zz],[mx-5.1,17.4,zz]],'#c5a78f');
      for(let j=0;j<6;j++){const x=mx-3+j*1.27,h=7+((j*7)%6)*.8;
        face([[x-1.13,3.4,zz*1.003],[x+1.1,3.4,zz*1.003],[x+1.4,h-1,zz*1.003],[x+.49,h+1.39,zz*1.003],[x-.9,h,zz*1.003]],j%2?'#b69c88':'#cfb298');}
      face([[mx-4.7,19.0,zz],[mx+4.7,19,zz],[mx+4.7,23.4,zz],[mx-4.7,23.4,zz]],'#ead2ad');
      for(let j=0;j<5;j++)face([[mx-4+j*1.7,20.0,zz*1.002],[mx-3+j*1.7,20.0,zz*1.002],[mx-3.5+j*1.7,22.5,zz*1.002]],'#c7a995');
    }
    block(-side,side,-depth,depth,29.8,35.5,limestone);
    block(-side-.55,side+.55,-depth-.55,depth+.55,35.5,36.25,trim);
    block(-side,side,-depth,depth,36.25,39.8,tinted);
    for(const z of [-depth-.04,depth+.04])for(let i=0;i<24;i++){const x=-side+1+i*1.82;
      face([[x-.67,36.7,z],[x+.62,36.7,z],[x+.79,38.55,z],[x+.11,39.27,z],[x-.52,38.7,z]],i%2?'#ead2ac':'#c09d87');}
    block(-side-.83,side+.83,-depth-.83,depth+.83,39.8,41.4,trim);
    block(-side+.60,side-.60,-depth+.58,depth-.58,41.4,47.9,limestone);
    for(const z of [-depth+.36,depth-.36])for(let i=0;i<9;i++){
      const x=-side+2+i*4.9;
      face([[x,42.1,z],[x+3,42.1,z],[x+3,46.9,z],[x,46.9,z]],'#bfaa9a');
      face([[x+.25,42.45,z*1.001],[x+2.75,42.45,z*1.001],[x+2.75,46.55,z*1.001],[x+.25,46.55,z*1.001]],'#dfc6a7');
    }
    block(-side+.05,side-.05,-depth+.05,depth-.05,47.9,49.5,trim);
  }else{
    const glass=['#c6d0cb','#8da3a8','#e6e6d5'],marble=['#e8dfd3','#bdc7c8','#f2e7db'];
    for(const lr of [[-side,-gap],[gap,side]]){
      block(...lr,-depth,depth,0,m.h,marble);
      for(const z of [-depth-.06,depth+.06])for(let j=0;j<23;j++){
        const y=3+j*4.3;
        face([[lr[0]+1,y,z],[lr[1]-1,y,z],[lr[1]-1,y+1.3,z],[lr[0]+1,y+1.3,z]],glass[1]);}
    }
    block(-gap,gap,-depth,depth,m.clearance,m.h,marble);
    face([[-gap,m.clearance,-depth],[gap,m.clearance,-depth],[gap,m.clearance,depth],[-gap,m.clearance,depth]],'#91a3a5');
  }
  return {m,faces};
}
function parisLandmark(id,x,y){
  const faces=[];
  const add=(p,color)=>faces.push({p,color,x:p.reduce((s,v)=>s+v[0]/p.length,0),y:p.reduce((s,v)=>s+v[1]/p.length,0)});
  const rotate=(a,b,height)=>[x+a*.898-b*.44,y+a*.44+b*.898,height];
  if(id==='pyramid'){
    const r=17.55,top=rotate(0,0,21.6),square=[[-r,-r],[r,-r],[r,r],[-r,r]];
    for(let i=0;i<4;i++){
      const a=square[i],b=square[(i+1)%4],u=rotate(...a,0),v=rotate(...b,0);
      add([u,v,top],['#6b96a7','#87a8af','#adc4c1','#829ea7'][i]);
      for(let j=1;j<12;j++){
        const f=j/12,aa=[mix(u[0],v[0],f),mix(u[1],v[1],f),0],bb=[mix(u[0],top[0],f),mix(u[1],top[1],f),top[2]*f],cc=[mix(v[0],top[0],1-f),mix(v[1],top[1],1-f),top[2]*(1-f)];
        for(const target of [bb,cc]){const off=.07;add([aa,target,[target[0]+off,target[1],target[2]],[aa[0]+off,aa[1],aa[2]]],'#cfdbd2');}
      }
    }
  }else{
    const foot=1.53,top=.78,base=4.25,shaft=24.7;
    const corners=r=>[[-r,-r],[r,-r],[r,r],[-r,r]];
    for(let i=0;i<4;i++){
      const j=(i+1)%4,b=corners(2.8),bb=corners(2.55),lo=corners(foot),hi=corners(top);
      add([rotate(...b[i],0),rotate(...b[j],0),rotate(...bb[j],base),rotate(...bb[i],base)],['#bda991','#c4ada0','#a9968c','#d6bd9e'][i]);
      add([rotate(...lo[i],base),rotate(...lo[j],base),rotate(...hi[j],shaft),rotate(...hi[i],shaft)],['#c68f7c','#e1ae8d','#bd8e7b','#dda98a'][i]);
      add([rotate(...hi[i],shaft),rotate(...hi[j],shaft),rotate(0,0,26.4)],i%2?'#e9c571':'#d0a450');
    }
  }
  return {m:{id,x,y},faces};
}
const monumentModels=isEnfer?[]:[...Object.values(monuments).map(monumentModel),parisLandmark('pyramid',6284,2114),parisLandmark('obelisk',5206,1617),...grandParisModels];

export function createCanvasView(canvas,spawn,onNotice){
  let surface=canvas,g=canvas.getContext('2d',{alpha:false});
  if(!g){
    surface=document.createElement('canvas');
    surface.setAttribute('aria-hidden','true');
    surface.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    canvas.after(surface);g=surface.getContext('2d',{alpha:false});
  }
  if(!g){onNotice?.('Le navigateur ne fournit pas de surface de dessin.');return {available:false,mode:'canvas',render(){},aim(){return null;},projectTarget(){return null;},effect(){},dispose(){surface!==canvas&&surface.remove();}};}
  const spatial=getSpatial(),parks=green.map(a=>({a,bounds:loopBounds(a.poly)})),waters=water.map(a=>({a,level:waterLevel(a),bounds:loopBounds(a.poly)}));
  let projectionBase=null;const terraceFaces=[];
  let w=0,h=0,f=0,camX=spawn.x,camY=spawn.y,camH=2.3,fx=1,fy=0,sin=0,cos=1,horizon=.42,sideLimit=1;
  const followCamera=createWorldCamera(spawn);
  const facadeSigns=new Map();
  let cacheX=Infinity,cacheY=Infinity,nearBuildings=[],nearWays=[],enclosures=[],props=[],lastProps=-10;
  let renderQuality=1,overBudget=0,fastFrames=0;
  let running=true,drawn=false,clock=0,last=-10;const effects=[],queue=[],occlusion=[];
  const blood=createBleedFibers();
  let foregroundLayer=null;
  const wearChanged=trackPropWear();
  let background=null,backX=Infinity,backY=Infinity,backYaw=0,backPitch=0,backArm=0,backHeight=0,backVersion=null,backPropCount=0;
  function xyz(x,y,height,ground=projectionBase??terrainHeight(x,y)){
    const dx=x-camX,dy=y-camY,forward=dx*fx+dy*fy,v=ground+height-camH;
    return {s:-dx*fy+dy*fx,v:v*cos-forward*sin,d:forward*cos+v*sin};
  }
  function project(v){return {x:w*.5+f*v.s/v.d,y:h*.5-f*v.v/v.d,d:v.d};}
  function at(x,y,z,ground){const p=xyz(x,y,z,ground);return p.d>=near?project(p):null;}
  function drawBlood(strands,opacity=1){
    if(!strands)return;
    g.save();g.lineCap='round';g.lineJoin='round';g.globalAlpha=opacity;
    for(const {points,width,color} of strands){
      let started=false;g.beginPath();
      for(const p of points){
        const v=xyz(p.x,p.y,p.h,0);if(v.d<near){started=false;continue;}
        const pixel=project(v);
        if(!started){
          g.moveTo(pixel.x,pixel.y);g.lineWidth=Math.max(.38,width*f/v.d);started=true;
        }else g.lineTo(pixel.x,pixel.y);
      }
      g.strokeStyle=color;g.stroke();
    }
    g.restore();
  }
  function uprightBody(e){
    if(!e||e.isCar||e.stunned||e.ragdoll)return null;
    const lift=e.lift||0,low=at(e.x,e.y,.48+lift),high=at(e.x,e.y,1.49+lift);
    if(!low||!high)return null;
    const width=.38*f/((low.d+high.d)*.5);
    return {x:(low.x+high.x)*.5,r:width,top:high.y,bottom:low.y,depth:depth(e.x,e.y)};
  }
  function pedestrianOpacity(e,playerBody){
    if(!playerBody||e.self||e.isCar)return 1;
    const difference=playerBody.depth-depth(e.x,e.y);
    if(difference<=.1)return 1;
    const body=uprightBody(e);if(!body)return 1;
    const left=Math.max(playerBody.x-playerBody.r,body.x-body.r),right=Math.min(playerBody.x+playerBody.r,body.x+body.r);
    const width=Math.max(0,right-left)/(2*playerBody.r);
    const height=Math.max(0,Math.min(body.bottom,playerBody.bottom)-Math.max(body.top,playerBody.top))/(playerBody.bottom-playerBody.top);
    return 1-.70*clamp(width*height*2.8,0,1)*clamp((difference-.1)/.5,0,1);
  }
  function uprightSprite(e,base,top,height,time,angle,opacity){
    // Horizontal scale comes from camera depth. Shear maps the head and feet to their own
    // projected world centres when looking down on a pedestrian near the edge of the screen.
    const metresPerPixel=1.78/height,scaleX=metresPerPixel*f/((top.d+base.d)*.5);
    let ctx=g;
    if(opacity<.999){
      if(!foregroundLayer)foregroundLayer=makeCanvas(w,h);
      if(foregroundLayer.width!==w||foregroundLayer.height!==h){foregroundLayer.width=w;foregroundLayer.height=h;}
      ctx=foregroundLayer.getContext('2d');ctx.clearRect(0,0,w,h);
    }
    ctx.save();ctx.translate(base.x,base.y);ctx.transform(scaleX,0,(base.x-top.x)/height,1,0,0);
    drawCanvasPuppet(ctx,e,0,0,height,time,angle);
    ctx.restore();
    if(ctx!==g){
      // Fade the completed sprite once. Applying alpha per limb lets the hidden back arms and lining show through.
      g.save();g.globalAlpha=opacity;g.drawImage(foregroundLayer,0,0);g.restore();
    }
  }
  function projectPoly(points){
    const input=points.map(o=>xyz(...o)),clipped=[];
    let a=input[input.length-1];
    for(const b of input){
      if((a.d>=near)!==(b.d>=near)){const t=(near-a.d)/(b.d-a.d);clipped.push({s:mix(a.s,b.s,t),v:mix(a.v,b.v,t),d:near});}
      if(b.d>=near)clipped.push(b);a=b;
    }
    if(clipped.length<3)return null;const pp=clipped.map(project);
    if(pp.every(q=>q.x<-.8)||pp.every(q=>q.x>w+1)||pp.every(q=>q.y<-.8)||pp.every(q=>q.y>h+1))return null;
    return pp;
  }
  function fillPath(points,color,stroke=null){
    if(!points?.length)return;
    g.beginPath();g.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)g.lineTo(points[i].x,points[i].y);
    g.closePath();g.fillStyle=color;g.fill();
    if(stroke){g.strokeStyle=stroke;g.lineWidth=.7;g.stroke();}
  }
  function poly3(points,color,stroke){fillPath(projectPoly(points),color,stroke);}
  function depth(x,y){return (x-camX)*fx+(y-camY)*fy;}
  function seen(b,r=650){
    const dx=b.x-camX,dy=b.y-camY,d=dx*fx+dy*fy;
    return d>=-b.r&&d<r+b.r&&Math.abs(-dx*fy+dy*fx)<=Math.max(0,d)*sideLimit+b.r*2.0;
  }
  function roadRibbon(seg,extra,color,offset=0,a=seg.a,b=seg.b){
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const span=gradedRoad(seg.way,seg.index)?3:18;
    if(len>span){
      const parts=Math.ceil(len/span);let p=a;
      for(let j=1;j<=parts;j++){const q=[mix(a[0],b[0],j/parts),mix(a[1],b[1],j/parts)];roadRibbon(seg,extra,color,offset,p,q);p=q;}
      return;
    }
    const rad=Math.max(.035,seg.w*.5+extra),l=offset-rad,r=offset+rad,{nx,ny}=seg;
    const points=[[a,l],[b,l],[b,r],[a,r]].map(([p,d])=>{
      const x=p[0]+nx*d,y=p[1]+ny*d;return [x,y,0,roadHeight(seg.way,seg.index,x,y)];
    });
    const plane=projectPoly(points);
    fillPath(plane,color);
  }
  function ellipseGround(x,y,r,z,color){
    const points=[];for(let i=0;i<72;i++){const a=i/72*tau;points.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z]);}
    const face=projectPoly(points);fillPath(face,color);
  }
  function sky(yaw){
    paintSkyView(g,w,h,horizon,f,yaw);
    const ground=g.createLinearGradient(0,horizon,0,h);ground.addColorStop(0,'#c0ab92');ground.addColorStop(.18,'#b49e92');ground.addColorStop(1,'#a48d86');
    g.fillStyle=ground;g.fillRect(0,horizon,w,h-horizon);
  }
  function texturedFace(pic,world){
    // Clip UVs in camera space. This keeps the stone courses continuous when a wall crosses the camera.
    let poly=world.map(p=>({...xyz(p[0],p[1],p[2]),u:p[3],vv:p[4]}));
    for(const plane of [p=>p.d-near,p=>p.s+p.d*w/(2*f),p=>p.d*w/(2*f)-p.s,p=>p.v+p.d*h/(2*f),p=>p.d*h/(2*f)-p.v]){
      if(!poly.length)return;
      const out=[];let a=poly[poly.length-1],da=plane(a);
      for(const b of poly){
        const db=plane(b);
        if((da>=0)!==(db>=0)){const t=da/(da-db);out.push({s:mix(a.s,b.s,t),v:mix(a.v,b.v,t),d:mix(a.d,b.d,t),u:mix(a.u,b.u,t),vv:mix(a.vv,b.vv,t)});}
        if(db>=0)out.push(b);a=b;da=db;
      }
      poly=out;
    }
    if(poly.length<3)return;
    const scr=poly.map(q=>({...project(q),u:q.u,v:q.vv}));
    const a=scr[0];
    for(let j=1;j<scr.length-1;j++){
      const b=scr[j],c=scr[j+1],bu=b.u-a.u,bv=b.v-a.v,cu=c.u-a.u,cv=c.v-a.v;
      const det=bu*cv-bv*cu;if(Math.abs(det)<.001)continue;
      const x1=b.x-a.x,x2=c.x-a.x,y1=b.y-a.y,y2=c.y-a.y;
      const A=(x1*cv-x2*bv)/det,B=(y1*cv-y2*bv)/det,C=(x2*bu-x1*cu)/det,D=(y2*bu-y1*cu)/det;
      const mx=(a.x+b.x+c.x)/3,my=(a.y+b.y+c.y)/3;
      g.save();g.beginPath();for(const [i,pt] of [a,b,c].entries()){const vx=pt.x-mx,vy=pt.y-my,len=Math.hypot(vx,vy)||1;g[i?'lineTo':'moveTo'](pt.x+.35*vx/len,pt.y+.35*vy/len);}g.closePath();g.clip();
      g.transform(A,B,C,D,a.x-A*a.u-C*a.v,a.y-B*a.u-D*a.v);
      const l=Math.max(0,Math.floor(Math.min(a.u,b.u,c.u))-1),r=Math.min(pic.width,Math.ceil(Math.max(a.u,b.u,c.u))+1);
      const top=Math.max(0,Math.floor(Math.min(a.v,b.v,c.v))-1),bt=Math.min(pic.height,Math.ceil(Math.max(a.v,b.v,c.v))+1);
      if(r>l&&bt>top)g.drawImage(pic,l,top,r-l,bt-top,l,top,r-l,bt-top);
      g.restore();
    }
  }
  function arcFront(m){
    const ct=Math.cos(m.yaw),st=Math.sin(m.yaw),signZ=Math.sign((camX-m.x)*st+(camY-m.y)*ct)||-1;
    const zz=signZ*(m.depth+.14),surf=(x,z,h)=>[m.x+x*ct+z*st,m.y-x*st+z*ct,h];
    const pic=illustratedArc(),d=depth(m.x+zz*st,m.y+zz*ct);
    const quads=[];
    for(let j=0;j<12;j++){
      const a=-m.side+m.side*2*j/12,b=-m.side+m.side*2*(j+1)/12;
      const q=[surf(a,zz,49.1),surf(b,zz,49.1),surf(b,zz,0),surf(a,zz,0)].map(pt=>at(...pt));if(q.some(p=>!p))continue;
      quads.push({q,j});
    }
    if(!quads.length)return;
    queue.push({base:projectionBase,z:d-Math.abs(m.side*(ct*fx-st*fy))-1.3,draw:()=>{
      for(const {q,j} of quads){
        const a=q[0],b=q[1],c=q[2],d=q[3];
        g.save();g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.lineTo(c.x,c.y);g.lineTo(d.x,d.y);g.closePath();g.clip();
        const strip=pic.width/12;
        g.transform((b.x-a.x)/strip,(b.y-a.y)/strip,(d.x-a.x)/pic.height,((d.y-a.y)+(c.y-b.y))/(2*pic.height),a.x,a.y);
        g.drawImage(pic,j*strip,0,strip,pic.height,0,0,strip+.03,pic.height);g.restore();
      }
    }});
    const flag=surf(11,-.2,49.5),pole=surf(11,-.2,53.8),pp0=at(...flag),pp1=at(...pole);
    if(pp0&&pp1)queue.push({base:projectionBase,z:d-5,draw:()=>{
      g.strokeStyle='#786e71';g.lineWidth=Math.max(.65,f/pp1.d*.11);g.beginPath();g.moveTo(pp0.x,pp0.y);g.lineTo(pp1.x,pp1.y);g.stroke();
      const scale=f/pp1.d;for(let j=0;j<3;j++){const offset=j*1.08,dy=Math.sin(j*1.4+clock*1.4)*.21;
        g.fillStyle=['#4d668c','#f5e8ca','#c5565a'][j];g.fillRect(pp1.x+scale*offset,pp1.y+scale*dy,scale*1.12,scale*1.65);}
    }});
  }
  function groundRelief(){
    const distances=[.2,4,10,20,35,56,83,120,170,240,330,440,600,820,1150,1550],strips=12;
    let previous=null;
    for(let k=distances.length-1;k>=0;k--){
      const d=distances[k],row=[];
      for(let i=0;i<=strips;i++){
        const offset=(2*i/strips-1)*(d*sideLimit+3);
        const x=camX+fx*d-fy*offset,y=camY+fy*d+fx*offset;
        row.push([x,y,-.12,baseTerrainHeight(x,y)]);
      }
      if(previous)for(let i=0;i<strips;i++){
        const a=row[i],b=row[i+1],c=previous[i+1],e=previous[i];
        const grade=(terrainHeight(c[0],c[1])-terrainHeight(b[0],b[1]))/(distances[k+1]-d);
        const haze=clamp(d/900,0,1),light=clamp(grade*.52,-.08,.09);
        poly3([a,b,c,e],tint('#c3a995',.96+haze*.09+light));
      }
      previous=row;
    }
  }
  // Keep the material mask in world coordinates. It is rebuilt once per block of
  // travel and directly shared by every projected scanline when the camera pans.
  let surfaceAtlas=null,groundOverlay=null,patternLevels=null;
  const reliefLut=[];
  const surfacePeriod=[streetFabric.paving.meters,streetFabric.road.meters,streetFabric.park.meters,streetFabric.water.meters];
  function surfaceMap(){
    const size=384,scale=3,cx=Math.floor(camX/20)*20,cy=Math.floor(camY/20)*20;
    if(surfaceAtlas?.cx===cx&&surfaceAtlas.cy===cy)return surfaceAtlas;
    const canvas=surfaceAtlas?.canvas||makeCanvas(size,size),mask=canvas.getContext('2d',{willReadFrequently:true});
    const left=cx-size/(2*scale),top=cy-size/(2*scale),radius=size/(2*scale)+8;
    mask.setTransform(scale,0,0,scale,-left*scale,-top*scale);mask.fillStyle=isEnfer&&spatial.blocks.around(cx,cy,52).filter(o=>Math.hypot(o.bounds.x-cx,o.bounds.y-cy)<55).length<12?'#800000':'#000';mask.fillRect(left,top,size/scale,size/scale);
    function fillArea(list,red){
      mask.fillStyle=red;
      for(const {a,bounds} of list)if(Math.abs(bounds.x-cx)<bounds.r+radius&&Math.abs(bounds.y-cy)<bounds.r+radius){
        mask.beginPath();
        for(const ring of [a.poly,...(a.holes||[])]){
          if(ring.length<3)continue;mask.moveTo(...ring[0]);for(let i=1;i<ring.length;i++)mask.lineTo(...ring[i]);mask.closePath();
        }
        mask.fill('evenodd');
      }
    }
    function circle(x,y,r,color){mask.fillStyle=color;mask.beginPath();mask.arc(x,y,r,0,tau);mask.fill();}
    fillArea(parks,'#800000');fillArea(waters,'#c00000');
    const arc=monuments.arc,arcVisible=!isEnfer&&Math.hypot(cx-arc.x,cy-arc.y)<radius*1.5+115;
    if(arcVisible)circle(arc.x,arc.y,115,'#400000');
    const local=spatial.ways.around(cx,cy,radius);
    for(const curb of [true,false]){
      mask.strokeStyle=curb?'#000':'#400000';mask.lineCap='butt';
      for(const s of local){
        if(!curb&&s.way.kind==='path')continue;
        mask.lineWidth=s.w+(curb?2.7:0);mask.beginPath();mask.moveTo(...s.a);mask.lineTo(...s.b);mask.stroke();
      }
    }
    if(arcVisible)circle(arc.x,arc.y,35.2,'#000');
    const pixels=mask.getImageData(0,0,size,size).data,material=new Uint8Array(size*size);
    for(let i=0;i<material.length;i++)material[i]=Math.min(3,Math.round(pixels[i*4]/64));
    return surfaceAtlas={canvas,cx,cy,size,scale,left,top,material};
  }
  function clothSamples(){
    const tile=makeCanvas(128,128),small=makeCanvas(1,1);
    return ['paving','road','park','water'].map(kind=>{
      const base=tile.getContext('2d');base.clearRect(0,0,128,128);
      paintStreetFabric(base,128,128,kind,false);
      // Store just the signed lightness of each yarn ridge. A single lookup
      // converts its bilinearly sampled relief back into translucent light or shadow.
      const rgb=parseInt(streetFabric[kind].color.slice(1),16);
      const mid=(rgb>>16)*.30+((rgb>>8)&255)*.59+(rgb&255)*.11;
      const shades=new Uint32Array(256),bytes=new Uint8Array(shades.buffer);
      for(let i=0;i<256;i++){
        const light=i>=128,val=light?[251,230,200]:[54,43,64];
        const a=Math.min(255,Math.abs(i-128)*255/(light?232-mid:mid-50));
        bytes.set([...val,Math.round(a)],4*i);
      }
      reliefLut.push(shades);
      return [128,64,32,16,8].map(size=>{
        small.width=small.height=size;const output=small.getContext('2d');
        output.imageSmoothingEnabled=true;output.imageSmoothingQuality='high';output.drawImage(tile,0,0,size,size);
        const rgba=output.getImageData(0,0,size,size).data,relief=new Uint8Array(size*size);
        for(let i=0;i<relief.length;i++){
          const k=i*4,light=rgba[k]*.30+rgba[k+1]*.59+rgba[k+2]*.11;
          relief[i]=clamp(128+Math.round((light-mid)*rgba[k+3]/255),0,255);
        }
        return relief;
      });
    });
  }
  function groundTexture(){
    const atlas=surfaceMap(),scale=Math.min(.65,480/w),ow=Math.max(1,Math.ceil(w*scale));
    const ahead=distance=>at(camX+fx*distance,camY+fy*distance,.015);
    const far=36,farPoint=ahead(far);if(!farPoint)return;
    const top=Math.max(0,Math.floor(farPoint.y)),oh=Math.ceil((h-top)*scale);
    if(oh<=0)return;
    if(!patternLevels)patternLevels=clothSamples();
    if(!groundOverlay||groundOverlay.canvas.width!==ow||groundOverlay.image.height<oh){
      // Room above the current horizon prevents reallocating the buffer on small slopes.
      const canvas=makeCanvas(ow,Math.ceil(h*scale)),context=canvas.getContext('2d');
      const image=context.createImageData(ow,canvas.height);
      groundOverlay={canvas,context,image,pixels:new Uint32Array(image.data.buffer)};
    }
    const {canvas,context,image,pixels}=groundOverlay;pixels.fill(0,0,ow*oh);
    let distance=.65,front=ahead(distance);
    while(distance<far){
      const next=Math.min(far,distance+Math.max(.16,distance*.12)),back=ahead(next);
      if(front&&back&&front.y>back.y){
        const lastRow=Math.min(oh,Math.ceil((front.y-top)*scale-.5)),firstRow=Math.max(0,Math.ceil((back.y-top)*scale-.5));
        const depthPerRow=(next-distance)/((front.y-back.y)*scale);
        // Minify in depth as well as across the road, eliminating swimming stitches at the horizon.
        const lod=clamp(Math.floor(Math.log2(Math.max(1,depthPerRow*32))),0,4),ts=128>>lod,wrap=ts-1;
        const rates=surfacePeriod.map(period=>ts/period),samples=patternLevels.map(levels=>levels[lod]);
        for(let row=firstRow;row<lastRow;row++){
          const y=top+(row+.5)/scale,t=(front.y-y)/(front.y-back.y);
          const z=1/((1-t)/front.d+t/back.d),d=z*((1-t)*distance/front.d+t*next/back.d);
          const spacing=z/(scale*f),l=(.5/scale-w*.5)*z/f,fade=clamp((far-d)/9,0,1);
          let x=camX+fx*d-fy*l,wy=camY+fy*d+fx*l,index=row*ow;
          const stepX=-fy*spacing,stepY=fx*spacing;
          for(let col=0;col<ow;col++,x+=stepX,wy+=stepY){
            const mx=Math.floor((x-atlas.left)*atlas.scale),my=Math.floor((wy-atlas.top)*atlas.scale);
            const kind=mx>=0&&mx<atlas.size&&my>=0&&my<atlas.size?atlas.material[my*atlas.size+mx]:0,rate=rates[kind];
            const px=x*rate,py=wy*rate,ix=Math.floor(px),iy=Math.floor(py),tx=ix&wrap,nextX=(ix+1)&wrap;
            const iy0=(iy&wrap)*ts,iy1=((iy+1)&wrap)*ts,sample=samples[kind];
            const tintA=mix(sample[iy0+tx],sample[iy0+nextX],px-ix),tintB=mix(sample[iy1+tx],sample[iy1+nextX],px-ix);
            pixels[index++]=reliefLut[kind][Math.round(128+(mix(tintA,tintB,py-iy)-128)*fade)];
          }
        }
      }
      distance=next;front=back;
    }
    context.putImageData(image,0,0,0,0,ow,oh);g.drawImage(canvas,0,0,ow,oh,0,top,w,oh/scale);
  }
  function hiddenByFacade(pp){
    // Scan-convert a conservative depth mask in screen columns. Farther façades behind a closer street wall never need texturing.
    const step=9,minX=Math.max(0,Math.min(...pp.map(q=>q.x))),maxX=Math.min(w,Math.max(...pp.map(q=>q.x)));
    const lo=Math.max(0,Math.floor(minX/step)),hi=Math.ceil(maxX/step),isWide=maxX-minX>step*1.3;
    let visible=false;
    for(let col=lo;col<=hi;col++){
      const x=clamp((col+.5)*step,minX+.01,maxX-.01);let top=Infinity,bottom=-Infinity;
      for(let i=0;i<pp.length;i++){
        const a=pp[i],b=pp[(i+1)%pp.length],dx=b.x-a.x;
        if(Math.abs(dx)<.001||x<Math.min(a.x,b.x)||x>Math.max(a.x,b.x))continue;
        const y=a.y+(b.y-a.y)*(x-a.x)/dx;top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      if(bottom<=top)continue;
      const mask=occlusion[col];
      if(!mask||top<mask.top-1.4||bottom>mask.bottom+1.4)visible=true;
      if(!isWide||col*step<minX||(col+1)*step>maxX)continue;
      if(!mask)occlusion[col]={top:top+2,bottom:bottom-2};
      else if(top<=mask.bottom&&bottom>=mask.top){mask.top=Math.min(mask.top,top+2);mask.bottom=Math.max(mask.bottom,bottom-2);}
    }
    return !visible;
  }
  function building(item,skyline=false){
    const {o,wind,seed,bounds}=item,poly=o.poly,H=Math.max(2.2,o.h||13);
    const site=isEnfer&&heritageByFootprint.get(String(o.id));
    if(site){
      projectionBase=baseTerrainHeight(site.x,site.y);
      const add=(points,color)=>{
        const pp=projectPoly(points);
        if(!pp)return;
        const u=points[1][0]-points[0][0],v=points[1][1]-points[0][1],l=Math.hypot(u,v);
        const shade=l>.001?.91+.09*(v-u*.4)/l:1;
        const z=points.reduce((n,p)=>n+depth(p[0],p[1]),0)/points.length,fill=tint(color,shade);
        queue.push({z,draw:()=>fillPath(pp,fill)});
      };
      const base=heritagePlinth(site,o);
      for(let i=0;i<base.poly.length;i++){
        const a=base.poly[i],b=base.poly[(i+1)%base.poly.length];
        add([[...a,0],[...b,0],[...b,base.height],[...a,base.height]],site.key==='mairie-briques'?'#a25e50':'#cbbb9e');
      }
      add(base.poly.map(p=>[...p,base.height]),'#9a8981');
      if(String(o.id)===site.ids[0]){
        const near=!skyline&&Math.hypot(site.x-camX,site.y-camY)<150;
        for(const f of heritageModel(site,skyline?'silhouette':near))add(f.p.map(([x,h,z])=>[x,z,h]),f.color);
      }
      return;
    }
    const enferIndex=isEnfer?enferStyle(o):-1,local=enferStyles[enferIndex];
    const glass=!local&&(H>48||(bounds.x< -135&&bounds.y< -625&&H>24));
    const pitched=local&&enferRoof(poly,H,enferIndex);
    const eave=pitched?.wall??(glass?H-.7:H>7.5?H-Math.min(3.25,H*.15):H-.65);
    const frontage=isEnfer&&namedFronts.get(String(o.id));
    const store=isEnfer&&!skyline&&storeByBuilding.get(String(o.id));
    if(store){
      const [left,right]=shopOpening(poly,store),sign=frontageSigns[store.style];
      const surface=(ring,h,color)=>{
        const points=projectPoly(ring.map(p=>[...p,h]));
        if(points)queue.push({z:ring.reduce((sum,p)=>sum+depth(...p),0)/ring.length,base:item.ground,draw:()=>fillPath(points,color)});
      };
      const wall=(a,b,low,high,color)=>{
        const points=projectPoly([[...a,low],[...b,low],[...b,high],[...a,high]]);
        if(points)queue.push({z:depth((a[0]+b[0])/2,(a[1]+b[1])/2),base:item.ground,draw:()=>fillPath(points,color)});
      };
      for(let j=0;j<poly.length;j++){
        const a=poly[j],b=poly[(j+1)%poly.length];
        if(j!==store.edge){wall(a,b,0,H,local.wall);continue;}
        wall(a,left,0,H,sign.color);wall(right,b,0,H,sign.color);
        wall(left,right,shopHeadroom,H,sign.color);
        const z=depth(...store.point(0,0)),p=projectPoly([
          [...store.point(-store.halfWidth,-.08),shopHeadroom+.04],
          [...store.point(store.halfWidth,-.08),shopHeadroom+.04],
          [...store.point(store.halfWidth,-.08),shopHeadroom+.51],
          [...store.point(-store.halfWidth,-.08),shopHeadroom+.51]
        ]);
        if(p&&z>0)queue.push({z:z-.06,base:item.ground,draw:()=>{
          let texture=facadeSigns.get(frontage.style);
          if(!texture){
            texture=makeCanvas(256,64);paintFrontageSign(texture.getContext('2d'),256,64,sign);
            facadeSigns.set(frontage.style,texture);
          }
          texturedFace(texture,[
            [...store.point(-store.halfWidth,-.08),shopHeadroom+.04,0,texture.height],
            [...store.point(store.halfWidth,-.08),shopHeadroom+.04,texture.width,texture.height],
            [...store.point(store.halfWidth,-.08),shopHeadroom+.51,texture.width,0],
            [...store.point(-store.halfWidth,-.08),shopHeadroom+.51,0,0]
          ]);
        }});
      }
      for(const fixture of [store.booth,...store.furnishings]){
        const ring=shopFixture(store,fixture);
        for(let i=0;i<ring.length;i++)wall(ring[i],ring[(i+1)%4],0,fixture.h,i%2?store.tint:'#99745e');
        surface(ring,fixture.h,'#ddc29b');
      }
      if(camH>H+item.ground)surface(poly,H,local.roof);
      return;
    }
    const top=poly.map(q=>[q[0]+(bounds.x-q[0])*.032,q[1]+(bounds.y-q[1])*.032,H]);
    for(let j=0;j<poly.length;j++){
      const a=poly[j],b=poly[(j+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      if(length<.35)continue;
      const normalX=wind*dy/length,normalY=-wind*dx/length;
      if(normalX*(camX-a[0])+normalY*(camY-a[1])<0)continue;
      const d=depth((a[0]+b[0])*.5,(a[1]+b[1])*.5),shade=normalX*-.45+normalY*-.6>-.09?1:0;
      const crest=skyline?H:eave;
      const pts=[[a[0],a[1],Math.min(0,terrainHeight(a[0],a[1])-item.ground)-.12],[b[0],b[1],Math.min(0,terrainHeight(b[0],b[1])-item.ground)-.12],[b[0],b[1],crest],[a[0],a[1],crest]];
      const pp=projectPoly(pts);if(!pp||hiddenByFacade(pp))continue;
      if(skyline){
        const color=local?tint(local.wall,shade?1:.85):glass?(shade?'#a2a5af':'#8e969f'):(shade?'#c5ae9c':'#ac9a94');
        queue.push({z:d,base:item.ground,draw:()=>fillPath(pp,color)});
        continue;
      }
      queue.push({z:d,base:item.ground,draw:()=>{
        fillPath(pp,glass?shade?'#829aa1':'#657b88':tint(local?.wall||stone[seed%8],shade?1.00:.85));
        const topA=top[j],topB=top[(j+1)%top.length],roofColor=local?.roof||roofs[seed%roofs.length];
        const roofFace=[[a[0],a[1],eave],[b[0],b[1],eave],topB,topA];
        if(pitched){
          const left=pitched.ridge(a),right=pitched.ridge(b),rim=[[...b,pitched.top(b)]];
          if(left*right<0){const t=left/(left-right);rim.push([a[0]+dx*t,a[1]+dy*t,H]);}
          rim.push([...a,pitched.top(a)]);
          poly3([[...a,eave],[...b,eave],...rim],tint(local.wall,shade?.91:.78));
        }else poly3(roofFace,glass?'#a5b8b5':roofColor);
        if(!pitched&&!glass&&d<115&&length>1.8&&H>7.5){
          const tile=zincCloth(),pic=repeatFacade(tile,clamp(Math.round(length/4),1,9));
          g.save();g.globalAlpha=.32;
          texturedFace(pic,roofFace.map((q,i)=>[...q,i===1||i===2?pic.width:0,i<2?pic.height:0]));
          g.restore();
        }
        if(d>620||length<1.8)return;
        const bays=clamp(Math.round(length/(local?.bay||6.6)),1,40),count=d>85?Math.min(3,Math.ceil(bays/4)):Math.min(16,bays),floors=clamp(Math.round((eave-3)/3.2),1,10);
        const repeats=clamp(Math.round(bays/count),1,10);
        function picture(k,detail){
          if(local)return repeatFacade(enferWall(enferIndex,enferIndex===4?1:clamp(Math.round(eave/2.75),1,10),k===0&&enferIndex<3&&(seed+j)%3===0&&length>3),repeats);
          const style=detail?(seed+j*3+k*5)%8:seed;
          return repeatFacade(facade(style,floors,shade,glass,detail),repeats);
        }
        for(let k=0;k<count;k++){
          let aa=k/count,bb=(k+1)/count;
          if(d<34){
            const x1=a[0]+dx*aa,z1=a[1]+dy*aa,x2=a[0]+dx*bb,z2=a[1]+dy*bb;
            const da=depth(x1,z1),db=depth(x2,z2);
            if(Math.max(da,db)<near)continue;
            const pic=picture(k,Math.min(da,db)<12?2:1),u1=wind>0?pic.width:0,u2=pic.width-u1;
            const rows=clamp(Math.ceil(eave/4),2,9);
            for(let r=0;r<rows;r++){
              const t=r/rows,u=(r+1)/rows,y0=eave*(1-t),y1=eave*(1-u);
              texturedFace(pic,[[x1,z1,y0,u1,pic.height*t],[x2,z2,y0,u2,pic.height*t],[x2,z2,y1,u2,pic.height*u],[x1,z1,y1,u1,pic.height*u]]);
            }
            continue;
          }
          // Crop the strip to the camera near plane before projection when brushing a shopfront.
          const da=Math.min(xyz(a[0]+dx*aa,a[1]+dy*aa,eave).d,xyz(a[0]+dx*aa,a[1]+dy*aa,0).d);
          const db=Math.min(xyz(a[0]+dx*bb,a[1]+dy*bb,eave).d,xyz(a[0]+dx*bb,a[1]+dy*bb,0).d);
          if(da<=near+.02&&db<=near+.02)continue;
          if(da<=near+.02)aa=mix(aa,bb,(near+.04-da)/(db-da));
          else if(db<=near+.02)bb=mix(aa,bb,(near+.04-da)/(db-da));
          const ax=a[0]+dx*aa,ay=a[1]+dy*aa,bx=a[0]+dx*bb,by=a[1]+dy*bb;
          const p1=at(ax,ay,eave),p2=at(bx,by,eave),p3=at(bx,by,0),p4=at(ax,ay,0);
          if(!p1||!p2||!p3||!p4)continue;
          if([p1,p2,p3,p4].every(pt=>pt.x<0)||[p1,p2,p3,p4].every(pt=>pt.x>w))continue;
          const width=p2.x-p1.x;if(Math.abs(width)<.7)continue;
          const pic=picture(k,Math.abs(width)/repeats>100?2:Math.abs(width)/repeats>38?1:0);
          const stripHeight=Math.max(0,p4.y-p1.y);
          g.save();
          if(d<45||Math.abs((p3.y-p2.y)-stripHeight)>2.5){g.beginPath();g.moveTo(p1.x,p1.y);g.lineTo(p2.x,p2.y);g.lineTo(p3.x,p3.y);g.lineTo(p4.x,p4.y);g.closePath();g.clip();}
          g.transform(width/pic.width,(p2.y-p1.y)/pic.width,(p4.x-p1.x)/pic.height,(stripHeight+(p3.y-p2.y))*.5/pic.height,p1.x,p1.y);
          if(wind>0){g.translate(pic.width,0);g.scale(-1,1);}
          g.drawImage(pic,0,0);g.restore();
        }
        if(frontage&&j===frontage.edge&&d<110){
          const sign=frontageSigns[frontage.style],width=Math.min(sign.wares?5.4:4.1,length*.84),center=length/2;
          const cap=Math.min(3.15,eave-.10),left=center-width/2,right=center+width/2;
          const pt=(u,inset,h)=>[a[0]+dx*u/length+normalX*inset,a[1]+dy*u/length+normalY*inset,h];
          const panel=(l,r,base,top,tint,inset=.07)=>poly3([pt(l,inset,base),pt(r,inset,base),pt(r,inset,top),pt(l,inset,top)],tint);
          panel(left,right,.08,cap,sign.color);
          panel(left+.13,right-.13,.71,cap-.55,'#688080');
          panel(center-.33,center+.33,.10,cap-.54,sign.color,.09);
          for(const u of [left+.16,right-.16])panel(u-.03,u+.03,.59,cap-.53,'#e9d6ad',.10);
          if(sign.wares){
            const tones=sign.wares==='bread'?['#daa16a','#e8b678','#ce8958']:sign.wares==='flowers'?
              ['#e5a2ae','#a7a0ce','#dfbc74']:['#c99d64','#abc6b0','#bc7880'];
            for(const side of [-1,1])for(let i=0;i<5;i++){
              const u=center+side*(.46+i*(width*.39-.46)/4);
              panel(u-.075,u+.075,.91,1.08+i%3*.11,tones[i%tones.length],.10);
            }
          }
          let pic=facadeSigns.get(frontage.style);
          if(!pic){pic=makeCanvas(256,64);paintFrontageSign(pic.getContext('2d'),256,64,sign);facadeSigns.set(frontage.style,pic);}
          const u0=wind>0?256:0,u1=256-u0;
          texturedFace(pic,[[...pt(left,.12,cap-.04),u0,0],[...pt(right,.12,cap-.04),u1,0],
            [...pt(right,.12,cap-.51),u1,64],[...pt(left,.12,cap-.51),u0,64]]);
          if(frontage.style!==2)for(let i=0;i<9;i++){
            const l=left+width*i/9,r=left+width*(i+1)/9,tint=i%2?'#edceb1':sign.awning;
            poly3([pt(l,.07,cap-.52),pt(r,.07,cap-.52),pt(r,.81,cap-.76),pt(l,.81,cap-.76)],tint);
            poly3([pt(l,.81,cap-.76),pt(r,.81,cap-.76),pt(r,.81,cap-.90),pt(l,.81,cap-.90)],tint);
          }
        }
      }});
    }
    if(pitched){
      for(const side of [-1,1]){
        const facet=roofPitch(poly,pitched.ridge,side),plane=projectPoly(facet.map(p=>[...p,pitched.top(p)]));
        if(plane&&facet.length>=3&&H+item.ground<camH+.45)
          queue.push({z:depth(bounds.x,bounds.y),draw:()=>fillPath(plane,tint(local.roof,side>0?1:.86))});
      }
    }else{
      const rooftop=projectPoly(top);if(rooftop&&H+item.ground<camH)queue.push({z:depth(bounds.x,bounds.y),draw:()=>fillPath(rooftop,local?.roof||roofs[seed%roofs.length])});
    }
  }
  function showProp(o,health){
    if(terracePanels[o.type]){
      projectionBase=terrainHeight(o.x,o.y);
      const c=Math.cos(o.angle),s=Math.sin(o.angle),cx=camX-o.x,cy=camY-o.y;
      for(const {normal:[nx,ny],points,color} of terracePanels[o.type]){
        if((nx||ny)&&nx*(c*cx+s*cy)+ny*(-s*cx+c*cy)<(nx?o.halfLength:o.halfWidth))continue;
        const vertices=points.map(([along,h,across])=>[o.x+c*along-s*across,o.y+s*along+c*across,h]);
        const plane=projectPoly(vertices);if(!plane)continue;
        const depths=vertices.map(([x,y])=>depth(x,y));
        const z=nx||ny?(Math.min(...depths)+Math.max(...depths))/2:depth(o.x,o.y)+o.r+.2;
        queue.push({z,draw:()=>fillPath(plane,color)});
        terraceFaces.push({plane,color,top:projectionBase+o.h,z,left:Math.min(...plane.map(v=>v.x)),right:Math.max(...plane.map(v=>v.x)),bottom:Math.max(...plane.map(v=>v.y)),upper:Math.min(...plane.map(v=>v.y))});
      }
      projectionBase=null;return;
    }
    const tree=o.type==='tree',ground=tree?baseTerrainHeight(o.x,o.y)-.10:undefined;
    const base=at(o.x,o.y,0,ground),height=tree?Math.max(4.7,o.h):o.h||1;
    if(!base||base.d>295)return;const top=at(o.x,o.y,height,ground);if(!top)return;
    const ph=base.y-top.y;if(ph<2||base.x<-ph||base.x>w+ph)return;
    const stage=propWearStage(health),pixelsPerMetre=f/base.d;
    const heading=Math.atan2(o.y-camY,o.x-camX)-(o.angle||0);
    const furniture=furnitureSprite(o.type,stage,heading);
    if(furniture){
      queue.push({z:base.d,draw:()=>g.drawImage(furniture.image,
        base.x+furniture.left*pixelsPerMetre,base.y+furniture.top*pixelsPerMetre,
        furniture.width*pixelsPerMetre,furniture.height*pixelsPerMetre)});
      return;
    }
    const s=Math.abs(Math.floor(o.x*7+o.y*3)),pic=propImage(o.type,s,stage);
    queue.push({z:base.d,draw:()=>{
      const width=height*.745*pixelsPerMetre;
      g.drawImage(pic,base.x-width/2,base.y-ph,width,ph);
    }});
  }
  const pickupVisibility=new Map();
  function coverBehindTerrace(e,base,top,height) {
    if(!terraceFaces.length)return;
    const foot=terrainHeight(e.x,e.y)+(e.lift||0),width=height*(e.isCar?1.8:.67),left=base.x-width,right=base.x+width,cut=base.d-.08;
    for(const face of terraceFaces){
      if(foot>=face.top-.05||right<face.left||left>face.right||top.y>face.bottom||base.y+2<face.upper)continue;
      const clipped=[];let a=face.plane.at(-1);
      for(const b of face.plane){
        if((a.d<cut)!==(b.d<cut)){
          // Perspective-correct interpolation of inverse depth on a projected edge.
          const t=(1/cut-1/a.d)/(1/b.d-1/a.d);
          clipped.push({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)});
        }
        if(b.d<cut)clipped.push(b);a=b;
      }
      if(clipped.length<3)continue;
      g.save();g.beginPath();g.rect(left,top.y-2,2*width,height+5);g.clip();fillPath(clipped,face.color);g.restore();
    }
  }
  function pickupClear(id,x,y,height,reach,time,destroyed){
    const cached=pickupVisibility.get(id),revision=destroyed?.size||0;
    if(cached&&revision===cached.revision&&time-cached.time<.21&&Math.hypot(camX-cached.x,camY-cached.y)<.35&&Math.abs(camH-cached.h)<.12)return cached.clear;
    const clear=reach<=1.65||cameraDistance(camX,camY,camH-terrainHeight(camX,camY),Math.atan2(y-camY,x-camX),reach,height,destroyed)>=reach-.75;
    if(pickupVisibility.size>128)pickupVisibility.clear();
    pickupVisibility.set(id,{x:camX,y:camY,h:camH,clear,time,revision});
    return clear;
  }
  function queuePickup(p,time,destroyed){
    const style=pickupStyle(p.weapon);
    if(!style||!Number.isFinite(p.x+p.y)||!seen({x:p.x,y:p.y,r:1.25},pickupRange))return;
    const reach=Math.hypot(p.x-camX,p.y-camY);if(reach>pickupRange||reach<.43)return;
    const phase=pickupPhase(p.id),height=pickupLift(time,phase);
    const base=at(p.x,p.y,.11),icon=at(p.x,p.y,height),body=at(p.x,p.y,.23),cap=at(p.x,p.y,.45);
    if(!base||!icon||!body||!cap)return;
    if(!pickupClear(p.id,p.x,p.y,height,reach,time,destroyed))return;
    const unit=f/base.d,art=pickupPatch(p.weapon),iconWidth=pickupMarkerWidth*f/icon.d;
    if(icon.x+iconWidth*.55<0||icon.x-iconWidth*.55>w||base.y<0||icon.y-iconWidth*.42>h)return;
    queue.push({z:depth(p.x,p.y),draw:()=>{
      const radius=.57*unit;
      const ellipse=(x,y,rx,ry,col)=>{g.beginPath();g.ellipse(x,y,Math.max(.45,rx),Math.max(.32,ry),0,0,tau);g.fillStyle=col;g.fill();};
      const perspective=clamp((camH-terrainHeight(p.x,p.y))/reach,.045,.81);
      ellipse(base.x,base.y,radius+unit*.08,radius*perspective+unit*.055,'rgba(55,40,57,.40)');
      g.beginPath();g.moveTo(cap.x,cap.y);g.lineTo(icon.x,icon.y);g.lineCap='round';g.lineWidth=Math.max(1,.072*unit);g.strokeStyle='#926d50';g.stroke();
      const rx=.52*unit,ry=Math.max(.65,rx*perspective);
      ellipse(base.x,base.y,rx,ry,'#99765f');
      g.fillStyle=style.thread;g.fillRect(body.x-unit*.434,cap.y,unit*.868,Math.max(1,base.y-cap.y));
      for(let i=1;i<=3;i++){const yy=cap.y+(base.y-cap.y)*i/4;ellipse(body.x,yy,unit*.43,Math.max(.65,ry*.33),i===2?style.accent:style.thread);}
      ellipse(cap.x,cap.y,rx,ry,'#b99a78');
      ellipse(cap.x,cap.y-.05*unit,rx*.84,ry*.78,'#dfbd93');
      g.drawImage(art,icon.x-iconWidth*.5,icon.y-iconWidth*.4,iconWidth,iconWidth*.8);
    }});
  }
  function effect(kind,x,y,angle=0,len=0,colors=[],lift=0,age=0){
    const debris=propDebris(kind,colors?.type,angle);
    if(effects.length>60)effects.shift();
    effects.push({kind,x,y,angle,len,lift:lift+(debris?.height||0),born:clock-age,duration:debris?.lifetime,barrel:colors?.barrel,flash:colors?.flash,
      firstAge:colors?.barrel?age:null,
      fibers:debris?.strands||(kind==='meleeImpact'?impactFibers(angle,len):null)});
  }
  function render(state,dt,time){
    if(!running)return false;clock=time;
    if(time-last<1/32&&!state.snap&&drawn)return false;const frameDt=Math.min(.1,time-last);last=time;drawn=true;
    const width=canvas.clientWidth||window.innerWidth,height=canvas.clientHeight||window.innerHeight;
    if(!width||!height)return false;
    // Render close stitching at native resolution when the street can afford it.
    const started=performance.now(),density=Math.min(globalThis.devicePixelRatio||1,width<640?1.15:1);
    const scale=Math.min(density,1360/width,900/height)*renderQuality;
    if(surface.width!==Math.round(width*scale)||surface.height!==Math.round(height*scale)){
      surface.width=Math.round(width*scale);surface.height=Math.round(height*scale);
    }
    w=surface.width;h=surface.height;f=.5*h/Math.tan((w<h?68:58)*Math.PI/360);
    const {p,yaw,car,destroyed}=state,rig=followCamera(state,frameDt,time),snap=rig.reset;
    fx=Math.cos(yaw);fy=Math.sin(yaw);
    camX=rig.x;camY=rig.y;camH=rig.z;
    const tilt=Math.atan2(rig.aimZ-camH,Math.hypot(rig.aimX-camX,rig.aimY-camY));
    sin=Math.sin(tilt);cos=Math.cos(tilt);horizon=h*.5+f*Math.tan(tilt);sideLimit=w/(2*f)+.1;
    if(Math.hypot(cacheX-p.x,cacheY-p.y)>35){
      cacheX=p.x;cacheY=p.y;
      const queryRange=canvasViewRange(false)+45;
      enclosures=isEnfer?nearbyEnclosures(p.x,p.y,180):[];
      nearBuildings=spatial.blocks.around(p.x,p.y,queryRange);
      nearWays=spatial.ways.around(p.x,p.y,streetViewRange+45);
    }
    if(snap||time-lastProps>.42){props=nearbyProps(p.x,p.y,370);lastProps=time;}
    const changed=wearChanged(props,state.propHealth,state.propDamageRevision);
    const oldG=g,version=(destroyed?.size||0),refresh=changed||!background||background.width!==w||background.height!==h||snap||
      Math.hypot(camX-backX,camY-backY)>.035||Math.abs(camH-backHeight)>.02||Math.abs(yaw-backYaw)>.0015||Math.abs(tilt-backPitch)>.0015||version!==backVersion||props.length!==backPropCount;
    queue.length=0;
    if(refresh){
    if(!background)background=makeCanvas(w,h);
    if(background.width!==w||background.height!==h){background.width=w;background.height=h;}
    g=background.getContext('2d',{alpha:false});backX=camX;backY=camY;backHeight=camH;backYaw=yaw;backPitch=tilt;backVersion=version;backPropCount=props.length;
    sky(yaw);groundRelief();
    for(const {a,bounds} of parks)if(seen(bounds,470)){
      const plane=projectPoly(a.poly.map(q=>[q[0],q[1],0]));
      fillPath(plane,streetFabric.park.color);
    }
    for(const {a,bounds,level} of waters)if(a.poly.length>=3&&seen(bounds,1000)){
      const rings=[a.poly,...(a.holes||[])].map(ring=>projectPoly(ring.map(([x,y])=>[x,y,0,level]))).filter(Boolean);
      if(!rings.length)continue;
      g.save();
      g.beginPath();
      for(const ring of rings){
        g.moveTo(ring[0].x,ring[0].y);
        for(const point of ring.slice(1))g.lineTo(point.x,point.y);
        g.closePath();
      }
      const colour=g.createLinearGradient(0,Math.max(0,horizon),0,h);
      colour.addColorStop(0,'#769f9f');colour.addColorStop(1,'#3e767e');
      g.fillStyle=colour;g.fill('evenodd');
      g.clip('evenodd');
      g.strokeStyle='#91b8ac';g.lineWidth=1.5;g.stroke();
      g.globalAlpha=.29;g.strokeStyle='#c3d8c8';g.lineWidth=.7;
      for(let y=Math.max(0,horizon);y<h;y+=Math.max(2,Math.floor((y-horizon)*.061))){
        g.beginPath();g.moveTo(0,y);g.lineTo(w,y+.9);g.stroke();
      }
      g.restore();
    }
    const visibleWays=nearWays.filter(s=>seen(s.bounds,230)),arc=monuments.arc;
    const atArc=!isEnfer&&Math.hypot(arc.x-p.x,arc.y-p.y)<450;
    for(const seg of nearWays)if(seg.w>=8&&seen(seg.bounds,streetViewRange)&&!seen(seg.bounds,230))
      roadRibbon(seg,0,'#8c7f81',0,seg.a,seg.b);
    if(atArc)ellipseGround(arc.x,arc.y,115,0,streetFabric.road.color);
    for(const seg of visibleWays)roadRibbon(seg,1.35,'#c7af95',0,seg.a,seg.b);
    for(const seg of visibleWays)if(seg.way.kind!=='path')
      roadRibbon(seg,0,seg.w>7?streetFabric.road.color:'#79747c',0,seg.a,seg.b);

    for(const s of visibleWays){
      if(s.way.kind==='path'||s.w<5.0||s.len<6||!seen(s.bounds,135))continue;
      for(let d=2;d+1<s.len;d+=9){
        const f0=d/s.len,f1=Math.min(1,(d+2.5)/s.len),dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1];
        roadRibbon(s,-s.w*.5+.088,'#e1ceb1',0,[s.a[0]+dx*f0,s.a[1]+dy*f0],[s.a[0]+dx*f1,s.a[1]+dy*f1]);}
    }
    if(atArc){
      ellipseGround(arc.x,arc.y,35.2,.025,'#c4b5a6');
    }
    groundTexture();
    if(isEnfer)for(const lot of parkingLots){
      if(!seen({...lot,r:13},streetViewRange))continue;
      const rect=(l,r,a,b,h,tint)=>poly3([[...lotPoint(lot,l,a),h],[...lotPoint(lot,r,a),h],
        [...lotPoint(lot,r,b),h],[...lotPoint(lot,l,b),h]],tint);
      rect(-parkingWidth/2,parkingWidth/2,-parkingDepth/2,parkingDepth/2,.11,'#96969a');
      rect(-3.2,3.2,-6.55,-4.6,.20,'#a79889');
      for(const [a,b] of parkingMarkings(lot)){
        const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy),u=.049*dy/n,v=.049*dx/n;
        poly3([[a[0]-u,a[1]+v,.14],[b[0]-u,b[1]+v,.14],[b[0]+u,b[1]-v,.14],[a[0]+u,a[1]-v,.14]],'#e4d5b5');
      }
      const [x,y]=parkingSign(lot),low=at(x,y,.85),center=at(x,y,1.72);
      if(low&&center)queue.push({z:depth(x,y),draw:()=>{
        const size=Math.max(3,f*.74/center.d);
        g.strokeStyle='#46515e';g.lineWidth=Math.max(1,size*.083);g.beginPath();g.moveTo(low.x,low.y);g.lineTo(center.x,center.y);g.stroke();
        g.fillStyle='#315779';g.fillRect(center.x-size/2,center.y-size/2,size,size);
        g.strokeStyle='#d4e8e0';g.lineWidth=Math.max(.7,size*.045);g.strokeRect(center.x-size*.43,center.y-size*.43,size*.86,size*.86);
        g.save();g.fillStyle='#fff1d3';g.font='bold '+Math.round(size*.71)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';
        g.fillText('P',center.x,center.y+size*.035);g.restore();
      }});
    }
    if(isEnfer)for(const s of visibleWays){
      if(!s.way.bridge)continue;
      roadRibbon(s,.95,'#c6ad92',0,s.a,s.b);
      roadRibbon(s,0,'#746f76',0,s.a,s.b);
      for(const sign of [-1,1]){
        const dx=(s.b[0]-s.a[0])/s.len,dy=(s.b[1]-s.a[1])/s.len,edge=sign*(s.w*.5+.74);
        const a=[s.a[0]-dy*edge,s.a[1]+dx*edge],b=[s.b[0]-dy*edge,s.b[1]+dx*edge];
        const ah=roadHeight(s.way,s.index,...a),bh=roadHeight(s.way,s.index,...b);
        const face=(bottom,top,color)=>poly3([[...a,bottom,ah],[...b,bottom,bh],[...b,top,bh],[...a,top,ah]],color);
        face(-.51,.27,'#94837d');face(.7,.88,'#4a444e');
        for(let d=.6;d<s.len;d+=2.7){
          const x=a[0]+dx*d,y=a[1]+dy*d;
          const deck=roadHeight(s.way,s.index,x,y),foot=at(x,y,.22,deck),head=at(x,y,.8,deck);
          if(foot&&head){g.strokeStyle='#514950';g.lineWidth=Math.max(1,w/head.d*.006);g.beginPath();g.moveTo(foot.x,foot.y);g.lineTo(head.x,head.y);g.stroke();}
        }
      }
    }
    occlusion.length=0;
    const range=canvasViewRange(w<h,renderQuality);
    const facadeSet=nearBuildings.filter(item=>seen(item.bounds,range)).sort((a,b)=>depth(a.bounds.x,a.bounds.y)-depth(b.bounds.x,b.bounds.y));
    let skylineCount=0;
    for(const item of facadeSet){
      const skyline=!seen(item.bounds,detailedCanvasRange);
      if(skyline&&item.o.h<50&&++skylineCount>(w<h?210:320))continue;
      projectionBase=item.ground;building(item,skyline);
    }
    projectionBase=null;
    for(const obj of monumentModels){
      const reach=obj.m.range||2300,md=depth(obj.m.x,obj.m.y);
      if(Math.hypot(obj.m.x-camX,obj.m.y-camY)>reach||!seen({x:obj.m.x,y:obj.m.y,r:110},reach))continue;
      projectionBase=terrainHeight(obj.m.x,obj.m.y);
      for(const face of obj.faces){
        if(face.line){
          const pp=at(...face.p[0]),qq=at(...face.p[1]);if(!pp||!qq||
            Math.max(pp.x,qq.x)<0||Math.min(pp.x,qq.x)>w||Math.max(pp.y,qq.y)<0||Math.min(pp.y,qq.y)>h)continue;
          const lineWidth=f*face.line/Math.max(2,(pp.d+qq.d)*.5);if(lineWidth<.37)continue;
          queue.push({z:depth(face.x,face.y),draw:()=>{g.strokeStyle=face.color;g.lineWidth=Math.min(45,Math.max(.65,lineWidth));g.beginPath();g.moveTo(pp.x,pp.y);g.lineTo(qq.x,qq.y);g.stroke();}});
          continue;
        }
        const pp=projectPoly(face.p);
        if(pp){
          const z=depth(face.x,face.y);
          if(face.textile&&z<430){
            const texture=marbleCloth(...face.textile);
            const uv=face.p.map((v,i)=>[...v,i===1||i===2?texture.width:0,i<2?texture.height:0]);
            queue.push({z,base:projectionBase,draw:()=>{fillPath(pp,face.color);texturedFace(texture,uv);}});
          }else queue.push({z,draw:()=>fillPath(pp,face.color)});
        }}
      if(obj.m.id==='arc')arcFront(obj.m);
      projectionBase=null;
    }
    for(const span of enclosures){
      const {a,b,x,y,h:height,style,halfLength}=span;
      if(!seen({x,y,r:halfLength},145))continue;
      const points=[[...a,0],[...b,0],[...b,height],[...a,height]],plane=projectPoly(points);
      if(!plane)continue;
      const art=enclosureStrip(style),z=depth(x,y),tile=style==='mesh'?.90:1.36,repeat=96*(halfLength*2)/tile;
      const uv=points.map((pt,i)=>[...pt,i===1||i===2?repeat:0,i<2?96*height/tile:0]);
      queue.push({z,draw:()=>{
        if(style!=='mesh')fillPath(plane,style==='board'?'#a47f68':'#b38170');
        texturedFace(art,uv);
      }});
    }
    terraceFaces.length=0;
    for(const o of props)if(!destroyed?.has(o.id))showProp(o,state.propHealth?.get(o.id));
    terraceFaces.sort((a,b)=>b.z-a.z);
    queue.sort((a,b)=>b.z-a.z);for(const q of queue){projectionBase=q.base??null;q.draw();}
    projectionBase=null;
    g=oldG;
    }
    g.drawImage(background,0,0);queue.length=0;
    if(state.lostWool){
      const wool=state.lostWool,distance=Math.hypot(wool.x-camX,wool.y-camY),point=at(wool.x,wool.y,.48);
      if(point&&distance<84&&point.d>.4&&pickupClear(wool.id,wool.x,wool.y,.5,distance,time,destroyed)){
        const r=Math.max(1,.30*f/point.d);
        queue.push({z:depth(wool.x,wool.y),draw:()=>{
          g.save();g.beginPath();g.ellipse(point.x,point.y,r,r*.94,0,0,tau);g.fillStyle='#ad4164';g.fill();g.clip();
          g.lineWidth=Math.max(.6,r*.10);g.strokeStyle='#ffa7b0';
          for(const tilt of [-.55,-.35,.32,.62,.87]){
            g.beginPath();g.ellipse(point.x,point.y,r*.45,r*1.07,tilt,0,tau);g.stroke();
          }
          g.restore();
        }});
      }
    }
    for(const pickup of state.pickups||[])queuePickup(pickup,time,destroyed);
    blood.begin(time,state.epoch??Date.now());
    const playerBody=uprightBody(state.entities.find(e=>e.self));
    for(const e of state.entities){
      const swimmer=e.motion==='swim'&&!e.isCar;
      const ground=terrainHeight(e.x,e.y);
      const roadOffset=(e.isCar&&isAircraft(e.type)?baseTerrainHeight(e.x,e.y):terrainHeight(e.x,e.y,e.angle))-ground;
      const lift=swimmer?swimGround(e.x,e.y)-terrainHeight(e.x,e.y)-.67:(e.lift||0)+roadOffset,base=at(e.x,e.y,lift),high=e.isCar?vehicleSpec(e.type).height:1.78,top=at(e.x,e.y,lift+high);
      if(!base||!top||base.d>(e.isCar?160:96)||base.d<.61)continue;
      const ph=base.y-top.y;if(ph<2||base.x<-ph*2||base.x>w+ph*2)continue;
      // Collinear urban façades can hide traffic even though the shared simulation still runs behind them.
      if(!e.self&&base.d>4){const d=Math.hypot(e.x-camX,e.y-camY);if(cameraDistance(camX,camY,camH-terrainHeight(camX,camY),Math.atan2(e.y-camY,e.x-camX),d,lift+high*.78,destroyed)<d-1.5)continue;}
      const fray=base.d<42?blood.actor(e):null;
      queue.push({z:depth(e.x,e.y)-.09,draw:()=>{
        const wid=ph*(e.isCar?.77:.27);
        const floor=e.supportHeight||0,shadow=at(e.x,e.y,floor+roadOffset),shadowScale=1/(1+Math.max(0,lift-floor)*.08);
        if(shadow&&!swimmer){g.fillStyle='rgba(62,49,64,.25)';g.beginPath();g.ellipse(shadow.x,shadow.y-1,Math.max(1,wid*shadowScale),Math.max(1,wid*.2*shadowScale),0,0,tau);g.fill();}
        const theta=Math.atan2(e.y-camY,e.x-camX)-(e.angle||0);
        if(e.isCar){
          const slope=terrainGradient(e.x,e.y,e.angle);
          g.save();g.translate(base.x,base.y);g.rotate(-Math.atan(-fy*slope.x+fx*slope.y));drawCanvasCar(g,e,0,0,ph,time,theta);g.restore();
        }
        else{
          const pose=walkingPose(e);
          const waterline=swimmer&&at(e.x,e.y,lift+.67);
          if(waterline){g.save();g.beginPath();g.rect(0,0,w,waterline.y);g.clip();}
          uprightSprite(pose,base,top,ph,time,-theta,pedestrianOpacity(e,playerBody));
          if(waterline)g.restore();
        }
        drawBlood(fray,pedestrianOpacity(e,playerBody));
        coverBehindTerrace(e,base,top,ph);
        if(e.bubble||e.peer&&base.d<45){
          const label=String(e.bubble||e.name||'').slice(0,26);g.font=(e.bubble?'19px':'600 11px')+' sans-serif';
          const art=e.bubble&&emotePatch(label),ww=art?30:g.measureText(label).width+12,hh=art?30:18,yy=top.y-(e.isCar?10:6);
          g.beginPath();g.roundRect(top.x-ww/2,yy-hh,ww,hh,art?9:5);g.fillStyle='#283e40';g.fill();
          g.lineWidth=1;g.strokeStyle='#ad9779';g.stroke();
          if(art)g.drawImage(art,top.x-14,yy-29,28,28);
          else{g.fillStyle='#fff0d2';g.textAlign='center';g.fillText(label,top.x,yy-5);g.textAlign='start';}
        }
      }});
    }
    blood.eachDrop((id,p,strands)=>{
      const reach=Math.hypot(camX-p.x,camY-p.y),height=p.h-terrainHeight(p.x,p.y);
      if(reach>44||!seen({x:p.x,y:p.y,r:.35},45)||!pickupClear(id,p.x,p.y,height,reach,time,destroyed))return;
      queue.push({z:depth(p.x,p.y),draw:()=>drawBlood(strands)});
    });
    queue.sort((a,b)=>b.z-a.z);for(const o of queue)o.draw();
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];
      if(e.firstAge!=null){e.born=time-e.firstAge;e.firstAge=null;}
      const age=time-e.born;
      const duration=e.duration??(e.fibers?fiberLifetime:e.kind==='burst'?.55:e.kind==='carExplosion'?1.35:effectDuration(e.kind));
      if(age>duration){effects.splice(i,1);continue;}
      if(e.fibers){
        const height=terrainHeight(e.x,e.y)+e.lift;
        g.save();g.globalAlpha=Math.min(1,(duration-age)*10);g.lineCap='round';g.lineJoin='round';
        for(const strand of e.fibers){
          const [vx,vy,vz]=strand.velocity;
          const projected=strand.points.map(([dx,dy,dz])=>{
            const x=e.x+dx+vx*age,z=e.y+dz+vz*age;
            return at(x,z,Math.max(.025,height-terrainHeight(x,z)+dy+vy*age-3.5*age*age));
          });
          if(!projected.every(Boolean))continue;
          g.lineWidth=clamp((strand.thickness?strand.thickness*2:.033)*f/projected[0].d,.8,9);g.strokeStyle=strand.color;
          g.beginPath();g.moveTo(projected[0].x,projected[0].y);
          g.quadraticCurveTo(projected[1].x,projected[1].y,projected[2].x,projected[2].y);g.stroke();
        }
        g.restore();
      }else if(e.kind==='carExplosion'){
        const pp=at(e.x,e.y,.8+e.lift+age*.65);if(!pp)continue;
        g.save();g.globalAlpha=Math.min(1,(1.35-age)*2.2);
        for(let j=0;j<19;j++){
          const a=j*2.399,spread=(.30+age*(1.9+j%4*.4))*f/pp.d;
          const r=(.26+age*.72)*f/pp.d;
          g.fillStyle=age<.42?['#ffe091','#e9874d','#d75343'][j%3]:['#554650','#806765','#6b6067'][j%3];
          g.beginPath();g.ellipse(pp.x+Math.cos(a)*spread,pp.y+Math.sin(a)*spread*.68,r,r*.82,0,0,tau);g.fill();
        }g.restore();
      }else if(e.kind==='burst'){
        const pp=at(e.x,e.y,.93+e.lift);if(!pp)continue;
        for(let j=0;j<8;j++){const v=j*2.39+age;g.fillStyle=j%2?'#f0c891':'#94b5a6';g.fillRect(pp.x+Math.cos(v)*age*80,pp.y+Math.sin(v)*age*80,3,3);}
      }else{
        const strokes=buildShotEffect(e.barrel||e.kind,e.x,e.y,e.angle,e.len,age/duration,!!e.barrel);
        if(e.flash&&age<.095)strokes.push(...muzzleFlash(e.barrel,e.x,e.y,e.angle));
        for(const stroke of strokes){
          g.beginPath();g.strokeStyle=stroke.color;g.lineWidth=stroke.width;let pen=false;
          for(const vertex of stroke.points){const pt=at(vertex.x,vertex.y,vertex.z+e.lift+terrainHeight(e.x,e.y)-terrainHeight(vertex.x,vertex.y));if(!pt){pen=false;continue;}if(pen)g.lineTo(pt.x,pt.y);else g.moveTo(pt.x,pt.y);pen=true;}
          g.stroke();
        }
      }
    }
    if(refresh && !snap){
      const drawMs=performance.now()-started;
      overBudget=drawMs>31?overBudget+1:Math.max(0,overBudget-1);
      fastFrames=drawMs<17?fastFrames+1:0;
      if(overBudget>=7 && renderQuality>.70){
        renderQuality=Math.max(.70,renderQuality-.10);overBudget=0;fastFrames=0;
      }else if(fastFrames>=90 && renderQuality<1){
        renderQuality=Math.min(1,renderQuality+.05);fastFrames=0;
      }
    }
  }
  function projectTarget(x,y,elevation=1){
    if(!running||!drawn||!w||!h||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(elevation))return null;
    const pixel=at(x,y,elevation);
    if(!pixel||pixel.d>6300||pixel.x<0||pixel.x>w||pixel.y<0||pixel.y>h)return null;
    return {x:pixel.x/w,y:pixel.y/h,depth:pixel.d};
  }
  function aim(clientX,clientY,p){
    const b=canvas.getBoundingClientRect();if(!w||!b.width||!b.height)return null;
    const s=((clientX-b.left)/b.width*w-w*.5)/f,v=(h*.5-(clientY-b.top)/b.height*h)/f;
    const height=v*cos+sin,forward=cos-v*sin,dx=fx*forward-fy*s,dy=fy*forward+fx*s;
    const d=(terrainHeight(p.x,p.y)+(p.lift||0)+.87-camH)/height;
    return d>0&&d<180?Math.atan2(camY+dy*d-p.y,camX+dx*d-p.x):Math.atan2(dy,dx);
  }
  return {available:true,mode:'canvas',render,aim,projectTarget,effect,dispose(){running=false;effects.length=0;if(surface!==canvas)surface.remove();}};
}
