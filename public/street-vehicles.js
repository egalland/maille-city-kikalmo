import {roadsterRecipe} from './roadster-model.js';
import {Vector3,TorusGeometry} from './three.js';
import {saddles,gripOnFork,riderIdentity} from './saddle-rider.js';
import {puppetAppearance} from './puppet-dyes.js';
import {fleetFabric} from './vehicle-fabric.js';
import {wheelPart} from './vehicle-damage.js';
import {townFleetPaint,createTownCarRecipe} from './town-fleet.js';
import {vehicleSpec} from './vehicle-types.js';

const {ink,thread:cream,tyre:rubber,brass,silver:iron}=fleetFabric;
const seat='#694b46',wood='#b27b50';
const colors={...townFleetPaint,motorbike:'#a95346',scooter:'#79a7a0',cargo:'#4f8886',pickup:'#a16458'};
export const isStreetVehicle=type=>Object.hasOwn(colors,type);
const bicycleWheel=new TorusGeometry(1,.15,6,28);
const twoWheeler=type=>type==='scooter'||type==='motorbike';
const limit=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const box=(parts,p,size,c,thread=false)=>parts.push({kind:'box',p,size,c,thread});
const egg=(parts,p,size,c)=>parts.push({kind:'egg',p,size,c});
const rod=(parts,a,b,r,c)=>parts.push({kind:'rod',a,b,r,c});
const disc=(parts,p,r,width,c)=>parts.push({kind:'disc',p,r,width,c});
const cone=(parts,a,b,r,c)=>parts.push({kind:'cone',a,b,r,c});
const section=(name,p=[0,0,0])=>({name,p,parts:[]});

function makeWheel(x,z,r,width,front,spoked){
  const wheel=section('roue',[x,r,z]),parts=wheel.parts;
  wheel.r=r;wheel.front=front;
  if(spoked)parts.push({kind:'ring',p:[0,0,0],r,width,c:rubber});
  else disc(parts,[0,0,0],r,width,rubber);
  for(const side of [-1,1]){
    const edge=side*width*.5;
    if(spoked)parts.push({kind:'ring',p:[0,0,edge*.61],r:r*.81,width:.012,c:iron});
    else{
      disc(parts,[0,0,edge],r*.79,.009,cream);
      disc(parts,[0,0,edge+side*.009],r*.63,.010,iron);
    }
    for(let i=0;i<(spoked?6:3);i++){
      const a=i*Math.PI/(spoked?6:3),spoke=r*(spoked?.77:.62),dx=Math.cos(a)*spoke,dy=Math.sin(a)*spoke;
      rod(parts,[-dx,-dy,edge+side*.017],[dx,dy,edge+side*.017],spoked?.009:.018,spoked?cream:brass);
    }
    disc(parts,[0,0,edge+side*.022],r*.30,.017,brass);
    if(!spoked){
      const z=edge+side*.032;
      for(const sign of [-1,1]){
        disc(parts,[sign*r*.115,sign*r*.045,z],r*.041,.008,ink);
      }
      rod(parts,[-r*.11,-r*.045,z],[r*.11,r*.045,z],r*.022,cream);
    }
  }
  return wheel;
}
function parcel(parts,x,y,z,l,h,w,paper){
  box(parts,[x,y+h/2,z],[l,h,w],paper);
  box(parts,[x,y+h/2+.003,z],[.041,h+.014,w+.014],cream);
  box(parts,[x,y+h+.008,z],[l+.006,.012,.043],cream);
  // A cross-tied pair of wool loops makes the parcel readable from behind the carrier.
  for(const s of [-1,1]){
    const top=y+h+.018,m=Math.min(l,w)*.22;
    rod(parts,[x,top,z],[x+s*m,top+.063,z-.038],.016,cream);
    rod(parts,[x+s*m,top+.063,z-.038],[x+s*m*.68,top+.083,z+.05],.016,cream);
    rod(parts,[x+s*m*.68,top+.083,z+.05],[x,top,z],.015,cream);
  }
}
// Simplified fallback used only when neither of the mesh renderers can draw.
// Its pose, grips, footwear and dyes correspond to the same mount and rider.
function sketchRider(mount,id,steering){
  const {pelt,coat,animal}=puppetAppearance(id.role,id.skin,id.seed);
  const rider=section('conducteur'),p=rider.parts,[x,y]=mount.hip;
  const headX=x+.09+mount.lean*.3;
  egg(p,[x+.035,y+.26,0],[.19,.28,.215],coat);
  egg(p,[headX,y+.66,0],[.245,.24,.255],pelt.fur);
  if(animal==='human'){
    egg(p,[headX-.055,y+.795,0],[.217,.108,.238],pelt.shade);
    egg(p,[headX+.218,y+.60,0],[.061,.057,.055],pelt.inner);
  }else{
    egg(p,[headX+.18,y+.605,0],[.15,.099,.15],pelt.cream);
    egg(p,[headX+.29,y+.627,0],[.046,.043,.065],ink);
    egg(p,[x-.245,y+.14,.11],[.243,.121,.127],pelt.fur);
    egg(p,[x-.433,y+.225,.20],[.119,.124,.122],pelt.cream);
  }
  for(const side of [-1,1]){
    if(animal==='fox')cone(p,[headX-.04,y+.82,side*.135],[headX-.079,y+1.06,side*.21],.105,pelt.fur);
    egg(p,[headX+.193,y+.696,side*.14],[.032,.045,.029],ink);
    const hand=gripOnFork(mount,side,steering,new Vector3()).toArray();
    const elbow=[x+.11,y+.285,side*.25],knee=[x+.18,y-.09,side*.20],boot=[mount.foot[0],mount.foot[1],side*mount.foot[2]];
    rod(p,[x+.09,y+.415,side*.177],elbow,.071,coat);rod(p,elbow,hand,.054,coat);
    egg(p,hand,[.074,.065,.065],pelt.cream);
    rod(p,[x,y+.015,side*.106],knee,.076,ink);rod(p,knee,boot,.061,ink);
    egg(p,boot,[.118,.061,.078],seat);
  }
  return rider;
}

