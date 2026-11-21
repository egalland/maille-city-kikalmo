import {districtEventDisplay} from './district-event-models.js';
import {createAirfieldMarkings} from './airfield-markings.js';
import {woolDisplay} from './lost-wool-model.js';
import {isAircraft} from './airfield.js';
import {cameraFieldOfView} from './camera-options.js';
import {createDriverView} from './driver-view.js';
import {createMeshRenderer} from './mesh-renderer.js';
import {createAtmosphere} from './city-atmosphere.js';
import {enferLighting} from './enfer-lighting.js';
import {isEnfer} from './paris-data.js';
import {rendererFallback} from './renderer-fallback.js';
import {makeEmoteIcon} from './emote-art.js';
import {textileSky,sunBearing} from './textile-sky.js';
import {createBleedFibers} from './bleed-fibers.js';
import {createBleedMesh} from './bleed-mesh.js';
import {fiberLifetime,impactFibers} from './puppet-combat.js';
import {baseTerrainHeight,terrainHeight,terrainGradient,walkingPose} from './terrain-height.js';
import {buildShotEffect,effectDuration,muzzleFlash,rocketFlightTime} from './weapon-effects.js';
import {propDebris} from './prop-wear.js';
import {emergencyColors,emergencyFlash} from './emergency-signals.js';
import { vehicleSpec } from './vehicle-types.js';
import * as THREE from './three.js';
import { createCity3D } from './city3d.js';
import { createPuppet, createCar } from './puppets3d.js';
import { createCanvasView } from './canvas-view.js';
import { createPickupDisplay } from './pickup-models.js';
import {createCrossingDisplay} from './rail-crossing-models.js';
import { nearbyProps, swimmingSurface } from './paris-world.js';
import {createWorldCamera} from './world-camera.js';

export function shotStrokeMesh(strokes,height){
  const positions=[],tints=[],color=new THREE.Color();
  for(const stroke of strokes){
    color.set(stroke.color);
    for(let i=1;i<stroke.points.length;i++){
      const a=stroke.points[i-1],b=stroke.points[i];
      const dx=b.x-a.x,dy=b.y-a.y,planar=Math.hypot(dx,dy);
      const width=.009*stroke.width;
      if(planar<.0001&&Math.abs(b.z-a.z)<.0001)continue;
      const cross=planar>.0001?[-dy/planar*width,0,dx/planar*width]:[0,0,width];
      for(const [sx,sy,sz] of [cross,planar>.0001?[0,width,0]:[width,0,0]]){
        for(const [p,sign] of [[a,-1],[a,1],[b,1],[a,-1],[b,1],[b,-1]]){
          positions.push(p.x+sx*sign,height+p.z+sy*sign,p.y+sz*sign);tints.push(color.r,color.g,color.b);
        }
      }
    }
  }
  if(!positions.length)return;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  return new THREE.Mesh(geometry,material);
}

const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const blend = (k,dt) => 1-Math.exp(-k*dt);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const swimGround=(x,y)=>swimmingSurface(x,y,true)??terrainHeight(x,y);

function makeSky() {
  const texture=new THREE.CanvasTexture(textileSky());texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;texture.repeat.x=-1;texture.offset.x=.5;
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(4300,32,16),new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false}));
  sphere.renderOrder=-50;return sphere;
}
function makeShadow() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d'),g=c.createRadialGradient(32,32,1,32,32,32);
  g.addColorStop(0,'rgba(55,36,52,.7)');g.addColorStop(.55,'rgba(62,38,55,.42)');g.addColorStop(1,'rgba(62,38,55,0)');
  c.fillStyle=g;c.fillRect(0,0,64,64);
  const material=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,toneMapped:false});
  material.userData.contactShadow=true;
  const geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
  const shadows=new THREE.InstancedMesh(geometry,material,65);shadows.frustumCulled=false;shadows.count=0;return shadows;
}
function hash(str){let n=2166136261;for(const ch of str){n=Math.imul(n^ch.charCodeAt(0),16777619);}return n>>>0;}

