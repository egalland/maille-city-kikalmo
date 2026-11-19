import {puppetKnit} from './puppet-material.js';
import {motionSeed,sampleLocomotion,linkedPose} from './locomotion-pose.js';
import * as THREE from './three.js';
import {appearanceKey,getKikalmoLook,zones} from './kikalmo-avatar.js';
import {costumeThreads} from './kikalmo-shell.js';

const templates=new WeakMap(),unused=new Map(),materials=new Map();
const sphere=new THREE.SphereGeometry(1,16,12);
const lowSphere=new THREE.SphereGeometry(1,12,8);
const up=new THREE.Vector3(0,1,0);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
const shirts=['#a17176','#768a6a','#745e77','#445d76','#ad7048','#917b63'];

function yarn(color){
  if(!materials.has(color))materials.set(color,new THREE.MeshLambertMaterial({color,map:puppetKnit()}));
  return materials.get(color);
}
function ball(parent,material,x,y,z,width,height,depth,geometry=lowSphere){
  const part=new THREE.Mesh(geometry,material);
  part.position.set(x,y,z);part.scale.set(width,height,depth);parent.add(part);
  return part;
}
function rgb(color){return new THREE.Color(color).getRGB(new THREE.Color(),THREE.SRGBColorSpace).toArray().map(c=>Math.round(c*255));}

