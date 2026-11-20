import {createSaddleRig} from './saddle-rider.js';
import {createHelicopter} from './helicopter-model.js';
import {createAirship} from './airship-model.js';
import {cabinFit,cabinOccupant,fitCabinPuppet} from './cabin-rider.js';
import {yarnPalette} from './wool-art.js';
import {puppetAppearance} from './puppet-dyes.js';
import {puppetKnit,puppetFelt} from './puppet-material.js';
import {jacketPattern,dressCivilian,travelerScarf,outerFoxEar} from './figure-tailoring.js';
import {foxFaces,humanHead,humanNose,distantHead,distantNose,haircuts,distantSleeve,distantThigh,upperSleeve,foreSleeve,turnedCuff,trouserThigh,trouserCalf,boots} from './character-patterns.js';
import {motionSeed,sampleLocomotion} from './locomotion-pose.js';
import * as THREE from './three.js';
import { createStreetVehicle, isStreetVehicle } from './street-vehicles.js';
import { vehicleSpec } from './vehicle-types.js';
import {chassisStage,chassisHealth,wheelPart} from './vehicle-damage.js';
import {bodyFabric as carPaint,serviceFabric as fleetPaint,fleetFabric as carYarn} from './vehicle-fabric.js';
import { createRagdollRig } from './ragdoll-render.js';

// All figures face +X and stand on y=0. The scenery and the game camera use metres.
const geo={
  ball:new THREE.SphereGeometry(1,12,8), detailBall:new THREE.SphereGeometry(1,18,12),
  littleBall:new THREE.SphereGeometry(1,8,6), box:new THREE.BoxGeometry(1,1,1),
  cylinder:new THREE.CylinderGeometry(1,1,1,16),cone:new THREE.ConeGeometry(1,1,12),
};
const crowdBall=new THREE.SphereGeometry(1,7,5);
const TAU=Math.PI*2;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const colors={ink:yarnPalette.ink,boot:'#543f45',sole:'#392f3b',glove:'#fbe3b5',trim:'#e9ba69',teal:'#378784',deepTeal:yarnPalette.petrol};