function makeMotorbike(paint){
  return roadsterRecipe(paint,{section,egg,disc,box,rod,makeWheel});
}
function makeScooter(paint){
  const chassis=section('carrosserie'),p=chassis.parts,fork=section('guidon',[.61,0,0]),f=fork.parts;
  egg(p,[-.51,.46,0],[.483,.254,.261],paint);
  egg(p,[-.55,.497,0],[.353,.092,.273],cream);
  egg(p,[-.49,.523,0],[.361,.107,.282],paint);
  egg(p,[-.33,.690,0],[.353,.078,.211],cream);
  egg(p,[-.33,.722,0],[.35,.085,.206],seat);
  box(p,[.088,.268,0],[.65,.065,.394],cream);box(p,[.082,.305,0],[.55,.028,.37],ink);
  for(const s of [-1,1]){
    rod(p,[.29,.32,s*.16],[.473,.78,s*.168],.055,paint);
    rod(p,[-.85,.47,s*.207],[-.62,.407,s*.25],.017,cream);
    rod(p,[-.62,.407,s*.25],[-.35,.412,s*.25],.017,cream);
    for(let i=0;i<4;i++)rod(p,[-.62+i*.068,.54,s*.268],[-.588+i*.068,.498,s*.271],.012,cream);
  }
  egg(p,[.424,.54,0],[.142,.255,.222],paint);
  rod(p,[.473,.77,0],[.57,.98,0],.048,iron);
  egg(p,[-.901,.525,0],[.053,.048,.088],'#cf6159');
  rod(f,[0,.31,0],[-.02,1.04,0],.043,paint);
  egg(f,[.035,.52,0],[.33,.09,.152],paint);
  egg(f,[.008,1.046,0],[.12,.10,.132],paint);
  egg(f,[.101,1.047,0],[.055,.088,.099],brass);
  egg(f,[.132,1.047,0],[.038,.070,.082],fleetFabric.lamp);
  for(const s of [-1,1])egg(f,[.165,1.047,s*.028],[.008,.009,.009],ink);
  for(const s of [-1,1]){
    rod(f,[-.007,1.06,s*.075],[-.15,1.102,s*.223],.024,iron);
    rod(f,[-.15,1.102,s*.223],[-.40,1.055,s*.283],.024,iron);
    rod(f,[-.40,1.055,s*.283],[-.425,1.055,s*.372],.032,seat);
    rod(f,[-.18,1.096,s*.234],[-.09,1.174,s*.304],.012,iron);
    egg(f,[-.09,1.171,s*.304],[.025,.043,.052],cream);
  }
  // Rolled saddle welt, stitched channels and the exposed left-hand drive cover.
  for(let i=0;i<5;i++)rod(p,[-.545+i*.084,.782,-.141],[-.545+i*.084,.782,.141],.008,'#a78363');
  egg(p,[-.52,.349,-.158],[.31,.102,.107],iron);
  rod(p,[-.48,.34,.183],[-.85,.37,.199],.044,iron);
  egg(p,[-.917,.352,.199],[.094,.051,.050],ink);
  return {chassis,fork,mount:saddles.scooter,wheels:[makeWheel(-.68,0,.305,.147,false,false),makeWheel(.66,0,.305,.147,true,false)]};
}
function makeCargo(paint){
  const chassis=section('carrosserie'),p=chassis.parts,fork=section('guidon',[-.12,0,0]),f=fork.parts;
  const rear=[-1.007,.312,0],crank=[-.49,.29,0],post=[-.735,.834,0],bar=[-.135,.91,0];
  for(const [a,b] of [[rear,crank],[crank,post],[rear,post],[crank,bar],[post,bar]])rod(p,a,b,.032,paint);
  rod(p,crank,[.88,.33,0],.053,paint);rod(p,[.88,.34,-.459],[.88,.34,.459],.043,iron);
  egg(p,[-.743,.870,0],[.171,.047,.144],seat);
  box(p,[.61,.47,0],[1.29,.095,.82],wood);
  for(const s of [-1,1]){
    for(let i=0;i<3;i++)box(p,[.61,.554+i*.125,s*.391],[1.29,.105,.054],i%2?wood:'#c58d58');
    for(const x of [.05,1.16])box(p,[x,.706,s*.418],[.049,.459,.026],paint);
    box(p,[.61,.919,s*.398],[1.30,.041,.073],cream);
    rod(p,[-.52,.29,s*.145],[-.45,.24,s*.146],.024,iron);
    box(p,[-.45,.23,s*.175],[.113,.035,.118],ink);
  }
  for(const end of [-.014,1.229]){
    box(p,[end,.716,0],[.056,.399,.746],wood);
    const sign=end>0?1:-1, x=end+sign*.032;
    box(p,[x,.848,0],[.015,.105,.56],cream);
    for(let i=-2;i<=2;i++)box(p,[x+sign*.007,.848,i*.09],[.012,.018,.047],seat);
  }
  parcel(p,.42,.515,-.089,.53,.473,.49,'#b26a4d');
  parcel(p,.922,.516,.059,.373,.496,.39,'#a3a26d');
  rod(f,[0,.84,0],[-.021,1.132,0],.022,iron);
  for(const s of [-1,1]){
    rod(f,[-.021,1.131,0],[-.15,1.099,s*.264],.023,iron);
    rod(f,[-.15,1.099,s*.264],[-.211,1.097,s*.355],.031,seat);
  }
  egg(f,[.034,1.091,0],[.067,.069,.069],cream);
  return {chassis,fork,mount:saddles.cargo,wheels:[makeWheel(-1.01,0,.315,.081,false,true),...[-.472,.472].map(z=>makeWheel(.878,z,.288,.089,true,true))]};
}
function makePickup(paint){
  const chassis=section('carrosserie'),p=chassis.parts;
  box(p,[0,.531,0],[4.55,.26,1.68],ink);
  box(p,[.035,.725,0],[4.61,.343,1.80],paint);
  box(p,[-1.24,.888,0],[2.13,.10,1.653],wood);
  for(const s of [-1,1]){
    box(p,[-1.24,1.05,s*.856],[2.16,.36,.105],paint);
    box(p,[-1.24,1.245,s*.857],[2.19,.05,.12],cream);
    box(p,[.51,1.081,s*.803],[1.30,.43,.117],paint);
    box(p,[.265,1.19,s*.878],[.158,.034,.024],cream);
    box(p,[.525,1.488,s*.781],[1.05,.398,.045],'#57727c');
    for(const x of [-.111,.49,1.12])rod(p,[x,1.242,s*.809],[x-.04,1.702,s*.753],.039,paint);
    for(const x of [-1.511,1.561])egg(p,[x,.724,s*.873],[.602,.213,.118],paint);
    egg(p,[2.258,.868,s*.649],[.082,.108,.124],'#fce4aa');
    box(p,[-2.294,.951,s*.712],[.042,.097,.136],'#c65b59');
    rod(p,[.831,1.309,s*.813],[.948,1.404,s*.945],.016,iron);
    egg(p,[.949,1.41,s*.943],[.056,.047,.037],cream);
  }
  box(p,[-2.273,1.058,0],[.124,.45,1.71],paint);
  box(p,[-2.337,1.205,0],[.02,.032,1.54],cream);
  for(let i=-3;i<=3;i++)box(p,[-2.34,1.11,.174*i],[.019,.021,.095],cream);
  for(const s of [-1,1])box(p,[-2.341,.974,s*.64],[.015,.087,.071],brass);
  box(p,[-.16,1.29,0],[.117,.75,1.61],paint);
  box(p,[-.224,1.465,0],[.024,.29,1.11],'#536f77');
  box(p,[1.108,1.474,0],[.075,.408,1.457],fleetFabric.frontPane);
  rod(p,[1.151,1.312,-.525],[1.151,1.637,-.273],.024,fleetFabric.gleam);
  rod(p,[1.151,1.32,-.418],[1.151,1.637,-.17],.011,fleetFabric.gleam);
  egg(p,[.484,1.706,0],[.79,.153,.903],paint);
  box(p,[1.672,.996,0],[1.047,.414,1.58],paint);
  egg(p,[1.718,1.164,0],[.605,.108,.843],paint);
  box(p,[2.243,.898,0],[.083,.31,.89],ink);
  for(let i=0;i<4;i++)box(p,[2.294,.788+i*.069,0],[.028,.025,.80],cream);
  for(const x of [-2.342,2.344])box(p,[x,.565,0],[.134,.101,1.869],cream);
  parcel(p,-1.561,.945,-.207,.625,.39,.54,'#ac8d50');
  parcel(p,-.785,.945,.185,.563,.30,.459,'#899678');
  return {chassis,wheels:[-1.507,1.561].flatMap(x=>[-.814,.814].map(z=>makeWheel(x,z,.388,.204,x>0,false)))};
}