// A circular cross section closes to a point at the ends. The jacket keeps its
// volume at the shoulders and waist, while the head takes a rounder profile.
function radius(t,exponent){return Math.max(0,1-(2*t-1)**2)**exponent;}
function roundedGeometry(part){
  const {width,height,depth,bend,exponent}=part;
  const columns=36,rows=24,positions=[],indices=[],uv=[],normals=[];
  for(let row=0;row<=rows;row++){
    const v=row/rows,cross=radius(v,exponent),y=(.5-v)*height;
    for(let col=0;col<=columns;col++){
      const u=col/columns,theta=(u-.5)*Math.PI*2;
      const cos=Math.cos(theta),sin=Math.sin(theta);
      const x=depth*cos*cross*(cos>0?1: .94)+bend*(v-.5);
      positions.push(x,y,width*sin*cross);
      uv.push(u,1-v);
      const slope=(radius(v+.002,exponent)-radius(v-.002,exponent))/.004;
      const n=new THREE.Vector3(cos/depth,slope/height-(bend/height)*cos/depth,sin/width);
      if(row===0||row===rows)n.set(0,row===0?1:-1,0);
      n.normalize();normals.push(n.x,n.y,n.z);
      if(row&&col){
        const d=row*(columns+1)+col,c=d-1,b=d-columns-1,a=b-1;
        if(row>1)indices.push(a,b,c);
        if(row<rows)indices.push(b,d,c);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  return geometry;
}

function layers(art){
  const {front,rear,tag}=art,w=front.width,h=front.height;
  const read=canvas=>canvas.getContext('2d').getImageData(0,0,w,h).data;
  const pixels=read(front),tags=read(tag);
  let faceBottom=0,noseX=0,noseY=0,noseCount=0;
  for(let y=0;y<h*.77;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    if(tags[i+3]<165)continue;
    const zone=Math.round(tags[i]/24);
    if(zone===zones.skin||zone===zones.feature||zone===zones.nose||zone===zones.facewear)faceBottom=Math.max(faceBottom,y);
    if(zone===zones.nose&&x>w*.24&&x<w*.76){noseX+=x;noseY+=y;noseCount++;}
  }
  const split=clamp(faceBottom+Math.round(h*.042),h*.37,h*.70);
  const nose=noseCount>6&&!art.appearance.facewear?{x:noseX/noseCount,y:noseY/noseCount}:null;
  return {w,h,pixels,back:read(rear),split,nose};
}
function textileMap(source,part,fallback,head,costume){
  const canvas=document.createElement('canvas');
  canvas.width=256;canvas.height=144;
  const ctx=canvas.getContext('2d'),im=ctx.createImageData(canvas.width,canvas.height);
  const {w,h,pixels,back,split}=source;
  const dye=rgb(fallback);
  for(let y=0;y<canvas.height;y++){
    const v=(y+.5)/canvas.height,cross=radius(v,part.exponent);
    const srcY=clamp(Math.round(head?split*v:split+(h-split-1)*v),0,h-1);
    for(let x=0;x<canvas.width;x++){
      const u=(x+.5)/canvas.width,theta=(u-.5)*Math.PI*2,face=Math.cos(theta);
      // The original embroidery follows the curved front. The side blends into
      // yarn and the back borrows the existing rear portrait for uncovered heads.
      const reach=1.02*cross*Math.sin(theta),front=face>=0;
      const srcX=clamp(Math.round((.5-(front?1:-1)*reach*.5)*w),0,w-1);
      const p=(srcY*w+srcX)*4,i=(y*canvas.width+x)*4;
      const data=front?pixels:back;
      const strength=front?smooth(.01,.53,face):costume?.31*smooth(.05,.80,-face):smooth(.04,.64,-face);
      const weight=strength*smooth(30,224,data[p+3])*(costume&&!front&&head?0:1);
      const knit=.96+.08*Math.cos((u*52+Math.cos(v*34*Math.PI)*.29)*Math.PI*2)*Math.cos(v*46*Math.PI)**2;
      for(let c=0;c<3;c++)im.data[i+c]=(dye[c]*(1-weight)+data[p+c]*weight)*knit;
      im.data[i+3]=255;
    }
  }
  ctx.putImageData(im,0,0);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.userData.cpuSize=128;map.anisotropy=4;
  return new THREE.MeshLambertMaterial({map});
}

function template(art){
  const existing=templates.get(art);if(existing)return existing;
  const {appearance:a}=art,source=layers(art),costume=!!a.costume;
  const coat=costume?costumeThreads(art):null;
  const sleeve=coat?.sleeve||shirts[a.outfit]||shirts[0],trouser=coat?.trouser||'#51495a';
  const boot=coat?.boot||'#503f43',cuff=a.costume===163?'#4b365d':coat?.cuff||sleeve;
  const hair=costume?swatchAt(source,.29,source.split/source.h*.62,coat.sleeve):swatchAt(source,.50,.16,a.color);
  const head={width:costume?.315:.263,height:costume?.681:.645,depth:costume?.255:.224,bend:.052,exponent:.47};
  const body={width:costume?.306:.287,height:.596,depth:.199,bend:-.035,exponent:.36};
  const headGeo=roundedGeometry(head),bodyGeo=roundedGeometry(body);
  const headMat=textileMap(source,head,hair,true,costume),bodyMat=textileMap(source,body,sleeve,false,costume);
  let nose=null;
  if(source.nose&&source.nose.y<source.split){
    const v=source.nose.y/source.split,cross=radius(v,head.exponent);
    const theta=Math.asin(clamp((.5-source.nose.x/source.w)*2/(1.02*cross),-.55,.55));
    const noseColor=swatchAt(source,source.nose.x/source.w,source.nose.y/source.h,a.color);
    if(noseColor!==a.color)nose={x:head.depth*Math.cos(theta)*cross+head.bend*(v-.5)-.009,y:(.5-v)*head.height,z:head.width*Math.sin(theta)*cross,mat:yarn(noseColor)};
  }
  const result={headGeo,bodyGeo,headMat,bodyMat,nose,sleeve,trouser,boot,cuff,costume,ornaments:costumeOrnaments(a.costume),refs:0};
  templates.set(art,result);return result;
}

// Linked costumes keep their front embroidery. The Abyss Monarch also has
// geometry for the motifs that must stand out around the hood and shoulders.
function costumeOrnaments(id){
  if(id!==163)return [];
  const violet=yarn('#584171'),plum=yarn('#2d234a'),jade=yarn('#398b8c'),gold=yarn('#9e815a');
  const head=new THREE.Group(),chest=new THREE.Group();
  function cord(group,material,points,radius){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,points.length*4,radius,7),material));
  }
  for(const side of [-1,1]){
    const s=side;
    cord(head,plum,[[.168,-.276,.11*s],[.154,-.19,.205*s],[.114,-.043,.272*s],[.09,.075,.275*s],[.064,.164,.218*s]],.038);
    cord(head,violet,[[.19,-.25,.115*s],[.184,-.19,.194*s],[.149,-.078,.243*s],[.132,.025,.253*s],[.115,.092,.24*s]],.022);
    cord(head,violet,[[-.11,-.218,.167*s],[-.197,-.14,.194*s],[-.215,-.01,.181*s],[-.166,.153,.19*s],[-.09,.23,.143*s]],.025);
    for(let finger=0;finger<3;finger++){
      const z=s*(.083+finger*.058),y=.282-.034*finger;
      cord(head,jade,[[.002,y-.053,z*.90],[-.022,y,z],[-.031,y+.060,z*1.13],[-.004,y+.089,z*1.18]],.019);
      ball(head,jade,-.004,y+.087,z*1.18,.026,.031,.025);
    }
    cord(chest,violet,[[.13,.035,.217*s],[.04,.124,.267*s],[-.066,.116,.285*s],[-.169,.026,.251*s],[-.18,-.068,.195*s]],.030);
    cord(chest,gold,[[-.215,-.08,.062*s],[-.217,-.121,.158*s],[-.194,-.23,.179*s],[-.162,-.35,.116*s]],.009);
  }
  ball(head,gold,.157,.196,0,.035,.065,.042);
  ball(head,jade,.181,.199,0,.023,.048,.029);
  ball(chest,gold,-.234,-.118,0,.024,.051,.042);
  ball(chest,jade,-.248,-.116,0,.014,.034,.028);
  for(const [attachment,parts] of [['head',head.children],['chest',chest.children]])
    for(const part of parts)part.userData.attachment=attachment;
  return [...head.children,...chest.children];
}