const surfaces={
  felt:new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,map:puppetFelt()}),
  yarn:new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,map:puppetKnit()}),
  glass:new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide}),
  plain:new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true}),
  glow:new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true}),
};
const unpacked=new WeakMap();
function addPart(parent,geometry,x,y,z,sx,sy,sz,color,rotX=0,rotY=0,rotZ=0,style='yarn'){
  const mesh=new THREE.Mesh(geometry,surfaces[style]||surfaces.yarn);
  mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rotX,rotY,rotZ);
  mesh.userData.tint=new THREE.Color(color||'#ffffff');mesh.userData.surface=style;
  parent.add(mesh);return mesh;
}
function ball(parent,x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0,style='yarn'){
  return addPart(parent,geo.ball,x,y,z,sx,sy,sz,color,rx,ry,rz,style);
}
function joint(parent,name,x=0,y=0,z=0){
  const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;
}
// Bake each rigid section into vertex-coloured material batches. All instances of a template
// share the resulting buffers, while their joint transforms are independent.
function batchGroup(group){
  const sets=new Map(),p=new THREE.Vector3(),n=new THREE.Vector3(),norm=new THREE.Matrix3();
  for(const mesh of [...group.children]){
    if(!mesh.isMesh||!mesh.userData.tint)continue;
    const g=mesh.geometry;
    if(!unpacked.has(g))unpacked.set(g,g.index?g.toNonIndexed():g);
    const src=unpacked.get(g),pa=src.attributes.position,no=src.attributes.normal,uv=src.attributes.uv,co=src.attributes.color;
    const tint=mesh.userData.tint,style=mesh.userData.surface||'yarn';
    const out=sets.get(style)||{p:[],n:[],u:[],c:[]};sets.set(style,out);
    mesh.updateMatrix();norm.getNormalMatrix(mesh.matrix);
    for(let i=0;i<pa.count;i++){
      p.fromBufferAttribute(pa,i).applyMatrix4(mesh.matrix);out.p.push(p.x,p.y,p.z);
      if(no)n.fromBufferAttribute(no,i).applyNormalMatrix(norm);else n.set(0,1,0);
      out.n.push(n.x,n.y,n.z);out.u.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
      out.c.push(tint.r*(co?co.getX(i):1),tint.g*(co?co.getY(i):1),tint.b*(co?co.getZ(i):1));
    }
    group.remove(mesh);
  }
  for(const [style,o] of sets){
    const geometry=new THREE.BufferGeometry();
    for(const [name,arr,size] of [['position',o.p,3],['normal',o.n,3],['color',o.c,3],['uv',o.u,2]]){
      geometry.setAttribute(name,new THREE.Float32BufferAttribute(arr,size));
    }
    geometry.computeBoundingSphere();
    group.add(new THREE.Mesh(geometry,surfaces[style]||surfaces.yarn));
  }
  return group;
}
function cord(parent,points,radius,color,style='yarn'){
  const ps=points.map(pt=>new THREE.Vector3(...pt));
  const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps),Math.max(3,(ps.length-1)*3),radius,5,false);
  return addPart(parent,geo,0,0,0,1,1,1,color,0,0,0,style);
}
function taper(points,radii,sides=12){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const steps=(points.length-1)*4,frames=curve.computeFrenetFrames(steps,false);
  const pos=[],uv=[],ix=[];
  for(let i=0;i<=steps;i++){
    const u=i/steps,v=u*(radii.length-1),a=Math.min(radii.length-2,Math.floor(v)),r=THREE.MathUtils.lerp(radii[a],radii[a+1],v-a);
    const center=curve.getPointAt(u);
    for(let j=0;j<=sides;j++){
      const ang=TAU*j/sides;
      const pt=center.clone().addScaledVector(frames.normals[i],r*Math.cos(ang)).addScaledVector(frames.binormals[i],r*Math.sin(ang));
      pos.push(pt.x,pt.y,pt.z);uv.push(j/sides,u);
      if(i<steps&&j<sides){const k=i*(sides+1)+j;ix.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setIndex(ix);
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function earWedge(dir){
  const pts=[[.07,0,-.086*dir],[.07,0,.094*dir],[-.03,.245,.044*dir],[-.06,.0,-.069*dir],[-.075,.0,.080*dir]];
  const faces=[[0,1,2],[4,3,2],[1,4,2],[3,0,2],[0,3,4],[0,4,1]];
  const p=[],uv=[];
  for(let v of faces){
    if(dir>0)v=[v[2],v[1],v[0]];
    for(let i=0;i<3;i++){p.push(...pts[v[i]]);uv.push(i===0?0:i===1?1:.5,i===2?1:0);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
const ears=[earWedge(-1),earWedge(1)];
function earModel(head,side,animal,pal){
  const e=joint(head,side<0?'earL':'earR',-.045,.315,.178*side);
  if(animal==='bear'){
    ball(e,0,.055,0,.08,.11,.102,pal.shade);ball(e,.047,.058,0,.053,.073,.079,pal.inner);
  }else if(animal==='rabbit'){
    ball(e,-.016,.143,0,.074,.22,.085,pal.fur,.18*side,0,.09);ball(e,.038,.15,.002*side,.039,.16,.049,pal.inner,.18*side,0,.09);
  }else{
    e.position.y=.297;
    addPart(e,outerFoxEar,0,0,0,1,1,1,pal.shade,.10*side);
    addPart(e,outerFoxEar,.019,-.013,0,1,.89,.95,pal.fur,.10*side);
    addPart(e,outerFoxEar,.060,.018,.005*side,.47,.65,.61,pal.inner,.10*side);
    cord(e,[[.082,.015,-.037*side],[.076,.050,0],[.065,.104,.011*side]],.009,pal.cream);
  }
  return e;
}
function cloakPoint(u, drop) {
  // The opening widens towards the hem and exposes the jacket. Six pressed
  // folds run from the collar and deepen toward the back of the travelling cape.
  const gap=.16+drop*.49, angle=gap+u*(TAU-2*gap);
  const c=Math.cos(angle),s=Math.sin(angle),rear=(1-c)*.5;
  const pleat=.022*drop*(.44+rear)*Math.cos(6*angle+.38*drop);
  const depth=.15+.195*drop, halfWidth=.235+.105*drop;
  return [(depth+pleat)*c-.047-.071*drop*rear,
    .042-.451*drop+.107*drop*(1-rear)-.014*drop*Math.cos(6*angle),
    (halfWidth+pleat)*s];
}
function cloakGeometry(){
  const steps=32,drops=[0,.13,.39,.72,.955,1],positions=[],uv=[],indices=[];
  for(const [row,drop] of drops.entries()){
    for(let j=0;j<=steps;j++){
      const u=j/steps;
      positions.push(...cloakPoint(u,drop));uv.push(u*2,drop);
      if(row===drops.length-1||j===steps)continue;
      const a=row*(steps+1)+j,b=a+steps+1;
      indices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();
  return g;
}
const capeShape=cloakGeometry();
function addFoxCape(torso,cloth){
  const cape=joint(torso,'cape',-.015,.20,0);
  addPart(cape,capeShape,0,0,0,1,1,1,cloth);
  for(const [drop,radius,color] of [[.855,.006,'#80c9a5'],[.94,.010,colors.trim]]){
    const points=Array.from({length:25},(_,j)=>cloakPoint(j/24,drop));
    cord(cape,points,radius,color);
  }
  for(const u of [0,1])cord(cape,[0,.13,.39,.72,1].map(drop=>cloakPoint(u,drop)),.008,colors.trim);
  return cape;
}
function serviceUniform(torso,head,type,cloth,edge){
  const brass='#ffd173';
  if(type==='police'){
    ball(head,0,.34,0,.297,.103,.294,'#34455f');ball(head,.169,.302,0,.196,.026,.237,'#30323e');
    ball(head,.267,.347,0,.018,.033,.034,brass);
    cord(torso,[[.20,.12,-.12],[.217,.04,0],[.18,-.09,.11]],.018,'#baa779');
    ball(torso,.189,.12,-.11,.018,.048,.038,brass);
  }else if(type==='medic'){
    ball(head,0,.342,0,.261,.08,.255,'#eee6d2');ball(head,0,.303,0,.250,.022,.249,'#4d807c');
    cord(torso,[[.14,.158,-.141],[.196,.017,-.018],[.164,-.128,.129]],.019,edge);
    addPart(head,geo.box,.25,.348,0,.023,.067,.024,'#317e70');addPart(head,geo.box,.246,.348,0,.025,.023,.067,'#317e70');
    ball(torso,-.165,-.003,.08,.151,.197,.187,'#f1e0bd');
    addPart(torso,geo.box,-.309,.03,.09,.018,.091,.027,'#3a8975');
    addPart(torso,geo.box,-.311,.03,.09,.018,.026,.084,'#3a8975');
  }else if(type==='firefighter'){
    ball(head,0,.345,0,.274,.168,.289,'#edb54c');ball(head,-.036,.278,0,.324,.035,.32,'#cd9442');
    cord(head,[[-.23,.391,0],[0,.515,0],[.218,.406,0]],.025,'#ffe1a0');ball(head,.26,.354,0,.02,.044,.04,'#8b413d');
    for(const y of [-.105,-.052])ball(torso,0,y,0,.20,.022,.235,'#f2cd67');
  }else if(type==='swat'){
    ball(head,0,.321,0,.289,.183,.29,'#424b5a');ball(head,0,.285,0,.305,.035,.299,'#2f3444');
    ball(head,.236,.173,0,.063,.061,.216,'#393a46');ball(head,.282,.172,0,.023,.04,.179,'#81a4b2',0,0,0,'plain');
    ball(torso,-.018,.018,0,.213,.198,.263,'#525a66');
    for(const s of [-1,1])addPart(torso,geo.box,.187,-.035,s*.093,.045,.105,.11,'#68727c');
  }else{
    for(const s of [-1,1])cord(torso,[[.135,.19,s*.14],[.167,.061,s*.1],[.133,-.058,s*.16]],.014,edge);
  }
}
function makeBody(look,high,seated=false){
  const {type,animal,pelt:pal,coat:cloth,trim:edge,service}=look;
  const isFox=type==='fox',out=[cloth,edge];
  const group=new THREE.Group(),core=joint(group,'core',0,.69,0),torso=joint(core,'torso',0,.065,0);
  const head=joint(core,'head',.025,.49,0);
  const fur=pal.fur;
  const small=(parent,x,y,z,sx,sy,sz,c,rx=0,ry=0,rz=0,style='yarn')=>
    addPart(parent,high?geo.littleBall:crowdBall,x,y,z,sx,sy,sz,c,rx,ry,rz,style);
  const stitches={part:addPart,small,cord};
  // The yoke reaches the arm joints, closing the gap under each raised sleeve.
  addPart(torso,jacketPattern,0,0,0,1,1,1,out[0]);
  small(torso,.006,.252,0,.119,.135,.13,isFox?colors.deepTeal:out[0]);
  ball(torso,.01,-.224,0,.156,.089,.182,'#4d5262');
  const human=animal==='human', faceSurface=high?'felt':'yarn';
  const detail=high?'near':'far';
  if(human)addPart(head,high?humanHead:distantHead,0,0,0,1,1,1,fur,0,0,0,faceSurface);
  else if(animal==='fox'){
    const panelTints=[fur,pal.cream,pal.shade];
    foxFaces[detail].forEach((panel,i)=>addPart(head,panel,0,0,0,1,1,1,panelTints[i],0,0,0,faceSurface));
  }
  else addPart(head,high?geo.detailBall:geo.littleBall,-.006,.120,0,.269,.245,.284,fur,0,0,0,faceSurface);
  if(animal==='human'){
    const kind=look.pick%6;
    if(kind!==4){
      addPart(head,haircuts[kind][detail],0,0,0,1,1,1,pal.shade,0,0,0,faceSurface);
    }
    if(kind===2)small(head,-.239,.092,.016,.091,.082,.119,pal.shade,0,0,-.20);
    if(kind===1||kind===5){
      small(head,-.025,.324,0,.278,.092,.285,cloth);
      small(head,.134,.294,-.006,.192,.031,.220,edge,0,0,-.075);
    }
    for(const side of [-1,1]){
      small(head,-.042,.10,side*.257,.072,.087,.044,fur,0,0,0,faceSurface);
      if(high)small(head,-.042,.102,side*.291,.034,.042,.015,pal.inner,0,0,0,faceSurface);
    }
    dressCivilian(torso,head,look,high,stitches);
  }
  if(!high){
    for(const s of [-1,1]){
      if(animal==='rabbit')small(head,-.025,.382,s*.170,.065,.183,.066,fur,.16*s);
      else if(animal==='bear')small(head,-.035,.319,s*.205,.067,.086,.08,fur);
      else if(animal!=='human')addPart(head,ears[s<0?0:1],-.025,.294,.158*s,.88,.91,.87,fur);
      if(animal!=='human'&&animal!=='fox')small(head,.155,.078,s*.119,.153,.104,.143,pal.cream);
      small(head,.216,.173,s*.127,.045,.057,.047,'#f4e5be');
      small(head,.247,.173,s*.144,.029,.042,.031,colors.ink);
      if(seated){
        const side=s<0?'L':'R',arm=joint(core,'arm'+side,.001,.182,s*.224),leg=joint(core,'leg'+side,-.016,-.24,s*.112);
        const elbow=joint(arm,'elbow'+side,.008,-.162,.04*s),knee=joint(leg,'knee'+side,-.012,-.141,0);
        for(const limb of [leg,knee])addPart(limb,distantThigh,0,0,0,.98,1,.98,'#454052');
        addPart(knee,boots.far[0],0,0,0,1,1,1,colors.boot);
        for(const limb of [arm,elbow])addPart(limb,distantSleeve,0,0,0,1,1,1,isFox?'#385561':out[0]);
        small(elbow,.06,-.166,s*.011,.065,.063,.061,human?fur:isFox?pal.shade:colors.glove);
        for(const limb of [arm,leg,elbow,knee])batchGroup(limb);
      }else{
        addPart(core,distantThigh,-.016,-.24,s*.112,.98,1.8,.98,'#454052');
        addPart(core,boots.far[0],-.028,-.381,s*.112,1,1,1,colors.boot);
        addPart(core,distantSleeve,.001,.182,s*.224,1,1.8,1,isFox?'#385561':out[0],-.13*s);
        small(core,.047,-.132,s*.266,.065,.063,.061,human?fur:isFox?pal.shade:colors.glove);
      }
    }
    if(human)addPart(head,distantNose,0,0,0,1,1,1,pal.inner);
    else small(head,animal==='fox'?.387:.265,.094,0,.045,.038,.051,colors.ink);
    if(isFox){
      small(torso,-.076,.189,0,.217,.067,.235,'#d79b5a');
      addPart(torso,capeShape,-.015,.20,0,1,1,1,cloth);
      small(core,-.254,-.096,.12,.23,.09,.095,fur,.1,.3,.32);small(core,-.44,-.016,.216,.123,.075,.07,pal.cream);}
    if(service){
      const tone=type==='firefighter'?'#deb05e':type==='medic'?'#efe3c6':cloth;
      small(head,0,.333,0,.286,.103,.285,tone);
      if(type==='police'||type==='swat')small(head,.115,.287,0,.20,.030,.235,colors.ink);
      else if(type==='firefighter')small(head,-.016,.287,0,.318,.028,.318,'#b38755');
      if(type==='medic'){
        small(torso,-.152,0,.035,.11,.146,.14,'#d9c6a3');
        addPart(torso,geo.box,-.263,.015,.036,.014,.074,.022,edge);
        addPart(torso,geo.box,-.264,.015,.036,.014,.021,.073,edge);
      }
    }
    batchGroup(head);batchGroup(core);batchGroup(torso);
    return group;
  }
  for(const sign of [-1,1]){
    if(!human) {
      if(animal!=='fox'){
        addPart(head,geo.ball,.096,.051,sign*.146,.149,.100,.134,pal.cream,.20*sign,0,-.09,faceSurface);
      }
      if(animal==='cat'){
        const tuft=taper([[.113,.036,sign*.212],[.073,.049,sign*.266],[.017,.111,sign*.327]],[.066,.047,.002],8);
        addPart(head,tuft,0,0,0,1,1,1,pal.cream,0,0,0,faceSurface);
      }
      if(animal==='raccoon')small(head,.173,.184,sign*.149,.081,.073,.089,pal.shade,.16*sign);
      earModel(head,sign,animal,pal);
    }
    cord(head,[[.158,.248,.156*sign],[.192,.259,.131*sign],[.217,.25,.099*sign]],.014,pal.shade);
  }
  if(human){
    addPart(head,humanNose,0,0,0,1,1,1,pal.inner,0,0,0,faceSurface);
    cord(head,[[.234,.012,-.052],[.246,.007,-.011],[.248,.012,.023],[.24,.022,.057]],.007,pal.shade);
  }else{
    if(animal!=='fox')ball(head,.213,.075,0,.142,.073,.102,pal.cream,0,0,0,faceSurface);
    small(head,animal==='fox'?.386:.323,.106,0,.045,.037,.053,colors.ink,0,0,.13,faceSurface);
    small(head,animal==='fox'?.426:.365,.117,.012,.009,.008,.012,'#b09a97',0,0,0,'plain');
    const lip=animal==='fox'?[[.390,.083,0],[.377,.066,0],[.338,.061,.042],[.305,.068,.068]]:
      [[.336,.080,0],[.327,.054,0],[.306,.046,.041],[.298,.054,.062]];
    cord(head,lip,.006,'#69434b');
    for(const side of [-1,1])for(let i=0;i<2;i++)
      small(head,.22+.020*i,.072+.013*i,side*(.116-.016*i),.009,.008,.010,pal.shade,0,0,0,faceSurface);
  }
  // The irises follow each eye's outward normal. Previously the second eye's
  // pupil and the human nose highlight hung clear of the face in profile.
  const eyes=joint(head,'eyes',0,.174,0);
  for(const side of [-1,1]){
    const skinX=human?.213:.215,skinZ=human?.128:.120;
    ball(eyes,skinX,.001,side*skinZ,human?.021:.038,human?.047:.059,human?.044:.049,'#f5e7c9',0,-.56*side,0,'plain');
    const inset=human?.015:.026;
    small(eyes,skinX+inset,.001,side*(skinZ+inset*.56),human?.012:.018,human?.035:.043,human?.025:.031,colors.ink,0,-.56*side,0,'plain');
    small(eyes,skinX+inset*1.6,.014,side*(skinZ+inset*.86),.006,.009,.009,'#fff2d8',0,0,0,'plain');
  }
  // Wrap raised strand seams behind the head. They read from the follow camera when the face is hidden.
  for(const s of [-1,1])for(let i=0;i<3;i++){
    const z=s*(.047+.058*i),x=-.26+.02*i,y=.172+.009*i;
    cord(head,[[x+.009,y+.018,z-.014],[x-.005,y-.007,z],[x+.004,y+.018,z+.015]],.0055,i===2?pal.cream:pal.shade);
  }
  // Raised, turned hems show up on the back and the side in the chase camera.
  // The same seam runs across civilian jackets, uniform coats and the hero cape collar.
  const collar=[];
  for(let j=0;j<=16;j++){
    const a=j*TAU/16;collar.push([.133*Math.cos(a),.181-.018*Math.max(0,Math.cos(a)),.162*Math.sin(a)]);
  }
  cord(torso,collar,.012,out[1]);
  if(!service&&!isFox&&!human){
    if(look.pick%3===0){
      cord(torso,[[-.15,.02,-.1],[-.184,-.02,0],[-.16,.02,.11]],.018,out[1]);
      ball(torso,-.177,-.123,.159,.054,.093,.073,pal.shade);
    }
    if(look.pick%3===1){
      cord(torso,[[.17,.181,-.133],[.208,.104,-.04],[.207,.101,.072],[.175,.183,.136]],.019,out[1]);
    }
    cord(torso,[[-.151,.089,-.114],[-.182,.048,0],[-.151,.089,.114]],.006,'#77636c');
    for(const y of [-.06,.025,.104])ball(torso,.192,y,0,.012,.022,.024,out[1],0,0,0,'plain');
  }
  if(service)serviceUniform(torso,head,type,out[0],out[1]);
  if(isFox){
    travelerScarf(addFoxCape(torso,cloth),head,look,stitches,cloakPoint);
    const clasp=look.skinId==='braise'?'#e29b70':look.skinId==='bruyere'?'#a68eaf':look.skinId==='foret'?'#afbc78':'#6fe0c9';
    for(const side of [-1,1]){
      cord(torso,[[.007,.172,.213*side],[-.097,.165,.184*side],[-.173,.114,.156*side]],.014,clasp);
      ball(torso,-.141,-.034,.203*side,.048,.081,.059,colors.boot,0,0,.24);
    }
    if(look.skinId==='foret'||look.skinId==='braise'){
      ball(torso,-.211,-.038,-.095,.076,.139,.125,colors.boot,0,0,.14);
      cord(torso,[[-.287,.003,-.181],[-.295,.009,-.094],[-.277,.003,-.019]],.014,clasp);
    }
    ball(torso,.002,.201,0,.191,.068,.245,cloth);
    cord(torso,[[.121,.202,-.171],[.172,.137,-.09],[.19,.139,0],[.172,.137,.09],[.121,.202,.171]],.019,'#f5c979');
    ball(torso,.198,.143,0,.033,.056,.056,'#d49b54');ball(torso,.225,.145,0,.023,.04,.036,'#6fe0c9');
  }
  for(const s of [-1,1]){
    const side=s<0?'L':'R',arm=joint(core,'arm'+side,.001,.182,s*.224),leg=joint(core,'leg'+side,-.016,-.24,s*.112);
    const sleeve=isFox?'#385561':out[0];
    const elbow=joint(arm,'elbow'+side,.008,-.162,.040*s);
    const knee=joint(leg,'knee'+side,-.012,-.141,0);
    addPart(arm,upperSleeve,0,0,0,1,1,1,sleeve,-.21*s);
    addPart(elbow,foreSleeve,0,0,0,1,1,1,sleeve,-.07*s);
    addPart(elbow,turnedCuff,0,0,0,1,1,1,isFox?colors.trim:out[1],-.07*s);
    const hand=human?fur:isFox?pal.shade:colors.glove;
    small(elbow,.054,-.17,.011*s,.069,.083,.062,hand,.1*s,0,.05,faceSurface);
    small(elbow,.091,-.151,-.021*s,.039,.051,.036,hand,0,0,0,faceSurface);
    addPart(leg,trouserThigh,0,0,0,1,1,1,'#454052');
    addPart(knee,trouserCalf,0,0,0,1,1,1,'#454052');
    addPart(knee,boots.near[0],0,0,0,1,1,1,isFox?'#815a43':colors.boot,0,0,0,'felt');
    addPart(knee,boots.near[1],0,0,0,1,1,1,colors.sole);
    for(const offset of [0,.028])cord(knee,[[.068+offset,-.139-offset*.55,-.046],[.073+offset,-.127-offset*.55,0],[.083+offset,-.145-offset*.55,.046]],.005,'#c69a75');
  }
  if(animal==='fox'||animal==='raccoon'||animal==='cat'){
    const tail=joint(core,'tail',-.108,-.158,.095);
    const path=[[-.015,-.015,.015],[-.155,-.113,.088],[-.293,-.075,.218],[-.389,.02,.335],[-.399,.14,.404],[-.344,.235,.474]];
    addPart(tail,taper(path.slice(0,5),[.037,.081,.116,.145,.086],12),0,0,0,1,1,1,pal.fur);
    const tip=[path[3],[-.397,.063,.362],path[4],path[5],[-.323,.272,.511]];
    addPart(tail,taper(tip,[.142,.134,.099,.053,.001],12),0,0,0,1,1,1,pal.cream);
    if(animal==='raccoon'){ball(tail,-.287,-.060,.223,.094,.105,.111,pal.shade,0,0,-.41);}
  }else if(animal==='rabbit')ball(core,-.189,-.142,0,.083,.087,.087,pal.cream);
  group.traverse(o=>{if(o.isGroup)batchGroup(o);});
  return group;
}
function bakeStaticHierarchy(root){
  root.updateMatrixWorld(true);
  const all=[];
  root.traverse(o=>{if(o.isMesh)all.push(o);});
  const g=new THREE.Group();
  for(const original of all){
    const m=original.clone();m.matrix.copy(original.matrixWorld);m.matrix.decompose(m.position,m.quaternion,m.scale);
    m.userData.tint=new THREE.Color(1,1,1);m.userData.surface=Object.keys(surfaces).find(k=>surfaces[k]===original.material)||'yarn';g.add(m);
  }
  batchGroup(g);return g;
}
const peopleTemplates=new Map();
function puppetTemplate(look){
  const {type,animal,coat:cloth}=look;
  const key=type+'|'+animal+'|'+cloth+'|'+look.pelt.fur+(animal==='human'?'|'+look.pick%6:'');
  if(!peopleTemplates.has(key)){
    peopleTemplates.set(key,{near:makeBody(look,true),far:bakeStaticHierarchy(makeBody(look,false))});
  }
  return peopleTemplates.get(key);
}
function mountedPuppet(identity,mount,type){
  const look=puppetAppearance(identity.role,identity.skin,identity.seed);
  return createSaddleRig(puppetTemplate(look).near.clone(true),mount,type);
}
export function createPuppet(type='fox',color,seed=0){
  const look=puppetAppearance(type,color,seed);
  type=look.type;
  const {animal,coat:cloth,pick}=look;
  const template=puppetTemplate(look),near=template.near.clone(true),far=template.far.clone(true);
  const group=new THREE.Group(),lod=new THREE.LOD();group.add(lod);lod.addLevel(near,0);lod.addLevel(far,type==='fox'?48:29,.12);
  const bone={};near.traverse(o=>{if(o.name)bone[o.name]=o;});
  let styleSeed=motionSeed(seed),lastId;
  let phaseIdle=(pick%141)*.039,tailLag=0,em=0,impact=0,shot=0,equipment;
  function updateEquipment(kit){
    const selected=kit?.arm;
    if(equipment?.name===selected)return;
    if(equipment){equipment.removeFromParent();for(const mesh of equipment.children)mesh.geometry.dispose();equipment=null;}
    if(!selected)return;
    const long=selected!=='pistol';
    equipment=joint(bone.elbowR,selected,.044,-.215,.011);
    addPart(equipment,geo.box,.018,-.045,0,.075,long?.237:.123,.053,'#433744',0,0,.06,'plain');
    addPart(equipment,geo.box,.016,long?-.186:-.115,0,.054,long?.145:.06,.045,'#77727a',0,0,0,'plain');
    addPart(equipment,geo.box,-.018,-.013,0,.126,.058,.051,'#624453',0,0,-.1,'plain');
    if(long)addPart(equipment,geo.box,.04,.144,0,.071,.09,.06,'#a96a4f');
    batchGroup(equipment);
  }
  const hero=type==='fox',ragRig=createRagdollRig(bone),farDistance=lod.levels[1].distance;
  function update(pose={},dt=1/60,time=0){
    ragRig.restore();
    if(type==='police'||type==='swat')updateEquipment(pose.kit);
    if(pose.id!==lastId){lastId=pose.id;styleSeed=motionSeed(lastId??seed);}
    const motion=sampleLocomotion(pose,time,styleSeed);
    const articulated=pose.ragdoll||motion.effort>.02||!!pose.kit;
    lod.levels[1].distance=articulated?Infinity:farDistance;
    if(articulated){near.visible=true;far.visible=false;}
    dt=clamp(Number(dt)||0,0,.1);phaseIdle+=dt;
    const {phase,step:a,pace:rel,turn,breath:idleBreath}=motion,b=Math.cos(phase*2);
    const waveSignal=pose.emote?1:0;
    em+=(waveSignal-em)*(1-Math.exp(-dt*14));
    impact=Math.max(clamp(Number(pose.impact)||0,0,1),impact*Math.exp(-dt*8));
    shot=Math.max(clamp(Number(pose.fire)||0,0,1),shot*Math.exp(-dt*14));
    far.position.y=motion.bob;
    far.rotation.set(motion.roll*.55,0,-motion.lean*.50);
    if(!near.visible)return;
    bone.core.position.y=.69+motion.bob-.039*impact;
    bone.core.rotation.z=pose.stunned&&!pose.ragdoll?-1.26:-motion.lean+.12*impact;
    bone.core.rotation.x=motion.roll;bone.core.rotation.y=motion.twist;
    const squash=motion.squash-.10*impact;
    bone.torso.scale.set(1-squash*.52,1+squash,1-squash*.50);
    bone.head.position.y=.49+.30*squash+.009*Math.cos(phase*2-.6)*rel;
    bone.head.rotation.z=motion.lean*.36+.022*b*rel+.057*impact+.009*(1-rel)*idleBreath;
    bone.head.rotation.x=-motion.roll*.55;
    bone.head.rotation.y=-motion.twist*.61-turn*.145+.14*em*Math.sin(phaseIdle*7);
    const blinkCycle=(phaseIdle+pick*.113)%3.63;
    bone.eyes.scale.y=1-.91*Math.max(0,1-Math.abs(blinkCycle-.10)/.079);
    for(const s of [-1,1]){
      const k=s<0?'L':'R',leg=bone['leg'+k],arm=bone['arm'+k],ear=bone['ear'+k];
      const limb=s<0?motion.left:motion.right;
      leg.rotation.z=limb.thigh+motion.lean*.52;
      leg.scale.y=1+(limb.legStretch||0);arm.scale.y=1+(limb.armStretch||0);
      leg.rotation.x=-s*.036;bone['knee'+k].rotation.z=limb.shin;
      arm.rotation.z=limb.arm+motion.lean*.48;
      arm.rotation.x=-s*limb.splay;
      bone['elbow'+k].rotation.z=limb.elbow;
      if(s>0){const free=1-motion.effort;arm.rotation.z+=free*(1.11*shot+em*(2.4+.20*Math.sin(phaseIdle*13)));arm.rotation.x+=free*em*(.36+.16*Math.sin(phaseIdle*14));}
      if(ear){
        ear.rotation.x=s*(.085+.029*Math.sin(phase*2-.5)*rel)+turn*.07;
        ear.rotation.z=-.025*(1-rel)*idleBreath+.069*Math.sin(phase*2-.38)*rel+.13*impact;
      }
    }
    if(bone.cape){bone.cape.rotation.z=-.07*rel-.04*b*rel-.018*idleBreath;bone.cape.rotation.x=.045*a*rel+turn*.03;}
    if(bone.tail){
      tailLag+=(turn-tailLag)*(1-Math.exp(-dt*5.5));
      bone.tail.rotation.y=.10*Math.sin(phaseIdle*2.4)+.15*Math.sin(phase-.6)*rel-.3*tailLag;
      bone.tail.rotation.z=(hero?.06:.02)+.075*Math.sin(phase*2-.9)*rel+.048*idleBreath-em*.17;
    }
    if(pose.ragdoll)ragRig.apply(pose.ragdoll);
  }
  return {group,update,dispose(){updateEquipment();group.removeFromParent();}};
}
// A section runs across the body from its front to the back. A broad top and
// rounded shoulders give the knitted car one continuous, upholstered silhouette.
import {coachBody,enamel} from './coachwork.js';
surfaces.enamel=enamel;
const carShapeCache = new Map();
function wheelArchBody(key,stations,axles,radius){
  if(!carShapeCache.has(key))carShapeCache.set(key,coachBody(stations,axles,radius,key==='saloon'?[-1.10,.84]:key==='sport-wing'?[-1.35,.98]:[-1.30,.81]));
  return carShapeCache.get(key);
}
function carLoft(key, sections, exponent = .55) {
  if (carShapeCache.has(key)) return carShapeCache.get(key);
  const slices = 16, positions = [], uvs = [], indices = [];
  const signedPower = v => Math.sign(v) * Math.pow(Math.abs(v),exponent);
  sections.forEach(([x, bottom, top, halfWidth], index) => {
    for (let n=0;n<=slices;n++) {
      const a = n / slices * Math.PI * 2;
      positions.push(x, (bottom+top)/2+(top-bottom)/2*signedPower(Math.cos(a)), halfWidth*signedPower(Math.sin(a)));
      uvs.push(index/(sections.length-1), n/slices);
    }
  });
  for(let j=0;j<sections.length-1;j++) for(let i=0;i<slices;i++) {
    const a=j*(slices+1)+i,b=a+1,c=a+slices+1,d=c+1;
    const bay=key==='city-bus'?sections[j][0]>=2.82:key==='van-body'&&sections[j][0]>=-.58&&sections[j+1][0]<=.91;
    if(bay&&(i<2||i>=slices-2))continue;
    indices.push(a,b,c,b,d,c);
  }
  for(let end=0;end<=1;end++) {
    const i=end*(sections.length-1),[x,lo,hi]=sections[i];
    const center=positions.length/3;
    positions.push(x,(lo+hi)/2,0);uvs.push(.5,.5);
    for(let n=0;n<slices;n++){
      const a=i*(slices+1)+n;
      if(end===0)indices.push(center,a+1,a);else indices.push(center,a,a+1);
    }
  }
  const mesh=new THREE.BufferGeometry();
  mesh.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  mesh.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  mesh.setIndex(indices);mesh.computeVertexNormals();carShapeCache.set(key,mesh);return mesh;
}

function carWindshield(key,phase) {
  if(carShapeCache.has(key))return carShapeCache.get(key);
  const back=phase==='rear';
  const sign=back ? -1 : 1;
  const xBottom=back ? -1.23 : .99, xTop=back ? -.77 : .45;
  const yBottom=back ? 1.12 : 1.13, yTop=1.59;
  const bottomWidth=back ? .54 : .60,topWidth=.51;
  const geom = new THREE.BufferGeometry();
  const v = [xBottom,yBottom,-bottomWidth, xTop,yTop,-topWidth, xTop,yTop,topWidth, xBottom,yBottom,bottomWidth];
  geom.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,1,1,1,1,0],2));
  geom.setIndex(sign>0 ? [0,1,2,0,2,3] : [0,2,1,0,3,2]);
  geom.computeVertexNormals();carShapeCache.set(key,geom);return geom;
}
function carSideWindow(front,side) {
  const key='side-window-'+Number(front)+'-'+side;
  if(carShapeCache.has(key))return carShapeCache.get(key);
  const points=front?
    [[-.03,1.07,.73],[-.03,1.59,.604],[.39,1.57,.602],[.79,1.10,.699]]:
    [[-1.10,1.07,.69],[-.72,1.53,.589],[-.17,1.59,.604],[-.17,1.07,.73]];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(([x,y,z])=>[x,y,z*side]),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,1,1,1,1,0],2));
  geometry.setIndex(side>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]);geometry.computeVertexNormals();
  carShapeCache.set(key,geometry);return geometry;
}
const carCloth=carYarn.binding,carDark=carYarn.ink,carCream=carYarn.thread;
function carPart(group,geom,x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0,style='yarn'){
  return addPart(group,geom,x,y,z,sx,sy,sz,color,rx,ry,rz,style);
}
function carBox(g,x,y,z,w,h,d,c,rx=0,ry=0,rz=0,style='yarn'){
  return carPart(g,geo.box,x,y,z,w,h,d,c,rx,ry,rz,style);
}
function carBall(g,x,y,z,w,h,d,c,style='yarn'){
  return carPart(g,geo.ball,x,y,z,w,h,d,c,0,0,0,style);
}
function carButton(g,x,y,z,r,length,c) {
  return carPart(g,geo.cylinder,x,y,z,r,length,r,c,Math.PI/2,0,0,'yarn');
}
function carTrim(g,a,b,r,c){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),dir=to.clone().sub(from);
  const mid=from.clone().lerp(to,.5);
  const item=carPart(g,geo.cylinder,mid.x,mid.y,mid.z,r,dir.length(),r,c);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return item;
}
function lensThread(g,x,y,z,spacing){
  for(const side of [-1,1])carBall(g,x,y,z+side*spacing,.006,.013,.011,carYarn.welt);
  carBox(g,x+.003,y+.002,z,.008,.009,spacing*1.6,carYarn.thread);
}
function carGrille(g,x,y,wide){
  carBall(g,x,y,0,.088,.24,wide,'#464656');
  for(let i=-3;i<=3;i++)carBox(g,x+.090,y,i*wide*.213,.012,.32*(1-.18*Math.abs(i)/3),.028,'#e3cba0');
}
function carBumpers(g,xfront,xrear,width){
  for(const [x,dir] of [[xfront,1],[xrear,-1]]){
    carBox(g,x,.45,0,.14,.105,width*1.86,'#c3b29b');
    for(const s of [-1,1]){
      carBall(g,x,.45,s*width*.91,.077,.061,.076,'#f3dec2');
      carBox(g,x+dir*.075,.46,s*width*.43,.09,.14,.16,'#707681');
    }
    lacedSeam(g,[x+dir*.035,.70,-width*.42],[x+dir*.035,.70,width*.42],6);
    carBox(g,x+dir*.077,.53,0,.02,.12,.42,carCream);
    carBox(g,x+dir*.091,.525,-.16,.006,.09,.065,'#387298');
    for(let i=0;i<4;i++)carBox(g,x+dir*.091,.535,-.07+i*.052,.006,.058,.018,'#525260');
  }
}
function carChassis(g,paint,service,variant){
  const body=wheelArchBody('saloon',[
    [-1.94,.49,.855,.60],[-1.85,.38,.924,.79],[-1.55,.32,1.012,.849],[-.89,.31,1.026,.855],
    [.03,.31,1.013,.849],[.84,.32,1.009,.83],[1.50,.34,.961,.817],[1.84,.39,.905,.737],[1.96,.51,.837,.59]
  ],[-1.22,1.25],.372);
  carPart(g,body,0,0,0,1,1,1,paint,0,0,0,'enamel');
  const capColor=service==='police'?'#e8dfc8':service==='taxi'||variant%3===0?carCloth:paint;
  carPart(g,carLoft('hollow-cabin-roof',[[-.86,1.555,1.59,.57],[-.66,1.595,1.68,.63],
    [.18,1.61,1.72,.64],[.48,1.56,1.63,.58]],.42),0,0,0,1,1,1,capColor);
  for(const side of [-1,1]){
    for(const [from,to] of [[[-1.23,1.03,.69],[-.77,1.60,.59]],[[.92,1.04,.70],[.45,1.60,.59]],[[-.11,1.02,.73],[-.11,1.63,.60]]]){
      carTrim(g,[from[0],from[1],side*from[2]],[to[0],to[1],side*to[2]],.045,capColor);
    }
    carTrim(g,[-1.22,1.052,side*.69],[.94,1.052,side*.70],.044,capColor);
  }
  for(const k of ['front','rear'])trimmedGlass(g,carWindshield('glass-'+k,k),k==='front'?carYarn.frontPane:carYarn.pane);
  for(const s of [-1,1]){
    for(const front of [true,false])trimmedGlass(g,carSideWindow(front,s),front?carYarn.pane:carYarn.shadePane);
    // Contrast piping at the rocker, waist and skirt.
    lacedSeam(g,[-1.06,.74,s*.85],[.85,.74,s*.85],9);
    carBox(g,.014,.42,s*.841,1.55,.054,.057,'#343846');
    carTrim(g,[-1.57,.87,s*.831],[1.51,.86,s*.794],.024,'#e8c9a3');
    carBox(g,.23,.97,s*.823,.18,.034,.04,carCloth);
    carBox(g,-.73,.97,s*.823,.16,.034,.04,carCloth);
    carBall(g,1.65,.83,s*.615,.217,.169,.174,capColor);
    carBall(g,1.79,.855,s*.635,.125,.119,.13,'#ffe8ab','glow');
    carBall(g,-1.74,.83,s*.677,.104,.11,.12,'#8a3c48');
    carBall(g,-1.81,.85,s*.686,.064,.074,.08,carYarn.stop,'glow');
    lensThread(g,1.909,.855,s*.635,.033);lensThread(g,-1.871,.85,s*.686,.022);
    // The cut through each wing is part of the body profile. Cabinet seams and
    // hood flutes follow the pressed panels without filling the wheel opening.
    for(const [a,b] of [
      [[-.15,.98,.841],[-.14,.58,.847]],[[-.14,.58,.847],[.54,.55,.844]],
      [[.54,.55,.844],[.66,.91,.841]],[[-.86,.89,.842],[-.76,.62,.850]],
      [[1.00,1.022,.48],[1.61,.97,.46]],[[1.61,.97,.46],[1.81,.935,.415]]
    ])carTrim(g,[a[0],a[1],s*a[2]],[b[0],b[1],s*b[2]],.008,carYarn.welt);
    carBox(g,.686,1.08,s*.80,.13,.07,.11,capColor);
    if(service==='police'){
      carBox(g,-.10,.81,s*.849,1.98,.16,.028,'#ede1c8');
      carBox(g,-.10,.82,s*.866,1.92,.04,.012,'#6ba9c4');
    }
    if(service==='taxi')for(let i=0;i<7;i++)carBox(g,-.78+i*.20,.81,s*.849,.10,.09,.02,carDark);
  }
  carTrim(g,[1.04,.995,0],[1.86,.914,0],.023,'#e6c5a1');
  carGrille(g,1.91,.72,.40);
  carBumpers(g,1.98,-1.94,.86);
}
// Cut every pane from the same three tones of felt. Bake the jamb, a pair of
// diagonal highlights and the lower cord into the rigid body material batch.
function carPanel(g,points,color){
  const space=points.map(p=>new THREE.Vector3(...p)),[a,b,c,d]=space;
  const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const outward=normal.x*(a.x+c.x)+normal.z*(a.z+c.z)>=0;
  if(!outward)normal.multiplyScalar(-1);
  (g.userData.glazing??=[]).push({points,normal:normal.toArray()});
  const vertices=[],inks=[],uv=[],indices=[],sample=new THREE.Vector3(),other=new THREE.Vector3();
  function patch(corners,tint,raise){
    const offset=vertices.length/3,col=new THREE.Color(tint);
    for(const [u,v] of corners){
      sample.lerpVectors(a,b,u).lerp(other.lerpVectors(d,c,u),v).addScaledVector(normal,raise);
      vertices.push(sample.x,sample.y,sample.z);inks.push(col.r,col.g,col.b);uv.push(u,v);
    }
    for(const i of outward?[0,1,2,0,2,3]:[0,2,1,0,3,2])indices.push(offset+i);
  }
  if(g.userData.seats3D){
    const pane=new THREE.BufferGeometry();
    pane.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    pane.setIndex(outward?[0,1,2,0,2,3]:[0,2,1,0,3,2]);pane.computeVertexNormals();
    carPart(g,pane,0,0,0,1,1,1,color,0,0,0,'glass');
  }else{
    patch([[0,0],[1,0],[1,1],[0,1]],carYarn.shadePane,0);
    patch([[.03,.06],[.97,.06],[.95,.95],[.05,.95]],color,.003);
  }
  patch([[.025,.76],[.041,.76],[.104,.96],[.089,.96]],carYarn.gleam,.006);
  patch([[.06,.025],[.94,.025],[.92,.055],[.08,.055]],carYarn.binding,.006);
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(inks,3));geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geom.setIndex(indices);geom.computeVertexNormals();
  return carPart(g,geom,0,0,0,1,1,1,'#ffffff');
}
function trimmedGlass(g,original,tint){
  const attr=original.attributes.position;
  carPanel(g,[0,3,2,1].map(i=>[attr.getX(i),attr.getY(i),attr.getZ(i)]),tint);
}
function lacedSeam(g,from,to,steps){
  // Low-poly stitches share one geometry and the body's existing yarn batch.
  const p=new THREE.Vector3(...from),span=new THREE.Vector3(...to).sub(p),at=new THREE.Vector3();
  const length=span.length()/steps*.55;
  const axis=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),span.clone().normalize());
  for(let i=0;i<steps;i++){
    at.copy(p).addScaledVector(span,(i+.5)/steps);
    const stitch=carBox(g,at.x,at.y,at.z,length,.023,.026,carYarn.binding);
    stitch.quaternion.copy(axis);
  }
}
function townCar(g,type,paint){
  const sport=type==='sport',l=sport?2.12:1.71,w=sport?.94:.79;
  const belt=sport?.70:.91,roof=sport?1.20:1.58;
  const rear=sport?-1.57:-1.45,front=sport?1.04:.86;
  const rearTop=sport?-.58:-1.02,frontTop=sport?.17:.23,glass=w*.87,top=w*.72;
  const shell=wheelArchBody(type+'-wing',[
    [-l+.06,.40,belt*.86,w*.73],[-l+.17,.30,belt*.99,w*.94],[-l*.65,.285,belt+.035,w],
    [0,.295,belt+.013,w*.987],[l*.64,.29,belt-.042,w*.977],[l-.17,.34,belt-.10,w*.915],[l-.06,.39,belt-.15,w*.75]
  ],sport?[-1.31,1.36]:[-1.06,1.03],sport?.34:.304);
  carPart(g,shell,0,0,0,1,1,1,paint,0,0,0,'enamel');
  // A tall, short greenhouse on the hatch and a swept, low canopy on the coupé.
  const lower=belt-.014;
  const wind=(bottom,end,sign)=>carPanel(g,[[bottom+sign*.017,lower+.036,-glass*.84],[bottom+sign*.017,lower+.036,glass*.84],
    [end+sign*.016,roof-.046,top*.83],[end+sign*.016,roof-.046,-top*.83]],sign>0?'#98c3c6':'#6b949e');
  wind(front,frontTop,1);wind(rear,rearTop,-1);
  const roofPanel=carLoft(type+'-roof',[
    [rearTop-.046,roof-.072,roof-.031,top*.89],[rearTop+.076,roof-.047,roof+.034,top],
    [(rearTop+frontTop)/2,roof-.037,roof+.055,top*1.022],[frontTop-.055,roof-.048,roof+.025,top],
    [frontTop+.057,roof-.075,roof-.022,top*.90]],.48);
  carPart(g,roofPanel,0,0,0,1,1,1,sport?paint:'#eadbbb',0,0,0,'enamel');
  for(const s of [-1,1]){
    carPanel(g,[[rear+.10,belt+.072,s*glass],[front-.10,belt+.072,s*glass],
      [frontTop-.03,roof-.078,s*top],[rearTop+.05,roof-.078,s*top]],'#81aab3');
    for(const [foot,tip] of [[rear,rearTop],[front,frontTop],[sport?-.58:-.60,sport?-.37:-.52]])
      carTrim(g,[foot,belt+.032,s*glass],[tip,roof-.017,s*top],.032,paint);
    carTrim(g,[rear+.005,belt+.05,s*glass],[front-.005,belt+.05,s*glass],.022,'#ecd8a2');
    lacedSeam(g,[-.86,belt-.13,s*(w+.008)],[.49,belt-.13,s*(w+.008)],7);
    carBox(g,-.28,belt-.055,s*w,.20,.028,.027,'#d3c4a1');
    const sillFrom=sport?-.88:-.70,sillTo=sport?.93:.66;
    carBox(g,(sillFrom+sillTo)/2,.355,s*w*.99,sillTo-sillFrom,.048,.042,sport?'#344350':'#c7bab1');
    const sideZ=(w-.008)*s;
    for(const [a,b] of [[[front-.17,belt-.03],[sillTo-.025,.455]],[[sillTo-.025,.455],[sillFrom+.08,.437]],
      [[sillFrom+.08,.437],[sillFrom-.045,belt-.06]]]){
      carTrim(g,[a[0],a[1],sideZ],[b[0],b[1],sideZ],.009,carYarn.welt);
    }
    carBall(g,l-.12,belt-.16,s*w*.68,.09,sport?.047:.10,sport?.17:.114,'#ffeba0','glow');
    carBall(g,-l+.08,belt-.12,s*w*.68,.045,sport?.047:.10,.121,carYarn.stop,'glow');
    lensThread(g,l-.035,belt-.16,s*w*.68,.033);lensThread(g,-l+.036,belt-.12,s*w*.68,.028);
    if(sport){
      carBox(g,-1.50,belt+.105,s*.58,.08,.2,.07,'#3b3e49',0,0,-.16);
      carBox(g,1.42,belt-.087,s*.19,.77,.035,.075,'#e8d8ad',0,0,-.06);
    }else carTrim(g,[rearTop-.01,roof+.047,s*.36],[frontTop+.01,roof+.047,s*.36],.014,'#c8af8d');
  }
  if(sport)carBox(g,-1.56,belt+.24,0,.32,.065,1.76,paint,0,0,-.06);
  carBox(g,l-.098,belt-.26,0,.04,.13,w*(sport?1.12:.68),carDark);
  carBumpers(g,l-.098,-l+.098,w*.96);
}
function cityBus(g,paint){
  const l=4.25,w=1.19,lower=1.20,top=2.80;
  const shell=carLoft('city-bus',[
    [-4.24,.42,1.28,1.10],[-4.11,.35,1.38,w],[-3.91,.35,1.39,w],
    [2.82,.35,1.39,w],[3.92,.35,1.39,w],[4.10,.37,1.36,1.16],[4.23,.48,1.30,1.08]
  ],.22);
  carPart(g,shell,0,0,0,1,1,1,paint);
  carPart(g,carLoft('city-bus-roof',[[-4.23,2.31,2.57,1.08],[-4.10,2.32,2.76,1.16],[-3.90,2.34,2.82,w],
    [3.92,2.34,2.82,w],[4.10,2.32,2.76,1.16],[4.23,2.31,2.56,1.08]],.22),0,0,0,1,1,1,paint);
  for(const s of [-1,1]){
    for(const end of [-1,1])carBox(g,end*4.14,1.83,s*1.10,.14,1.03,.12,paint);
    carBox(g,0,1.05,s*w,7.99,.55,.032,'#ece2c5');
    carBox(g,0,lower+.05,s*(w+.016),8.02,.047,.021,'#e7b05f');
    for(let i=0;i<7;i++){
      const x=-3.45+i*1.13;
      const door=s>0 && (i===3||i===6);
      carBox(g,x-.53,1.83,s*w,.095,1.0,.041,'#354f60');
      carBox(g,x,1.435,s*w,1.13,.105,.041,paint);
      carBox(g,x,2.29,s*w,1.13,.075,.041,paint);
      const z=s*(w+.031);
      carPanel(g,[[x-.45,1.53,z],[x+.45,1.53,z],[x+.45,2.25,z],[x-.45,2.25,z]],door?carYarn.pane:i%2?carYarn.frontPane:carYarn.pane);
      if(door)carBox(g,x,1.48,s*(w+.032),.060,1.77,.018,'#586c70');
      else carBox(g,x,2.08,s*(w+.032),.92,.027,.018,'#dde4cb');
    }
    carBall(g,4.16,.84,s*.78,.094,.10,.14,'#f9dfa4','glow');
    carBall(g,-4.16,1.04,s*.91,.055,.17,.092,carYarn.stop,'glow');
    lensThread(g,4.251,.84,s*.78,.039);lensThread(g,-4.213,1.04,s*.91,.025);
  }
  for(const s of [-1,1]){
    const cap=s*(l-.005);
    carPanel(g,[[cap,1.32,-.96],[cap,1.32,.96],[cap,2.32,.96],[cap,2.32,-.96]],s>0?carYarn.frontPane:carYarn.pane);
    lacedSeam(g,[cap,1.10,-.83],[cap,1.10,.83],9);
    carBox(g,s*(l-.014),2.43,0,.04,.28,1.51,'#33444b');
    for(const [y,z,ww] of [[2.49,-.48,.16],[2.48,-.11,.18],[2.42,-.11,.17],[2.36,-.11,.18],[2.40,.34,.24],[2.40,.62,.09]]){
      carBox(g,s*(l+.009),y,z,.016,.021,ww,'#eec16e');
    }
    for(const [y,z] of [[2.45,-.40],[2.39,-.40],[2.45,-.04],[2.39,-.04]])carBox(g,s*(l+.009),y,z,.016,.067,.025,'#edba68');
  }
  carBox(g,0,top+.035,0,7.73,.13,2.15,'#d5d4b6');
  carBox(g,-1.12,top+.14,0,1.36,.17,.94,'#8eada4');
  for(let i=0;i<5;i++)carBox(g,-1.63+i*.22,top+.232,0,.089,.014,.68,'#576c70');
}