export function createView(canvas,spawn,onNotice) {
  const forceCompatible=typeof location!=='undefined'&&new URLSearchParams(location.search).get('rendu')==='secours';
  return rendererFallback(
    fallback=>createWebGLView(canvas,spawn,fallback),
    ()=>{
      try{return mountWebGLView(canvas,spawn,()=>{},createMeshRenderer(canvas));}
      catch(error){console.warn('Rendu 3D logiciel',error);return createCanvasView(canvas,spawn,onNotice);}
    },
    {forceCompatible,report:error=>{
      console.warn('Maille City · rendu compatible',error);
      onNotice?.('Accélération indisponible · 3D sur processeur');
    }}
  );
}

function createWebGLView(canvas,spawn,onLost) {
  const options={canvas,antialias:!matchMedia('(pointer:coarse)').matches,alpha:false,stencil:false};
  let renderer;
  try{renderer=new THREE.WebGLRenderer({...options,powerPreference:'high-performance'});}
  catch{renderer=new THREE.WebGLRenderer({...options,powerPreference:'default',antialias:false});}
  try{return mountWebGLView(canvas,spawn,onLost,renderer);}
  catch(error){renderer.dispose();throw error;}
}

function mountWebGLView(canvas,spawn,onLost,renderer) {
  const touch=matchMedia('(pointer:coarse)').matches;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#f0d9be');scene.fog=new THREE.FogExp2('#d1c2b2',.00066);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.00;
  const sky=makeSky();scene.add(sky);
  const lighting=isEnfer?enferLighting(scene,renderer,touch):null;
  const atmosphere=isEnfer?createAtmosphere(scene,sky,renderer,renderer.software):null;
  if(!lighting){
    scene.add(new THREE.HemisphereLight(0xfff1d7,0x8a8294,1.44));
    const sun=new THREE.DirectionalLight(0xffe2ad,1.92);sun.position.set(Math.cos(sunBearing),1.06,Math.sin(sunBearing));scene.add(sun);
    const fill=new THREE.DirectionalLight(0xd8ebea,.69);fill.position.set(-.6,.47,-.9);scene.add(fill);
  }
  const wool=woolDisplay(scene),incidents=districtEventDisplay(scene);
  const city=createCity3D(scene,{software:renderer.software}), pickupDisplay=createPickupDisplay(scene);
  const crossingDisplay=createCrossingDisplay(scene);
  const landingMarks=isEnfer?createAirfieldMarkings(scene):null;
  const camera=new THREE.PerspectiveCamera(51,1,.12,6300);
  const driverView=createDriverView(scene);
  const shadows=makeShadow();scene.add(shadows);
  const shadowTransform=new THREE.Object3D(), projection=new THREE.Vector3(), cameraAim=new THREE.Vector3();
  let width=0,height=0, camX=spawn.x,camY=spawn.y, lastPropTick=-100,props=[],inFrame=0,slowCount=0,scale=touch?.94:1, active=true;
  const followCamera=createWorldCamera(spawn);
  const models=new Map(), names=new Map(), effects=[];
  const trafficGeometry=new THREE.BoxGeometry(1,1,1),trafficLimit=70,trafficTransform=new THREE.Object3D();
  const makeDistantTraffic=material=>{
    const mesh=new THREE.InstancedMesh(trafficGeometry,material,trafficLimit);
    mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);return mesh;
  };
  const trafficBody=makeDistantTraffic(new THREE.MeshLambertMaterial({color:'#65737c'}));
  const trafficCabin=makeDistantTraffic(new THREE.MeshLambertMaterial({color:'#3f505a'}));
  const trafficLamps=makeDistantTraffic(new THREE.MeshBasicMaterial({color:'#fff4c9'}));
  function distantVehicle(car,index){
    const spec=vehicleSpec(car.type),angle=car.angle||0,ground=terrainHeight(car.x,car.y,angle),c=Math.cos(angle),s=Math.sin(angle);
    const put=(mesh,forward,height,length,tall,width)=>{
      trafficTransform.position.set(car.x+c*forward,ground+height,car.y+s*forward);
      trafficTransform.rotation.y=-angle;trafficTransform.scale.set(length,tall,width);
      trafficTransform.updateMatrix();mesh.setMatrixAt(index,trafficTransform.matrix);
    };
    const height=spec.height;
    put(trafficBody,0,height*.34,spec.halfLength*1.96,height*.42,spec.halfWidth*1.97);
    put(trafficCabin,-spec.halfLength*.13,height*.68,spec.halfLength*1.09,height*.52,spec.halfWidth*1.55);
    put(trafficLamps,spec.halfLength*.983,height*.40,.061,.097,spec.halfWidth*1.64);
  }
  const glowSize=32,glowData=new Uint8Array(glowSize*glowSize*4);
  for(let j=0;j<glowSize;j++)for(let i=0;i<glowSize;i++){
    const k=(j*glowSize+i)*4,u=(i+.5)/glowSize*2-1,v=(j+.5)/glowSize*2-1;
    glowData[k]=glowData[k+1]=glowData[k+2]=255;
    glowData[k+3]=Math.round(255*Math.max(0,1-Math.hypot(u,v))**2);
  }
  const emergencyGlow=new THREE.DataTexture(glowData,glowSize,glowSize);
  emergencyGlow.magFilter=THREE.LinearFilter;emergencyGlow.needsUpdate=true;
  const emergencyFloor=new THREE.PlaneGeometry(1,1),sirenLens=new THREE.IcosahedronGeometry(.12,1);
  function createBeacons(group){
    return emergencyColors.map(color=>{
      const material={map:emergencyGlow,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending};
      const flare=renderer.software?new THREE.Mesh(sirenLens,new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false})):
        new THREE.Sprite(new THREE.SpriteMaterial(material));
      const pool=new THREE.Mesh(emergencyFloor,new THREE.MeshBasicMaterial({...material,polygonOffset:true,polygonOffsetFactor:-2}));
      pool.rotation.x=-Math.PI/2;pool.scale.set(10,8,1);
      group.add(flare,pool);return {flare,pool};
    });
  }
  function releaseModel(item){
    for(const {flare,pool} of item.beacons||[]){flare.removeFromParent();pool.removeFromParent();flare.material.dispose();pool.material.dispose();}
    item.object.dispose?.();
  }
  const blood=createBleedFibers(),bloodMesh=createBleedMesh(scene);
  const labels=document.createElement('div');
  labels.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none;';
  canvas.after(labels);
  let fieldOfView=80;
  function resize(fov=80){
    const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;
    if(w===width&&h===height&&fov===fieldOfView)return;
    fieldOfView=fov;
    width=w;height=h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,touch?1.15:1.4)*scale);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=cameraFieldOfView(w/h,fieldOfView);camera.updateProjectionMatrix();
  }
  function entity(e,dt,t,distance){
    const vehicle=!!e.isCar,key=e.renderId||e.id;
    const id=vehicle?'car/'+e.type:'puppet/'+e.type+'/'+(e.color||'');
    let item=models.get(key);
    if(item && item.kind!==id){scene.remove(item.object.group);releaseModel(item);models.delete(key);item=null;}
    if(!item){const seed=hash(String(e.id))%65535;const object=(vehicle?createCar:createPuppet)(e.type,e.color,seed);item={kind:id,object};models.set(key,item);scene.add(object.group);}
    item.used=inFrame;const g=item.object.group;
    g.userData.followedByCamera=!!e.self;
    const angle=e.angle||0;
    const ground=vehicle&&(isAircraft(e.type)||e.type==='train')?baseTerrainHeight(e.x,e.y):terrainHeight(e.x,e.y,e.angle,item.roadFloor),swim=e.motion==='swim' && !vehicle;
    item.roadFloor=ground;
    const offset=swim?swimGround(e.x,e.y)-ground-.67:0;
    item.waterOffset=item.waterOffset==null?offset:item.waterOffset+(offset-item.waterOffset)*blend(9,dt);
    g.position.set(e.x,ground+(e.lift||0)+item.waterOffset,e.y);
    g.rotation.set(0,-angle,0,'YXZ');
    if(vehicle&&isAircraft(e.type)){
      g.rotation.z=e.carPitch||0;g.rotation.x=e.bank||0;
    }else if(vehicle){
      const slope=terrainGradient(e.x,e.y,e.angle),c=Math.cos(angle),s=Math.sin(angle);
      g.rotation.z=e.carPitch??Math.atan(slope.x*c+slope.y*s);g.rotation.x=-Math.atan(-slope.x*s+slope.y*c);
    }
    g.visible=true;
    if(lighting&&!renderer.software){
      const casts=e.self||Math.hypot(e.x-camX,e.y-camY)<42;
      if(item.casts!==casts){
        item.casts=casts;
        g.traverse(node=>{if(node.isMesh&&node.material&&!node.material.transparent){node.castShadow=casts;node.receiveShadow=true;}});
      }
    }
    if(vehicle&&e.siren&&!item.beacons)item.beacons=createBeacons(g);
    for(const [side,{flare,pool}] of (item.beacons||[]).entries()){
      const flash=e.siren?emergencyFlash(t,side):0,z=side?.48:-.48;
      const spec=vehicleSpec(e.type);
      flare.visible=flash>0;pool.visible=flash>0&&(e.lift||0)<1;
      flare.position.set(-.18,spec.height+.05,z);flare.scale.setScalar(renderer.software?.57+flash*.62:1.15+flash*.86);
      flare.material.opacity=flash*.96;
      pool.position.set(-.22,.062,z*2);pool.material.opacity=flash*.48;
    }
    item.object.update(vehicle?{...e,cabinDistance:distance,appearance:undefined}:walkingPose(e),dt,t);
    return item;
  }
  function badge(e,label,bubble){
    let el=names.get(e.id);
    if(!el){el=document.createElement('span');el.className='world-label';labels.append(el);names.set(e.id,el);}
    el._used=inFrame;projection.set(e.x,(e.motion==='swim'?swimGround(e.x,e.y)-.67:e.isCar&&(isAircraft(e.type)||e.type==='train')?baseTerrainHeight(e.x,e.y):terrainHeight(e.x,e.y,e.angle))+(e.lift||0)+(e.isCar?vehicleSpec(e.type).height+.43:2.14),e.y);projection.project(camera);
    const visible=projection.z>0&&projection.z<1&&Math.abs(projection.x)<1.1&&Math.abs(projection.y)<1;
    el.hidden=!visible;if(!visible)return;
    el.style.left=(50+50*projection.x)+'%';el.style.top=(50-50*projection.y)+'%';
    if(el._label!==label||el._bubble!==bubble){
      el._label=label;el._bubble=bubble;
      const art=bubble&&makeEmoteIcon(label);
      el.classList.toggle('world-emote',!!art);
      if(art){el.replaceChildren(art);el.setAttribute('aria-label',label);}
      else{el.textContent=label;el.removeAttribute('aria-label');}
    }
  }
  function drawShotStrokes(strokes,height,life,age){
    if(age>=life)return;
    const mesh=shotStrokeMesh(strokes,height);
    if(!mesh)return;
    scene.add(mesh);effects.push({mesh,life:life-age,max:life,shot:true,fresh:true});
  }
  function effect(kind,x,y,angle=0,len=0,colors=[],lift=0,age=0) {
    if(!active || effects.length>42)return;
    const debris=propDebris(kind,colors?.type,angle);
    if(kind==='meleeImpact'||debris){
      const height=terrainHeight(x,y)+lift+(debris?.height||0),duration=debris?.lifetime??fiberLifetime;
      for(const strand of debris?.strands||impactFibers(angle,len)){
        const curve=new THREE.CatmullRomCurve3(strand.points.map(v=>new THREE.Vector3(...v)));
        const geo=new THREE.TubeGeometry(curve,4,strand.thickness||.017,4,false);
        const mat=new THREE.MeshBasicMaterial({color:strand.color,transparent:true,depthWrite:false});
        const mesh=new THREE.Mesh(geo,mat),[vx,vy,vz]=strand.velocity;
        mesh.position.set(x,height,y);scene.add(mesh);
        effects.push({mesh,life:duration,max:duration,vx,vy,vz,fiber:true});
      }
      return;
    }
    if(kind==='rocket'){
      const max=rocketFlightTime(len,colors?.barrel);
      if(age>=max)return;
      const height=terrainHeight(x,y)+lift;
      const strokes=progress=>shotStrokeMesh(buildShotEffect(kind,x,y,angle,len,progress,false,colors?.drop),height);
      const mesh=strokes(age/max);
      if(mesh){scene.add(mesh);effects.push({mesh,life:max-age,max,rocket:strokes,fresh:true});}
      if(colors?.flash)drawShotStrokes(muzzleFlash(colors.barrel,x,y,angle),height,.095,age);
      return;
    }
    const ordnance=kind==='shellExplosion'?1.7:kind==='rocketExplosion'?1.23:0;
    if(kind!=='burst'&&kind!=='carExplosion'&&!ordnance){
      const duration=effectDuration(kind);
      const height=terrainHeight(x,y)+lift,barrel=colors?.barrel;
      drawShotStrokes(buildShotEffect(barrel||kind,x,y,angle,len,Math.max(.25,age/duration),!!barrel,colors?.drop),height,duration,age);
      if(colors?.flash)drawShotStrokes(muzzleFlash(barrel,x,y,angle),height,.095,age);
      return;
    }
    const explosion=kind==='carExplosion'||ordnance>0;
    const palette=explosion?['#ffd687','#f58b48','#ffebbe','#4b4445']:colors.length?colors:['#e69ea7','#ffdc9f','#8fcabf','#d6a787'];
    const ground=terrainHeight(x,y)+lift;
    if(ordnance){
      const flash=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshBasicMaterial({color:'#fff1bd',transparent:true,depthWrite:false}));
      flash.position.set(x,ground+.52,y);scene.add(flash);
      effects.push({mesh:flash,life:.25-age,max:.25,pulse:ordnance*2.3});
      const ring=new THREE.Mesh(new THREE.RingGeometry(.89,1,56).rotateX(-Math.PI/2),
        new THREE.MeshBasicMaterial({color:'#ffc97b',transparent:true,depthWrite:false,side:THREE.DoubleSide}));
      ring.position.set(x,ground+.18,y);scene.add(ring);
      effects.push({mesh:ring,life:.68-age,max:.68,pulse:ordnance*6.2,ring:true});
    }
    for(let i=0;i<(ordnance?34:explosion?18:7);i++){
      const smoke=ordnance&&i%3===0,extent=ordnance||1;
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(((explosion?.34:.09)+Math.random()*(explosion?.28:.07))*extent,1),
        new THREE.MeshBasicMaterial({color:smoke?'#453e43':palette[i%palette.length],transparent:true,depthWrite:false}));
      m.position.set(x,ground+.3+Math.random()*.5,y);scene.add(m);
      const a=Math.random()*Math.PI*2,v=(1.3+Math.random()*(explosion?4.8:2))*extent*(smoke?.50:1);
      const vx=Math.cos(a)*v,vy=(2+Math.random()*2.5)*extent,vz=Math.sin(a)*v;
      m.position.x+=vx*age;m.position.z+=vz*age;m.position.y+=vy*age-3.5*age*age;
      const max=smoke?2.45:explosion?1.3:.65;
      effects.push({mesh:m,life:max-age,max,vx,vy:vy-7*age,vz,smoke:!!smoke});
    }
  }
  let cpuFrame=-Infinity;
  function render(state,dt,time) {
    if(!active || !canvas.isConnected)return false;
    if(renderer.software&&!state.snap&&time-cpuFrame<1/30-.002)return false;
    if(renderer.software){dt=Math.min(.10,Math.max(dt,time-cpuFrame));cpuFrame=time;}
    resize(state.cameraConfig?.fov);inFrame++;
    const {p,car,yaw,pitch,destroyed}=state;
    const model=car?vehicleSpec(car.type):null;
    const cockpit=!!car&&!isAircraft(car.type)&&car.type!=='train'&&!state.passengerView&&state.cameraConfig?.mode==='driver';
    const rig=followCamera(state,dt,time),{ground,reset:snap}=rig;
    camX=rig.x;camY=rig.y;
    camera.position.set(rig.x,rig.z,rig.y);
    cameraAim.set(rig.aimX,rig.aimZ,rig.aimY);
    driverView.set(cockpit,model,p,ground,state.steering,state.vehiclePitch);
    if(cockpit){
      camera.position.copy(driverView.eye);
      const sightPitch=pitch-.13+(state.vehiclePitch||0);
      cameraAim.set(camera.position.x+Math.cos(yaw)*12,camera.position.y+Math.sin(sightPitch)*12,camera.position.z+Math.sin(yaw)*12);
    }
    camera.lookAt(cameraAim);camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    const epoch=state.epoch??Date.now();
    crossingDisplay.update(state.crossings,epoch,dt);
    lighting?.update(p,ground,time,snap,scale,epoch);
    atmosphere?.update(epoch,camera);
    if(time-lastPropTick>.30 || snap){props=nearbyProps(p.x,p.y,320);lastPropTick=time;}
    landingMarks?.update(p);
    city.update(p,time,{epoch,props,destroyed,propHealth:state.propHealth,propDamageRevision:state.propDamageRevision});
    pickupDisplay.update(state.pickups,p,time);wool.update(state.lostWool,p);incidents.update(state.districtIncident,p,epoch);
    const candidates=state.entities.filter(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)).sort((a,b)=>distance(a,p)-distance(b,p));
    const lowPower=renderer.software||scale<.81;
    const carLimit=lowPower?7:touch?10:17, pedestrianLimit=lowPower?8:touch?11:14;
    let npcs=0,cars=0,index=0,farCars=0;
    blood.begin(time,state.epoch??Date.now());bloodMesh.begin();
    for(const e of candidates) {
      if(cockpit&&e.self)continue;
      const d=distance(e,p),critical=e.self||e.peer;
      if(e.isCar&&!critical&&!isAircraft(e.type)&&e.type!=='train'&&(e.farTraffic||d>138||cars>=carLimit&&!e.siren)){
        if(d<(car?345:160)&&farCars<trafficLimit)distantVehicle(e,farCars++);
        continue;
      }
      if(!critical&&(e.isCar?d>175:d>86||npcs>=pedestrianLimit))continue;
      if(critical&&!e.self&&d>220)continue;
      if(e.isCar)cars++;else npcs++;
      entity(e,dt,time,d);
      if(d<42)bloodMesh.draw(blood.actor(e));
      if(index<65&&e.motion!=='swim'){
        const floor=e.supportHeight||0,angle=e.angle||0,c=Math.cos(angle),s=Math.sin(angle);
        const railway=e.type==='train',slope=floor>.12||railway?{x:0,y:0}:terrainGradient(e.x,e.y,e.angle);
        const scale=1/(1+.08*Math.max(0,(e.lift||0)-floor));
        shadowTransform.position.set(e.x,(railway?baseTerrainHeight(e.x,e.y):terrainHeight(e.x,e.y,e.angle))+floor+.10,e.y);
        shadowTransform.rotation.set(-Math.atan(-slope.x*s+slope.y*c),-angle,Math.atan(slope.x*c+slope.y*s),'YXZ');
        const footprint=e.isCar?vehicleSpec(e.type):null;
        shadowTransform.scale.set(scale*(footprint?footprint.halfLength*2.1:1.1),1,scale*(footprint?footprint.halfWidth*2.2:.74));
        shadowTransform.updateMatrix();shadows.setMatrixAt(index++,shadowTransform.matrix);
      }
      if(e.bubble || (e.peer && d<48))badge(e,e.bubble||e.name,!!e.bubble);
    }
    for(const mesh of [trafficBody,trafficCabin,trafficLamps]){
      mesh.count=farCars;mesh.instanceMatrix.needsUpdate=true;
    }
    blood.eachDrop((id,center,strands)=>bloodMesh.draw(strands));bloodMesh.finish();
    shadows.count=index;shadows.instanceMatrix.needsUpdate=true;
    for(const [key,v] of models)if(v.used!==inFrame){
      v.object.group.visible=false;
      if(inFrame-v.used>160 || models.size>60){scene.remove(v.object.group);releaseModel(v);models.delete(key);}
    }
    for(const [key,el] of names)if(el._used!==inFrame){el.remove();names.delete(key);}
    for(let i=effects.length-1;i>=0;i--){
      const e=effects[i];
      if(e.fresh)e.fresh=false;else e.life-=dt;
      if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1);continue;}
      if(e.rocket){
        const mesh=e.rocket(1-e.life/e.max);
        if(mesh){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();e.mesh=mesh;scene.add(mesh);}
        continue;
      }
      if(e.pulse){
        const phase=1-e.life/e.max;
        e.mesh.scale.setScalar(e.pulse*(.28+phase*.92));
        e.mesh.material.opacity=(1-phase)**2*(e.ring?.58:.92);
        continue;
      }
      if(e.smoke)e.mesh.scale.setScalar(1+(e.max-e.life)*1.3);
      if(e.vy!==undefined){e.vy-=(e.smoke?1.3:7)*dt;e.mesh.position.x+=e.vx*dt;e.mesh.position.z+=e.vz*dt;e.mesh.position.y=Math.max(terrainHeight(e.mesh.position.x,e.mesh.position.z)+.02,e.mesh.position.y+e.vy*dt);if(!e.fiber)e.mesh.rotation.z+=dt*6;}
      e.mesh.material.opacity=Math.min(1,e.shot?1.72*e.life/e.max:e.life*(e.fiber?10:5));
    }
    // The software view has already scheduled this frame before updating its scene.
    const presented=renderer.render(scene,camera,snap||renderer.software);
    if(!renderer.software&&dt>.049)slowCount++;else slowCount=Math.max(0,slowCount-.5);
    if(slowCount>55 && scale>.68){scale=Math.max(.68,scale-.12);width=0;slowCount=0;}
    return presented!==false;
  }
  // World (east, south, elevation) to the last drawn viewport; depth is along the camera axis in metres.
  function projectTarget(x,y,elevation=1){
    if(!active||!inFrame||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(elevation))return null;
    projection.set(x,terrainHeight(x,y)+elevation,y).applyMatrix4(camera.matrixWorldInverse);
    const depth=-projection.z;
    if(depth<camera.near||depth>camera.far)return null;
    projection.applyMatrix4(camera.projectionMatrix);
    if(Math.abs(projection.x)>1||Math.abs(projection.y)>1)return null;
    return {x:(1+projection.x)/2,y:(1-projection.y)/2,depth};
  }
  const ray=new THREE.Raycaster(),floor=new THREE.Plane(new THREE.Vector3(0,1,0),-.87),point=new THREE.Vector3();
  function aimRay(x,y){
    const r=canvas.getBoundingClientRect();if(!inFrame||!r.width||!r.height)return null;
    ray.setFromCamera(new THREE.Vector2(x==null?0:(x-r.left)/r.width*2-1,y==null?0:1-(y-r.top)/r.height*2),camera);
    const {origin,direction}=ray.ray,d=Math.hypot(direction.x,direction.z);
    if(d<.01)return null;
    return {x:origin.x,y:origin.z,z:origin.y,angle:Math.atan2(direction.z,direction.x),slope:direction.y/d};
  }
  function aim(x,y,p){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
    ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),camera);
    floor.constant=-(terrainHeight(p.x,p.y,p.angle)+(p.lift||0)+.87);
    if(ray.ray.intersectPlane(floor,point)&&point.distanceTo(camera.position)<160)return Math.atan2(point.z-p.y,point.x-p.x);
    return Math.atan2(ray.ray.direction.z,ray.ray.direction.x);
  }
  function contextLost(event){event.preventDefault();if(active)onLost(new Error('Contexte WebGL interrompu.'));}
  canvas.addEventListener('webglcontextlost',contextLost);
  return {available:true,get drawCalls(){return renderer.info?.render?.calls;},mode:renderer.software?'mesh':'webgl',render,aim,aimRay,projectTarget,effect,dispose(){
    active=false;canvas.removeEventListener('webglcontextlost',contextLost);labels.remove();
    for(const item of models.values())releaseModel(item);
    emergencyGlow.dispose();emergencyFloor.dispose();sirenLens.dispose();
    trafficGeometry.dispose();for(const mesh of [trafficBody,trafficCabin,trafficLamps])mesh.material.dispose();
    incidents.dispose();wool.dispose();driverView.dispose();bloodMesh.dispose();pickupDisplay.dispose();crossingDisplay.dispose();city.dispose?.();
    landingMarks?.dispose();
    atmosphere?.dispose();lighting?.dispose();shadows.geometry.dispose();shadows.material.map.dispose();shadows.material.dispose();
    sky.geometry.dispose();sky.material.map.dispose();sky.material.dispose();renderer.dispose();
  }};
}