const models=new Map();
function modelFor(type,color){
  const paint=typeof color==='string'&&/^#[a-f\d]{6}$/i.test(color)?color:colors[type],key=type+paint;
  if(!models.has(key)){
    const model=Object.hasOwn(townFleetPaint,type)?createTownCarRecipe(type,paint,{section,box,egg,rod,makeWheel}):
      (type==='motorbike'?makeMotorbike:type==='scooter'?makeScooter:type==='cargo'?makeCargo:makePickup)(paint);
    models.set(key,model);if(models.size>80)models.delete(models.keys().next().value);
  }
  return models.get(key);
}
function newMotion(){return {steering:0,roll:0,pitch:0,bob:0,phase:0,lastHeading:null,lastSpeed:null};}
function advanceMotion(m,type,e,dt,time,seed){
  dt=limit(Number(dt)||.016,.001,.1);
  const speed=Number(e.speed)||0,blend=1-Math.exp(-dt*10),heading=Number(e.angle)||0;
  const yaw=m.lastHeading===null?0:Math.atan2(Math.sin(heading-m.lastHeading),Math.cos(heading-m.lastHeading))/dt;
  const input=e.steer??e.turn??yaw*.51;m.lastHeading=heading;
  m.steering+=(limit(input,-1,1)*.52-m.steering)*blend;
  const bank=type==='motorbike'?.94:type==='scooter'?.61:type==='cargo'?.125:.09;
  m.roll+=(m.steering*bank*limit(Math.abs(speed)/7,0,1)-m.roll)*blend;
  const a=m.lastSpeed===null?0:limit((speed-m.lastSpeed)/dt,-13,10);m.lastSpeed=speed;
  m.pitch+=((a*.0025-(e.brake?.027:0))-m.pitch)*blend;
  m.phase-=speed*dt;
  m.bob=Math.sin((Number(time)||0)*12+seed%13)*.015*limit(Math.abs(speed)/10,0,1)-limit(Number(e.impact)||0,0,1)*.057;
}
export function createStreetVehicle(THREE,art,type,color,seed=0){
  const model=modelFor(type,color),root=new THREE.Group(),suspension=new THREE.Group(),cached=[],up=new THREE.Vector3(0,1,0);
  root.name='Maille véhicule '+type;root.add(suspension);
  function build(section){
    const node=new THREE.Group();node.name=section.name;node.position.set(...section.p);
    const panelGeometry=[];
    for(const v of section.parts){
      const col=v.c;
      if(v.kind==='panel'){
        const positions=[],uv=[];
        for(let i=1;i+1<v.points.length;i++)for(const point of [v.points[0],v.points[i],v.points[i+1]]){
          positions.push(...point);uv.push((point[0]+point[2])*.58,point[1]*.8);
        }
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
        art.addPart(node,g,0,0,0,1,1,1,col,0,0,0,v.glass?'glass':'yarn');panelGeometry.push(g);
      }else if(v.kind==='box'||v.kind==='egg')art.addPart(node,v.kind==='box'?art.geo.box:art.geo.littleBall,...v.p,...v.size,col);
      else if(v.kind==='ring')art.addPart(node,bicycleWheel,...v.p,v.r/1.15,v.r/1.15,v.width/.30,col);
      else if(v.kind==='disc')art.addPart(node,art.geo.cylinder,...v.p,v.r,v.width,v.r,col,Math.PI/2);
      else{
        const a=new THREE.Vector3(...v.a),b=new THREE.Vector3(...v.b),d=b.clone().sub(a);
        const part=art.addPart(node,v.kind==='cone'?art.geo.cone:art.geo.cylinder,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,v.r,d.length(),v.r,col);
        part.quaternion.setFromUnitVectors(up,d.normalize());
      }
    }
    art.batchGroup(node);for(const g of panelGeometry)g.dispose();return node;
  }
  function release(node){for(const m of node.children)m.geometry?.dispose();node.removeFromParent();}
  const body=build(model.chassis);suspension.add(body);cached.push(body);
  if(model.seats3D){body.userData.seats3D=model.seats3D;body.userData.townDoorHinge=model.seats3D.x+.66;}
  const glazing=model.seats3D?body.children.find(mesh=>mesh.material?.transparent):null;
  const fork=model.fork&&build(model.fork);
  if(fork){suspension.add(fork);cached.push(fork);}
  const wheels=model.wheels.map(w=>{
    const pivot=new THREE.Group();pivot.name=w.front?'direction':'essieu';pivot.position.set(...w.p);
    const spin=build(w);spin.position.set(0,0,0);pivot.add(spin);root.add(pivot);cached.push(spin);
    return {pivot,spin,w};
  });
  const motion=newMotion();
  let rider=null,identity=null;
  function clearRider(){
    if(!rider)return;
    release(rider.distant);rider.group.removeFromParent();rider=null;
  }
  function update(e={},dt=.016,time=0){
    advanceMotion(motion,type,e,dt,time,seed);
    const {steering,roll,pitch,bob,phase}=motion;
    suspension.position.y=bob;
    suspension.rotation.set(roll,0,pitch);
    if(glazing)glazing.visible=!(e.parts&1);
    if(fork)fork.rotation.y=-steering;
    for(const {pivot,spin,w} of wheels){
      pivot.rotation.y=w.front?-steering:0;
      pivot.rotation.x=twoWheeler(type)?roll:0;
      const flat=(e.parts&wheelPart(w.front,w.p[2]>0))!==0||(w.p[2]===0&&(e.parts&wheelPart(w.front,true))!==0);
      pivot.position.y=w.r*(flat?.75:1);pivot.scale.y=flat?.68:1;
      spin.rotation.z=phase/w.r;
    }
    if(model.mount){
      const next=riderIdentity(e);
      if(rider&&(!next||next.id!==identity.id||next.role!==identity.role||next.skin!==identity.skin)){
        clearRider();
      }
      if(next&&!rider){
        const close=art.mountedPuppet(next,model.mount,type);
        close.group.name='Pantin au guidon';
        const distant=build(sketchRider(model.mount,next,0));
        distant.name='Silhouette au guidon';
        const lod=new THREE.LOD();lod.name='conducteur';
        lod.addLevel(close.group,0);lod.addLevel(distant,27,.12);distant.visible=false;
        rider={group:lod,update:close.update,distant};
        suspension.add(lod);identity=next;
      }
      rider?.update(motion,e,time);
    }
  }
  return {group:root,windowHost:model.seats3D?body:undefined,update,dispose(){for(const n of cached)release(n);clearRider();root.removeFromParent();}};
}