function carVan(g,type,paint){
  const body=carLoft('van-body',[
    [-2.45,.42,1.00,.72],[-2.37,.39,1.93,.94],[-2.16,.39,2.00,.98],[-.62,.39,2.00,.98],
    [-.58,.39,1.26,.95],[.30,.39,1.25,.91],[.56,.39,1.24,.88],[.91,.40,1.23,.89],
    [1.65,.43,1.19,.86],[2.12,.45,1.07,.77],[2.31,.55,.96,.68]
  ],.48);
  carPart(g,body,0,0,0,1,1,1,paint);
  carPart(g,carLoft('van-cab-roof',[[-.70,1.89,2.0,.91],[-.53,1.90,2.03,.93],[.17,1.87,1.97,.87],[.33,1.82,1.91,.77]],.38),0,0,0,1,1,1,paint);
  const stripe=type==='firetruck'?'#f1b858':type==='swat'?'#7d90a6':'#49a593';
  for(const s of [-1,1]){
    carBox(g,-.74,1.05,s*.974,2.90,.13,.028,stripe);
    carBox(g,-1.25,.66,s*.975,1.68,.25,.023,type==='firetruck'?'#b4a098':paint);
    for(let i=0;i<4;i++)if(type==='firetruck')carBox(g,-1.25,.57+i*.064,s*.992,1.58,.017,.012,'#716d73');
    if(type==='van'){
      carBox(g,-1.11,1.55,s*.972,1.53,.52,.022,'#ead9ad');
      for(let i=0;i<3;i++)carTrim(g,[-1.65+i*.26,1.45,s*.995],[-1.42+i*.26,1.66,s*.995],.027,'#99885a');
    }else carBox(g,-.85,1.56,s*.946,.38,.41,.035,'#5a8692');
    if(type!=='van')carBox(g,-1.47,1.56,s*.945,.66,.40,.035,type==='swat'?'#414858':'#6c99a0');
    const z=s*.911;
    const high=s*.81;
    carPanel(g,[[-.53,1.30,z],[.63,1.30,z],[.30,1.84,high],[-.53,1.89,high]],'#6e9ca1');
    carTrim(g,[-.54,1.27,z],[-.54,1.92,high],.044,paint);
    carTrim(g,[.66,1.25,s*.85],[.31,1.86,high],.044,paint);
    carTrim(g,[-.55,1.28,z],[.65,1.28,z],.032,paint);
    carBall(g,1.9,1.03,s*.65,.23,.15,.19,paint);
    carBall(g,2.09,1.04,s*.66,.096,.10,.12,'#ffe4a1','glow');
    carBall(g,-2.389,1.14,s*.77,.075,.125,.12,carYarn.stop,'glow');
    lensThread(g,2.183,1.04,s*.66,.03);lensThread(g,-2.462,1.14,s*.77,.028);
    if(type==='ambulance'){
      carBox(g,-1.33,1.48,s*.969,.10,.34,.025,carCream);
      carBox(g,-1.33,1.48,s*.971,.32,.10,.027,carCream);
    }
    for(const xx of [-1.55,1.43])carBall(g,xx,.66,s*.83,.62,.26,.22,paint);
  }
  // Driver's forward glass leans from the roof down to the hood.
  carPanel(g,[[.634,1.314,-.75],[.634,1.314,.75],[.314,1.852,.77],[.314,1.852,-.77]],carYarn.frontPane);
  carBox(g,.48,1.56,0,.065,.548,.04,paint,0,0,.56);
  carGrille(g,2.266,.84,.47);carBumpers(g,2.34,-2.45,.97);
  carBox(g,-2.405,1.22,0,.040,1.09,.041,'#776a6d');
  for(const side of [-1,1]){
    const z=side*.39,x=-2.448;
    carPanel(g,[[x,1.42,z-.28],[x,1.42,z+.28],[x,1.79,z+.28],[x,1.79,z-.28]],carYarn.pane);
    lacedSeam(g,[x,1.06,z-.24],[x,1.06,z+.24],3);
  }
  if(type==='ambulance'){
    carBox(g,-2.456,1.14,0,.026,.36,.10,carYarn.thread);
    carBox(g,-2.457,1.14,0,.028,.11,.35,carYarn.thread);
  }
  if(type==='firetruck'){
    for(const s of [-1,1])carTrim(g,[-2.29,2.11,s*.32],[.20,2.11,s*.32],.050,carCloth);
    for(let j=0;j<9;j++)carTrim(g,[-2.13+j*.27,2.11,-.32],[-2.13+j*.27,2.11,.32],.025,carCloth);
  }
  if(type==='swat')for(let j=0;j<3;j++)carBox(g,-1.89+j*.48,2.00,0,.29,.13,1.1,'#3b424d');
}
const spoolWelt=new THREE.TorusGeometry(1,.045,4,24);
// A rolled shoulder and recessed bead remain visible against the open wheel arch.
const roadTyre=new THREE.LatheGeometry([
  [.61,-.40],[.71,-.49],[.86,-.52],[.96,-.455],[1,-.315],
  [1,.315],[.96,.455],[.86,.52],[.71,.49],[.61,.40]
].map(([r,z])=>new THREE.Vector2(r,z)),32).rotateX(Math.PI/2);
function buttonWheel(g,r,side){
  carPart(g,spoolWelt,0,0,side*.121,r*.86,r*.86,.23,carYarn.welt);
  for(let i=0;i<8;i++){
    const theta=Math.PI*i*.25;
    carBox(g,Math.cos(theta)*r*.65,Math.sin(theta)*r*.65,side*.153,.066,.021,.016,carYarn.brass,0,0,theta+.82);
  }
}
function carWheel(radius,side,service) {
  const wheel=new THREE.Group();
  carPart(wheel,roadTyre,0,0,0,radius,radius,.219,'#34343d');
  carButton(wheel,0,0,0,radius*.69,.144,'#46434a');
  carPart(wheel,spoolWelt,0,0,side*.095,radius*.68,radius*.68,.24,carYarn.silver);
  const spokeColor=service==='swat'?'#72767b':'#b9b2a4';
  for(let k=0;k<5;k++){
    const a=Math.PI*2*k/5+.20;
    const r=radius*.43;
    const spoke=carBox(wheel,r*Math.cos(a),r*Math.sin(a),side*.101,radius*.49,radius*.14,.033,spokeColor);
    spoke.rotation.z=a+.11*side;
  }
  carButton(wheel,0,0,side*.118,radius*.28,.034,'#a5a098');
  carButton(wheel,0,0,side*.168,radius*.12,.025,'#e5cfb2');
  for(let k=0;k<3;k++){
    const angle=k*Math.PI*2/3;
    carBall(wheel,Math.cos(angle)*radius*.41,Math.sin(angle)*radius*.41,side*.161,.026,.026,.012,'#545766');
  }
  buttonWheel(wheel,radius,side);
  batchGroup(wheel);return wheel;
}
function carServiceDetails(g,type,isVan){
  const height=isVan?2.03:1.72;
  if(type==='taxi') {
    carBox(g,-.04,height+.10,0,.34,.17,.56,'#f7de9c');
    carBox(g,.138,height+.11,0,.012,.067,.30,'#78613d');
    return null;
  }
  if(!['police','ambulance','firetruck','swat'].includes(type))return null;
  const y=height+.08, x=isVan?-.14:.05;
  carBox(g,x,y,0,.27,.080,.88,'#3d3c4c');
  const beacon=new THREE.Group();
  beacon.position.set(x,y+.119,0);
  for(const s of [-1,1]){
    const tint=type==='firetruck' && s<0?'#f9a372':'#68d4fa';
    carBall(beacon,0,0,s*.280,.116,.105,.144,tint,'glow');
  }
  batchGroup(beacon);
  g.add(beacon);return beacon;
}
function createCarBody(type='car',color,seed=0){
  type=String(type?.type??type).toLowerCase();
  if(isStreetVehicle(type))return createStreetVehicle(THREE,{geo,addPart,batchGroup,mountedPuppet},type,color,seed);
  if(type==='fire'||type==='firefighter')type='firetruck';
  if(type==='medic')type='ambulance';
  if(type==='cop')type='police';
  const index=(Math.abs(Number(seed)||0)*1741)|0, variant=Math.abs(index)%carPaint.length;
  const supplied=typeof color==='string' && /^#(?:[0-9a-f]{3}){1,2}$/i.test(color);
  const isVan=['van','firetruck','swat','ambulance'].includes(type),bus=type==='bus';
  const shaped=type==='compact'||type==='sport';
  const spec=vehicleSpec(type);
  const paint=fleetPaint[type] || (supplied ? color : carPaint[variant]);
  const group=new THREE.Group(),frame=new THREE.Group(),body=new THREE.Group();
  group.name='Maille véhicule '+type;body.name='Carrosserie';
  group.add(frame);frame.add(body);
  {
    const low=type==='sport',compact=type==='compact';
    body.userData.seats3D={x:low?-.32:compact?-.31:.02,y:low?.71:compact?.91:1.01,spacing:low?.38:compact?.31:.335,scale:low?.70:compact?.89:.94};
  }
  if(bus)cityBus(body,paint);
  else if(shaped)townCar(body,type,paint);
  else if(isVan)carVan(body,type,paint);
  else carChassis(body,paint,type,variant);
  if(!bus&&!shaped){
    const sourceLength=isVan?2.54:2.06,sourceWidth=isVan?1.10:.97;
    frame.scale.set(spec.halfLength/sourceLength,spec.height/(isVan?2.30:type==='taxi'||type==='police'?1.93:1.72),spec.halfWidth/sourceWidth);
  }
  if(body.userData.seats3D){
    body.userData.seats3D.units=frame.scale.toArray();
    const fit=cabinFit(type,body.userData.seats3D),{x,y,spacing,wheel}=fit;
    for(const side of [-1,1]){
      carBox(body,x-.19,y+.17,side*spacing,.105,.38,.41,'#524952',0,0,-.11);
      carBall(body,x-.22,y+.38,side*spacing,.073,.089,.132,'#786368');
    }
    carBox(body,x+.58,y+.36,0,.21,.12,spacing*3.4,'#4a4247');
    for(const s of [-1,1])carBox(body,x+.02,y-.045,s*spacing,.36,.10,.38,'#65545b');
    const rim=t=>[wheel[0]-.32*fit.radius*Math.sin(t),wheel[1]+.948*fit.radius*Math.sin(t),wheel[2]+fit.radius*Math.cos(t)];
    for(let i=0;i<16;i++)carTrim(body,rim(i*Math.PI/8),rim((i+1)*Math.PI/8),.013,'#3a3336');
    carTrim(body,wheel,[wheel[0]+.20,wheel[1]-.065,wheel[2]],.026,'#504648');
  }
  const beacon=carServiceDetails(body,type,isVan);
  batchGroup(body);
  const glass=body.children.find(mesh=>mesh.material===surfaces.glass);
  const wheelRadius=bus?.48:isVan?.434:type==='compact'?.304:type==='sport'?.34:.372;
  const axleZ=bus?1.10:isVan?.94:type==='compact'?.68:type==='sport'?.82:.805;
  const axles=bus?[-2.50,2.73]:isVan?[-1.54,1.45]:type==='compact'?[-1.06,1.03]:type==='sport'?[-1.31,1.36]:[-1.22,1.25];
  const wheels=[];
  for(const x of axles)for(const s of [-1,1]){
    const wheel=carWheel(wheelRadius,s,type);
    wheel.userData.front=x>0;
    wheel.position.set(x,wheelRadius,s*axleZ);
    frame.add(wheel);wheels.push(wheel);
  }
  let spin=0,previousSpeed=0,lastHeading=null,pitch=0,roll=0,compression=0,steer=0;
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  function update(pose={},dt=.016,time=0){
    dt=clamp(Number(dt)||.016,.001,.09);const t=Number(time)||0;
    const speed=Number.isFinite(pose.speed)?pose.speed:pose.moving?6:0;
    const heading=Number.isFinite(pose.angle)?pose.angle:null;
    let steering=Number(pose.steer??pose.turn)||0;
    if(!steering && heading!==null && lastHeading!==null)steering=clamp(Math.atan2(Math.sin(heading-lastHeading),Math.cos(heading-lastHeading))/dt*.36,-1,1);
    if(heading!==null)lastHeading=heading;
    const blend=1-Math.exp(-9*dt),velocity=Math.min(1,Math.abs(speed)/14);
    steer+=(clamp(steering,-1,1)*.42-steer)*blend;
    const acceleration=clamp((speed-previousSpeed)/dt,-14,14);previousSpeed=speed;
    pitch+=((acceleration*.0018-(pose.brake?.042:0))-pitch)*blend;
    roll+=(steer*velocity*.22-roll)*blend;
    compression+=(Math.min(.14,Math.abs(Number(pose.impact)||0)*.12)-compression)*Math.min(1,dt*15);
    if(glass)glass.visible=!(pose.parts&1);
    body.position.y=(Math.sin(t*(4+velocity*5)+variant)*.009+Math.sin(t*13+variant)*.004)*velocity-compression*.26;
    const wear=1-chassisHealth(pose.chassisHp)/100;
    body.scale.set(1+compression*.12-wear*.071,1-compression*.6-wear*.096,1+compression*.34+wear*.018);
    body.rotation.z=pitch;body.rotation.x=roll;
    spin-=speed*dt/wheelRadius;
    for(const wheel of wheels){
      const flat=(pose.parts&wheelPart(wheel.userData.front,wheel.position.z>0))!==0;
      wheel.position.y=wheelRadius*(flat?.73:1);wheel.scale.set(1,flat?.65:1,1);
      wheel.rotation.order='YXZ';wheel.rotation.y=wheel.userData.front?-steer:0;wheel.rotation.z=spin;
    }
    if(beacon){
      // The little purls of the beacon breathe without changing anyone else's shared material.
      const flash=pose.siren===false?.18:(Math.sin(t*11.5+variant)>0?1:.45);
      beacon.scale.set(1,.74+.33*flash,1);
    }
  }
  update({},.016,0);
  return {group,windowHost:body,update,dispose(){
    group.traverse(o=>{if(o.isMesh && o.geometry && !Object.values(geo).includes(o.geometry) && ![...carShapeCache.values()].includes(o.geometry))o.geometry.dispose();});
    group.removeFromParent();
  }};
}