function swatchAt({pixels,w,h},u,v,fallback){
  const x=Math.round(u*(w-1)),y=Math.round(v*(h-1)),colors=[];
  for(let j=-4;j<=4;j++)for(let i=-4;i<=4;i++){
    const p=(clamp(y+j,0,h-1)*w+clamp(x+i,0,w-1))*4;
    if(pixels[p+3]>180)colors.push([pixels[p],pixels[p+1],pixels[p+2]]);
  }
  if(!colors.length)return fallback;
  const light=c=>c[0]*.3+c[1]*.6+c[2]*.1;
  colors.sort((a,b)=>light(a)-light(b));
  return '#'+colors[Math.floor(colors.length*.54)].map(c=>c.toString(16).padStart(2,'0')).join('');
}

function stretch(mesh,a,b,radius,delta){
  delta.subVectors(b,a);mesh.position.copy(a).addScaledVector(delta,.5);
  mesh.scale.set(radius,Math.max(.01,delta.length()*.63),radius);
  mesh.quaternion.setFromUnitVectors(up,delta.normalize());
}

export function createKikalmoModel(value,seed=0){
  const a=JSON.parse(appearanceKey(value)),group=new THREE.Group();
  const chest=new THREE.Group(),head=new THREE.Group(),limbs=new THREE.Group();
  chest.name='kikalmo-chest';head.name='kikalmo-head';limbs.name='kikalmo-limbs';
  group.add(chest,head,limbs);
  const skin=yarn(a.color),base=yarn(shirts[a.outfit]||shirts[0]);
  ball(chest,base,0,-.075,0,.199,.294,.288,sphere);
  ball(head,skin,.015,.208,0,.225,.332,.260,sphere);
  const arms=[],legs=[];
  for(let i=0;i<2;i++){
    const hand=ball(limbs,skin,0,0,0,.079,.084,.075);
    const thumb=ball(hand,skin,.47,-.12,i?-.61:.61,.51,.56,.46);
    const shoe=ball(limbs,yarn('#503f43'),0,0,0,.135,.077,.097);shoe.name='kikalmo-boot';
    ball(shoe,yarn('#322d37'),.06,-.63,0,.97,.47,1.01);
    arms.push([ball(limbs,base,0,0,0,1,1,1),ball(limbs,base,0,0,0,1,1,1),hand,thumb]);
    legs.push([ball(limbs,yarn('#51495a'),0,0,0,1,1,1),ball(limbs,yarn('#51495a'),0,0,0,1,1,1),shoe]);
  }
  let art,entry,style=motionSeed(seed),lastId;
  const p=new THREE.Vector3(),q=new THREE.Vector3(),r=new THREE.Vector3(),delta=new THREE.Vector3(),target=new THREE.Vector3();
  const orientation=new THREE.Quaternion();
  function release(){
    if(!entry||--entry.refs>0)return;
    unused.set(art,entry);
    if(unused.size<=16)return;
    const [key,old]=unused.entries().next().value;
    unused.delete(key);templates.delete(key);
    old.bodyGeo.dispose();old.headGeo.dispose();
    for(const part of old.ornaments)if(part.geometry!==lowSphere)part.geometry.dispose();
    for(const mat of [old.headMat,old.bodyMat]){mat.map.dispose();mat.dispose();}
  }
  function fit(look){
    if(!look||look===art)return;
    release();
    art=look;entry=template(look);entry.refs++;unused.delete(look);
    chest.clear();head.clear();
    const torso=new THREE.Mesh(entry.bodyGeo,entry.bodyMat);
    torso.name='kikalmo-jacket';torso.position.y=-.065;chest.add(torso);
    const face=new THREE.Mesh(entry.headGeo,entry.headMat);
    face.name='kikalmo-head-volume';face.position.set(.023,.235,0);head.add(face);
    const {nose,sleeve,trouser,cuff,boot,costume,ornaments}=entry;
    ball(chest,yarn(trouser),-.012,-.316,0,.151,.132,.228,sphere);
    ball(chest,yarn(sleeve),-.015,.139,0,.133,.098,.175);
    if(nose)ball(face,nose.mat,nose.x,nose.y,nose.z,.051,.044,.038);
    if(costume){
      ball(chest,yarn(sleeve),-.136,-.13,0,.102,.266,.245,sphere);
      ball(chest,yarn(cuff),.003,.148,0,.149,.063,.225);
    }else{
      for(const s of [-1,1])ball(face,skin,.019,-.086,s*.231,.059,.066,.052);
    }
    for(const part of ornaments){
      (part.userData.attachment==='head'?face:chest).add(part.clone());
    }
    for(const [upper,lower,hand,thumb] of arms){upper.material=yarn(sleeve);lower.material=yarn(cuff);hand.material=thumb.material=costume?yarn(cuff):skin;}
    for(const [thigh,shin,shoe] of legs){thigh.material=shin.material=yarn(trouser);shoe.material=yarn(boot);}
  }
  function rotate(part,anchor,joint,below,gait,blend,lean){
    part.position.fromArray(anchor);
    part.rotation.set(gait.roll,gait.twist*lean,-gait.lean*lean);
    const squash=gait.squash*(1-blend);
    part.scale.set(1-squash*.5,1+squash,1-squash*.5);
    if(joint&&blend){
      part.position.lerp(target.fromArray(joint),blend);
      if(below){
        delta.fromArray(joint).sub(target.fromArray(below));
        if(delta.lengthSq()>.0001)part.quaternion.slerp(orientation.setFromUnitVectors(up,delta.normalize()),blend);
      }
    }
  }
  function update(e,dt=.016,t=0){
    if(e.id!==lastId){lastId=e.id;style=motionSeed(lastId??seed);}
    const pose=e.pose||e,gait=sampleLocomotion(pose,t,style),rig=linkedPose(pose,gait,t);
    // The linked suit has a fixed mesh. All in-game motion comes from its rig.
    fit(getKikalmoLook(a,0)?.art);
    const rag=e.ragdoll||pose.ragdoll,blend=clamp(rag?.blend||0);
    rotate(chest,rig.anchors[1],rag?.chest,rag?.hips,gait,blend,1);
    rotate(head,rig.anchors[2],rag?.head,rag?.chest,gait,blend,.65);
    head.rotateY(-gait.turn*.13*(1-blend));
    for(const side of [0,1]){
      const name=side?'right':'left',arm=arms[side],leg=legs[side];
      p.fromArray(rig.arms[side][0]);q.fromArray(rig.arms[side][1]);r.fromArray(rig.arms[side][2]);
      if(blend){
        if(rag[name+'Shoulder'])p.lerp(target.fromArray(rag[name+'Shoulder']),blend);
        if(rag[name+'Elbow'])q.lerp(target.fromArray(rag[name+'Elbow']),blend);
        if(rag[name+'Hand'])r.lerp(target.fromArray(rag[name+'Hand']),blend);
      }
      stretch(arm[0],p,q,.087,delta);stretch(arm[1],q,r,.073,delta);arm[2].position.copy(r);arm[2].quaternion.copy(arm[1].quaternion);
      p.fromArray(rig.legs[side][0]);q.fromArray(rig.legs[side][1]);r.fromArray(rig.legs[side][2]);
      if(blend){
        if(rag.hips)p.lerp(target.fromArray(rag.hips),blend);
        if(rag[name+'Knee'])q.lerp(target.fromArray(rag[name+'Knee']),blend);
        if(rag[name+'Foot'])r.lerp(target.fromArray(rag[name+'Foot']),blend);
      }
      stretch(leg[0],p,q,.096,delta);stretch(leg[1],q,r,.083,delta);
      leg[2].position.copy(r);leg[2].position.x+=.054;leg[2].position.y+=.019;
    }
  }
  return {group,update,dispose(){release();group.removeFromParent();}};
}