const cube=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const sides=[[0,1,2,3],[4,7,6,5],[0,3,7,4],[1,5,6,2],[3,2,6,7],[0,4,5,1]];
const sideLight=[.83,1.00,.81,.94,1.10,.70];
const circle=Array.from({length:12},(_,i)=>[Math.cos(i*Math.PI/6),Math.sin(i*Math.PI/6)]);
const shades=new Map();
function shade(hex,light){
  const key=hex+light;if(shades.has(key))return shades.get(key);
  const rgb=parseInt(hex.slice(1),16),v=[16,8,0].map(k=>limit(Math.round(((rgb>>k)&255)*light),0,255));
  const output='rgb('+v.join(',')+')';shades.set(key,output);if(shades.size>500)shades.delete(shades.keys().next().value);return output;
}
// Keep wheel travel and suspension continuous as an observer changes speed or sees a turning NPC.
const canvasMotion=new WeakMap();
function softwareMotion(c,e,t){
  let history=canvasMotion.get(c);
  if(!history){history=new Map();canvasMotion.set(c,history);}
  const key=e.type+'/'+(e.renderId||e.id||e.seed||0);
  let state=history.get(key);
  if(!state||t-state.time>.6||t<state.time){
    state=newMotion();state.time=t-1/60;history.set(key,state);
    if(history.size>160)history.delete(history.keys().next().value);
  }
  if(t>state.time){advanceMotion(state,e.type,e.pose||e,t-state.time,t,0);state.time=t;}
  return state;
}
export function drawStreetVehicle(c,e,x,y,height,time=0,viewAngle=0,weave=null){
  const pattern=height>=38&&typeof c.createPattern==='function'?weave?.(c):null;
  const model=modelFor(e.type,e.color),spec=vehicleSpec(e.type),size=height/spec.height,draw=[];
  const cs=Math.cos(viewAngle),sn=-Math.sin(viewAngle);
  const {steering:steer,roll,pitch,bob,phase}=softwareMotion(c,e,time);
  function project(a,b,d){
    const depth=a*cs-d*sn,scale=1/(1+depth*.035);
    return [(a*sn+d*cs)*scale,(-b-depth*.19)*scale,depth];
  }
  function face(points,fill,edges=false,woven=false){
    const depth=points.reduce((total,p)=>total+p[2],0)/points.length;
    draw.push({kind:'face',points,depth,fill,edges,woven});
  }
  function build(section,steering=0,spin=0,body=false){
    const [ox,oy,oz]=section.p,cc=Math.cos(spin),ss=Math.sin(spin),cd=Math.cos(steering),sd=Math.sin(steering);
    const bank=body||twoWheeler(e.type)?roll:0,cb=Math.cos(bank),sb=Math.sin(bank),cp=Math.cos(pitch),sp=Math.sin(pitch);
    function point(a,b,d){
      const ax=a*cc-b*ss,by=a*ss+b*cc;
      let px=ox+ax*cd+d*sd,pz=oz-ax*sd+d*cd,py=oy+by;
      if(body){const tx=px*cp-py*sp;py=px*sp+py*cp+bob;px=tx;}
      const zz=pz*cb+py*sb;py=py*cb-pz*sb;
      const flat=section.r&&(e.parts&(section.p[2]===0?wheelPart(section.front,true)|wheelPart(section.front,false):wheelPart(section.front,section.p[2]>0)));
      return project(px,flat?py*.76:py,zz);
    }
    for(const v of section.parts){
      if(height<22&&((v.kind==='rod'&&v.r*size<.33)||(v.kind==='egg'&&v.size[0]*size<.7)))continue;
      const fill=v.c;
      if(v.kind==='panel'){
        if(v.glass&&(e.parts&1))continue;
        const points=v.points.map(([x,y,z])=>point(x,y,z));
        const ax=v.points[1][0]-v.points[0][0],ay=v.points[1][1]-v.points[0][1],az=v.points[1][2]-v.points[0][2];
        const bx=v.points[2][0]-v.points[0][0],by=v.points[2][1]-v.points[0][1],bz=v.points[2][2]-v.points[0][2];
        const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,n=Math.hypot(nx,ny,nz)||1;
        face(points,v.glass?'rgba(153,187,177,.24)':shade(fill,Math.round((.91+.17*ny/n+.05*nx/n)*16)/16),false,!v.glass);
      }else if(v.kind==='box'){
        const corners=cube.map(k=>point(...k.map((n,i)=>v.p[i]+n*v.size[i]/2)));
        for(let i=0;i<5;i++){
          const q=sides[i].map(k=>corners[k]);
          const area=(q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[1][1]-q[0][1])*(q[2][0]-q[0][0]);
          if(area>0)face(q,shade(fill,sideLight[i]),!v.thread,Math.max(...v.size)>.4);
        }
      }else if(v.kind==='egg'){
        const [a,b,d]=v.p,p=point(a,b,d);
        const vectors=[[v.size[0],0,0],[0,v.size[1],0],[0,0,v.size[2]]].map(([dx,dy,dz])=>point(a+dx,b+dy,d+dz));
        let xx=0,xy=0,yy=0;
        for(const q of vectors){const dx=q[0]-p[0],dy=q[1]-p[1];xx+=dx*dx;xy+=dx*dy;yy+=dy*dy;}
        const delta=Math.hypot(xx-yy,2*xy);
        draw.push({kind:'egg',p,rx:Math.sqrt((xx+yy+delta)/2),ry:Math.sqrt(Math.max(.000001,(xx+yy-delta)/2)),angle:Math.atan2(2*xy,xx-yy)/2,fill,woven:v.size[0]>.135,depth:p[2]});
      }else if(v.kind==='cone'){
        const [dx,dy,dz]=v.b.map((x,i)=>x-v.a[i]),len=Math.hypot(dx,dy,dz),xz=Math.hypot(dx,dz);
        const ux=xz?dz/xz:1,uz=xz?-dx/xz:0,vx=dy*uz/len,vy=(dz*ux-dx*uz)/len,vz=-dy*ux/len;
        const a=point(...v.b),ring=circle.map(([co,si])=>point(v.a[0]+v.r*(co*ux+si*vx),v.a[1]+v.r*si*vy,v.a[2]+v.r*(co*uz+si*vz)));
        for(let i=0;i<ring.length;i++)face([ring[i],ring[(i+1)%ring.length],a],shade(fill,[.88,.93,1,1.04][Math.floor(i/3)]));
        face(ring,shade(fill,.91));
      }else if(v.kind==='ring'){
        const [cx,cy,cz]=v.p;
        const ring=(r,z)=>circle.map(([dx,dy])=>point(cx+r*dx,cy+r*dy,cz+z));
        const front=ring(v.r,v.width/2),back=ring(v.r,-v.width/2);
        const frontHole=ring(v.r*.74,v.width/2),backHole=ring(v.r*.74,-v.width/2);
        for(let i=0;i<circle.length;i++){
          const j=(i+1)%circle.length;
          face([front[i],front[j],back[j],back[i]],shade(fill,i<6?.97:.8));
          face([front[i],front[j],frontHole[j],frontHole[i]],fill);
          face([back[i],back[j],backHole[j],backHole[i]],fill);
        }
      }else if(v.kind==='rod'){
        const a=point(...v.a),b=point(...v.b);
        draw.push({kind:'rod',a,b,r:v.r,fill,depth:(a[2]+b[2])/2});
      }else{
        const [cx,cy,cz]=v.p;
        const rings=[-1,1].map(s=>circle.map(([dx,dy])=>point(cx+v.r*dx,cy+v.r*dy,cz+s*v.width*.5)));
        const depth0=rings[0].reduce((n,p)=>n+p[2],0),depth1=rings[1].reduce((n,p)=>n+p[2],0);
        if(v.width>.05)for(let i=0;i<circle.length;i++){
          const j=(i+1)%circle.length;
          face([rings[0][i],rings[1][i],rings[1][j],rings[0][j]],shade(fill,i<6?1:.88));
        }
        face(rings[depth0<depth1?0:1],fill);
      }
    }
  }
  build(model.chassis,0,0,true);
  if(model.seats3D){
    const {x:seatX,y:seatY,spacing,scale}=model.seats3D;
    for(const [index,active] of [e.driver,e.passenger,e.fare].entries()){
      if(!active)continue;
      const seat=section('siège',[seatX-(index===2?.60:0),seatY,index?spacing:-spacing]);
      const player=index===0?(e.self||e.peer):index===1&&e.passengerSkin;
      const dye=puppetAppearance(player?'fox':'human',index===0?e.driverSkin:e.passengerSkin,index);
      const {fur}=dye.pelt,coat=dye.coat;
      egg(seat.parts,[0,.14*scale,0],[.12*scale,.17*scale,.16*scale],coat);
      egg(seat.parts,[.012,.384*scale,0],[.143*scale,.15*scale,.15*scale],fur);
      if(player)for(const s of [-1,1])cone(seat.parts,[-.03,.482*scale,s*.079],[-.05,.611*scale,s*.109],.059*scale,fur);
      build(seat,0,0,true);
    }
  }
  if(model.fork)build(model.fork,-steer,0,true);
  const rider=model.mount&&riderIdentity(e);
  if(rider)build(sketchRider(model.mount,rider,steer),0,0,true);
  for(const w of model.wheels)build(w,w.front?-steer:0,phase/w.r);
  c.save();c.translate(x,y);c.scale(size,size);c.lineJoin='round';c.lineCap='round';
  function yarn(o){
    if(pattern&&o.woven){c.save();c.scale(.014,.014);c.fillStyle=pattern;c.fill();c.restore();}
  }
  draw.sort((a,b)=>b.depth-a.depth);
  for(const o of draw){
    c.beginPath();
    if(o.kind==='face'){
      c.moveTo(o.points[0][0],o.points[0][1]);
      for(let i=1;i<o.points.length;i++)c.lineTo(o.points[i][0],o.points[i][1]);
      c.closePath();c.fillStyle=o.fill;c.fill();yarn(o);
      if(o.edges){c.lineWidth=.009;c.strokeStyle='#493f48';c.stroke();}
    }else if(o.kind==='rod'){
      c.moveTo(o.a[0],o.a[1]);c.lineTo(o.b[0],o.b[1]);c.lineWidth=Math.max(.009,o.r*2);c.strokeStyle=o.fill;c.stroke();
    }else{
      c.ellipse(o.p[0],o.p[1],o.rx,o.ry,o.angle,0,2*Math.PI);c.fillStyle=o.fill;c.fill();yarn(o);
      c.lineWidth=.009;c.strokeStyle='#51414a';c.stroke();
    }
  }
  c.restore();
}