const seatedSilhouettes=new Map();
function prepareOccupant(identity,fit,index,close){
  const look=puppetAppearance(identity.role,identity.skin,identity.seed);
  if(close){
    const figure=puppetTemplate(look).near.clone(true);
    return {figure,update:fitCabinPuppet(figure,fit,index)};
  }
  const key=[look.type,look.coat,look.pelt.fur,look.pick%6].join('/');
  if(!seatedSilhouettes.has(key))seatedSilhouettes.set(key,makeBody(look,false,true));
  const low=seatedSilhouettes.get(key).clone(true);
  fitCabinPuppet(low,fit,index);
  const position=low.position.clone(),scale=low.scale.clone();
  low.position.set(0,0,0);low.scale.setScalar(1);
  const figure=bakeStaticHierarchy(low);
  figure.position.copy(position);figure.scale.copy(scale);
  return {figure,dispose(){for(const mesh of figure.children)mesh.geometry.dispose();}};
}
function updateSeatedFigures(host,pose,occupants,seed,type){
  const fit=host.userData.cabinFit??=cabinFit(type,host.userData.seats3D);
  for(let index=0;index<occupants.length;index++){
    const seat=occupants[index],distance=pose.cabinDistance??0;
    const identity=distance<55&&cabinOccupant(pose,index,type,seed);
    if(!identity){if(seat.figure)seat.figure.visible=false;continue;}
    const key=[identity.role,identity.skin,identity.seed].join('/');
    const close=distance<(seat.close?25:20);
    if(seat.key!==key||close!==seat.close){
      seat.figure?.removeFromParent();seat.dispose?.();
      const rig=prepareOccupant(identity,fit,index,close);
      Object.assign(seat,rig,{update:rig.update,dispose:rig.dispose,key,close});
      seat.figure.name=['Conducteur assis','Passager assis','Client du taxi'][index];
      host.add(seat.figure);
    }
    seat.figure.visible=true;seat.update?.(pose.steer??pose.turn);
  }
}
function clearCabin(seats){
  for(const seat of seats){seat.figure?.removeFromParent();seat.dispose?.();}
}

const headLens=new THREE.MeshBasicMaterial({color:'#fff6c0'});
const stopLens=new THREE.MeshBasicMaterial({color:'#ff3527'});
const lampPool=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.20,depthWrite:false,
  blending:THREE.AdditiveBlending,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
const beamShape=new THREE.BufferGeometry();
beamShape.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.12,0,0,.12,1,.014,1,1,.014,-1],3));
beamShape.setAttribute('color',new THREE.Float32BufferAttribute([1,.84,.50,1,.84,.50,.01,.009,.007,.01,.009,.007],3));
beamShape.setIndex([0,1,2,0,2,3]);
function makeVehicleSignals(type,spec){
  const front=new THREE.Group(),rear=new THREE.Group();
  front.name='Feux de croisement';rear.name='Feux stop';
  // Positions follow the lamps modelled into each family, accounting for frame scaling.
  const shaped=type==='compact'||type==='sport',bus=type==='bus',van=['van','firetruck','swat','ambulance'].includes(type);
  const lamp=type==='boxtruck'?[.990,.370,.641,.995,.230,.735]:
    type==='tipper'?[.990,.442,.652,.994,.275,.748]:type==='gt'?[.960,.486,.610,1,.430,.527]:
    type==='supercar'?[.931,.408,.592,.996,.526,.606]:
    shaped?[.99,.49,.66,.98,.50,.66]:bus?[1.00,.284,.65,1.0,.35,.76]:
    van?[.861,.467,.60,.969,.50,.70]:type==='motorbike'?[.57,.753,0,.91,.52,0]:
    type==='scooter'?[.76,.874,0,.90,.438,0]:spec.openSeat?[.89,.75,0,.86,.62,0]:
    type==='pickup'?[.96,.52,.67,.97,.53,.73]:[.922,.49,.658,.905,.49,.705];
  for(const side of spec.openSeat?[0]:[-1,1]){
    function lens(group,material,x,y,z,scale){
      const mesh=new THREE.Mesh(geo.littleBall,material);
      mesh.scale.set(.057,scale,scale*1.23);
      mesh.position.set(x*spec.halfLength,y*spec.height,side*z*spec.halfWidth);group.add(mesh);
    }
    lens(front,headLens,lamp[0],lamp[1],lamp[2],type==='supercar'?.043:.083);
    lens(rear,stopLens,-lamp[3],lamp[4],lamp[5],type==='supercar'?.042:.080);
    const pool=new THREE.Mesh(beamShape,lampPool);
    pool.position.set(spec.halfLength*.92,.085,side*.5*spec.halfWidth);
    pool.scale.set(6.8,1,1.25);pool.rotation.y=side*-.055;
    front.add(pool);
  }
  return {front,rear};
}
const frayedChassis=new THREE.MeshLambertMaterial({color:'#493940'});
const flameYarn=new THREE.MeshBasicMaterial({color:'#f8a451'});
const cottonSmoke=new THREE.MeshBasicMaterial({color:'#82747e',transparent:true,opacity:.42,depthWrite:false});
function roadsterWreck(spec){
  const wreck=new THREE.Group(),l=spec.halfLength,h=spec.height;
  wreck.name='Carcasse';
  const fallen=joint(wreck,'Cadre couché',0,.16,0);
  fallen.rotation.x=-1.20;
  carTrim(fallen,[-.65,.29,0],[.34,.28,0],.062,'#443840');
  carTrim(fallen,[-.52,.36,0],[-.27,.65,0],.047,'#55424b');
  carTrim(fallen,[-.27,.65,0],[.30,.33,.09],.052,'#714f49');
  carBall(fallen,.02,.47,0,.205,.143,.151,'#49383c');
  for(const [cx,r,z] of [[-l*.66,h*.26,0],[l*.68,h*.245,.09]]){
    carPart(fallen,spoolWelt,cx,r,z,r*.95,r*.95,r*.95,'#332d34');
    for(let i=0;i<3;i++){
      const a=i*Math.PI/3,dx=Math.cos(a)*r*.77,dy=Math.sin(a)*r*.77;
      carTrim(fallen,[cx-dx,r-dy,z],[cx+dx,r+dy,z],.014,'#735e59');
    }
  }
  carTrim(fallen,[.32,.54,.02],[l*.67,.30,.10],.043,'#77615e');batchGroup(fallen);
  return wreck;
}

export function createCar(type='car',color,seed=0){
  const kind=type?.type??type;
  if(kind==='helicopter'||kind==='airship'){
    const factory=kind==='helicopter'?createHelicopter:createAirship;
    return factory(THREE,{geo,addPart,batchGroup,cord,carTrim,updateSeatedFigures,clearCabin},color,seed);
  }
  const body=createCarBody(type,color,seed),spec=vehicleSpec(type?.type??type);
  let wear=null,door=null,wreck=null,hiddenIntact=null;
  const intact=[...body.group.children],seated=[{},{},{}];
  let signals=null,signalSpeed=null,brakeFlash=0;
  function updateWreck(damaged){
    if(!damaged){
      if(wreck)wreck.visible=false;
      if(hiddenIntact){intact.forEach((part,i)=>{part.visible=hiddenIntact[i];});hiddenIntact=null;}
      return;
    }
    hiddenIntact??=intact.map(part=>part.visible);
    for(const part of intact)part.visible=false;
    if(!wreck&&(type==='motorbike'||type==='scooter')){
      wreck=roadsterWreck(spec);body.group.add(wreck);
    }
    if(!wreck){
      wreck=new THREE.Group();wreck.name='Carcasse';
      const l=spec.halfLength,w=spec.halfWidth,h=spec.height;
      addPart(wreck,geo.box,0,h*.18,0,l*1.91,h*.22,w*1.84,'#342d36',0,.03,.02);
      addPart(wreck,geo.box,-l*.25,h*.39,0,l*.88,h*.15,w*1.44,'#40323d',.19,-.10,.21);
      addPart(wreck,geo.box,l*.50,h*.36,-w*.08,l*.70,h*.075,w*1.43,'#61504a',-.18,.07,-.51);
      for(const side of [-1,1]){
        addPart(wreck,geo.box,-l*.47,h*.49,side*w*.57,l*.69,h*.074,.115,'#736562',side*.27,.12,side*.19);
        for(const axle of [-1,1]){
          const wheel=addPart(wreck,geo.cylinder,axle*l*.56,h*.15,side*w*.80,h*.19,.21,h*.19,'#211c24');
          wheel.rotation.x=Math.PI/2+side*.37;wheel.rotation.y=axle*.43;
          addPart(wreck,geo.box,axle*l*.67,h*.29,side*w*.82,l*.38,h*.145,.19,'#564653',side*.31,axle*.13,.21);
        }
        cord(wreck,[[l*.60,h*.46,side*w*.44],[l*.28,h*.51,side*w*.62],[-l*.12,h*.47,side*w*.51],[-l*.37,h*.53,side*w*.42]],.032,'#aa7155');
      }
      batchGroup(wreck);body.group.add(wreck);
    }
    wreck.visible=true;
    if(door)door.visible=false;
  }
  function updateDoor(open){
    if(!open||spec.openSeat){if(door)door.visible=false;return;}
    if(!door){
      door=new THREE.Group();door.name='Portière ouverte';
      const paint=fleetPaint[type] || (/^#(?:[a-f\d]{3}){1,2}$/i.test(color||'')?color:carPaint[Math.abs((Number(seed)||0)*1741)%carPaint.length|0]);
      const span=Math.min(1.18,spec.halfLength*.57),h=spec.height;
      addPart(door,geo.box,-span*.5,h*.353,0,span,h*.295,.067,paint);
      if(body.windowHost?.userData.seats3D){
        carBox(door,-span*.49,h*.69,0,span*.91,.038,.030,paint);
        for(const x of [-span*.93,-span*.055])carBox(door,x,h*.59,0,.032,h*.205,.029,paint);
      }else addPart(door,geo.box,-span*.51,h*.568,0,span*.85,h*.151,.036,'#6e959f');
      addPart(door,geo.box,-span*.71,h*.463,.036,.18,.047,.048,'#dccba8',0,0,0,'plain');
      batchGroup(door);body.group.add(door);
    }
    const side=Math.sign(open);
    const hingeX=body.windowHost?.userData.townDoorHinge??spec.halfLength*.40;
    door.visible=true;door.position.set(hingeX,0,side*spec.halfWidth*.94);
    door.rotation.y=side*Math.abs(open)*1.04;
  }
  function updateCabin(pose){
    const host=body.windowHost;
    if(host?.userData.seats3D)updateSeatedFigures(host,pose,seated,seed,kind);
  }
  function updateSignals(pose,dt){
    const current=Math.abs(Number(pose.speed)||0),decelerating=signalSpeed!==null&&signalSpeed-current>Math.max(.075,2.2*dt);
    signalSpeed=current;
    brakeFlash=decelerating?.28:Math.max(0,brakeFlash-dt);
    const near=pose.signalDetail!==false&&!pose.wrecked;
    const front=near&&pose.headlamps,rear=near&&(pose.brake||brakeFlash>0);
    if(!signals&&!front&&!rear)return;
    if(!signals){
      signals=makeVehicleSignals(type,spec);
      const fork=spec.openSeat&&body.group.getObjectByName('guidon');
      if(fork){
        signals.front.position.x=-fork.position.x;
        fork.add(signals.front);body.group.getObjectByName('carrosserie').add(signals.rear);
      }else body.group.add(signals.front,signals.rear);
    }
    signals.front.visible=!!front;signals.rear.visible=!!rear;
  }
  function update(pose={},dt=.016,time=0){
    updateSignals(pose,dt);

    body.update(pose,dt,time);updateCabin(pose);updateDoor(pose.doorOpen);updateWreck(pose.wrecked);
    const stage=chassisStage(pose.chassisHp);
    if(!stage){if(wear)wear.group.visible=false;return;}
    if(!wear){
      const group=new THREE.Group(),marks=[],puffs=[],flames=[],fibers=[];
      for(let i=0;i<12;i++){
        const patch=new THREE.Mesh(geo.box,frayedChassis);
        const width=spec.halfWidth*(i%2===0?1:-1);
        const along=[.64,-.54,.16,-.32,.47,-.70][i>>1];
        patch.position.set(spec.halfLength*along,spec.height*(.34+.045*(i%3)),width*.99);
        patch.rotation.z=(i%3-1)*.32;
        patch.scale.set(spec.halfLength*.20,.041,.027);group.add(patch);marks.push(patch);
      }
      for(let i=0;i<4;i++){const puff=new THREE.Mesh(geo.littleBall,cottonSmoke);group.add(puff);puffs.push(puff);}
      for(let i=0;i<6;i++){const flame=new THREE.Mesh(geo.littleBall,flameYarn);group.add(flame);flames.push(flame);}
      for(let i=0;i<12;i++){
        const thread=new THREE.Mesh(geo.box,i%3?frayedChassis:flameYarn);group.add(thread);fibers.push(thread);
      }
      body.group.add(group);wear={group,marks,puffs,flames,fibers};
    }
    wear.group.visible=true;
    wear.marks.forEach((patch,i)=>{
      const char=pose.burnProgress||0;
      const loss=1-chassisHealth(pose.chassisHp)/100;
      patch.visible=!pose.wrecked&&i<2*Math.ceil(loss*6);
      patch.scale.x=spec.halfLength*(.12+.20*loss);
      patch.scale.y=.028+.055*loss+.095*char;
      patch.scale.z=.034+.042*loss;
    });
    wear.flames.forEach((flame,i)=>{
      const age=(time*3.9+i*.18)%1;
      flame.visible=!!pose.burning;
      flame.position.set(spec.halfLength*.67+Math.sin(time*13+i)*.23,spec.height*.52+.9*age,(i-2.5)*.13);
      const heat=.65+(pose.burnProgress||0)*.9;
      flame.scale.set(.21*(1-age*.6)*heat,.38*(1-age*.7)*heat,.17*(1-age*.6)*heat);
    });
    wear.fibers.forEach((thread,i)=>{
      const heat=pose.burnProgress||0,age=(time*1.24+i*.32)%1;
      thread.visible=pose.burning&&i<Math.ceil(heat*12);
      thread.position.set(spec.halfLength*.53-age*(.3+i*.042),spec.height*.52+.73*age,Math.sin(i*3.44+age)*(.16+age*.92));
      thread.rotation.set(age*6,i*.9,age*9);
      thread.scale.set(.032*(1.3-age),.14*(1.15-age),.026);
    });
    wear.puffs.forEach((puff,i)=>{
      const age=(time*.94+i*.25)%1;
      puff.visible=stage>=2&&(stage===3||i%2===0);
      puff.position.set(spec.halfLength*.65-age*(.28+Math.abs(pose.speed||0)*.025),spec.height*.64+age*1.45,.13*Math.sin(age*4+i));
      puff.scale.setScalar(.075+.34*age);
    });
  }
  return {...body,update,dispose(){clearCabin(seated);if(signals){signals.front.removeFromParent();signals.rear.removeFromParent();}if(door)for(const part of door.children)part.geometry.dispose();if(wreck){wreck.removeFromParent();wreck.traverse(part=>part.geometry?.dispose());}body.dispose();}};
}
