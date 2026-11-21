import {planRoadCoast,sampleRoadCoast,tumbleSpeed} from './road-coast.js';
import {airfields,isAircraft} from './airfield.js';
import {stepAircraft,aircraftObstructed} from './flight.js';
import {planAutorotation,sampleAutorotation,flightSampleMs} from './autorotation.js';
import {ammoCapacity,reloadMagazine} from './ammunition.js';
import {vehicleContact,createVehicleDisplacements,sweptPedestrianContact,slideVehicleVelocity} from './vehicle-contact.js';
import {automaticGear,stepRoadDrive,impactSpeeds,roadSteering,roadSlip} from './vehicle-handling.js';
import {cameraOptions,cameraModes,readCameraOptions,writeCameraOptions} from './camera-options.js';
import {createFrameMeter} from './diagnostics.js';
import {roadblockSite,findOfficerCover} from './police-tactics.js';
import {crouchedPace,isLow,behindCar,guardedFraction} from './guard-stance.js';
import {crimeHeardOrSeen,observePursuit,responseUnits,canUseForce,custodyTime,policeSearchArea,searchEscapeDelay} from './police-perception.js';
import {careerPlaces} from './career-catalog.js';
import {officerKit} from './officer-kit.js';
import {stepVehicleBody} from './vehicle-motion.js';
import {createArmorLayer,withJacket} from './outfit-shop.js';
import {foxSkin} from './puppet-dyes.js';
import {abandonedFor,disconnectedFor,exitDriverFor,parkingExpired,wreckExpired,replacementAt} from './vehicle-lifecycle.js';
import {parkingBay,parkingLease} from './enfer-parking-lots.js';
import {retailClerks,retailClerkId} from './enfer-retail.js';
import {railPose,railDistance,railTrain,railTrains,atRailStation,railPlatform,stepRail,railStations,nextRailStation,alongRail,autonomousRail} from './enfer-rail.js';
import {crossingBarriers,crossingSignal} from './rail-crossings.js';
import {officerDrop} from './drop-id.js';
import {createStreetAudio} from './street-audio.js';
import {createTrafficHorns} from './traffic-horns.js';
import {reactionTo,reactionGoal} from './pedestrian-reaction.js';
import {chassisDamage,chassisHealth,chassisHealthAt,burnProgress,blastRadius,blastDamage,vehicleBurnDelay,enginePower,chassisGrip,damagedTires,vehiclePart,nextChassis} from './vehicle-damage.js';
import { SPAWN, destinations, districtAt, streetAt, nearbyProps, blocked, swimmingSurface, contactAt, moveBody, vehicleTurn, vehicleContactNormal, supportAt, cameraDistance, routeAgents, sampleTrafficRoute, trafficVehicleAt, trafficAlternatives, getTravelPoint, paintMap } from './paris-world.js';
import { nearbyDrivableStreets,railCrossings,clearsTrafficAtRest } from './paris-world.js';
import {isEnfer} from './paris-data.js';
import { planDispatch, planDistantDispatch, stepDispatch, dispatchDoor, footApproach, dispatchWorkSpot, stepDispatchFoot } from './dispatch-roads.js';
import { createDetourPlanner } from './traffic-detour.js';
import { createTrafficFlow } from './traffic-flow.js';
import { combo, meleeMoves, meleeContact, recoilPhase, recoilSeconds } from './melee.js';
import { createParkour } from './parkour.js';
import {automaticLights,doorOpening} from './vehicle-signals.js';
import {cityClimate} from './city-climate.js';
import { aircraftDeck, baseTerrainHeight, terrainHeight, terrainGradient } from './terrain-height.js';
import { createCrowdMotion, pedestrianBody, PLAYER_RADIUS, WALKER_RADIUS } from './crowd-motion.js';
import { packTraffic, receiveTraffic } from './traffic-sync.js';
import { peerViewTime, recordPeerMotion, readPeerMotion } from './peer-motion-net.js';
import { createView } from './game-render.js';
import { nearbyWeaponDrops, weaponDrops } from './weapon-drops.js';
import { createWanted } from './wanted.js';
import { createVitality, impactEvent, npcHealthAt, npcMaxHealth, npcIsDead, isLawOfficer, officerBodyLifetime, npcVehicleDamage, pedestrianDamage, crashDamage } from './vitality.js';
import { activeBleeding, bleedingAfterHit, hitSeverity } from './bleeding.js';
import { ragdollPose } from './ragdoll.js';
import { vehicleSpec, isVehicleType, vehicleDoorways, isTrain } from './vehicle-types.js';
import { weaponCatalog as weapons, starterWeapons, weaponList } from './weapon-catalog.js';
import { resolveWeaponShot,weaponShotShape } from './weapon-patterns.js';
import { renderShotRay,shotMuzzle } from './held-weapon.js';
import { effectDuration } from './weapon-effects.js';
import { createShotPlayback } from './shot-playback.js';
import { applyPropDamage, propMaxHealth, vehiclePropDamage,crushableProp } from './prop-damage.js';
import { chooseTouchShot, traceShot, targetHeight } from './aim-assist.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blend=(k,dt)=>1-Math.exp(-k*dt);
const deltaAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const turnTo=(a,b,k,dt)=>a+deltaAngle(a,b)*blend(k,dt);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const offset=(o,angle,length)=>({x:o.x+Math.cos(angle)*length,y:o.y+Math.sin(angle)*length});
const isInput=el=>el?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName);
const weaponLabels=Object.fromEntries(weaponList.map(w=>[w.id,w.name]));
const maxShotRange=Math.max(...weaponList.map(w=>w.range));
const pickupRadius=2.6;
const PEER_RANGE=212;
const services={police:'police',firefighter:'firetruck',medic:'ambulance',swat:'swat',
  military:'armored',tankunit:'tank',airunit:'helicopter'};
const dimensions=e=>{const {halfLength,halfWidth}=vehicleSpec(e.type);return {halfLength,halfWidth};};
const softProp=o=>!!propMaxHealth(o?.type);
function collisionBody(e){
  const {id,x,y,angle,speed}=e;
  const vx=e.vx??((speed||0)*Math.cos(angle||0)),vy=e.vy??((speed||0)*Math.sin(angle||0));
  if(e.isCar){
    const spec=vehicleSpec(e.type),parked=!e.peer&&!e.routeId&&!e.moving&&!e.occupied&&!e.id?.startsWith('unit-')&&!spec.openSeat;
    const onFoot=parked&&!isAircraft(e.type);
    const footprint=e.type==='airship'?{halfLength:1.58,halfWidth:.77}:dimensions(e);
    return {id,vehicleId:e.vehicle?.id||id,x,y,angle,vx,vy,speed,spin:e.spin||0,peer:!!e.peer,isCar:true,type:e.type,...footprint,h:spec.height,lift:e.lift||0,climbable:onFoot,standable:onFoot};
  }
  return {...pedestrianBody(e),lift:e.lift||0};
}

export function createGame({canvas,minimap,net,onState=()=>{},onNotice=()=>{},onAimLock=()=>{},initialPursuit=null,initialVitality=null,loadout=[],skin,onLoadoutChange=()=>{},buildView=createView}){
  let jacketDye=null,baseSkin=foxSkin(skin).id;
  let wearStorage;try{wearStorage=globalThis.localStorage;}catch{}
  const armorLayer=createArmorLayer(wearStorage);
  const p={...SPAWN,id:'local',type:'fox',color:baseSkin,health:100,wanted:0,walk:0,angle:SPAWN.angle||0,moving:false};
  const traversal=createParkour(p,(x,y)=>terrainHeight(x,y,p.angle),(x,y)=>terrainGradient(x,y,p.angle),{onImpact:velocity=>{
    damage(Math.min(48,Math.round((velocity-8)*3)),p.angle,Math.min(.8,.18+(velocity-8.5)*.11),'fall');
  }});
  const view=buildView(canvas,SPAWN,onNotice),keys=new Set(),destroyed=new Set(),peers=new Map(),carsShared=new Map(),npcShared=new Map(),incidents=new Map(),bubbles=new Map();
  let passengerSeat=null,seatPending=null,exitSlide=null;
  let woolPoint=null,districtIncident=null;
  const cabinPassengers=new Map(),openedDoors=new Map();
  let lampMode='auto',fareCar=null,seatBaseline=false;
  const lightsOn=()=>lampMode==='auto'?automaticLights(cityClimate(epoch)):lampMode==='on';
  function movingDoor(id){
    const door=openedDoors.get(id);
    if(!door)return 0;
    const amount=doorOpening(door.at,epoch,door.side);
    if(epoch-door.at>=920)openedDoors.delete(id);
    return amount;
  }
  const diagnostics=createFrameMeter();
  let cameraConfig=readCameraOptions();
  function setCameraOptions(patch){
    cameraConfig=cameraOptions({...cameraConfig,...patch});writeCameraOptions(cameraConfig);cameraSnap=true;
  }
  const displacedDrivers=new Map(),officerFiring=new Map();
  const policeReports=new Map();
  let crouched=false,knownByPolice=false,custody=0,searchOutsideSince=null;
  const retiredVehicles=new Map(),vehicleWear=new Map(),exploded=new Set(),reactions=new Map(),audio=createStreetAudio();
  const propHealth=new Map(),confirmedProps=new Map(),soloProps=new Map(),pendingImpacts=new Map(),rewardedProps=new Set();
  let propDamageRevision=0,impactNumber=0;
  const displacedCars=createVehicleDisplacements(),lastShunt=new Map();
  let lateralSpeed=0,collisionSpin=0;
  const traffic=createTrafficFlow(sampleTrafficRoute,createDetourPlanner(trafficAlternatives,sampleTrafficRoute));
  const trafficHorns=createTrafficHorns();
  const crowd=createCrowdMotion({
    blocked:(x,y,r)=>blocked(x,y,r,destroyed),
    move:(x,y,dx,dy,r)=>moveBody(x,y,dx,dy,{radius:r,destroyed})
  });
  const streetBlocked=(x,y,angle,spec)=>!!contactAt(x,y,{angle,halfLength:spec.halfLength,halfWidth:spec.halfWidth,destroyed});
  let trafficPeers={checkpoints:[],followers:new Set()};
  let drives=[],trafficSnapshot=null;
  const owned=new Set(starterWeapons);
  const ownedWeapons=()=>Object.keys(weapons).filter(k=>owned.has(k));
  function addLoadout(list){
    if(Array.isArray(list))for(const k of list)if(typeof k==='string'&&Object.hasOwn(weapons,k))owned.add(k);
  }
  addLoadout(loadout);
  const pursuit=createWanted(initialPursuit),pickupWait=new Map(),pendingPickup=new Set();
  p.wanted=pursuit.state().level;
  let wantedEvent=null,actionNumber=0,nearPickup=null,pickups=[],pickupArea=[],pickupCenter=null,noticePickup=null,trackedDrop=null;
  const ammo=Object.fromEntries(Object.entries(weapons).map(([k,v])=>[k,v.mag]));
  const reserve=Object.fromEntries(weaponList.map(w=>[w.id,Number.isFinite(w.mag)?ammoCapacity(w.id)-w.mag:0]));
  let authoritativeAmmo=null,emptyNoticeAt=-Infinity;
  let weapon='pistol',car=null,nearCar=null,boarding=null,suspension=null,speed=0,vx=0,vy=0,steer=0,turn=0,impact=0,shootPose=0,braking=false;
  let queuedCameraCycle=0;
  let yaw=p.angle,pitch=.13,drag=null,freeLookUntil=0,cameraSnap=true,stickX=0,stickY=0,aimX=0,aimY=0,fireHeld=false,sprintHeld=false,paused=false;
  let time=0,epoch=net?.serverTime?.()||Date.now(),networkTick=0,hudTick=0,mapTick=0,popTick=0,trafficTick=0,routeClock=0,lastState='',ready=false;
  if(p.wanted&&initialPursuit?.report?.enfer===isEnfer&&Number.isFinite(initialPursuit.report.x+initialPursuit.report.y))
    policeReports.set(net?.id||'self',{...initialPursuit.report,at:epoch});
  let reloading=0,cooldown=0,contactLock=0,actionAt=-2,score=0,arrivalChecked=false,isRunning=true;
  let roadMotion=null,mobileSteer=0,mobileThrottle=0,mobileLift=0;
  let actors=[],cars=[],routeActors=[],routeCars=[],remotes=[],obstacles=[],previousFrame=performance.now(),frameId;
  let driftX=0,driftY=0,aimPointer=null,shotFacingUntil=-1,meleeCameraAim=false,levelPlace=null,streetName=streetAt(p.x,p.y),streetTime=-1;
  let travelClaim=null,touchFireHeld=false,aimAssist=true,aimLock=null,lockPoint=null,markImpactUntil=0,nextLockCheck=0,heldSource='pointer';
  const life=createVitality(initialVitality,epoch,isEnfer?28500:undefined),receivedHits=new Map();
  let acceptShotsFrom=life.snapshot().protectedUntil||0;
  p.health=life.health;
  let appearance=null,impactSerial=0,trafficImpactAt=0;
  let swing=null,comboIndex=0,chainUntil=-1,meleeHeld=false,swingQueued=false,lastSwingStamp=0,selfRecoil=null;
  const witnessedSwings=new Map(),witnessedRecoils=new Map(),witnessedShots=new Map();
  const shotPlayback=createShotPlayback();
  const incapacitated=()=>life.down||!!life.ragdoll;
  let shotContacts=null;
  function emit(type,data){
    if(shotContacts&&data.cause==='weapon'&&['propDamage','vehicleDamage','npc'].includes(type)){
      shotContacts.push({type,data});return true;
    }
    return net?.emit?.(type,data);
  }
  const vehicleId=v=>v.vehicle?.id||v.vehicleId||v.id;
  let parkingOwner=null;
  let railRide=null;
  let crossingView=[],crossingBlocks=[];
  let mobileHandbrake=false;
  const railService=train=>{
    const remote=remotes.find(e=>e.vehicle?.id===train.id)||
      peerRoster.find(e=>e.id!==net?.id&&e.vehicle?.id===train.id);
    if(remote){
      const d=railDistance(remote.x,remote.y);
      return {...remote,d,direction:Math.cos(remote.angle-railPose(train,d,1).angle)<0?-1:1};
    }
    const record=carsShared.get(train.id);
    return autonomousRail(train,epoch,record?{...record,railAt:record.railAt??record.lastSeen??epoch}:null);
  };
  const myParkingOwner=()=>parkingOwner||(net?.status==='online'?null:'local');
  const myParkedCars=()=>[...carsShared.values()].filter(v=>v.parkingOwner&&v.parkingOwner===myParkingOwner()&&!parkingExpired(v,epoch));
  const reservedBay=()=>{
    if(!isEnfer||!car||Math.abs(speed)>.55||p.lift>.35||!myParkingOwner())return null;
    const bay=parkingBay(p,car.type);
    return bay&&![...carsShared.values()].some(v=>v.id!==car.id&&v.parkingSlot===bay.id&&!parkingExpired(v,epoch))?bay:null;
  };
  const retired=id=>(retiredVehicles.get(id)||0)>epoch;
  function retireVehicle(id,until){
    if(until>epoch)retiredVehicles.set(id,until);
    if(car?.id===id)dropCar(true);
    if(passengerSeat?.car===id)releasePassenger();
    if(boarding?.vehicle.id===id)cancelBoarding();
    carsShared.delete(id);displacedCars.delete(id);vehicleWear.delete(id);exploded.delete(id);
  }
  const vehicleHealth=v=>chassisHealthAt(vehicleWear.get(vehicleId(v)),epoch);
  function receiveChassis(d,local=false){
    if(!d?.id||!Number.isFinite(d.hp)||retired(d.id))return;
    if(wreckExpired(d,epoch)){if(replacementAt(d)>epoch)retireVehicle(d.id,replacementAt(d));return;}
    const previous=vehicleWear.get(d.id),previousRepair=previous?.repairedAt||0,repair=d.repairedAt||0;
    if(repair<previousRepair||(repair===previousRepair&&d.hp>=chassisHealth(previous?.hp)))return;
    if(repair>previousRepair)exploded.delete(d.id);
    if(local&&d.fireAt&&!vehicleWear.get(d.id)?.fireAt)dispatch('firefighter',d);
    vehicleWear.set(d.id,d.fireAt&&!d.explodeAt?{...d,explodeAt:d.fireAt+vehicleBurnDelay}:d);
    if(d.disabledAt&&car?.id===d.id)onNotice('Moteur hors service. Tu peux sortir du véhicule.');
    if(d.fireAt&&car?.id===d.id)onNotice(d.hp===0?'Le véhicule prend feu ! Sors vite.':'Le moteur prend feu.');
    if(d.part==='glass'&&dist(d,p)<75)audio.grit(.14,.095,4600);
    if((d.parts||0)&30&&car?.id===d.id&&!d.fireAt)onNotice('Pneu crevé · tenue de route réduite.');
  }
  function damageChassis(v,details){
    if(isTrain(v.type))return;
    const damage=chassisDamage(v.type,details);
    if(!damage||vehicleHealth(v)===0||retired(vehicleId(v)))return;
    const hit={id:vehicleId(v),type:v.type||'car',x:v.x,y:v.y,angle:v.angle??p.angle,...details};
    if(net?.status==='online'&&emit('vehicleDamage',hit)!==false)return;
    receiveChassis(nextChassis(vehicleWear.get(hit.id),hit,damage,epoch),true);
  }
  function publish(){
    // Traffic followers advance along known routes between these checkpoints.
    // Keep local aiming and player movement independent of this slower stream.
    if(!drives.length)trafficSnapshot=null;
    else if(!trafficSnapshot||epoch-trafficSnapshot.at>=300||epoch<trafficSnapshot.at)
      trafficSnapshot=packTraffic(drives,p,trafficPeers.followers,epoch);
    net?.publish?.({x:p.x,y:p.y,angle:p.angle,vx,vy,moving:p.moving,sprinting:p.sprinting,shooting:shootPose>.6,
      melee:swing?{kind:swing.kind,started:swing.started,angle:deltaAngle(0,swing.angle)}:undefined,recoil:recoilPhase(selfRecoil,epoch)?{at:selfRecoil.at,angle:selfRecoil.angle,force:selfRecoil.force}:undefined,
      walk:p.walk,lift:p.lift,verticalSpeed:p.verticalSpeed,motion:car?(suspension?.lift>0?'carAir':'idle'):p.motion,motionPhase:p.motionPhase,stride:p.stride,slope:p.slope,turn,traffic:trafficSnapshot||undefined,type:'fox',color:baseSkin,health:Math.ceil(p.health),downUntil:life.downUntil,ragdoll:life.ragdoll,bleeding:life.bleeding,appearance,wanted:p.wanted,weapon,
      ...(passengerSeat?.rail?{railRider:passengerSeat.car}:{}),
      speed:car?speed:Math.hypot(vx,vy),vehicle:car&&!travelClaim?{...car,...(isAircraft(car.type)?{bank:suspension?.bank||0,carPitch:suspension?.pitch||0,lift:p.lift||0}:{}),headlamps:lightsOn(),brake:braking,fare:fareCar===car.id,x:p.x,y:p.y,angle:p.angle,moving:Math.abs(speed)>.2,speed}:null});
  }
  let hornAt=-Infinity;
  const {unlock,tone}=audio;
  function alertCrowd(source,radius){
    for(const actor of actors){
      if(dist(actor,source)>radius||reactions.get(actor.id)?.until>epoch)continue;
      const reaction=reactionTo(actor,source,epoch);if(reaction)reactions.set(actor.id,reaction);
    }
  }
  function district(){
    const d=districtAt(p.x,p.y);return typeof d==='string'?d:d?.name||d?.district||'Paris';
  }
  function heightAboveLanding(pose){
    const bare=baseTerrainHeight(pose.x,pose.y),altitude=bare+(pose.lift||0);
    const deck=aircraftDeck(pose.x,pose.y);
    const ground=altitude>=deck-.05?deck:bare;
    const water=swimmingSurface(pose.x,pose.y,true);
    return Math.max(0,altitude-Math.max(ground,water==null?-Infinity:water+.75));
  }
  function sendHud(force=false){
    if(force||time-streetTime>.64){streetName=streetAt(p.x,p.y);streetTime=time;}
    const wanted=pursuit.state();
    const traversalReady=!paused&&!boarding&&!car&&!passengerSeat&&!incapacitated()&&(traversal.grounded||p.motion==='swim');
    const traversalAction=p.motion==='swim'?'swim':traversalReady?traversal.hint(p.angle,{destroyed,colliders:obstacles}):'jump';
    const piloting=isAircraft(car?.type),inAircraft=piloting||isAircraft(passengerSeat?.type);
    const train=railRide||passengerSeat?.rail&&passengerSeat;
    const railStation=train&&atRailStation(train.d),railDestination=train&&nextRailStation(train.d,train.direction);
    const canBail=inAircraft&&heightAboveLanding(p)>.16;
    const canBailRoad=!!(car||passengerSeat)&&!inAircraft&&p.lift<=.35&&Math.abs(speed)>=tumbleSpeed;
    const state={piloting,inAircraft,canBail,canBailRoad,canPark:!!reservedBay(),flightHeight:inAircraft?Math.round(heightAboveLanding(p)):0,traversalReady,traversalAction,armor:armorLayer.armor,...life.state(epoch),health:Math.ceil(life.health),passenger:!!passengerSeat,nearPassengerSeat:!!nearCar?.peer,vehicleName:passengerSeat?'Passager · '+vehicleSpec(passengerSeat.type).label:car?vehicleSpec(car.type).label:'',vehicleHealth:passengerSeat?vehicleHealth({id:passengerSeat.car}):car?vehicleHealth(car):100,nearVehicleName:nearCar?vehicleSpec(nearCar.type).label:'',wanted:p.wanted,wantedPoints:wanted.points,wantedProgress:wanted.progress,wantedEvent,ownedWeapons:ownedWeapons(),nearPickup,trackedDrop:tracker(),district:district(),street:streetName,weapon,reserve:reserve[weapon],ammo:Number.isFinite(ammo[weapon])?ammo[weapon]:'∞',
      crouched:isLow(p),policeContact:p.wanted?(knownByPolice?'En poursuite':searchOutsideSince!==null
        ?'Hors zone · '+Math.max(0,Math.ceil(searchEscapeDelay(p.wanted)-time+searchOutsideSince))+' s':'Zone de recherche'):'',
      maxAmmo:Number.isFinite(weapons[weapon].mag)?weapons[weapon].mag:'∞',nearVehicle:!!nearCar,jackTarget:!!nearCar&&hasDriver(nearCar),boarding:!!boarding,inVehicle:!!(car||passengerSeat),gear:car?automaticGear(vehicleSpec(car.type),speed):null,speed:Math.round(Math.abs(speed)*3.6),score,
      reloading:reloading>0,ready,graphics:view.mode||(view.available?'webgl':'unavailable')};
    const platform=!train&&isEnfer&&railStations.find(s=>dist(s,p)<24);
    const boardableTrain=platform&&!car&&!passengerSeat&&closestBoardableCar(true);
    Object.assign(state,{train:!!train,nearTrain:!!boardableTrain,railCanDrive:!!boardableTrain&&!boardableTrain.peer,platform:platform?.name||'',
      railStation:railStation?.name||'',railDistance:railDestination?Math.round(alongRail(train.d,railDestination.d,train.direction)):null,
      railDestination:railDestination?.name||'',canReverseTrain:!!railRide&&speed<.15});
    const packed=JSON.stringify(state);if(force||packed!==lastState){onState(state);lastState=packed;}
  }
  function clearSight(a,b){
    const distance=dist(a,b);
    if(distance<.4)return true;
    const eye=(isLow(b)?.77:1.15)+(b.lift||0);
    const height=(isLow(a)?.77:1.25)+(a.lift||0);
    return !behindCar(a,b,cars,trafficContact)&&!behindCar(b,a,cars,trafficContact)&&cameraDistance(a.x,a.y,height,Math.atan2(b.y-a.y,b.x-a.x),distance,eye,destroyed,.05)>=distance-.32;
  }
  function soundPan(source,distance){
    return clamp((-(source.x-p.x)*Math.sin(yaw)+(source.y-p.y)*Math.cos(yaw))/Math.max(1,distance),-1,1);
  }
  function nearbyMotor(){
    let nearest=null,distance=29;
    for(const vehicle of cars){
      if(!vehicle.occupied&&!vehicle.moving&&!vehicle.routeId||vehicle.noDriver||
        vehicle.id===car?.id||vehicle.id===passengerSeat?.car)continue;
      const range=Math.hypot(vehicle.x-p.x,vehicle.y-p.y,(vehicle.lift||0)-(p.lift||0));
      if(range<distance){distance=range;nearest=vehicle;}
    }
    if(!nearest)return null;
    const bearing=Math.atan2(p.y-nearest.y,p.x-nearest.x);
    const closing=(nearest.speed||0)*Math.cos(bearing-nearest.angle);
    return {type:nearest.type,speed:nearest.speed,volume:.49*(1-distance/29)**1.35,
      pan:soundPan(nearest,distance),doppler:clamp(1+closing/175,.86,1.14)};
  }
  function responderId(d,part){
    if(!isLawOfficer(d.kind))return d.id+'-'+part;
    const [source,slot]=d.id.slice(('unit-'+d.kind+'-').length).split(':');
    return 'u-'+d.kind+'-'+source.replaceAll('-','')+'-'+Math.round(d.started).toString(36)+'-'+(slot||0)+'-'+part;
  }
  function pursuitArea(){
    if(!p.wanted)return null;
    const id=net?.id||'self';
    if(!policeReports.has(id))policeReports.set(id,{x:p.x,y:p.y,angle:p.angle,at:epoch});
    return policeSearchArea(policeReports.get(id),p.wanted,knownByPolice);
  }
  function pursuitSnapshot(){
    const snapshot=pursuit.snapshot(time),area=pursuitArea();
    return area?{...snapshot,report:{x:area.x,y:area.y,enfer:isEnfer}}:snapshot;
  }
  function policeMap(){
    return {search:pursuitArea(),police:p.wanted?[...actors.filter(o=>isLawOfficer(o.type)&&!o.down),
      ...cars.filter(v=>isLawOfficer(v.driverRole)&&v.occupied)]:[]};
  }
  function dispatch(kind,scene=p,slot=0){
    const id='unit-'+kind+'-'+(net?.id||'self')+(slot?':'+slot:''),old=incidents.get(id);
    if(old){
      const officer=isLawOfficer(kind)&&npcShared.get(responderId(old,'foot'));
      const replaceAt=npcIsDead(officer)?officer.healthAt+(p.wanted>=3?30000:42000):old.started+(isEnfer?76000:42500);
      if(epoch<replaceAt)return;
    }
    const d={id,kind,x:scene.x,y:scene.y,angle:scene.angle||0,started:Math.round(epoch),level:p.wanted};
    incidents.set(id,d);emit('npc',d);
  }
  function dispatchPursuit(){
    if(life.down)return;
    const report=policeReports.get(net?.id||'self');
    for(const [role,slot] of responseUnits(p.wanted))dispatch(role,report||p,slot);
  }
  function recordAction(action){
    if(isEnfer&&!crimeHeardOrSeen(action,p,[...actors,...remotes,...cars.filter(v=>v.occupied||v.routeId)],clearSight))return;
    const id=net?.id||'self',lastReport=policeReports.get(id);
    const level=p.wanted,result=pursuit.add(action,time);
    p.wanted=result.level;searchOutsideSince=null;
    policeReports.set(id,{x:p.x,y:p.y,angle:p.angle,at:epoch});
    if(net?.id&&(level!==p.wanted||!lastReport||epoch-lastReport.at>1400||dist(lastReport,p)>15))emit('alert',{x:p.x,y:p.y,angle:p.angle,level:p.wanted});
    if(result.lastGain)wantedEvent={id:++actionNumber,action,points:Math.round(result.lastGain*10)/10};
    if(action==='destroy')dispatch('firefighter');
    if(['hitCivilian','hitOfficer','hitPlayer'].includes(action))dispatch('medic');
    dispatchPursuit();
  }
  function refreshProp(o){
    const maxHealth=propMaxHealth(o.type);
    if(!maxHealth)return;
    const base=soloProps.get(o.id)||confirmedProps.get(o.id);
    const before=base?.health??maxHealth;
    let pendingDamage=0;
    for(const item of pendingImpacts.values())if(item.prop.id===o.id&&item.predict)pendingDamage+=item.damage;
    // Keep the final thread and its collider until the world's lethal hit is confirmed.
    const health=before===0?0:Math.max(1,before-pendingDamage);
    const previous=propHealth.get(o.id);
    if(health===(previous?.health??maxHealth))return;
    if(health===0)destroyed.add(o.id);
    else if(previous?.health===0)destroyed.delete(o.id);
    if(health===maxHealth)propHealth.delete(o.id);
    else propHealth.set(o.id,{id:o.id,type:o.type,x:o.x,y:o.y,health,maxHealth});
    propDamageRevision++;
  }
  function rewardProp(id){
    if(rewardedProps.has(id))return false;
    rewardedProps.add(id);score+=10;return true;
  }
  function propEffect(kind,o,angle){
    if(dist(o,p)<125)view.effect(kind,o.x,o.y,angle||0,0,{type:o.type,health:o.health,maxHealth:o.maxHealth});
  }
  function settlePropImpact(impactId,broken){
    const item=pendingImpacts.get(impactId);
    if(!item)return;
    pendingImpacts.delete(impactId);refreshProp(item.prop);
    item.finish(!!broken&&rewardProp(item.prop.id));
  }
  function confirmProp(d){
    const maxHealth=propMaxHealth(d?.type);
    if(!maxHealth||!d.id||![d.x,d.y,d.health].every(Number.isFinite)||d.health<0||d.health>maxHealth)return false;
    if(d.health>=(confirmedProps.get(d.id)?.health??maxHealth))return false;
    confirmedProps.set(d.id,{id:d.id,type:d.type,x:d.x,y:d.y,health:d.health,maxHealth});
    refreshProp(d);return true;
  }
  function syncPropDamage(world){
    if(net?.status==='online'){
      if(soloProps.size){
        const previous=[...soloProps.values()];soloProps.clear();
        for(const item of previous)refreshProp(item);
      }
      for(const item of Object.values(world.propHealth||{}))confirmProp(item);
    }
    for(const id of world.destroyed||[])destroyed.add(id);
    for(const item of pendingImpacts.values())if(item.predict&&time>=item.expires){
      // A slow reply may still award the finishing hit after the provisional mark fades.
      item.predict=false;refreshProp(item.prop);
    }
  }
  function damageProp(o,amount,details,angle,finish){
    if(!softProp(o)||!o.id||destroyed.has(o.id)){finish(false);return;}
    const result=applyPropDamage(o.type,(soloProps.get(o.id)||confirmedProps.get(o.id))?.health,amount);
    if(!result?.damage){finish(false);return;}
    const prop={id:o.id,type:o.type,x:o.x,y:o.y};
    if(net?.status!=='online'){
      const record={...prop,...result};soloProps.set(o.id,record);refreshProp(o);
      propEffect(result.health===0?'propBreak':'propHit',record,angle);
      finish(result.health===0&&rewardProp(o.id));return;
    }
    const impactId='p'+Math.round(epoch).toString(36)+'-'+(++impactNumber).toString(36);
    const request={...prop,...details,damage:amount,angle,impactId};
    pendingImpacts.set(impactId,{prop,damage:amount,finish,predict:true,expires:time+5});
    if(emit('propDamage',request)===false){settlePropImpact(impactId,false);return;}
    refreshProp(prop);
    if(pendingImpacts.has(impactId))propEffect('propHit',propHealth.get(o.id)||{...prop,...result},angle);
  }
  function vandalism(broken){if(broken)recordAction('destroy');}
  function nextSeed(){return ((++impactSerial*32719)^Math.round(epoch))&65535;}
  function fallDirection(actor,preferred){
    const colliders=cars.filter(v=>dist(v,actor)<7).map(collisionBody);
    const opt={radius:.2,height:.4,destroyed,colliders};
    let best=preferred,clearance=0;
    for(const delta of [0,-.72,.72,-1.49,1.49,-2.25,2.25,Math.PI]){
      const heading=preferred+delta;let reach=.25;
      for(;reach<=1.65;reach+=.2){
        const q=offset(actor,heading,reach);
        if(contactAt(q.x,q.y,opt))break;
      }
      if(reach>1.65)return heading;
      if(reach>clearance){clearance=reach;best=heading;}
    }
    return best;
  }
  function rememberNpc(d,canonical=false){
    if(!d?.id||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
    const prev=npcShared.get(d.id),stamp=d.healthAt||d.stunnedUntil||0;
    if(!npcIsDead(d)&&(stamp+90000<epoch||(d.stunnedUntil<=epoch&&npcHealthAt(d,epoch)>=npcMaxHealth(d.type))))return;
    if(!prev||stamp>(prev.healthAt||prev.stunnedUntil||0)||(canonical&&stamp===(prev.healthAt||prev.stunnedUntil||0)))npcShared.set(d.id,d);
  }
  function hurtNpc(actor,amount,angle,force,strike=null,weaponId=null){
    const old=npcShared.get(actor.id),before=npcHealthAt(old,epoch,actor.type);
    if(before<=0)return false;
    const health=Math.max(0,before-amount),downUntil=health===0?epoch+6500:0,dead=health===0;
    let fall=old?.ragdoll?.until>epoch?old.ragdoll:null;
    if(downUntil||(!fall&&!strike&&!weaponId&&force>=.70))fall=impactEvent(epoch,fallDirection(actor,angle),force,downUntil?6500:680+force*840,nextSeed());
    const cause=strike?'melee':weaponId?'weapon':'traffic';
    const bleeding=downUntil?null:bleedingAfterHit(old?.bleeding,hitSeverity(cause,amount,weaponId),epoch);
    const update={id:actor.id,x:actor.x,y:actor.y,type:actor.type,angle:actor.angle,color:actor.color,vehicleType:actor.vehicleType,
      damage:amount,health,healthAt:epoch,threatX:p.x,threatY:p.y,downUntil,stunnedUntil:fall?.until||0,ragdoll:fall,bleeding,cause,...(dead?{dead}:{}),...(weaponId?{weapon:weaponId}:{})};
    if(strike){
      const landing=knockbackEnd(actor,angle,meleeMoves[strike.kind].push,WALKER_RADIUS);
      update.recoil={at:epoch,fromX:actor.x,fromY:actor.y,angle,force};
      Object.assign(update,landing,{swingAt:strike.started,swingKind:strike.kind});
      update.stunnedUntil=Math.max(update.stunnedUntil,epoch+recoilSeconds*1000);
    }
    npcShared.set(actor.id,update);emit('npc',update);
    const reaction=(strike||weaponId)&&reactionTo(actor,p,epoch,true);
    if(reaction)reactions.set(actor.id,{...reaction,attacker:net?.id||'self'});
    actor.health=health;actor.stunned=!!fall;actor.down=health===0;actor.dead=dead;actor.impact=1;actor.bleeding=bleeding;return true;
  }
  function trafficContact(v,person,margin=.1){
    const dx=person.x-v.x,dy=person.y-v.y,c=Math.cos(v.angle),s=Math.sin(v.angle),shape=vehicleSpec(v.type);
    return Math.abs(dx*c+dy*s)<shape.halfLength+margin&&Math.abs(dy*c-dx*s)<shape.halfWidth+margin;
  }
  function getAvailableDrops(){return availableDrops([...weaponDrops,...officerPickups()]);}
  function officerPickups(){
    if(!isEnfer)return [];
    const out=[];
    for(const npc of npcShared.values()){
      const drop=officerDrop(npc,epoch);
      if(drop)out.push(drop);
    }
    return out;
  }
  function tracker(){
    if(!trackedDrop)return null;
    const distance=Math.round(dist(p,trackedDrop));
    const angle=deltaAngle(yaw,Math.atan2(trackedDrop.y-p.y,trackedDrop.x-p.x));
    return {title:weaponLabels[trackedDrop.weapon],distance,angle:Math.round(angle*180/Math.PI)};
  }
  function availableDrops(list){
    const shared=net?.world?.().pickups||{};
    return list.filter(drop=>{
      const wait=pickupWait.get(drop.id);
      if(wait&&Math.max(wait.availableAt||0,wait.retryAt||0)<=epoch)pickupWait.delete(drop.id);
      return !(shared[drop.id]>epoch)&&!(wait?.availableAt>epoch);
    });
  }
  function pickupNotice(id,text){
    if(noticePickup!==id){noticePickup=id;onNotice(text);}
  }
  async function collect(drop){
    // One claim per item can be outstanding, including across temporary disconnects.
    pendingPickup.add(drop.id);
    publish();
    try{
      const receipt=await net.claimPickup(drop.id,drop.weapon);
      if(!isRunning)return;
      if(Number.isFinite(receipt?.availableAt)&&receipt.availableAt>epoch){
        pickupWait.set(drop.id,{availableAt:receipt.availableAt});
      }
      if(!receipt?.ok){
        if(receipt?.availableAt>epoch)pickupNotice(drop.id,'Un autre joueur a déjà ramassé cet objet.');
        else{
          pickupWait.set(drop.id,{retryAt:epoch+1700});
          pickupNotice(drop.id,'Ramassage en attente de connexion au monde partagé.');
        }
        return;
      }
      nearPickup=null;
      if(trackedDrop?.id===drop.id)trackedDrop=null;
      const isNew=!owned.has(drop.weapon);
      owned.add(drop.weapon);
      const total=authoritativeAmmo?.[drop.weapon]??ammoCapacity(drop.weapon);
      ammo[drop.weapon]=Math.min(total,weapons[drop.weapon].mag);reserve[drop.weapon]=total-ammo[drop.weapon];
      if(!authoritativeAmmo&&drop.weapon!=='pistol')reserve.pistol=Math.min(ammoCapacity('pistol')-ammo.pistol,reserve.pistol+24);
      if(isNew){
        equipOwned(drop.weapon);onLoadoutChange(ownedWeapons());
      }else if(weapon===drop.weapon)reloading=0;
      if(!(receipt.availableAt>epoch))pickupWait.set(drop.id,{availableAt:epoch+1700});
      onNotice(weaponLabels[drop.weapon]+(isNew?' · Arme ramassée et équipée.':' · Munitions récupérées.'));
      sendHud(true);
    }catch{
      if(!isRunning)return;
      pickupWait.set(drop.id,{retryAt:epoch+1700});
      pickupNotice(drop.id,'Ramassage en attente de connexion au monde partagé.');
    }finally{
      pendingPickup.delete(drop.id);
    }
  }
  function updatePickups(){
    if(!pickupCenter||dist(pickupCenter,p)>12){
      pickupCenter={x:p.x,y:p.y};pickupArea=nearbyWeaponDrops(p.x,p.y,115);
    }
    pickups=availableDrops([...pickupArea,...officerPickups().filter(drop=>dist(drop,p)<115)]);
    if(trackedDrop&&!availableDrops([trackedDrop]).length)trackedDrop=null;
    nearPickup=null;
    if(paused||car||passengerSeat||boarding||incapacitated()||!traversal.grounded||p.lift>.8){noticePickup=null;return;}
    let closest=null,closestDistance=pickupRadius;
    for(const drop of pickups){
      if(owned.has(drop.weapon)&&ammo[drop.weapon]+reserve[drop.weapon]>=ammoCapacity(drop.weapon)&&
         ammo.pistol+reserve.pistol>=ammoCapacity('pistol'))continue;
      const distance=dist(drop,p);
      if(distance<=closestDistance){closest=drop;closestDistance=distance;}
    }
    if(!closest){noticePickup=null;return;}
    const online=net?.status==='online'&&typeof net.claimPickup==='function';
    nearPickup={id:closest.id,weapon:closest.weapon,distance:Math.round(closestDistance*10)/10,online};
    if(!online){
      pickupNotice(closest.id,'Ramassage disponible à la reconnexion au monde partagé.');return;
    }
    if(pendingPickup.has(closest.id)||pickupWait.get(closest.id)?.retryAt>epoch)return;
    void collect(closest);
  }
  function clearAimLock(){
    aimLock=null;markImpactUntil=0;
    if(lockPoint){onAimLock(null);lockPoint=null;}
  }
  function drawAimLock(){
    if(!aimLock)return;
    let target=aimLock;
    if(aimLock.hitKind==='npc')target=actors.find(a=>a.id===aimLock.id&&!a.stunned);
    if(aimLock.hitKind==='peer')target=remotes.find(a=>a.id===aimLock.id);
    if(aimLock.hitKind==='vehicle')target=cars.find(v=>v.id===aimLock.id)||remotes.find(v=>v.isCar&&v.id===aimLock.id);
    if(aimLock.hitKind==='prop'&&destroyed.has(aimLock.id))target=null;
    // A falling character or vanished prop still gets a short, visible confirmation at its impact point.
    if(!target&&time<markImpactUntil)target=aimLock;
    if(!target){clearAimLock();return;}
    const angle=Math.atan2(target.y-p.y,target.x-p.x);
    if(Math.abs(deltaAngle(yaw,angle))>13*Math.PI/180){clearAimLock();return;}
    if(target!==aimLock&&time>=nextLockCheck){
      nextLockCheck=time+.12;
      if(shotScene(weapons[weapon].range).trace(angle).hit?.id!==target.id){clearAimLock();return;}
    }
    aimLock.x=target.x;aimLock.y=target.y;aimLock.lift=target.lift;
    const point=view.projectTarget?.(target.x,target.y,targetHeight(aimLock));
    if(!point){clearAimLock();return;}
    if(!lockPoint||Math.abs(point.x-lockPoint.x)+Math.abs(point.y-lockPoint.y)>.0008){
      lockPoint={x:point.x,y:point.y};onAimLock(lockPoint);
    }
  }
  function resetInputs(){
    mobileHandbrake=false;
    crouched=false;traversal.clearInput();swing=null;swingQueued=meleeHeld=false;chainUntil=-1;keys.clear();fireHeld=touchFireHeld=sprintHeld=false;stickX=stickY=aimX=aimY=mobileSteer=mobileThrottle=mobileLift=0;
    drag=null;driftX=driftY=0;aimPointer=null;shotFacingUntil=-1;meleeCameraAim=false;clearAimLock();
  }
  function hasDriver(v){return !v.noDriver&&!!(v.routeId||v.occupied&&!v.owner);}
  function clearDoor(v,from,clearance,far=false){
    const hull={radius:PLAYER_RADIUS,destroyed,colliders:obstacles,ignoreId:v.id};
    const doors=vehicleDoorways(v,clearance).filter(q=>!contactAt(q.x,q.y,hull));
    return doors.sort((a,b)=>(dist(a,from)-dist(b,from))*(far?-1:1))[0];
  }
  function cancelBoarding(message){
    if(!boarding)return;
    boarding=null;queuedCameraCycle=0;vx=vy=0;p.moving=false;
    if(message)onNotice(message);
    sendHud(true);
  }
  function noteDisplacedDriver(record){
    const e=record.eject,id=record.id;
    if(!e||epoch-e.at>=exitDriverFor||dist(e,p)>135||displacedDrivers.get(id)?.at>=e.at)return;
    displacedDrivers.set(id,{...e,id:'exit-'+id,type:'human',health:100});
  }
  function closestBoardableCar(onlyTrain=false){
    if(exitSlide||!traversal.grounded||p.lift>.5)return null;
    let closest=null,best=4.4;
    for(const v of [...remotes.filter(e=>e.isCar),...cars]){
      if(onlyTrain&&!isTrain(v.type))continue;
      if(v.parkingOwner&&v.parkingOwner!==myParkingOwner())continue;
      if(isTrain(v.type)&&(!atRailStation(railDistance(v.x,v.y))||Math.abs(v.speed||0)>.4||v.automatic&&!v.doors))continue;
      if(retired(vehicleId(v))||vehicleWear.get(vehicleId(v))?.fireAt||(isAircraft(v.type)?heightAboveLanding(v):(v.lift||0))>.35||v.flightPath&&!v.landed||v.roadCoast&&v.moving)continue;
      if(v.peer&&(vehicleSpec(v.type).openSeat||Math.abs(v.speed)>2.5||cabinPassengers.has(v.vehicle.id)))continue;
      if(!v.peer&&v.owner&&v.occupied||vehicleHealth(v)===0||dist(p,v)>vehicleSpec(v.type).halfLength+5)continue;
      for(const door of vehicleDoorways(v)){
        const distance=dist(door,p);
        if(distance<best){best=distance;closest=v;}
      }
    }
    return closest;
  }
  function boardTrainDriver(){
    const v=closestBoardableCar(true);
    if(!v||v.peer||car||passengerSeat||boarding)return;
    if(net?.status==='online')boarding={vehicle:v,started:time};
    finishBoarding(v);
  }
  function passengerExit(){
    if(!passengerSeat)return null;
    const carPose={...p,type:passengerSeat.type};
    const hull={radius:PLAYER_RADIUS,destroyed,colliders:obstacles.filter(e=>e.id!==passengerSeat.driver&&e.id!==passengerSeat.car&&e.vehicleId!==passengerSeat.car)};
    const side=q=>(q.y-p.y)*Math.cos(p.angle)-(q.x-p.x)*Math.sin(p.angle);
    return vehicleDoorways(carPose,.90).sort((a,b)=>side(b)-side(a)).find(q=>!contactAt(q.x,q.y,hull));
  }
  function startAircraftJump(id,type,side){
    const angle=p.angle,c=Math.cos(angle),s=Math.sin(angle),worldZ=baseTerrainHeight(p.x,p.y)+p.lift+.42;
    const baseX=p.x,baseY=p.y,vertical=p.verticalSpeed||0;
    // Step out next to the cabin, retaining the current world height over changing terrain.
    const doors=vehicleDoorways({...p,type},1.10);
    const exit=doors[side];
    const clear=[exit,doors[1-side]].find(q=>!contactAt(q.x,q.y,{radius:PLAYER_RADIUS,footWorldZ:worldZ,bodyHeight:1.55,destroyed,ignoreId:id}));
    if(clear){p.x=clear.x;p.y=clear.y;}
    const outward=Math.sign((p.y-baseY)*c-(p.x-baseX)*s)||1;
    vx=c*speed-s*outward*2.5;vy=s*speed+c*outward*2.5;
    speed=steer=0;p.moving=true;p.sprinting=false;popTick=networkTick=0;
    resetInputs();traversal.leaveAircraft(Math.max(.02,worldZ-terrainHeight(p.x,p.y)),vertical+1.1,vx,vy);
    onNotice(type==='airship'?'Saut du dirigeable':'Saut de l’hélicoptère');publish();sendHud(true);
  }
  function abandonAircraft(){
    const {id,type}=car,options={destroyed,colliders:obstacles,ignoreId:id};
    const flightPath=planAutorotation({...p,speed,type},{ground:baseTerrainHeight,deck:aircraftDeck,water:(x,y)=>swimmingSurface(x,y,true)},
      (x,y,z)=>aircraftObstructed(type,{x,y},p.angle,z,contactAt,options));
    const record={...car,x:p.x,y:p.y,angle:p.angle,lift:p.lift,speed,moving:true,occupied:false,owner:'',
      flightAt:epoch,flightPath,expiresAt:epoch+(flightPath.length-1)*flightSampleMs+abandonedFor};
    carsShared.set(id,{...record,protect:epoch+1600});emit('vehicle',record);
    suspension=null;travelClaim=null;car=null;startAircraftJump(id,type,0);
  }
  function leaveRoadVehicle(exit,velocityX,velocityY){
    const nx=-Math.sin(p.angle),ny=Math.cos(p.angle),side=Math.sign((exit.x-p.x)*nx+(exit.y-p.y)*ny)||1;
    const pace=Math.hypot(velocityX,velocityY);
    p.x=exit.x;p.y=exit.y;speed=steer=0;traversal.reset();resetInputs();
    p.moving=pace>.55;p.sprinting=false;vx=vy=0;
    if(pace>.55){
      const tumble=pace>=tumbleSpeed;
      if(tumble){
        damage(Math.min(90,Math.ceil((pace-5)*.9)),Math.atan2(velocityY,velocityX),Math.min(1,.42+pace*.012),'fall');
        selfRecoil=null; // The exit slip supplies the horizontal impulse.
      }
      const outward=Math.min(2.9,.40+pace*.12);
      vx=velocityX+nx*side*outward;vy=velocityY+ny*side*outward;
      exitSlide={tumble,remaining:tumble?1.35:.49};p.motion='dismount';
      p.moving=true;contactLock=Math.max(contactLock,.24);
    }
    popTick=networkTick=0;publish();sendHud(true);
  }
  function releasePassenger(){
    if(!passengerSeat)return;
    if(passengerSeat.rail){
      const train=railTrain(passengerSeat.car),exit=railExit(train,passengerSeat.d);
      if(!exit){onNotice('Les deux côtés sont obstrués.');return;}
      passengerSeat=seatPending=null;p.lift=0;cameraSnap=true;
      leaveRoadVehicle(exit,vx,vy);return;
    }
    if(isAircraft(passengerSeat.type)&&heightAboveLanding(p)>.16){
      const {car:id,type}=passengerSeat;passengerSeat=null;seatPending=null;startAircraftJump(id,type,1);return;
    }
    if(!isAircraft(passengerSeat.type)&&seatPending?.leave&&Math.abs(speed)>.55){
      const exit=passengerExit();
      if(exit){
        passengerSeat=null;seatPending=null;leaveRoadVehicle(exit,vx,vy);return;
      }
    }
    const site=isAircraft(passengerSeat.type)&&p.lift>.35?airfields.find(s=>s.type===passengerSeat.type):null;
    const exit=site?travelSpot(site.x,site.y,site.angle,null,passengerSeat.driver,16):passengerExit()||travelSpot(p.x,p.y,p.angle,null,passengerSeat.driver,12);
    passengerSeat=null;seatPending=null;speed=vx=vy=0;traversal.reset();p.moving=p.sprinting=false;
    if(exit){p.x=exit.x;p.y=exit.y;}
    resetInputs();publish();sendHud(true);
  }
  function railExit(train,d){
    const preferred=railPlatform(train,d),opposite=railPlatform({...train,track:-train.track},d);
    const geometry={radius:PLAYER_RADIUS,destroyed,colliders:obstacles,ignoreId:train.id};
    return [preferred,opposite].find(q=>!contactAt(q.x,q.y,geometry))||
      travelSpot(preferred.x,preferred.y,preferred.angle,null,train.id,16);
  }
  function dropCar(denied=false,rollingExit=false){
    if(!car)return true;
    if(railRide){
      const {train,d}=railRide,exit=railExit(train,d);
      if(!exit){onNotice('Les deux côtés sont obstrués.');return false;}
      if(!denied){
        const record={...car,x:p.x,y:p.y,angle:p.angle,occupied:false,owner:'',moving:speed>.13,speed,railAt:epoch,expiresAt:epoch+604_800_000};
        carsShared.set(car.id,{...record,protect:epoch+1600});emit('vehicle',record);
      }
      railRide=car=null;p.lift=0;cameraSnap=true;
      leaveRoadVehicle(exit,rollingExit?vx:0,rollingExit?vy:0);return true;
    }
    if(!denied&&isAircraft(car.type)&&(heightAboveLanding(p)>.16||Math.abs(speed)>1.5)){
      onNotice('Pose l’appareil sur un terrain dégagé pour descendre.');return false;
    }
    const exits=vehicleDoorways({...p,type:car.type},.87);
    const geometry={radius:PLAYER_RADIUS,destroyed,colliders:obstacles,ignoreId:car.id};
    const emergencyHome=denied&&isAircraft(car.type)&&p.lift>.35&&airfields.find(field=>field.type===car.type);
    const clear=emergencyHome?travelSpot(emergencyHome.x,emergencyHome.y,emergencyHome.angle,null,car.id,25):
      exits.find(q=>!contactAt(q.x,q.y,geometry));
    if(!clear&&!denied){onNotice('Les portières sont bloquées. Avance un peu.');return false;}
    if(rollingExit&&clear&&!isAircraft(car.type)&&Math.abs(speed)>.55){
      const id=car.id;
      const velocityX=Math.abs(vx)+Math.abs(vy)>.1?vx:Math.cos(p.angle)*speed;
      const velocityY=Math.abs(vx)+Math.abs(vy)>.1?vy:Math.sin(p.angle)*speed;
      const geometry={...dimensions(car),angle:p.angle,destroyed,ignoreId:id,colliders:obstacles};
      const roadCoast=planRoadCoast(p,velocityX,velocityY,epoch,(x,y)=>contactAt(x,y,geometry));
      if(!travelClaim||travelClaim.sent){
        const record={...car,x:p.x,y:p.y,angle:p.angle,speed,occupied:false,owner:'',moving:!!roadCoast,roadCoast,
          expiresAt:(roadCoast?.until||epoch)+abandonedFor};
        carsShared.set(id,{...record,protect:epoch+1600});emit('vehicle',record);
      }
      suspension=null;travelClaim=null;car=null;lateralSpeed=collisionSpin=0;
      leaveRoadVehicle(clear,velocityX,velocityY);return true;
    }
    const bay=!denied&&rollingExit?reservedBay():null;
    if(!denied&&(!travelClaim||travelClaim.sent)){const record={...car,x:p.x,y:p.y,angle:p.angle,...(isAircraft(car.type)?{lift:p.lift}:{}),moving:false,occupied:false,speed:0,owner:'',
      ...(bay?{parkingSlot:bay.id,parkingOwner:myParkingOwner()}:{}),expiresAt:epoch+(bay?parkingLease:abandonedFor)};
      carsShared.set(car.id,{...record,protect:epoch+1600});emit('vehicle',record);}
    if(bay)onNotice('Véhicule garé · '+bay.lot.name+' · Repère sur la carte');
    if(clear){p.x=clear.x;p.y=clear.y;}
    traversal.reset();suspension=null;travelClaim=null;car=null;speed=vx=vy=steer=0;p.moving=false;popTick=0;publish();return true;
  }
  function resetPopulation(){
    exitSlide=null;
    lastShunt.clear();displacedCars.clear();lateralSpeed=collisionSpin=0;
    boarding=null;queuedCameraCycle=0;displacedDrivers.clear();officerFiring.clear();
    selfRecoil=null;witnessedSwings.clear();witnessedRecoils.clear();
    witnessedShots.clear();
    traffic.reset();trafficHorns.reset();crowd.reset();drives=[];trafficSnapshot=null;actors=[];cars=[];routeActors=[];routeCars=[];
    trafficPeers={checkpoints:[],followers:new Set()};trafficTick=0;popTick=0;
  }
  function placeAt(place){
    const angle=place.angle??SPAWN.angle;
    const clear=travelSpot(place.x,place.y,angle,null);
    if(!clear){onNotice('Le point d’arrivée est encombré.');return false;}
    if(passengerSeat){onNotice('Descends du véhicule pour changer de quartier.');return false;}
    if(car&&!dropCar())return false;
    acceptShotsFrom=Math.max(acceptShotsFrom,Math.floor(net?.serverTime?.()??epoch));
    traversal.reset();p.x=clear.x;p.y=clear.y;p.angle=angle;p.moving=false;p.sprinting=false;
    yaw=p.angle;pitch=.13;vx=vy=speed=turn=0;cameraSnap=true;popTick=trafficTick=mapTick=hudTick=0;nearCar=null;
    routeClock=0;resetPopulation();resetInputs();publish();return true;
  }
  function damage(amount,angle=p.angle,force=0,cause='weapon',moveName=null){
    const guard=guardedFraction(p.motion,p.angle,angle,cause);
    if(guard<1){amount=Math.ceil(amount*guard);force*=guard;onNotice('Coup paré');}
    if(life.down||epoch<life.snapshot().protectedUntil)return;
    const absorbed=armorLayer.absorb(amount,cause);
    if(absorbed){
      amount=Math.max(0,amount-absorbed);impact=.5;tone(235,.10,'triangle',.04,125);sendHud(true);
      if(!amount)return;
    }
    const direction=(!car&&force>=.18)||amount>=life.health?fallDirection(p,angle):angle;
    if(!life.hurt(amount,{at:epoch,angle:direction,force,cause,weapon:cause==='weapon'?moveName:undefined,canFall:!car&&!passengerSeat,seed:nextSeed()}))return;
    if(!car&&!passengerSeat&&(cause==='melee'&&meleeMoves[moveName]||force>=.24)){
      const push=cause==='melee'?meleeMoves[moveName].push:Math.min(1.65,force*(cause==='traffic'?1.72:.92));
      const landing=knockbackEnd(p,direction,push,PLAYER_RADIUS);
      selfRecoil={at:epoch,angle:direction,force,fromX:p.x,fromY:p.y,toX:landing.x,toY:landing.y,progress:0};
    }
    p.health=life.health;impact=1;tone(120,.14,'triangle',.05,60);
    if(life.down&&passengerSeat){emit('seat',{leave:true});releasePassenger();}
    if(life.down&&car){
      if(!travelClaim||travelClaim.sent){
        const home=isAircraft(car.type)&&p.lift>.35&&airfields.find(field=>field.type===car.type);
        const parked={...car,x:home?home.x:p.x,y:home?home.y:p.y,angle:home?home.angle:p.angle,moving:false,occupied:false,speed:0,owner:'',expiresAt:epoch+abandonedFor};
        carsShared.set(car.id,{...parked,protect:epoch+1500});emit('vehicle',parked);
      }
      dropCar(true);
    }
    if(incapacitated()){if(!boarding?.sent)cancelBoarding();resetInputs();traversal.interrupt();reloading=0;vx=vy=speed=0;p.moving=p.sprinting=false;}
    if(life.down){dispatch('medic');onNotice('K.O. · Les secours sont en route.');}
    publish();sendHud(true);
  }
  function useMedkit(){
    if(!life.aid(epoch)){onNotice(life.health===100?'Ta santé est au maximum.':'Approche un ambulancier pour obtenir une trousse.');return;}
    p.health=life.health;tone(520,.16,'sine',.04,730);publish();sendHud(true);
  }
  function takeSeat(v,record){
    crouched=false;traversal.reset();suspension=null;car={id:v.id,type:v.type||'car',color:v.color,...(v.skin?{skin:v.skin}:{})};
    displacedCars.delete(v.id);lateralSpeed=collisionSpin=0;
    p.x=v.x;p.y=v.y;p.angle=v.angle||0;if(isAircraft(car.type))p.lift=v.lift||0;speed=0;vx=vy=stickX=stickY=mobileSteer=mobileThrottle=0;
    if(isTrain(car.type)){
      const train=railTrain(car.id),d=railDistance(v.x,v.y);
      railRide={train,d,direction:Math.cos(p.angle-railPose(train,d,1).angle)<0?-1:1};p.lift=.18;
    }
    p.moving=false;impact=.15;freeLookUntil=0;popTick=0;boarding=null;
    yaw=p.angle;pitch=.13;cameraSnap=true;
    if(queuedCameraCycle){cycleRideCamera(queuedCameraCycle);queuedCameraCycle=0;}
    carsShared.set(car.id,{...record,protect:epoch+1500});publish();
    if(Object.values(services).includes(v.type))recordAction('stealService');
    else if(record.eject)recordAction('stealVehicle');
    tone(95,.19,'triangle',.04,235);
    onNotice(vehicleSpec(car.type).label+(isTrain(car.type)?' · ↑ Traction · ↓ Frein · R Inverser à l’arrêt':
      isAircraft(car.type)?' · R pour monter, F pour descendre.':' · Haut pour accélérer, gauche et droite pour braquer.'));
    sendHud(true);
  }
  function finishBoarding(v,eject){
    const record={id:v.id,type:v.type||'car',color:v.color,skin:v.skin,x:v.x,y:v.y,
      angle:v.angle||0,...(isAircraft(v.type)?{lift:v.lift||0}:{}),moving:false,occupied:true,owner:net?.id||'local',...(eject?{eject}:{})};
    if(boarding&&net?.status==='online'){
      // Keep the player on foot until the shared world assigns the seat.
      boarding.sent=epoch;publish();
      if(emit('vehicle',record)!==false)return;
      cancelBoarding('Connexion au véhicule interrompue.');return;
    }
    if(eject){
      record.eject={...eject,at:epoch};
      noteDisplacedDriver(record);boarding.accepted=record;boarding.exitUntil=time+.38;
    }else{emit('vehicle',record);takeSeat(v,record);}
  }
  function stepBoarding(dt){
    if(!boarding)return false;
    const {vehicle,door,exit,started,sent}=boarding;
    if(boarding.accepted){
      if(time>=boarding.exitUntil)takeSeat(vehicle,boarding.accepted);
      return true;
    }
    if(sent){
      if(epoch-sent>5000)cancelBoarding('La portière ne répond plus. Réessaie.');
      return true;
    }
    if(paused||incapacitated()||selfRecoil||vehicleHealth(vehicle)===0){
      cancelBoarding();return false;
    }
    const dx=door.x-p.x,dy=door.y-p.y,reach=Math.hypot(dx,dy);
    if(reach>.09){
      const rate=Math.min(1,4.25*dt/reach);
      const next=moveBody(p.x,p.y,dx*rate,dy*rate,{radius:PLAYER_RADIUS,destroyed,colliders:obstacles,ignoreId:vehicle.id});
      p.x=next.x;p.y=next.y;p.angle=Math.atan2(dy,dx);p.moving=true;p.walk+=dt*9;
    }else{
      p.angle=Math.atan2(vehicle.y-p.y,vehicle.x-p.x);p.moving=false;
      if(time-started>.65){
        const eject={...exit,angle:Math.atan2(exit.y-vehicle.y,exit.x-vehicle.x)};
        finishBoarding(vehicle,eject);
      }
    }
    if(boarding&&!boarding.sent&&time-started>1.45)cancelBoarding('La portière est bloquée.');
    return true;
  }
  function interact(onlyTrain=false){
    if(paused||exitSlide||incapacitated()||time-actionAt<.27)return;
    actionAt=time;unlock();
    if(seatPending&&epoch-seatPending.at<5500)return;
    if(passengerSeat){
      if(passengerSeat.rail){releasePassenger();return;}
      if(isAircraft(passengerSeat.type)&&heightAboveLanding(p)>.16){
        if(emit('seat',{leave:true}))seatPending={at:epoch,leave:true};
        return;
      }
      if((isAircraft(passengerSeat.type)?heightAboveLanding(p):p.lift)>.35||isAircraft(passengerSeat.type)&&Math.abs(speed)>2.5){onNotice('Attends que le véhicule soit au sol et l’appareil arrêté.');return;}
      if(!passengerExit()){onNotice('La portière est bloquée.');return;}
      if(emit('seat',{leave:true}))seatPending={at:epoch,leave:true};
      return;
    }
    if(boarding){if(!boarding.sent)cancelBoarding('Prise du véhicule annulée.');return;}
    if(car){
      if(isAircraft(car.type)&&heightAboveLanding(p)>.16){abandonAircraft();return;}
      if(!isAircraft(car.type)&&p.lift>.35){onNotice('Attends que la voiture retouche le sol.');return;}
      if(dropCar(false,true))tone(165,.12);return;
    }
    if(!traversal.grounded||p.lift>.5)return;
    const v=closestBoardableCar(onlyTrain);
    if(!v){onNotice('Approche-toi d’une portière pour monter.');return;}
    if(isTrain(v.type)){
      passengerSeat={rail:true,car:vehicleId(v),type:v.type,d:railDistance(v.x,v.y),direction:v.direction||1};
      resetInputs();traversal.reset();Object.assign(p,{x:v.x,y:v.y,angle:v.angle,lift:.18});yaw=p.angle;
      cameraSnap=true;popTick=0;publish();sendHud(true);onNotice('À bord · E pour descendre');return;
    }
    if(v.peer){
      if((isAircraft(v.type)?heightAboveLanding(v):(v.lift||0))>.18){onNotice('Attends l’atterrissage.');return;}
      if(emit('seat',{car:v.vehicle.id,driver:v.id})){seatPending={at:epoch};onNotice('Tu ouvres la portière passager…');}
      return;
    }
    if(!hasDriver(v)){finishBoarding(v);return;}
    if(Math.abs(v.speed||0)>8){onNotice('Le véhicule roule trop vite.');return;}
    const door=clearDoor(v,p,.63);
    let exit=door&&clearDoor(v,door,.94,true);
    if(door&&(!exit||dist(exit,door)<1.28)){
      const angle=v.angle||0,c=Math.cos(angle),s=Math.sin(angle);
      const geometry={radius:WALKER_RADIUS,destroyed,colliders:obstacles,ignoreId:v.id};
      exit=[-1.55,1.55].map(d=>({x:door.x+c*d,y:door.y+s*d})).find(q=>!contactAt(q.x,q.y,geometry));
    }
    if(!door||!exit||dist(p,door)>3.2){
      onNotice('Approche-toi d’une portière dégagée.');return;
    }
    resetInputs();vx=vy=0;
    const heading=v.angle||0;
    const side=Math.sign((door.y-v.y)*Math.cos(heading)-(door.x-v.x)*Math.sin(heading));
    boarding={vehicle:{...v,moving:false,speed:0},door,exit,side,started:time};
    tone(180,.12,'triangle',.04,105);onNotice('Le conducteur descend…');sendHud(true);
  }
  let peerRoster=[],lastRosterRevision;
  function receivePeerSnapshots(){
    if(!net?.peers)return;
    const revision=net.rosterRevision;
    if(revision!==undefined && revision===lastRosterRevision)return;
    lastRosterRevision=revision;
    peerRoster=net.peers()||[];
    const members=net.players?.()||peerRoster;
    for(const [id,door] of openedDoors)if(epoch-door.at>920)openedDoors.delete(id);
    const previousSeats=new Set(cabinPassengers.keys());
    cabinPassengers.clear();
    for(const member of members)if(member.passenger){
      const key=member.passenger.car;
      cabinPassengers.set(key,member);
      if(!previousSeats.delete(key)&&seatBaseline)openedDoors.set(key,{at:epoch,side:1});
    }
    if(seatBaseline)for(const key of previousSeats)openedDoors.set(key,{at:epoch,side:1});
    seatBaseline=members.length>0;
    const assigned=members.find(member=>member.id===net.id)?.passenger;
    const coasting=assigned?.coasting&&(net.world?.()?.vehicles?.[assigned.car]||carsShared.get(assigned.car));
    if(coasting?.flightPath||coasting?.roadCoast){
      passengerSeat={...assigned,type:coasting.type};
    }
    const driver=assigned&&peerRoster.find(member=>member.id===assigned.driver&&member.vehicle?.id===assigned.car);
    if(driver&&(!passengerSeat||passengerSeat.driver!==assigned.driver)&&!incapacitated()){
      passengerSeat={...assigned,type:driver.vehicle.type};seatPending=null;resetInputs();traversal.reset();
      p.x=driver.x;p.y=driver.y;yaw=p.angle=driver.angle;cameraSnap=true;
      onNotice('À bord avec '+driver.name+' · Utilise la commande véhicule pour sortir.');sendHud(true);
    }else if(!driver&&!assigned?.coasting&&passengerSeat&&!passengerSeat.rail){releasePassenger();}

    const present=new Set();
    for(const d of peerRoster){
      if(!Number.isFinite(d.x)||!Number.isFinite(d.y))continue;
      present.add(d.id);
      let e=peers.get(d.id);
      if(!e){e={id:d.id,x:d.x,y:d.y,angle:d.angle||0,walk:0};peers.set(d.id,e);}
      recordPeerMotion(e,d,epoch);
    }
    for(const [id,peer] of peers){
      if(present.has(id))continue;
      const v=peer.data?.vehicle,parked=v&&carsShared.get(v.id);
      if(isTrain(v?.type)&&parked?.occupied&&parked.owner===id){
        const at=peer.data.updatedAt??epoch;
        carsShared.set(v.id,{...parked,...v,x:peer.data.x,y:peer.data.y,angle:peer.data.angle,
          owner:'',occupied:false,previousOwner:id,lastSeen:epoch,railAt:at,expiresAt:epoch+604_800_000});
      }
      if(isAircraft(v?.type)&&peer.data.lift>.35&&parked?.occupied&&parked.owner===id){
        const home=airfields.find(field=>field.type===v.type);
        Object.assign(parked,{x:home.x,y:home.y,angle:home.angle,lift:0,bank:0,carPitch:0,
          owner:'',occupied:false,previousOwner:id,lastSeen:epoch,expiresAt:epoch+disconnectedFor});
      }
      peers.delete(id);
    }
  }
  function syncPeers(){
    const roster=peerRoster;
    if(!arrivalChecked&&net?.status==='online'){
      arrivalChecked=true;
      if(!car&&dist(p,SPAWN)<.75){
        const clear=travelSpot(p.x,p.y,p.angle,null);
        if(clear&&(clear.x!==p.x||clear.y!==p.y)){p.x=clear.x;p.y=clear.y;traversal.reset();cameraSnap=true;publish();}
      }
    }
    const joinedAt=net?.players?.().find(member=>member.id===net?.id)?.joinedAt??Infinity;
    trafficPeers=receiveTraffic(roster,{x:p.x,y:p.y,id:net?.id||'self',joinedAt},drives,epoch,trafficVehicleAt,sampleTrafficRoute);
    const world=net?.world?.()||{};
    settleTravelClaim(roster,world);
    syncPropDamage(world);
    for(const [id,until] of Object.entries(world.retiredVehicles||{}))if(until>epoch&&!retired(id))retireVehicle(id,until);
    for(const wear of Object.values(world.vehicleDamage||{}))receiveChassis(wear);
    for(const [id,d] of Object.entries(world.vehicles||{})){
      if(retired(id))continue;
      const current=carsShared.get(id);
      if(!current||!(current.protect>epoch)){
        const merged={...d,lastSeen:d.lastSeen||current?.lastSeen||epoch};
        if(!current?.occupied&&current?.expiresAt>0&&d.occupied&&d.owner===current.previousOwner&&merged.lastSeen<=current.lastSeen)continue;
        carsShared.set(id,merged);
      }
    }
    for(const [id,d] of Object.entries(world.npcs||{})){if(d.kind){if(d.started>epoch-(isEnfer?77000:34000)&&(!incidents.has(id)||incidents.get(id).started<d.started))incidents.set(id,d);}
      else rememberNpc(d);}
  }
  function updateRemote(dt){
    remotes=[];let shadowCars;
    const viewAt=peerViewTime(epoch),gaitBlend=blend(7.5,dt);
    for(const e of peers.values()){
      const d=retired(e.data.vehicle?.id)?{...e.data,vehicle:null,moving:false,speed:0}:e.data;
      if(d.passenger||d.railRider)continue;
      if(dist(d,p)>PEER_RANGE){e.x=d.x;e.y=d.y;e.angle=d.angle||0;continue;}
      const pose=readPeerMotion(e,viewAt);
      e.x=pose.x;e.y=pose.y;
      const snap=!!e.snapPose;
      if(snap){e.angle=d.angle||0;e.snapPose=false;}
      const elapsed=Math.max(0,(epoch-(d.updatedAt||epoch))/1000);
      const verticalHorizon=Math.min(elapsed,.10);
      const moving=!!d.moving&&elapsed<.55;
      const desiredSpeed=moving?(Number.isFinite(d.speed)?Math.abs(d.speed):d.sprinting?5.6:3.1):0;
      e.gaitSpeed=snap||e.gaitSpeed==null?desiredSpeed:e.gaitSpeed+(desiredSpeed-e.gaitSpeed)*gaitBlend;
      if(e.gaitSpeed>.025 && !d.vehicle && !['jump','fall','vault','climb'].includes(d.motion))e.walk+=dt*e.gaitSpeed*3.25;
      if(Number.isFinite(d.stride)){
        e.stride=snap||e.stride==null?d.stride:e.stride+(d.stride-e.stride)*gaitBlend;
      }else e.stride=undefined;
      const lift=Math.max(0,(d.lift||0)+(['jump','fall','carAir'].includes(d.motion)?(d.verticalSpeed||0)*verticalHorizon:0));
      e.lift=snap||e.lift==null?lift:e.lift+(lift-e.lift)*blend(18,dt);
      let supportHeight=0;
      if(e.lift>.03&&!d.vehicle){
        shadowCars??=cars.filter(v=>!v.moving&&!v.routeId).map(collisionBody);
        const margin=['idle','walk','run','land'].includes(d.motion)?PLAYER_RADIUS:0;
        supportHeight=Math.min(e.lift,supportAt(e.x,e.y,e.lift+.045,{destroyed,colliders:shadowCars},margin).top);
      }
      const phase=clamp((d.motionPhase||0)+(['jump','fall','vault','climb'].includes(d.motion)?verticalHorizon:0),0,1);
      e.phase=e.motion===d.motion&&e.phase!=null?e.phase+(phase-e.phase)*blend(18,dt):phase;e.motion=d.motion;
      const fallen=!d.vehicle&&ragdollPose(d.ragdoll,d.angle||0,epoch);
      const down=d.downUntil>epoch||d.health===0;
      const seen=witnessedSwings.get(d.id);
      const animated=seen&&(!d.melee||seen.started>=d.melee.started)?seen:d.melee;
      const attack=animated&&meleeMoves[animated.kind],punchPhase=attack?Math.max(0,epoch-(animated.playAt??animated.started))/(1000*attack.duration):1;
      const shot=witnessedShots.get(d.id);
      const shooting=!d.vehicle&&!down&&!fallen&&shot&&epoch-shot.at<200;
      let desiredAngle=d.angle||0;
      if(!d.vehicle&&punchPhase<1){
        const reported=d.melee?.started===animated.started?d.melee.angle:null;
        if(Number.isFinite(reported))desiredAngle=reported;
        else if(Number.isFinite(animated.angle)&&!(d.updatedAt>animated.started+140))desiredAngle=animated.angle;
      }
      if(!d.vehicle&&punchPhase<1){
        if(e.swingAt!==animated.started){e.swingAt=animated.started;e.swingFrom=e.angle;}
        const t=Math.min(1,punchPhase*attack.duration/attack.contact);
        e.angle=e.swingFrom+deltaAngle(e.swingFrom,desiredAngle)*t*t*(3-2*t);
      }else e.angle=shooting?shot.angle:turnTo(e.angle,desiredAngle,12,dt);
      const reaction=witnessedRecoils.get(d.id);
      const recoil=recoilPhase(reaction&&(!d.recoil||reaction.at>d.recoil.at)?reaction:d.recoil,epoch);
      const firePose=shooting?Math.max(0,1-(epoch-shot.at)/215):(d.shooting&&elapsed<.20 ? .75 : 0);
      remotes.push({...d,...(d.vehicle||{}),weapon:shooting?shot.kind:d.weapon,bleeding:down?null:activeBleeding(d.bleeding,epoch),ragdoll:fallen,stunned:!!fallen||down,down,id:d.id,peer:true,driverSkin:d.color,name:d.name,type:d.vehicle?.type||'fox',x:e.x,y:e.y,viewAt:Math.round(pose.at),angle:e.angle,isCar:!!d.vehicle,
        melee:!down&&!fallen&&!d.vehicle&&punchPhase<1?{kind:animated.kind,phase:punchPhase}:null,recoil,
        lift:e.lift,supportHeight,stride:e.stride,speed:d.vehicle?(moving?d.speed:0):e.gaitSpeed,motionPhase:e.phase,moving,move:moving,fire:firePose,walk:e.walk,bubble:bubbles.get(d.id)?.symbol});
    }
  }
  const dispatchStates=new WeakMap();
  function serviceResponse(d,t,dt=1/60,trafficBlockers=[]){
    const age=(epoch-d.started)/1000;
    const role=d.kind,type=services[role];
    if(age<0||age>(isEnfer?76:42.5)||!type||dist(d,p)>350)return;
    const vehicleId=responderId(d,'car'),footId=responderId(d,'foot');
    const injury=npcShared.get(footId);
    if(retired(vehicleId)||vehicleWear.get(vehicleId)?.fireAt||vehicleWear.get(vehicleId)?.hp===0)return;
    if(npcIsDead(injury)){
      const vehicle=dispatchStates.get(d)?.vehicle;
      if(vehicle&&epoch-injury.healthAt<10500&&car?.id!==vehicleId&&!carsShared.has(vehicleId)&&!remotes.some(e=>e.vehicle?.id===vehicleId))
        cars.push({...vehicle,id:vehicleId,type,isCar:true,driverRole:role,moving:false,move:false,speed:0});
      return;
    }
    const playerBody=car?collisionBody({...p,...car,isCar:true,vx,vy,speed}):
      pedestrianBody({...p,player:true,vx,vy,down:life.down,stunned:incapacitated(),ragdoll:ragdollPose(life.ragdoll,p.angle,epoch)});
    const bodies=[playerBody,...[...actors,...remotes,...cars,...trafficBlockers]
      .filter(e=>e.id!==vehicleId&&e.id!==footId&&dist(e,d)<83)
      .map(e=>e.halfLength||e.r?e:collisionBody(e))];
    const walkable=q=>!contactAt(q.x,q.y,{radius:WALKER_RADIUS,destroyed});
    const freeFoot=q=>!contactAt(q.x,q.y,{radius:WALKER_RADIUS+.12,destroyed,colliders:bodies});
    const carClear=(q,spec,colliders=[])=>!contactAt(q.x,q.y,{angle:q.angle,halfLength:spec.halfLength+.16,
      halfWidth:spec.halfWidth+.12,destroyed,colliders});
    const [sourceId,slot]=d.id.slice(('unit-'+role+'-').length).split(':');
    const local=sourceId===(net?.id||'self'),suspect=local?p:remotes.find(r=>r.id===sourceId);
    const police=isLawOfficer(role),targetDown=local?life.down:!suspect||suspect.down||suspect.health===0;
    const stars=suspect?.wanted||0,chasing=police&&!targetDown&&responseUnits(stars).some(([kind,index])=>kind===role&&index===(Number(slot)||0));
    let state=dispatchStates.get(d);
    if(!state){state={plan:null,arrived:null,foot:null,nextPlan:0,roadGoal:null};dispatchStates.set(d,state);}
    if(police&&!chasing){
      if(!state.vehicle&&!state.walker)return;
      state.retreatAt??=age;
      if(age-state.retreatAt>13)return;
      if(state.walker&&state.vehicle&&dist(state.walker,state.vehicle)>2.6){
        const person=state.walker,aim=Math.atan2(state.vehicle.y-person.y,state.vehicle.x-person.x);
        const next=moveBody(person.x,person.y,Math.cos(aim)*3*dt,Math.sin(aim)*3*dt,{radius:WALKER_RADIUS,destroyed});
        Object.assign(person,{x:next.x,y:next.y,angle:aim,moving:true});
        actors.push({...person,id:footId,type:role,moving:true,walk:t*8});
      }else if(state.vehicle){
        state.walker=null;
        const vehicle=state.vehicle,spec=vehicleSpec(type),pace=type==='helicopter'?16:8;
        const next=type==='helicopter'?offset(vehicle,vehicle.angle,pace*dt):
          moveBody(vehicle.x,vehicle.y,Math.cos(vehicle.angle)*pace*dt,Math.sin(vehicle.angle)*pace*dt,
            {halfLength:spec.halfLength,halfWidth:spec.halfWidth,angle:vehicle.angle,destroyed,colliders:crossingBlocks});
        Object.assign(vehicle,{x:next.x,y:next.y});
        cars.push({...vehicle,id:vehicleId,type,isCar:true,occupied:true,moving:!next.hit,speed:next.hit?0:pace,driverRole:role});
      }
      return;
    }
    state.retreatAt=null;
    const report=policeReports.get(sourceId)||{...d,at:d.started};
    const vision=state.perception||(state.perception={});
    if(role==='airunit'){
      const angle=age*.26,centre=observePursuit(vision,{now:time,observer:state.vehicle,suspect,report,clear:clearSight,walkable});
      const destination={x:centre.x+Math.cos(angle)*29,y:centre.y+Math.sin(angle)*29};
      const vehicle=state.vehicle||{...destination,angle:angle+Math.PI/2};
      const gap=dist(vehicle,destination),step=Math.min(1,27*dt/Math.max(.1,gap));
      vehicle.angle=turnTo(vehicle.angle,Math.atan2(destination.y-vehicle.y,destination.x-vehicle.x),1.8,dt);
      vehicle.x+=(destination.x-vehicle.x)*step;vehicle.y+=(destination.y-vehicle.y)*step;
      vehicle.lift=16+Math.sin(age*.4)*2;state.vehicle=vehicle;
      cars.push({...vehicle,id:vehicleId,type,isCar:true,color:'#67755d',speed:8,occupied:true,moving:true,driverRole:role,headlamps:true});
      if(vision.visible){
        if(local)knownByPolice=true;
        if(epoch-report.at>550)policeReports.set(sourceId,{...vision.lastKnown,angle:suspect.angle||0,at:epoch});
      }
      if(local&&vision.visible&&dist(vehicle,p)<40&&epoch-(state.volleyAt||0)>3100){
        state.volleyAt=epoch;
        const bearing=Math.atan2(p.y-vehicle.y,p.x-vehicle.x);
        showWeaponShot('smg',[{x:vehicle.x,y:vehicle.y,angle:bearing,length:dist(vehicle,p)}],
          {...vehicle,type,isCar:true},0,terrainHeight(p.x,p.y)+(p.lift||0)+1.1);
        damage(11,bearing,.12,'police');
      }
      return;
    }
    const observer=state.walker||state.foot||state.vehicle;
    const officerDown=Math.max(injury?.downUntil||0,injury?.stunnedUntil||0)>epoch;
    const observedTarget=chasing?observePursuit(vision,{now:time,observer:officerDown?null:observer,suspect,report,
      clear:clearSight,walkable,slot:Number(slot)||0}):isEnfer&&role==='medic'?(suspect||d):d;
    if(isEnfer&&role==='swat'&&!slot&&d.level>=3&&chasing&&state.block===undefined){
      state.block=roadblockSite(report,nearbyDrivableStreets(report.x,report.y,100),vehicleSpec(type),(q,spec)=>carClear(q,spec,bodies));
    }
    const suspectCar=chasing&&(local?car:suspect?.isCar&&suspect.vehicle);
    const followingCar=!!(suspectCar&&vision.visible&&!isAircraft(suspectCar.type));
    const velocity=local?{vx,vy}:suspect;
    const lead=followingCar?Math.min(1.8,28/Math.max(1,Math.hypot(velocity.vx||0,velocity.vy||0))):0;
    const ahead=lead?{x:observedTarget.x+(velocity.vx||0)*lead,y:observedTarget.y+(velocity.vy||0)*lead}:observedTarget;
    const destination=(chasing&&state.block)||ahead;
    if(chasing&&vision.visible&&!officerDown){
      if(local)knownByPolice=true;
      if(epoch-report.at>550)policeReports.set(sourceId,{...vision.lastKnown,angle:suspect.angle||0,at:epoch});
    }
    if(chasing&&!officerDown&&state.vehicle&&!state.foot&&!state.block&&stars>=2&&vision.visible&&
      dist(state.vehicle,suspect)<35&&(followingCar||role==='tankunit'||role==='military')){
      const vehicle=state.vehicle,spec=vehicleSpec(type),aim=Math.atan2(ahead.y-vehicle.y,ahead.x-vehicle.x);
      const heading=turnTo(vehicle.angle,aim,stars>=4?2.35:1.65,dt);
      const current=vehicle.speed||5,target=Math.min(spec.forward,Math.max(10,Math.hypot(velocity?.vx||0,velocity?.vy||0)+(stars>=4?7:4)));
      const pace=current+(target-current)*blend(2.2,dt),shape={...dimensions({type}),bodyHeight:spec.height,footZ:0,angle:heading,destroyed,colliders:[...bodies,...crossingBlocks]};
      const next=moveBody(vehicle.x,vehicle.y,Math.cos(heading)*pace*dt,Math.sin(heading)*pace*dt,shape);
      Object.assign(vehicle,{x:next.x,y:next.y,angle:heading,speed:next.hit?Math.max(3,pace*.64):pace,moving:true});
      cars.push({...vehicle,id:vehicleId,type,isCar:true,driverId:footId,driverRole:role,occupied:true,siren:true,
        turretAngle:Math.atan2(suspect.y-vehicle.y,suspect.x-vehicle.x)});
      const range=dist(vehicle,p),bearing=Math.atan2(p.y-vehicle.y,p.x-vehicle.x);
      if(local&&car&&next.touched?.vehicleId===car.id&&epoch-(state.ramAt||0)>1250){
        state.ramAt=epoch;const force=Math.min(stars>=4?7:4,pace*.26);
        kickDriver({vx:Math.cos(heading)*force,vy:Math.sin(heading)*force,spin:.18*Math.sin(heading-p.angle)},p.angle);
        damageChassis({...car,x:p.x,y:p.y,angle:p.angle},{cause:'crash',speed:force});
        impact=Math.max(.6,impact);
      }
      if(local&&range>3&&range<31&&epoch-(state.volleyAt||0)>(stars>=4?2400:4500)&&clearSight(vehicle,p)){
        state.volleyAt=epoch;const arm=role==='tankunit'?'pompom':'smg';
        showWeaponShot(arm,[{x:vehicle.x,y:vehicle.y,angle:bearing,length:range}],{...vehicle,isCar:true,type});
        damage(role==='tankunit'?20:stars>=4?10:6,bearing,.12,'police');
      }
      return;
    }
    if(!state.foot&&age>=state.nextPlan&&(!state.plan||isEnfer&&state.vehicle&&(!state.roadGoal||dist(state.roadGoal,destination)>(followingCar?19:34)))){
      state.nextPlan=age+(chasing?2:3.5);
      const reserved=[...bodies];
      for(const other of incidents.values()){
        const plan=other!==d&&dispatchStates.get(other)?.plan;
        if(plan)reserved.push({...plan.park,halfLength:plan.spec.halfLength+.8,halfWidth:plan.spec.halfWidth+.35});
      }
      const origin=state.vehicle||null;
      const available=(q,spec,parking)=>carClear(q,spec,parking||origin?reserved:[]);
      const roads=nearbyDrivableStreets(destination.x,destination.y,isEnfer?260:62);
      const plan=isEnfer?(planDistantDispatch(destination,type,roads,available,walkable,origin,chasing?state.block:null,
        chasing&&role==='police'?67:122)
        ||(chasing&&!origin&&!state.block&&age>=4?planDispatch(destination,type,roads,available,walkable):null))
        :planDispatch(destination,type,roads,available,walkable);
      if(plan)Object.assign(state,{plan,distance:null,arrived:null,wait:0,roadGoal:{x:destination.x,y:destination.y},followUntil:null});
      else if(state.block){state.blockAttempts=(state.blockAttempts||0)+1;if(state.blockAttempts>=2)state.block=null;}
      else if(!isEnfer)state.arrived??=2;
    }
    if(state.plan&&!state.foot){
      const claimed=car?.id===vehicleId||carsShared.has(vehicleId)||remotes.some(e=>e.vehicle?.id===vehicleId);
      if(!claimed){
        const vehicle=vehicleHealth({id:vehicleId})>0?stepDispatch(state,age,dt,(q,spec)=>carClear(q,spec,bodies)):null;
        if(vehicle){
          state.vehicle=vehicle;
          cars.push({...vehicle,id:vehicleId,type,isCar:true,driverId:footId,driverRole:role,occupied:!state.foot,siren:true,move:vehicle.moving});
          if(state.arrived!=null){
            if(isEnfer&&followingCar&&!state.block&&stars>=2){
              state.followUntil??=age+3;
              if(age<state.followUntil)state.roadGoal=null;
              else if(dist(vehicle,suspect)>35)state.foot=dispatchDoor(vehicle,type,destination,freeFoot);
            }else state.foot=dispatchDoor(vehicle,type,destination,freeFoot);
          }
        }else if(!state.vehicle){
          state.plan=null;if(!isEnfer)state.arrived=age;
        }else if(vehicleHealth({id:vehicleId})===0&&dist(state.vehicle,destination)<85){
          state.foot=dispatchDoor(state.vehicle,type,destination,freeFoot);state.arrived=age;
        }
      }else{
        const last=car?.id===vehicleId?p:carsShared.get(vehicleId)||state.vehicle;
        if(last){
          state.foot=dispatchDoor(last,type,destination,freeFoot)||(!isEnfer&&footApproach(d,freeFoot,role));
          state.arrived=age;
        }
      }
    }else if(state.vehicle&&state.foot&&vehicleHealth({id:vehicleId})>0&&car?.id!==vehicleId&&!carsShared.has(vehicleId)&&!remotes.some(e=>e.vehicle?.id===vehicleId)){
      const holding=!!(chasing&&state.block&&dist(state.vehicle,state.block)<4);
      cars.push({...state.vehicle,id:vehicleId,type,isCar:true,driverRole:role,siren:holding,moving:false,move:false,speed:0});
      if(holding&&local&&!state.announced&&dist(p,state.vehicle)<55){state.announced=true;onNotice('Barrage de police dans cette rue.');}
    }
    if(!isEnfer&&!state.plan&&!state.foot&&age>=(state.nextEntry||0)){
      state.foot=footApproach(d,freeFoot,role);state.nextEntry=age+.5;
    }
    if(!state.foot||age<(state.arrived??age)+.3)return;
    const level=clamp(d.level||0,0,5);
    const target=chasing?(isEnfer?(vision.visible?observedTarget:destination):suspect):role==='medic'&&suspect?suspect:d;
    const moving=target===suspect&&Math.hypot(velocity?.vx||0,velocity?.vy||0)>.8;
    const heading=moving?Math.atan2(velocity.vy,velocity.vx):(suspect?.angle||0);
    const down=suspect&&(local?incapacitated():suspect.stunned||suspect.down);
    const closeContact=!!(chasing&&target===suspect&&!down&&!(local?car:suspect.isCar));
    const stride=chasing?Math.min(5.9,3.35+.28*Math.max(level,suspect.wanted)+(state.walker&&dist(state.walker,target)>16?1.1:0)):
      role==='swat'?2.4:1.7;
    const parked=cars.find(v=>v.id===vehicleId);
    let occupied;
    const available=q=>{
      if(!occupied){
        occupied=bodies.filter(body=>dist(body,target)<12);
        for(const other of incidents.values()){
          const work=other!==d&&dispatchStates.get(other)?.work;
          if(work&&dist(work,target)<12)occupied.push({...work,r:.96});
        }
      }
      return !contactAt(q.x,q.y,{radius:WALKER_RADIUS+.19,destroyed,colliders:occupied});
    };
    let spot=dispatchWorkSpot(state,target,age,{role,heading,moving,closeContact,down,walkable,available});
    const protectedArea=target===suspect&&(local?car:suspect.isCar)
      ? (local?playerBody:collisionBody(suspect))
      : {x:target.x,y:target.y,r:(closeContact?1.48:down?1.92:1.70)-WALKER_RADIUS};
    const colliders=parked?[collisionBody(parked),protectedArea]:[protectedArea];
    if(down&&target===suspect)colliders.push(local?playerBody:collisionBody(suspect));
    const canWalk=q=>!contactAt(q.x,q.y,{radius:WALKER_RADIUS,destroyed,colliders});
    if(state.walker&&!canWalk(state.walker)){
      const actual=trafficBlockers.find(b=>b.id===footId);
      if(actual&&canWalk(actual))Object.assign(state.walker,{x:actual.x,y:actual.y,target:null});
      else if(!protectedArea.halfLength&&dist(state.walker,target)<protectedArea.r+WALKER_RADIUS){
        // When the suspect moves onto a unit, allow it to walk out of the exclusion disc.
        const gap=dist(state.walker,target);
        protectedArea.r=Math.max(.02,Math.min(protectedArea.r,gap-WALKER_RADIUS-.025));
        state.walker.target=null;
      }
    }
    const threat=vision.lastKnown;
    if(isEnfer&&chasing&&role==='swat'&&threat&&state.walker&&epoch-report.at<10000){
      if(age>=(state.reviewCover||0)){
        state.reviewCover=age+3;
        if(!state.cover||dist(threat,state.cover.threat)>6||!canWalk(state.cover.shelter)){
          const cover=findOfficerCover(state.walker,threat,q=>canWalk(q)&&!contactAt(q.x,q.y,{radius:WALKER_RADIUS,destroyed,colliders:bodies.filter(b=>b.id!==footId)}),clearSight);
          state.cover=cover?{...cover,threat:{...threat}}:null;
        }
      }
      if(state.cover&&dist(state.walker,threat)>=7&&dist(state.walker,threat)<=33)
        spot=age%5<2.9?state.cover.shelter:state.cover.peek;
    }
    const foot=stepDispatchFoot(state,spot,age,stride,canWalk,target);
    if(state.walker)state.walker.motion=foot.motion=spot.motion==='crouch'&&dist(foot,spot)<.8?'crouch':foot.moving?'walk':'idle';
    const kit=police?officerKit(role,chasing?Math.max(level,suspect.wanted):level):null;
    actors.push({...foot,id:footId,type:role,responder:true,closeContact,walk:t*8,kit,engaged:!!kit&&local&&chasing&&vision.visible});
  }
  function pickThreat(reaction){
    const attacker=reaction.attacker===net?.id||reaction.attacker==='self'?p:remotes.find(e=>e.id===reaction.attacker);
    return attacker?{x:attacker.x,y:attacker.y}:{};
  }
  function stepDisplacements(vehicles,blockers,dt){
    if(!displacedCars.size)return;
    for(const v of vehicles){
      if(!displacedCars.has(v.id))continue;
      const spec=vehicleSpec(v.type),options={halfLength:spec.halfLength,halfWidth:spec.halfWidth,
        footZ:v.lift||0,bodyHeight:spec.height,destroyed,ignoreId:v.id,
        colliders:blockers.filter(b=>b.id!==v.id&&dist(b,v)<20)};
      const settled=displacedCars.advance(v,dt,
        (x,y,dx,dy,angle)=>moveBody(x,y,dx,dy,{...options,angle}),
        (x,y,angle)=>!contactAt(x,y,{...options,angle}));
      if(settled?.parked){
        const record={id:v.id,type:v.type,color:v.color,skin:v.skin,x:v.x,y:v.y,angle:v.angle,
          occupied:false,owner:'',shifted:true,speed:0,moving:false,expiresAt:epoch+abandonedFor};
        carsShared.set(v.id,{...record,protect:epoch+2100});
        if(settled.origin===(net?.id||'local'))emit('vehicle',record);
      }
    }
  }
  function kickDriver(kick,angle){
    const c=Math.cos(angle),s=Math.sin(angle);
    speed+=kick.vx*c+kick.vy*s;
    lateralSpeed+=kick.vy*c-kick.vx*s;
    collisionSpin=clamp(collisionSpin+kick.spin,-2.7,2.7);
  }
  function trafficContactImpulse(driver,obstacle){
    const ownCar=car?.id===obstacle.id;
    if((!ownCar&&!obstacle.traffic)||dist(driver,p)>48||displacedCars.has(driver.id)||displacedCars.has(obstacle.id))return;
    const a={...driver,...dimensions(driver)},b={id:obstacle.id,type:obstacle.type,x:obstacle.x,y:obstacle.y,
      angle:Math.atan2(obstacle.s,obstacle.c),halfLength:obstacle.length,halfWidth:obstacle.width,vx:obstacle.vx,vy:obstacle.vy};
    const [nx,ny]=vehicleContactNormal(a,b),hit=vehicleContact(a,b,nx,ny);
    if(!hit||hit.closing<1.8)return;
    // The route solver stops at the occupied space. Carry the remaining world
    // velocity into the skid, then allow both drivers to resume lane following.
    displacedCars.push(a,{vx:a.vx+hit.a.vx,vy:a.vy+hit.a.vy,spin:hit.a.spin},'traffic');
    if(ownCar)kickDriver(hit.b,p.angle);
    else displacedCars.push(b,hit.b,'traffic');
  }
  function population(dt){
    updateRemote(dt);trafficTick-=dt;
    if(isEnfer){
      const trains=railTrains.map(train=>railRide?.train===train?{d:railRide.d,direction:railRide.direction,speed}:railService(train));
      crossingView=railCrossings.filter(site=>dist(site,p)<198).map(site=>({...site,...crossingSignal(site,trains)}));
      crossingBlocks=crossingView.filter(site=>site.close).flatMap(crossingBarriers);
    }
    const activeIds=new Set(peerRoster.map(peer=>peer.vehicle?.id).filter(Boolean));
    if(car)activeIds.add(car.id);
    for(const [key,value] of carsShared){
      if(value.occupied&&value.owner&&!activeIds.has(key)&&boarding?.vehicle.id!==key&&!(value.protect>epoch)){
        const owner=peerRoster.find(peer=>peer.id===value.owner);
        const lastSeen=value.lastSeen||epoch;
        if(!owner||epoch-lastSeen>6500){
          const home=isAircraft(value.type)&&value.lift>.35&&airfields.find(field=>field.type===value.type);
          if(home)Object.assign(value,{x:home.x,y:home.y,angle:home.angle,lift:0,bank:0,carPitch:0});
          value.previousOwner=value.owner;value.occupied=false;value.owner='';value.expiresAt||=lastSeen+disconnectedFor;
        }
      }
      if(parkingExpired(value,epoch))carsShared.delete(key);
    }
    for(const [id,wear] of vehicleWear)if(wreckExpired(wear,epoch))retireVehicle(id,replacementAt(wear));
    for(const [id,until] of retiredVehicles)if(until<=epoch)retiredVehicles.delete(id);
    if(trafficTick<=0){trafficTick=.09;routeClock=epoch;const list=routeAgents(p.x,p.y,130,epoch);
      routeActors=list.actors;routeCars=list.cars;}
    const extrap=clamp((epoch-routeClock)/1000,0,.12);
    const step=e=>{const v=e.moving===false?0:e.speed||0;return {...e,x:e.x+Math.cos(e.angle||0)*v*extrap,y:e.y+Math.sin(e.angle||0)*v*extrap,moving:!!v,move:!!v,walk:time*(Math.abs(v)*3.4+2),speed:v};};
    const lastWalkers=new Map(actors.map(e=>[e.id,e]));
    for(const [id,reaction] of reactions)if(reaction.until<=epoch)reactions.delete(id);
    const previousBodies=incidents.size?[...cars,...actors].map(collisionBody):[];
    actors=routeActors.map(step);cars=[];
    if(isEnfer)for(const clerk of retailClerks){
      if(dist(clerk,p)<62)actors.push({...clerk,id:retailClerkId(clerk.store,epoch)});
    }
    const occupied=new Set(remotes.map(r=>r.vehicle?.id).filter(Boolean));if(car)occupied.add(car.id);
    const excluded=new Set([...occupied,...carsShared.keys(),...retiredVehicles.keys()]);
    if(isEnfer)for(const train of railTrains){
      if(occupied.has(train.id)||boarding?.vehicle.id===train.id)continue;
      const pose=railService(train);
      if(dist(pose,p)<175)cars.push({...pose,passenger:peerRoster.some(r=>r.railRider===train.id)||passengerSeat?.car===train.id});
    }
    if(boarding){
      excluded.add(boarding.vehicle.id);
      if(!occupied.has(boarding.vehicle.id))
        cars.push({...boarding.vehicle,isCar:true,occupied:!boarding.accepted,noDriver:!!boarding.accepted,
          doorOpen:boarding.side*clamp((time-boarding.started-.18)*2.9,0,1)});
    }
    for(const [id,driver] of displacedDrivers){
      if(epoch-driver.at>=exitDriverFor){displacedDrivers.delete(id);continue;}
      const stride=epoch-driver.at<420?1.05:2.8,c=Math.cos(driver.angle),s=Math.sin(driver.angle);
      const next=moveBody(driver.x,driver.y,c*stride*dt,s*stride*dt,{radius:WALKER_RADIUS,destroyed,colliders:obstacles});
      const pace=dist(next,driver)/Math.max(dt,.001);
      Object.assign(driver,{x:next.x,y:next.y,moving:pace>.06,move:pace>.06,speed:pace,walk:time*10});
      if(next.hit)driver.angle+=dt*2;
      actors.push({...driver});
    }
    const ambient=[];
    for(const wear of vehicleWear.values()){
      if(wear.hp!==0&&!wear.fireAt)continue;
      excluded.add(wear.id);
      if(!occupied.has(wear.id)){
        const parked=carsShared.get(wear.id),pose=parked&&!parked.occupied?(parked.roadCoast?{...parked,...sampleRoadCoast(parked,wear.fireAt||wear.disabledAt||epoch)}:parked):wear;
        if(dist(pose,p)<145)cars.push({...wear,...pose,id:wear.id,isCar:true,noDriver:true,moving:false,speed:0});
      }
    }
    for(const raw of routeCars){
      if(vehicleHealth(raw)===0)continue;
      if(excluded.has(raw.id))continue;
      if(raw.routeId){
        const wear=vehicleWear.get(raw.id);
        const driver=npcShared.get(raw.id+'-driver');
        if(npcHealthAt(driver,epoch)>0){
          const pace=wear?Math.sqrt(enginePower(wear.hp))*(1-.12*damagedTires(wear.parts)):1;
          ambient.push(pace<1?{...raw,speed:raw.speed*pace,cruiseSpeed:raw.cruiseSpeed*pace}:raw);
        }
        else{
          const pose=carsShared.get(raw.id)||driver;
          if(epoch-(driver.healthAt||epoch)>abandonedFor){ambient.push(raw);continue;}
          cars.push({...raw,x:pose.x,y:pose.y,angle:pose.angle,isCar:true,occupied:false,noDriver:true,moving:false,speed:0,cabinStopped:true});
        }
      }
      else cars.push({...step(raw),isCar:true});
    }
    for(const d of carsShared.values()){
      if(isTrain(d.type))continue;
      const wear=vehicleWear.get(d.id);
      if(wear?.fireAt||wear?.hp===0)continue;
      if(occupied.has(d.id)||boarding?.vehicle.id===d.id||d.occupied&&(peers.has(d.owner)||d.owner===net?.id))continue;
      const pose=d.flightPath?sampleAutorotation(d,epoch):d.roadCoast?sampleRoadCoast(d,epoch):{moving:false,speed:0};
      if(dist(d.flightPath||d.roadCoast?pose:d,p)<135)cars.push({...d,angle:d.angle||0,isCar:true,...pose});
    }
    for(const [id,d] of incidents){if(epoch-d.started>(isEnfer?77000:43500))incidents.delete(id);else serviceResponse(d,time,dt,previousBodies);}
    for(const [id,reaction] of reactions){
      const live=lastWalkers.get(id)||actors.find(e=>e.id===id);
      if(!live||live.down||dist(live,p)>125)continue;
      if(reaction.fight)Object.assign(reaction,pickThreat(reaction));
      const goal=reactionGoal(live,reaction,(x,y)=>blocked(x,y,.5,destroyed));
      const actor=actors.find(e=>e.id===id);
      if(actor)Object.assign(actor,goal);else actors.push(goal);
    }
    for(const [id,state] of npcShared){
      const dead=npcIsDead(state),age=epoch-state.healthAt;
      if(dead&&age>=officerBodyLifetime){
        const index=actors.findIndex(e=>e.id===id);
        if(index>=0)actors.splice(index,1);
        reactions.delete(id);
        if(id.startsWith('u-')&&age>110000)npcShared.delete(id);
        continue;
      }
      const health=npcHealthAt(state,epoch),until=Math.max(state.stunnedUntil||0,state.downUntil||0);
      if(health>=npcMaxHealth(state.type)&&until+800<epoch){npcShared.delete(id);continue;}
      if(dist(state,p)>135)continue;
      let actor=actors.find(e=>e.id===id);
      if(!dead&&until<=epoch&&!actor&&age>10000)continue;
      if(!actor){
        if(id.endsWith('-driver')&&health>0)continue;
        const body=id.endsWith('-driver')?vehicleDoorways({...state,type:state.vehicleType||'sedan'},.7).find(q=>!blocked(q.x,q.y,.48,destroyed)):null;
        actor={...state,...body,cabinExit:body,type:state.type||'human'};actors.push(actor);
      }
      actor.health=health;actor.dead=dead;actor.down=dead||state.downUntil>epoch;actor.bleeding=actor.down?null:activeBleeding(state.bleeding,epoch);
      const fallAt=dead&&state.ragdoll?Math.min(epoch,state.ragdoll.until-450):epoch;
      const fall=ragdollPose(state.ragdoll,state.angle||0,fallAt);
      actor.impact=Math.max(0,1-age/300);
      if(dead||until>epoch){
        Object.assign(actor,{x:actor.cabinExit?.x??state.x,y:actor.cabinExit?.y??state.y,angle:state.angle,moving:false,move:false,stunned:!!fall||actor.down,braced:true,speed:0,
          ragdoll:fall});
        const reaction=recoilPhase(state.recoil,epoch);
        if(reaction){
          const progress=1-(1-reaction.phase)**3;
          actor.x=state.recoil.fromX+(state.x-state.recoil.fromX)*progress;
          actor.y=state.recoil.fromY+(state.y-state.recoil.fromY)*progress;actor.recoil=reaction;
        }
      }else if(!reactions.has(id)&&until&&epoch-until<1800&&dist(actor,state)<24){
        const t=(epoch-until)/1800,x=state.x+(actor.x-state.x)*t,y=state.y+(actor.y-state.y)*t;
        if(!blocked(x,y,.36,destroyed)){actor.x=x;actor.y=y;}
      }
    }
    const selfBody=car
      ? collisionBody({...p,...car,isCar:true,vx,vy,speed})
      : pedestrianBody({...p,id:net?.id||'self',self:true,vx,vy,stunned:incapacitated(),
        ragdoll:ragdollPose(life.ragdoll,p.angle,epoch)});
    const onDeckLevel=e=>e.motion!=='swim'||terrainHeight(e.x,e.y)-(swimmingSurface(e.x,e.y,true)??terrainHeight(e.x,e.y))<1.1;
    if(displacedCars.size){
      const nearby=[{...selfBody,lift:p.lift},...remotes.map(collisionBody),...cars.map(collisionBody),...drives.map(collisionBody)];
      stepDisplacements(cars,nearby,dt);
    }
    const fixedBodies=[...(onDeckLevel(p)?[{...selfBody,lift:p.lift}]:[]),...remotes.filter(onDeckLevel).map(collisionBody),...cars.map(collisionBody)];
    // Begin with the pedestrians' last resolved positions, then let them react to this frame's actual vehicles.
    const walkerBodies=actors.filter(e=>!e.down).map(e=>collisionBody((!e.stunned&&lastWalkers.get(e.id))||e));
    drives=traffic.step(ambient,{dt,epoch,observer:p,excluded,checkpoints:trafficPeers.checkpoints,
      blockers:[...fixedBodies.filter(body=>!(body.lift>3.15)),...walkerBodies,...crossingBlocks],blockedPose:streetBlocked,onVehicleContact:trafficContactImpulse,recycleAfter:19});
    const actualDrives=displacedCars.size?drives.map(v=>displacedCars.has(v.id)?{...v}:v):drives;
    if(displacedCars.size){
      stepDisplacements(actualDrives,[...fixedBodies,...actualDrives.map(collisionBody)],dt);
      displacedCars.retain(new Set([...cars,...actualDrives].map(v=>v.id)));
    }
    for(const [id,at] of lastShunt)if(epoch-at>2200)lastShunt.delete(id);
    cars.push(...actualDrives);
    if(!life.down&&!(car&&isAircraft(car.type))){
      const warning=trafficHorns.step(actualDrives,{...selfBody,lift:p.lift},epoch,clearSight);
      if(warning){
        const {driver,duration}=warning,distance=dist(driver,p);
        audio.horn(driver.type,.76*(1-distance/32),duration,soundPan(driver,distance));
      }
    }
    crowd.step(actors,[...fixedBodies.filter(body=>!(body.lift>1.62)),...actualDrives.map(collisionBody)],dt);
    if(epoch>=trafficImpactAt){
      trafficImpactAt=epoch+250;
      outer: for(const v of cars){
        if(!v.moving||Math.abs(v.speed)<3||dist(v,p)>32)continue;
        // Neighbours observe the same simulated traffic. Only one nearby client publishes each collision.
        const authority=[net?.id||'self',...remotes.filter(e=>dist(e,v)<34).map(e=>e.id)].sort()[0];
        if(authority!==(net?.id||'self'))continue;
        for(const actor of actors){
          if(actor.down||actor.stunned||!trafficContact(v,actor,-.04)||(npcShared.get(actor.id)?.healthAt||0)>epoch-2300)continue;
          hurtNpc(actor,npcVehicleDamage(v.speed),v.angle+(v.speed<0?Math.PI:0),clamp(Math.abs(v.speed)/13,.70,1));break outer;
        }
      }
    }
    const reach=car?14+Math.abs(speed)*.075:9;
    const near=[...actors,...cars,...remotes].filter(e=>dist(e,p)<reach);
    obstacles=[...near.map(collisionBody),...crossingBlocks.filter(g=>dist(g,p)<reach+g.halfLength)];
    nearCar=car||passengerSeat?null:closestBoardableCar();
  }
  function readyReload(){
    if(incapacitated()||reloading||reserve[weapon]<=0||!Number.isFinite(ammo[weapon])||ammo[weapon]>=weapons[weapon].mag)return;
    reloading=weapons[weapon].reload;tone(305,.06,'square',.012);
  }
  function exportTravelState(){
    return {
      version:2,sourceId:net?.id||'',x:p.x,y:p.y,angle:p.angle,yaw,pitch,vx,vy,health:p.health,vitality:life.snapshot(),wanted:p.wanted,pursuit:pursuitSnapshot(),
      score,weapon,ownedWeapons:ownedWeapons(),reloading,
      reserve:Object.fromEntries(ownedWeapons().filter(k=>Number.isFinite(ammo[k])).map(k=>[k,reserve[k]])),
      ammo:Object.fromEntries(ownedWeapons().filter(k=>Number.isFinite(ammo[k])).map(k=>[k,ammo[k]])),
      vehicle:car?{...car,chassis:vehicleWear.get(car.id),speed,angle:p.angle,owner:net?.id||'',previousOwners:travelClaim?.previousOwners||[]}:null
    };
  }
  function settleTravelClaim(roster,world){
    if(!travelClaim||!car||net?.status!=='online')return;
    const owner=world.vehicles?.[car.id]?.owner;
    if(owner===net.id){travelClaim=null;publish();return;}
    if(travelClaim.sent||epoch<travelClaim.retryAt)return;
    // The last tab's keepalive leave can arrive after the new tab's join.
    if(travelClaim.previousOwners.includes(owner)&&roster.some(r=>r.id===owner))return;
    const claim={...car,x:p.x,y:p.y,angle:p.angle,speed,occupied:true,owner:net.id};
    travelClaim.sent=emit('vehicle',claim)!==false;
  }
  function travelSpot(x,y,angle,vehicle,sourceId,clearance=55){
    const nearby=routeAgents(x,y,64,epoch),world=net?.world?.()||{};
    const occupants=net?.peers?.()||[],occupied=new Set(occupants.map(r=>r.vehicle?.id));
    const at={x,y},entities=new Map();
    const add=e=>{if(dist(e,at)<62)entities.set(e.id,e);};
    nearby.actors.forEach(add);
    for(const v of nearby.cars)if(!occupied.has(v.id)&&!retired(v.id)&&!(world.retiredVehicles?.[v.id]>epoch))add({...v,isCar:true});
    // Prefer the simulated or replicated pose when the nominal clock has run ahead of a queue.
    for(const v of [...cars,...Object.values(world.vehicles||{}),...carsShared.values()]){
      if(retired(v.id)||world.retiredVehicles?.[v.id]>epoch||parkingExpired(v,epoch)||wreckExpired(vehicleWear.get(v.id),epoch))continue;
      entities.delete(v.id);if(!occupied.has(v.id))add({...v,...(v.roadCoast?sampleRoadCoast(v,epoch):{}),isCar:true});
    }
    for(const a of actors){entities.delete(a.id);add(a);}
    for(const a of [...Object.values(world.npcs||{}),...npcShared.values()]){
      if(a.id&&Math.max(a.stunnedUntil||0,a.downUntil||0)>epoch){
        add({...a,stunned:true,ragdoll:ragdollPose(a.ragdoll,a.angle||0,epoch)});
      }
    }
    for(const r of occupants)if(r.id!==sourceId&&(!vehicle||r.vehicle?.id!==vehicle.id)){
      add({...r,peer:true,type:r.vehicle?.type||'fox',isCar:!!r.vehicle,
        stunned:r.downUntil>epoch||r.health===0,ragdoll:ragdollPose(r.ragdoll,r.angle||0,epoch)});
    }
    if(vehicle)entities.delete(vehicle.id);
    const geometry={radius:PLAYER_RADIUS,angle,destroyed,swimmer:!vehicle&&swimmingSurface(x,y,true)!=null,colliders:Array.from(entities.values(),collisionBody)};
    if(vehicle)Object.assign(geometry,dimensions(vehicle));
    if(!contactAt(x,y,geometry))return {x,y};
    for(const radius of [.8,1.8,3.5,6,8,10,16,25,40,55]){
      if(radius>clearance)break;
      const count=Math.max(12,Math.ceil(Math.PI*radius));
      for(let i=0;i<count;i++){
        const q=offset({x,y},angle+i*Math.PI*2/count,radius);
        if(!contactAt(q.x,q.y,geometry))return q;
      }
    }
    return null;
  }
  function restoreTravelState(s,{clearance=55}={}){
    if(!s||![1,2].includes(s.version)||![s.x,s.y,s.angle].every(Number.isFinite)||Math.max(Math.abs(s.x),Math.abs(s.y))>100000)return false;
    const finite=(v,fallback,min,max)=>Number.isFinite(v)?clamp(v,min,max):fallback;
    const safeAngle=v=>Math.atan2(Math.sin(v),Math.cos(v));
    let ride=null;
    if(s.vehicle&&!isTrain(s.vehicle.type)){
      const v=s.vehicle;
      if(typeof v.id!=='string'||!/^[-\w:]{1,68}$/.test(v.id)||!isVehicleType(v.type))return false;
      ride={id:v.id,type:v.type};
      if(typeof v.color==='string'&&/^#[a-f\d]{6}$/i.test(v.color))ride.color=v.color;
      if(typeof v.skin==='string'&&/^[\w-]{1,40}$/.test(v.skin))ride.skin=v.skin;
    }
    if(ride&&(retired(ride.id)||net?.world?.().retiredVehicles?.[ride.id]>epoch||wreckExpired(s.vehicle.chassis,epoch)))ride=null;
    const angle=safeAngle(s.angle);
    for(const id of net?.world?.().destroyed||[])destroyed.add(id);
    const q=travelSpot(s.x,s.y,angle,ride,s.sourceId,clearance);
    if(passengerSeat||!q || (car&&car.id!==ride?.id&&!dropCar()))return false;
    resetInputs();resetPopulation();arrivalChecked=true;cameraSnap=true;levelPlace=null;
    p.x=q.x;p.y=q.y;p.angle=angle;
    life.restore({...s.vitality,health:finite(s.health,100,0,100)},epoch);p.health=life.health;
    acceptShotsFrom=Math.max(Math.floor(net?.serverTime?.()??epoch),life.snapshot().protectedUntil||0);
    p.wanted=pursuit.restore(s.version===2?s.pursuit:{wanted:s.wanted,heat:s.heat,sinceCrime:s.sinceCrime},time).level;
    const report=s.pursuit?.report,id=net?.id||'self';
    policeReports.delete(id);searchOutsideSince=null;knownByPolice=false;
    if(p.wanted&&report?.enfer===isEnfer&&dist(p,report)<600)policeReports.set(id,{...report,angle:p.angle,at:epoch});
    wantedEvent=null;nearPickup=null;score=Math.round(finite(s.score,0,0,1e9));
    const before=owned.size;
    if(s.version===2)addLoadout(s.ownedWeapons);
    if(owned.size!==before)onLoadoutChange(ownedWeapons());
    weapon=owned.has(s.weapon)?s.weapon:'pistol';
    for(const [k,w] of Object.entries(weapons)){
      ammo[k]=Number.isFinite(w.mag)?Math.floor(finite(s.ammo?.[k],w.mag,0,w.mag)):Infinity;
      if(Number.isFinite(w.mag))reserve[k]=Math.floor(finite(s.reserve?.[k],ammoCapacity(k)-w.mag,0,ammoCapacity(k)-ammo[k]));
    }
    reloading=weapon===s.weapon?finite(s.reloading,0,0,weapons[weapon].reload):0;
    yaw=safeAngle(Number.isFinite(s.yaw)?s.yaw:angle);pitch=finite(s.pitch,.13,-.32,1.05);
    const ownerChain=ride&&Array.isArray(s.vehicle.previousOwners)?s.vehicle.previousOwners:[];
    const previousOwners=[...new Set([s.vehicle?.owner,...ownerChain].filter(id=>typeof id==='string'&&id.length<=64))].slice(0,4);
    car=ride;suspension=null;
    if(ride&&s.vehicle.chassis?.id===ride.id)receiveChassis(s.vehicle.chassis);
    travelClaim=ride&&net&&s.sourceId!==net.id?{previousOwners,sent:false,retryAt:0}:null;
    speed=ride?finite(s.vehicle.speed,0,-vehicleSpec(ride.type).reverse,vehicleSpec(ride.type).forward):0;
    vx=ride?Math.cos(angle)*speed:finite(s.vx,0,-6.4,6.4);vy=ride?Math.sin(angle)*speed:finite(s.vy,0,-6.4,6.4);
    traversal.reset(vx,vy);p.moving=Math.hypot(vx,vy)>.1;p.sprinting=!ride&&Math.hypot(vx,vy)>4;
    if(!ride&&s.swimming===true&&swimmingSurface(q.x,q.y,true)!=null)p.motion='swim';
    nearCar=null;steer=turn=impact=shootPose=cooldown=0;braking=false;
    freeLookUntil=0;mapTick=hudTick=networkTick=trafficTick=popTick=0;
    settleTravelClaim(net?.peers?.()||[],net?.world?.()||{});
    publish();sendHud(true);return true;
  }
  function shotScene(range){
    const muzzle=car?1.8:.35;
    const vehicleTargets=[...cars,...remotes.filter(v=>v.isCar)].filter(v=>vehicleId(v)!==car?.id&&dist(v,p)<range+6)
      .map(v=>({...v,type:v.vehicle?.type||v.type,isCar:true,...dimensions(v),r:vehicleSpec(v.vehicle?.type||v.type).halfWidth,hitKind:'vehicle'}));
    const targets=[...nearbyProps(p.x,p.y,range+2).filter(o=>!destroyed.has(o.id)).map(o=>({...o,hitKind:'prop'})),
      ...actors.filter(o=>!o.down).map(o=>({...o,r:.65,hitKind:'npc'})),...vehicleTargets,...remotes.filter(o=>!o.isCar&&!o.down&&o.id!==net?.id&&o.id!==p.id).map(o=>({...o,r:.67,hitKind:'peer'}))];
    const vehicles=[...cars,...remotes.filter(e=>e.isCar)].filter(v=>dist(v,p)<range+6).map(collisionBody);
    const geometry={radius:.12,height:1.05+p.lift,camera:true,destroyed,colliders:vehicles,ignoreId:null};
    const contact=(x,y,ignoreId)=>{geometry.ignoreId=ignoreId;return contactAt(x,y,geometry);};
    const trace=angle=>traceShot(p,angle,muzzle,range,targets,contact);
    function visible(from,to,sourceId){
      const ignoreProps=sourceId?new Set([...destroyed,sourceId]):destroyed;
      const opt={...geometry,destroyed:ignoreProps,colliders:vehicles.filter(v=>v.id!==sourceId)};
      const clip=(x,y,ignoreId)=>{opt.ignoreId=ignoreId;return contactAt(x,y,opt);};
      const angle=Math.atan2(to.y-from.y,to.x-from.x);
      if(dist(from,to)<.05)return !clip(from.x,from.y,to.id);
      return traceShot(from,angle,0,dist(from,to)+(to.r||.5)+.1,targets.filter(o=>o.id!==sourceId),clip).hit?.id===to.id;
    }
    return {muzzle,targets,trace,visible};
  }
  // All shoves have a swept straight path. Sampling includes the victim's capsule
  // and other people, parked cars, live traffic, walls and the edge of the world.
  function knockbackEnd(actor,angle,length,radius){
    const colliders=obstacles.filter(body=>body.id!==actor.id);
    if(actor!==p)colliders.push({...pedestrianBody(p),lift:p.lift});
    const options={radius,footZ:actor.lift||0,bodyHeight:1.52,destroyed,colliders};
    const steps=Math.ceil(length/.075);
    let x=actor.x,y=actor.y;
    for(let i=1;i<=steps;i++){
      const nx=actor.x+Math.cos(angle)*length*i/steps,ny=actor.y+Math.sin(angle)*length*i/steps;
      if(contactAt(nx,ny,options))break;
      x=nx;y=ny;
    }
    return {x,y};
  }
  function aimBearing(source,melee=false){
    if((source==='touch'||source==='button')&&Math.hypot(aimX,aimY)>.15)
      return yaw+Math.atan2(aimX,-aimY);
    if((source==='pointer'||source==='key')&&aimPointer){
      const angle=view.aim(aimPointer.x,aimPointer.y,p);
      if(Number.isFinite(angle))return angle;
    }
    if(!melee)return yaw;
    const x=stickX+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('q')||keys.has('a')||keys.has('arrowleft'));
    const y=-stickY+Number(keys.has('z')||keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
    if(Math.hypot(x,y)>.15)return yaw+Math.atan2(x,y);
    return meleeCameraAim?yaw:p.angle;
  }
  function startSwing(source='button'){
    if(paused||incapacitated()||car||passengerSeat||!view.available||['climb','vault','swim'].includes(p.motion))return;
    if(swing){
      if(time-swing.begin>=.07)swingQueued=true;
      return;
    }
    crouched=false;
    if(time>chainUntil)comboIndex=0;
    const kind=combo[comboIndex],move=meleeMoves[kind];
    comboIndex=(comboIndex+1)%combo.length;
    const started=Math.max(Math.round(epoch),lastSwingStamp+1);lastSwingStamp=started;
    const bearing=aimBearing(source,true);
    const angle=swingContact(bearing,move)?.angle??bearing;
    swing={kind,started,source,begin:time,from:p.angle,bearing,angle,step:0,resolved:false};
    chainUntil=time+move.duration+.48;shotFacingUntil=-1;shootPose=0;
    clearAimLock();publish();emit('melee',{kind,started,angle:deltaAngle(0,angle),x:p.x,y:p.y,lift:p.lift});
    tone(kind==='kick'?195:255,.09,'sine',.024,90);
  }
  function swingContact(bearing,move){
    const targets=[...actors.filter(e=>!e.down).map(e=>({...e,r:WALKER_RADIUS,hitKind:'npc'})),
      ...remotes.filter(e=>!e.isCar&&!e.down).map(e=>({...e,r:PLAYER_RADIUS,hitKind:'peer'})),
      ...nearbyProps(p.x,p.y,3).filter(e=>softProp(e)&&!destroyed.has(e.id)).map(e=>({...e,hitKind:'prop'}))];
    // Aim at the nearest point of the bodywork, including the sides of long vehicles.
    for(const v of [...cars,...remotes.filter(e=>e.isCar)]){
      const spec=vehicleSpec(v.type);
      if(vehicleHealth(v)===0||dist(v,p)>spec.halfLength+3)continue;
      const a=v.angle||0,c=Math.cos(a),s=Math.sin(a),dx=p.x-v.x,dy=p.y-v.y;
      const along=clamp(dx*c+dy*s,-spec.halfLength,spec.halfLength),side=clamp(dy*c-dx*s,-spec.halfWidth,spec.halfWidth);
      targets.push({id:v.id,x:v.x+c*along-s*side,y:v.y+s*along+c*side,lift:v.lift,r:.16,h:spec.height,hitKind:'vehicle',vehicle:v});
    }
    const walls={radius:.075,camera:true,destroyed,colliders:obstacles.filter(o=>o.isCar)};
    const occluded=(x,y,height,ignoreId)=>contactAt(x,y,{...walls,height,ignoreId});
    return meleeContact(p,bearing,move,targets,terrainHeight,occluded);
  }
  function contactSwing(strike,move){
    const hit=swingContact(strike.bearing,move);
    if(!hit)return;
    alertCrowd(p,8);
    const {target,angle}=hit;
    p.angle=strike.angle=angle;
    publish();
    if(target.hitKind==='npc'){
      if(!hurtNpc(target,move.damage,angle,move.force,strike))return;
      recordAction(target.dead?(isLawOfficer(target.type)?'killOfficer':'killCivilian'):isLawOfficer(target.type)?'hitOfficer':'hitCivilian');
    }else if(target.hitKind==='peer'){
      emit('hit',{target:target.id,cause:'melee',kind:strike.kind,swingAt:strike.started,damage:move.damage,angle,force:move.force});
      recordAction('hitPlayer');
    }else if(target.hitKind==='vehicle'){
      damageChassis(target.vehicle,{cause:'melee',swingAt:strike.started,swingKind:strike.kind,part:'body'});
    }else if(target.hitKind==='prop'){
      damageProp(target,move.damage,{cause:'melee',swingAt:strike.started,swingKind:strike.kind},angle,vandalism);
    }
    view.effect('meleeImpact',hit.x,hit.y,angle,move.force,[],hit.height);
    audio.grit(.14,.10,700);tone(strike.kind==='kick'?92:128,.105,'triangle',.065,51);
  }
  function stepSwing(){
    if(!swing)return;
    if(paused||incapacitated()||car||['climb','vault','swim'].includes(p.motion)){swing=null;swingQueued=false;return;}
    const move=meleeMoves[swing.kind],age=time-swing.begin;
    if(!swing.resolved){
      // Keep the original arc for an unsteered swing. An explicit mouse or thumb
      // direction can still guide the wind-up, including the first touch strike.
      const steerThumb=(swing.source==='touch'||swing.source==='button')&&Math.hypot(aimX,aimY)>.15;
      if(steerThumb||((swing.source==='key'||swing.source==='pointer')&&aimPointer))
        swing.bearing=aimBearing(swing.source,true);
      swing.angle=swingContact(swing.bearing,move)?.angle??swing.bearing;
      const t=clamp(age/move.contact,0,1);
      p.angle=swing.from+deltaAngle(swing.from,swing.angle)*t*t*(3-2*t);
    }
    if(!swing.resolved && traversal.grounded){
      // Plant the leading foot during extension. The lunge uses the same swept
      // body as walking, even when punching against a car or the edge of a pier.
      const t=clamp((age/move.contact-.40)/.60,0,1);
      const distance=move.step*t*t*(3-2*t),advance=distance-swing.step;
      if(advance>0){
        const next=moveBody(p.x,p.y,Math.cos(swing.angle)*advance,Math.sin(swing.angle)*advance,
          {radius:PLAYER_RADIUS,footZ:p.lift,bodyHeight:1.52,destroyed,colliders:obstacles});
        p.x=next.x;p.y=next.y;swing.step=distance;
      }
    }
    if(!swing.resolved&&age>=move.contact){
      swing.resolved=true;contactSwing(swing,move);
    }
    if(age>=move.duration){
      const source=swing.source;swing=null;
      if(swingQueued){swingQueued=false;startSwing(source);}
    }
  }
  function showWeaponShot(kind,rays,actor,age=0,impactHeight=null){
    if(!rays.length||!weapons[kind])return;
    const muzzle=shotMuzzle(kind,{...actor,fire:Math.max(0,1-age*4.5)},rays[0].angle);
    const ground=(muzzle.aircraft?baseTerrainHeight:terrainHeight)(actor.x,actor.y,actor.angle);
    const chain=weaponShotShape(kind).chain,effect=weapons[kind].effect;
    for(const [index,ray] of rays.entries()){
      if(index&&chain){view.effect(effect,ray.x,ray.y,ray.angle,ray.length,[],actor.lift||0,age);continue;}
      const r=renderShotRay(ray,muzzle);
      const lift=ground-terrainHeight(r.x,r.y)+r.height-1.03;
      const drop=impactHeight===null?0:impactHeight-ground-r.height;
      view.effect(effect,r.x,r.y,r.angle,r.length,{barrel:kind,flash:index===0,drop},lift,age);
    }
  }
  function fire(source='manual'){
    if(paused||incapacitated()||passengerSeat||['swim','climb','vault'].includes(p.motion)||!view.available||cooldown>0)return;
    if(weapon==='fist'){
      if(!swing)startSwing(source);
      return;
    }
    if(swing||reloading>0)return;
    const w=weapons[weapon];
    if(ammo[weapon]<=0){
      if(reserve[weapon]>0)readyReload();
      else if(time-emptyNoticeAt>3){emptyNoticeAt=time;onNotice('Plus de munitions. Les dépôts sont indiqués sur la carte.');}
      return;
    }
    crouched=false;
    const firedAt=Math.round(net?.serverTime?.()??epoch);
    unlock();if(w.noise)alertCrowd(p,32);
    cooldown=w.interval;shootPose=1;ammo[weapon]--;
    const touch=source==='touch',manualDrag=(touch||source==='button')&&Math.hypot(aimX,aimY)>.15;
    const bearing=deltaAngle(0,aimBearing(source));
    const {muzzle,targets,trace,visible}=shotScene(w.range);
    let shot=trace(bearing);
    if(touch&&!manualDrag&&aimAssist){
      const lock=chooseTouchShot({position:p,yaw,muzzle,range:w.range,targets,wanted:p.wanted,previousId:aimLock?.id,
        project:view.projectTarget,trace,direct:shot});
      if(lock){shot=lock.shot;aimLock=lock.target;markImpactUntil=time+.19;nextLockCheck=time+.12;drawAimLock();}else clearAimLock();
    }else clearAimLock();
    const a=shot.angle;
    if(!car){p.angle=a;shotFacingUntil=time+.21;}
    publish();
    const peerHits=[];
    const pattern=resolveWeaponShot(weapon,a,trace,targets,visible,shot);
    const severity=['gunshot','destroy','hitCivilian','hitPlayer','hitOfficer'];
    let worst=w.noise?0:-1,unsettled=1;
    // A fan or chain can hit multiple targets. Charge a single offence after all its hits settle.
    const settleShot=broken=>{
      if(broken)worst=Math.max(worst,1);
      if(--unsettled===0&&worst>=0)recordAction(severity[worst]);
    };
    const shotId=crypto.randomUUID();shotContacts=[];
    for(const {target,damage:amount} of pattern.hits){
      const direction=Math.atan2(target.y-p.y,target.x-p.x),force=clamp(amount/45,.12,1);
      if(target.hitKind==='prop'){
        unsettled++;
        damageProp(target,amount,{cause:'weapon',weapon},direction,settleShot);
      }
      if(target.hitKind==='vehicle'){
        const ray=pattern.rays.find(r=>r.hit?.id===target.id);
        const entry=ray?offset(ray.origin,ray.angle,ray.length):target;
        const spec=vehicleSpec(target.type),rect=canvas.getBoundingClientRect?.();
        const bottom=view.projectTarget?.(target.x,target.y,0),top=view.projectTarget?.(target.x,target.y,spec.height);
        const screenY=rect?.height&&aimPointer&&(source==='pointer'||source==='key')?(aimPointer.y-rect.top)/rect.height:null;
        const height=screenY!=null&&top&&bottom&&bottom.y-top.y>.008?clamp((bottom.y-screenY)/(bottom.y-top.y),.04,.97):.60;
        const part=vehiclePart(target,entry,height),open=(vehicleWear.get(vehicleId(target))?.parts||0)&1;
        damageChassis(target,{cause:'weapon',weapon,part});
        if((part==='glass'||spec.openSeat&&height>.53)&&(target.peer||target.occupied||target.routeId)){
          const injury=Math.round(amount*(open||spec.openSeat?1:.54));
          if(target.peer){peerHits.push({target:target.id,damage:injury,angle:direction,force:force*.55,viewedAt:Math.round(target.viewAt??epoch)});worst=Math.max(worst,3);}
          else {
            const driver={...target,id:target.driverId||vehicleId(target)+'-driver',type:target.driverRole||'human',vehicleType:target.type};
            if(hurtNpc(driver,injury,direction,force*.45,null,weapon)){
              const officer=isLawOfficer(driver.type);
              if(driver.dead)recordAction(officer?'killOfficer':'killCivilian');
              else worst=Math.max(worst,officer?4:2);
            }
          }
        }
      }
      if(target.hitKind==='npc'&&hurtNpc(target,amount,direction,force,null,weapon)){
        if(target.dead)recordAction(isLawOfficer(target.type)?'killOfficer':'killCivilian');
        else worst=Math.max(worst,isLawOfficer(target.type)?4:2);
      }
      if(target.hitKind==='peer'){
        peerHits.push({target:target.id,damage:amount,angle:direction,force,
          ...(Number.isFinite(target.viewAt)?{viewedAt:Math.round(target.viewAt)}:{})});
        worst=Math.max(worst,3);
      }
    }
    const rays=pattern.rays.map(r=>({x:r.origin.x,y:r.origin.y,angle:r.angle,length:r.length}));
    showWeaponShot(weapon,rays,{...p,vehicle:car?{...car,angle:p.angle}:null});
    if(pattern.impact)view.effect('burst',pattern.impact.x,pattern.impact.y);
    const contacts=shotContacts;shotContacts=null;
    if(rays.length)emit('fire',{...rays[0],kind:weapon,lift:p.lift,shotId,firedAt,viewAt:peerViewTime(epoch),
      hits:peerHits,...(rays.length>1?{rays}:{}),...(pattern.impact?{impact:pattern.impact}:{})});
    for(const contact of contacts)emit(contact.type,{...contact.data,shotId});
    settleShot(false);
    if(w.noise)audio.grit(.16,.18,3700);
    tone(w.frequency,.1,w.noise?'triangle':'sine',.055,w.frequency*.42);
    if(!ammo[weapon])readyReload();
  }
  function updateSuspension(spec,dt){
    if(!car)return;
    suspension=stepVehicleBody(suspension,{x:p.x,y:p.y,angle:p.angle,speed,halfLength:spec.halfLength,dt},terrainHeight);
    p.lift=suspension.lift;p.verticalSpeed=suspension.vy;
    if(suspension.landed>2.2){
      impact=Math.min(1,suspension.landed*.15);
      if(suspension.landed>5.5)damageChassis({...car,x:p.x,y:p.y,angle:p.angle},{cause:'crash',speed:suspension.landed});
    }
  }
  function move(dt){
    roadMotion=null;
    if(passengerSeat){
      if(passengerSeat.rail){
        const train=railService(railTrain(passengerSeat.car));
        passengerSeat.d=train.d;passengerSeat.direction=train.direction;
        Object.assign(p,{x:train.x,y:train.y,angle:train.angle,lift:.18,moving:train.moving,sprinting:false});
        speed=train.speed;vx=Math.cos(train.angle)*speed;vy=Math.sin(train.angle)*speed;
        if(!drag&&time>freeLookUntil&&speed>.5)yaw=turnTo(yaw,p.angle,5,dt);
        return;
      }
      const glide=passengerSeat.coasting&&(net.world?.()?.vehicles?.[passengerSeat.car]||carsShared.get(passengerSeat.car));
      const driver=glide?.flightPath?sampleAutorotation(glide,epoch):glide?.roadCoast?sampleRoadCoast(glide,epoch):remotes.find(e=>e.id===passengerSeat.driver);
      if(driver){
        p.x=driver.x;p.y=driver.y;p.angle=driver.angle;p.lift=driver.lift||0;p.verticalSpeed=driver.verticalSpeed||0;
        p.moving=driver.moving;p.sprinting=false;speed=driver.speed||0;
        vx=driver.vx||0;vy=driver.vy||0;
        if(!drag&&time>freeLookUntil&&Math.abs(speed)>1)yaw+=deltaAngle(yaw,p.angle)*blend(2.2,dt);
      }
      return;
    }
    if(exitSlide){
      const slide=exitSlide,drag=slide.tumble?3.9:4.6,k=Math.exp(-drag*dt),step=(1-k)/drag;
      const next=moveBody(p.x,p.y,vx*step,vy*step,{radius:PLAYER_RADIUS,destroyed,colliders:obstacles,bodyHeight:slide.tumble?.68:1.55});
      p.x=next.x;p.y=next.y;vx*=k;vy*=k;
      if(next.hit){
        const inward=vx*next.normalX+vy*next.normalY;
        if(inward<0){vx-=inward*next.normalX;vy-=inward*next.normalY;}
      }
      const pace=Math.hypot(vx,vy);
      p.moving=pace>.24;p.motion='dismount';p.stride=Math.min(1,pace/6);p.walk+=Math.min(8,pace)*dt*3;
      slide.remaining-=dt;
      if(slide.remaining<=0||pace<.42){
        exitSlide=null;traversal.reset(life.ragdoll?0:vx,life.ragdoll?0:vy);
        if(life.ragdoll){vx=vy=0;p.moving=false;}
      }
      return;
    }
    if(selfRecoil){
      const r=selfRecoil,t=Math.min(1,r.progress+dt/recoilSeconds);
      const advance=(1-r.progress)**3-(1-t)**3;
      const next=moveBody(p.x,p.y,(r.toX-r.fromX)*advance,(r.toY-r.fromY)*advance,
        {radius:PLAYER_RADIUS,footZ:p.lift,bodyHeight:1.52,destroyed,colliders:obstacles});
      p.x=next.x;p.y=next.y;r.progress=t;if(t===1)selfRecoil=null;
    }
    if(incapacitated()){
      if(!car&&(!traversal.grounded||p.lift>.01))traversal.step(dt,{x:0,y:0,angle:p.angle,sprint:false},{destroyed,colliders:obstacles});
      return;
    }
    if(stepBoarding(dt))return;
    const has=(...a)=>a.some(k=>keys.has(k));
    let sx=paused?0:stickX+Number(has('d','arrowright'))-Number(has('q','a','arrowleft'));
    let sy=paused?0:-stickY+Number(has('z','w','arrowup'))-Number(has('s','arrowdown'));
    const m=Math.hypot(sx,sy);if(m>1){sx/=m;sy/=m;}
    const oldAngle=p.angle;
    if(car&&railRide){
      const {train,d,direction}=railRide,pedal=paused?0:clamp(sy+mobileThrottle,-1,1);
      const result=stepRail(train,d,direction,speed,pedal,paused||has(' '),dt);
      railRide.d=result.d;
      vx=(result.x-p.x)/dt;vy=(result.y-p.y)/dt;speed=result.speed;braking=pedal<-.05||has(' ');
      Object.assign(p,{x:result.x,y:result.y,angle:result.angle,moving:speed>.13,sprinting:false,lift:.18});
      if(!drag&&time>freeLookUntil)yaw=turnTo(yaw,p.angle,6,dt);
      return;
    }
    if(car&&isAircraft(car.type)){
      const vertical=paused?0:clamp(mobileLift+Number(has('r'))-Number(has('f')),-1,1);
      const throttle=paused?0:clamp(sy+mobileThrottle,-1,1);
      steer+=(clamp(paused?0:sx+mobileSteer,-1,1)-steer)*blend(5,dt);
      const burning=car.type==='helicopter'&&vehicleWear.get(car.id)?.fireAt;
      const power=burning?0:enginePower(vehicleHealth(car));
      const result=stepAircraft(car.type,{...p,speed,altitude:suspension?.altitude,recovery:suspension?.recovery,kick:suspension?.kick,pitch:suspension?.pitch,bank:suspension?.bank},
        {vertical,throttle,steer,power},dt,
        {ground:baseTerrainHeight,deck:aircraftDeck,water:(x,y)=>swimmingSurface(x,y,true),contact:contactAt,options:{destroyed,colliders:obstacles,ignoreId:car.id}});
      if(result.impact>3.2&&contactLock<=0){
        damageChassis({...car,x:p.x,y:p.y,angle:p.angle},{cause:'crash',speed:result.impact});
        if(car.type==='helicopter'){
          audio.grit(.24,Math.min(.38,result.impact*.018),920);
          impact=Math.min(1,result.impact*.075);
          if(result.impact>=11)onNotice('Impact · Perte de contrôle');
        }
        contactLock=.55;
      }
      vx=(result.x-p.x)/dt;vy=(result.y-p.y)/dt;speed=result.speed;
      Object.assign(p,{x:result.x,y:result.y,lift:result.lift,verticalSpeed:result.verticalSpeed,angle:result.angle,
        moving:Math.abs(speed)>.14||Math.abs(result.verticalSpeed)>.12,sprinting:false});
      suspension=result;braking=false;
      if(car.type==='helicopter'&&result.impactKind==='landing'&&result.impact>7.5){
        damage(Math.min(64,Math.round((result.impact-5)*5)),p.angle,.40,'traffic');
      }
      if(!drag&&time>freeLookUntil)yaw=turnTo(yaw,p.angle,3,dt);
      return;
    }
    if(car){
      sx=clamp(sx+mobileSteer,-1,1);sy=clamp(sy+mobileThrottle,-1,1);
      if(paused)sx=sy=0;
      const onRoad=(suspension?.lift||0)<.035;
      const tyres=damagedTires(vehicleWear.get(car.id)?.parts),power=enginePower(vehicleHealth(car))*(1-.12*tyres)*(1-.56*burnProgress(vehicleWear.get(car.id),epoch)),oldSpeed=speed,spec=vehicleSpec(car.type);
      if(tyres&&Math.abs(speed)>.8)sx=clamp(sx*(1-.125*tyres)+Math.sin(time*4.6)*tyres*.065,-1,1);
      if(!power){
        if(suspension?.lift>0)updateSuspension(spec,dt);
        speed=vx=vy=0;p.moving=false;braking=false;return;
      }
      const grip=(isEnfer?cityClimate(epoch).grip:1)*chassisGrip(vehicleHealth(car));
      const grade=terrainGradient(p.x,p.y,p.angle);
      const incline=grade.x*Math.cos(p.angle)+grade.y*Math.sin(p.angle);
      const handbrake=!paused&&(has(' ')||mobileHandbrake);
      const driveline=stepRoadDrive(spec,{speed,pedal:sy,grip,tyres,power,grounded:onRoad,incline,handbrake,dt});
      speed=driveline.speed;braking=driveline.braking;
      steer+=(sx-steer)*blend(11,dt);
      const steering=roadSteering(spec,speed,steer,driveline.tractionYaw,handbrake,onRoad);
      collisionSpin*=Math.exp(-3.3*dt);
      const options={radius:1,...dimensions(car),footZ:p.lift||0,bodyHeight:spec.height,destroyed,precise:true,
        colliders:obstacles.filter(body=>!body.person||body.player)};
      const turnDelta=(steering.yaw+collisionSpin)*dt;
      // Try steering at the end of the movement as well: a car close to a
      // wall can straighten once it has pulled past the corner.
      const targetAngle=vehicleTurn(p.x,p.y,p.angle,p.angle+turnDelta,options);
      lateralSpeed=roadSlip(lateralSpeed,speed,deltaAngle(p.angle,targetAngle),steering.sliding,dt);
      options.angle=targetAngle;
      const c=Math.cos(targetAngle),s=Math.sin(targetAngle),driveX=c*speed-s*lateralSpeed,driveY=s*speed+c*lateralSpeed;
      const dx=driveX*dt,dy=driveY*dt;
      let result=moveBody(p.x,p.y,dx,dy,options);
      if(!paused&&(Math.abs(sy)>.12||Math.abs(speed)>.6)){
        const sign=Math.sign(sy||speed);
        roadMotion={x:Math.cos(targetAngle)*sign,y:Math.sin(targetAngle)*sign,speed:Math.abs(speed),boundary:result.touched?.id==='boundary'};
      }
      if(result.hit&&softProp(result.touched)){
        const normalSpeed=Math.max(0,-speed*(Math.cos(targetAngle)*result.normalX+Math.sin(targetAngle)*result.normalY));
        const amount=vehiclePropDamage(normalSpeed,spec.halfLength);
        if(amount){
          const prop=result.touched;
          const crush=crushableProp(prop.type,normalSpeed,amount,propHealth.get(prop.id)?.health);
          if(contactLock<=0||crush)damageProp(prop,amount,{cause:'traffic',speed:normalSpeed},targetAngle+(speed<0?Math.PI:0),vandalism);
          if(crush||destroyed.has(prop.id)){
            const loss=prop.type==='bin'||prop.type==='crate'?1.05:2.7;
            const ratio=Math.max(.65,1-loss/Math.max(1,Math.abs(speed)));
            speed*=ratio;impact=Math.max(impact,.18);
            result=moveBody(p.x,p.y,dx*ratio,dy*ratio,{...options,ignoreId:prop.id});
          }
        }
      }
      const collisionPace=Math.abs(oldSpeed);
      const travelDistance=dist(p,result);
      if(collisionPace>=2.8&&travelDistance>.005){
        let struck=0,hitOfficer=false;
        const heading=targetAngle+(oldSpeed<0?Math.PI:0);
        const height=terrainHeight(p.x,p.y)+(p.lift||0);
        for(const actor of actors){
          if(actor.down||actor.stunned||dist(actor,p)>spec.halfLength+travelDistance+1.1||
             Math.abs(height-(actor.lift||0)-terrainHeight(actor.x,actor.y))>1.25||
             (npcShared.get(actor.id)?.healthAt||0)>epoch-1100||
             !sweptPedestrianContact(p,result,targetAngle,spec,actor))continue;
          if(hurtNpc(actor,npcVehicleDamage(collisionPace),heading,clamp(collisionPace/12,.70,1))){
            if(actor.dead)recordAction(isLawOfficer(actor.type)?'killOfficer':'killCivilian');
            struck++;hitOfficer||=isLawOfficer(actor.type);
          }
        }
        if(struck){
          speed*=Math.max(.78,.96-.028*struck);
          impact=Math.max(impact,.22);
          recordAction(hitOfficer?'hitOfficer':'hitCivilian');
        }
      }
      if(result.hit){
        const otherCar=result.touched?.isCar&&!isAircraft(result.touched.type)?result.touched:null;
        const shunt=otherCar&&!isTrain(otherCar.type)&&!carsShared.get(otherCar.vehicleId)?.parkingSlot&&vehicleContact({type:car.type,x:p.x,y:p.y,angle:targetAngle,vx:driveX,vy:driveY,spin:collisionSpin},
          otherCar,result.normalX,result.normalY);
        const normalSpeed=shunt?.closing??Math.max(0,-driveX*result.normalX-driveY*result.normalY);
        if(shunt){
          kickDriver(shunt.a,targetAngle);
          if(!otherCar.peer)displacedCars.push(otherCar,shunt.b,net?.id||'local');
          const otherId=otherCar.vehicleId,previous=lastShunt.get(otherId)??-Infinity;
          if(shunt.closing>.55&&epoch-previous>420){
            lastShunt.set(otherId,epoch);
            emit('vehicleShunt',{id:otherId,type:otherCar.type,x:otherCar.x,y:otherCar.y,...shunt.b});
          }
        }
        if(result.touched?.id==='boundary')speed*=.78;
        else if(contactLock<=0 && normalSpeed>2.2){
          impact=clamp(normalSpeed/12,.25,1);tone(95,.10,'triangle',.04,38);
          const other=result.touched?.isCar?vehicleSpec(result.touched.type):null;
          const impulse=impactSpeeds(spec,other,normalSpeed);
          damageChassis({...car,x:p.x,y:p.y,angle:p.angle},{cause:'crash',speed:impulse.own});
          if(other)damageChassis(result.touched,{cause:'crash',speed:impulse.struck});
          if(normalSpeed>11.5){damage(crashDamage(normalSpeed),targetAngle,.3,'crash');if(life.down)return;}
          if(!otherCar&&result.touched?.id&&remotes.some(e=>e.id===result.touched.id)&&normalSpeed>8){
            emit('hit',{target:result.touched.id,damage:pedestrianDamage(oldSpeed),force:clamp(Math.abs(oldSpeed)/15,.4,1),angle:targetAngle+(speed<0?Math.PI:0),cause:'traffic'});recordAction('hitPlayer');
          }
          contactLock=.32;
        }
        if(!otherCar&&normalSpeed>.12){
          const slide=slideVehicleVelocity(speed,lateralSpeed,targetAngle,result.normalX,result.normalY,normalSpeed>5?.08:0);
          speed=slide.speed;lateralSpeed=slide.lateral;
        }
      }
      p.angle=vehicleTurn(result.x,result.y,targetAngle,oldAngle+turnDelta,options);
      vx=(result.x-p.x)/dt;vy=(result.y-p.y)/dt;p.x=result.x;p.y=result.y;p.moving=Math.hypot(speed,lateralSpeed)>.13;
      updateSuspension(spec,dt);
      if(!drag&&time>freeLookUntil&&(Math.abs(speed)>.21||Math.abs(deltaAngle(yaw,p.angle))>.025))
        yaw=turnTo(yaw,p.angle,6.2+Math.abs(speed)*.04,dt);
      p.sprinting=false;
    }else{
      p.sprinting=!crouched&&!paused&&!swing&&!selfRecoil&&(sprintHeld||keys.has('shift')) && m>.25;
      const c=Math.cos(yaw),s=Math.sin(yaw);
      const attackPace=swing?(swing.kind==='kick' ? .50 : .72):1;
      const footing=(selfRecoil && selfRecoil.progress<.45 ? .35 : attackPace)*(crouched?crouchedPace:1);
      const foot=traversal.step(dt,{x:(sy*c-sx*s)*footing,y:(sy*s+sx*c)*footing,angle:p.angle,sprint:p.sprinting},{destroyed,colliders:obstacles});
      if(crouched&&['idle','walk'].includes(p.motion))p.motion='crouch';
      if(!paused&&traversal.grounded&&m>.12)
        roadMotion={x:(sy*c-sx*s)/Math.min(m,1),y:(sy*s+sx*c)/Math.min(m,1),speed:foot.actual,boundary:foot.boundary};
      vx=foot.vx;vy=foot.vy;p.moving=foot.actual>.11;
      if(traversal.grounded)p.walk+=foot.actual*dt*3.25;
      const firing=keys.has('f')?'key':fireHeld?heldSource:touchFireHeld?'touch':null;
      if(!swing&&firing&&weapon!=='fist'){
        const target=firing==='touch'&&aimLock;
        const bearing=target?Math.atan2(target.y-p.y,target.x-p.x):aimBearing(firing);
        p.angle=turnTo(p.angle,bearing,24,dt);
      }else if(!swing&&time>=shotFacingUntil&&(p.moving||['vault','climb'].includes(p.motion))){
        if(m>.15)meleeCameraAim=false;
        p.angle=turnTo(p.angle,foot.heading,traversal.grounded?12:8,dt);
      }
      // If moving traffic reaches a stationary pedestrian, separate them to the near side of the body.
      if(contactLock<=0&&p.motion!=='swim'){
        const traffic=cars.find(e=>e.moving&&p.lift<vehicleSpec(e.type).height-.08&&Math.abs(e.speed)>1.5&&trafficContact(e,p,.18));
        if(traffic){const dx=p.x-traffic.x,dy=p.y-traffic.y,c=Math.cos(traffic.angle),s=Math.sin(traffic.angle);
          const localX=dx*c+dy*s,localY=-dx*s+dy*c;
          const shape=vehicleSpec(traffic.type);
          if(Math.abs(localX)<shape.halfLength+.18&&Math.abs(localY)<shape.halfWidth+.18){
            const side=(Math.sign(localY)||1)*(shape.halfWidth+.58),px=traffic.x+c*localX-s*side,py=traffic.y+s*localX+c*side;
            if(!contactAt(px,py,{radius:PLAYER_RADIUS,destroyed,colliders:obstacles,ignoreId:traffic.id})){p.x=px;p.y=py;}
            impact=.8;damage(pedestrianDamage(traffic.speed),traffic.angle,clamp(Math.abs(traffic.speed)/13,.38,1),'traffic');contactLock=1.5;
          }}
      }
    }
    turn=clamp(deltaAngle(oldAngle,p.angle)/dt/3,-1,1);
    if(!paused){
      if(meleeHeld||keys.has('v')){if(!swing)startSwing(meleeHeld?'button':'key');}
      else if(keys.has('f'))fire('key');
      else if(fireHeld)fire(heldSource);
      else if(touchFireHeld)fire('touch');
    }
  }
  function playRemoteShot(event,age){
    const d=event.data,effect=weapons[d.kind]?.effect||'shot';
    if(dist(d,p)>=180)return;
    if(age<.2&&Number.isFinite(d.angle))witnessedShots.set(event.player,{angle:d.angle,kind:d.kind,at:epoch-age*1000});
    if(age<effectDuration(effect)){
      const rays=(Array.isArray(d.rays)?d.rays.slice(0,13):[d]).filter(r=>[r.x,r.y,r.angle,r.length].every(Number.isFinite));
      const seen=remotes.find(e=>e.id===event.player);
      const vehicle=d.fromVehicle?(seen?.vehicle||{type:d.fromVehicle,angle:d.angle}):null;
      const origin=offset(d,d.angle,vehicle?-1.8:-.35);
      const anchor=seen&&dist(seen,origin)<2.6&&!!seen.vehicle===!!vehicle?seen:origin;
      showWeaponShot(d.kind,rays,{...anchor,lift:anchor.lift??d.lift,vehicle,isCar:!!vehicle},age);
    }
    if(age<.23&&dist(d,p)<78){
      const profile=weapons[d.kind],volume=1-dist(d,p)/83;
      if(profile?.noise){alertCrowd(d,30);audio.grit(.13,.12*volume,2550);}
      else if(profile)tone(profile.frequency,.08,'sine',.045*volume,profile.frequency*.42);
    }
    if(age<.55&&d.impact&&dist(d.impact,d)<100)view.effect('burst',d.impact.x,d.impact.y,0,0,[],0,age);
  }
  function frame(t){
    if(!isRunning)return;
    const measure=diagnostics.enabled,simStart=measure?performance.now():0;
    const dt=clamp((t-previousFrame)/1000,.001,.075);
    previousFrame=t;time+=dt;epoch=net?.serverTime?.()||Date.now();
    shotPlayback.flush(epoch,playRemoteShot);
    receivePeerSnapshots();
    popTick-=dt;if(popTick<=0){syncPeers();if(p.wanted)dispatchPursuit();popTick=.24;}
    knownByPolice=false;
    const populationStart=measure?performance.now():0;
    population(dt);
    const populationMs=measure?performance.now()-populationStart:0;
    if(!drag && Math.abs(driftX)+Math.abs(driftY)>.002){
      yaw+=driftX*dt;pitch=clamp(pitch+driftY*dt,-.32,1.05);
      driftX*=Math.exp(-12*dt);driftY*=Math.exp(-12*dt);
    }
    if(keys.has('j')||keys.has('l')){yaw+=(keys.has('l')?1:-1)*1.8*dt;meleeCameraAim=true;freeLookUntil=time+2.5;}
    cooldown=Math.max(0,cooldown-dt);contactLock=Math.max(0,contactLock-dt);
    impact=Math.max(0,impact-dt*3);shootPose=Math.max(0,shootPose-dt*4.5);
    if(reloading){reloading=Math.max(0,reloading-dt);if(!reloading){
      const loaded=reloadMagazine(ammo[weapon],reserve[weapon],weapons[weapon].mag);
      ammo[weapon]=loaded.clip;reserve[weapon]=loaded.reserve;
    }}
    const wasWanted=p.wanted,search=pursuitArea();
    if(search&&!knownByPolice&&dist(p,search)>search.radius)searchOutsideSince??=time;
    else searchOutsideSince=null;
    if(searchOutsideSince!==null&&time-searchOutsideSince>=searchEscapeDelay(wasWanted)){
      pursuit.clear(time);searchOutsideSince=null;policeReports.delete(net?.id||'self');
    }else pursuit.tick(time,false,!!search);
    p.wanted=pursuit.state().level;
    if(wasWanted&&!p.wanted)onNotice('Fin des recherches · Tu as semé la police.');
    for(const [id,report] of policeReports)
      if(epoch-report.at>120000&&!(p.wanted&&id===(net?.id||'self')))policeReports.delete(id);
    const medic=!car&&p.lift<1.2&&actors.some(o=>o.type==='medic'&&!o.stunned&&dist(o,p)<2.7);
    if(life.tick(epoch,medic)){
      acceptShotsFrom=life.snapshot().protectedUntil;
      p.health=life.health;pursuit.clear(time);p.wanted=0;wantedEvent=null;resetInputs();
      if(!medic)placeAt(levelPlace||SPAWN);
      onNotice(medic?'L’ambulancier t’a remis sur pied.':'Les secours t’ont reconduit en lieu sûr.');
      sendHud(true);
    }
    p.health=life.health;
    const steps=Math.max(1,Math.ceil(dt/(1/45)));
    for(let i=0;i<steps;i++)move(dt/steps);
    stepSwing();updatePickups();
    for(const [id,s] of witnessedSwings)if(epoch-s.playAt>1600)witnessedSwings.delete(id);
    for(const [id,s] of witnessedShots)if(epoch-s.at>500)witnessedShots.delete(id);
    for(const [id,r] of witnessedRecoils)if(epoch-r.at>1000)witnessedRecoils.delete(id);
    for(const [id,b] of bubbles)if(b.until<epoch)bubbles.delete(id);
    const retaliation=actors.find(o=>!o.stunned&&dist(o,p)<1.65&&reactions.get(o.id)?.fight&&
      [net?.id,'self'].includes(reactions.get(o.id).attacker));
    if(retaliation&&!car&&!life.down&&p.lift<1.1&&contactLock<=0){
      retaliation.melee={kind:'jab',phase:.56};retaliation.impact=.5;
      damage(6,Math.atan2(p.y-retaliation.y,p.x-retaliation.x),.18,'melee','jab');contactLock=1.38;
      audio.grit(.11,.08,660);
    }
    for(const [id,shot] of officerFiring)if(epoch-shot>5200)officerFiring.delete(id);
    for(const officer of actors){
      if(!officer.engaged||officer.stunned||officer.down)continue;
      const {kit}=officer,range=dist(officer,p),last=officerFiring.get(officer.id)||0,elapsed=epoch-last;
      if(elapsed<420)officer.fire=1-elapsed/420;
      if(!canUseForce(p.wanted)||life.down||range<2.6||range>kit.reach||elapsed<kit.interval||p.lift>3.6||contactLock>.5)continue;
      const aim=Math.atan2(p.y-officer.y,p.x-officer.x);
      if(!clearSight(officer,p))continue;
      officerFiring.set(officer.id,epoch);officer.angle=aim;officer.fire=1;
      showWeaponShot(kit.arm,[{x:officer.x,y:officer.y,angle:aim,length:range}],officer);
      tone(105,.10,'triangle',.035,238);
      if(car&&((Math.round(epoch/100)+officer.id.length)%3!==0))continue;
      damage(kit.damage,aim,.18,'police');contactLock=.78;
    }
    const responder=actors.find(o=>o.engaged&&!o.stunned&&!o.down&&dist(o,p)<3.3);
    const stopped=!!responder&&!car&&!boarding&&!life.down&&p.lift<.4&&Math.hypot(vx,vy)<.55&&!swing&&shootPose<.1;
    const nextCustody=custodyTime(custody,dt,stopped);
    if(nextCustody&&!custody)onNotice('Halte ! Reste immobile pour te rendre.');
    custody=nextCustody;
    if(custody>=2.4){
      custody=0;pursuit.clear(time);p.wanted=0;wantedEvent=null;
      placeAt(isEnfer?careerPlaces.police:SPAWN);
      score=Math.max(0,score-15);resetInputs();publish();sendHud(true);
      canvas.dispatchEvent?.(new CustomEvent('maille:arrest',{bubbles:true}));
      onNotice('Arrestation · Tu es relâché devant le commissariat.');
    }
    for(const wear of vehicleWear.values()){
      if(!wear.explodeAt||epoch<wear.explodeAt||exploded.has(wear.id))continue;
      exploded.add(wear.id);
      if(epoch-wear.explodeAt>1800)continue;
      const vehicle=car?.id===wear.id?p:[...cars,...remotes].find(e=>vehicleId(e)===wear.id)||wear;
      const distance=dist(vehicle,p);
      alertCrowd(vehicle,52);
      const exposed=target=>dist(vehicle,target)<1||clearSight(vehicle,target);
      if(distance<115){view.effect('carExplosion',vehicle.x,vehicle.y,0,0,[],.35);audio.grit(.75,.36*(1-distance/120),680);tone(82,.68,'triangle',.14,24);}
      if(distance<blastRadius){
        if(car?.id===wear.id){
          const parked={...car,x:p.x,y:p.y,angle:p.angle,occupied:false,owner:'',moving:false,speed:0,expiresAt:epoch+abandonedFor};
          carsShared.set(car.id,parked);emit('vehicle',parked);dropCar(true);
        }
        const amount=exposed(p)?blastDamage(distance,59):0;
        if(amount>0&&p.lift<3.8)damage(amount,Math.atan2(p.y-vehicle.y,p.x-vehicle.x),.64,'traffic');
      }
      const witnesses=[...(distance<100?[net?.id||'local']:[]),...remotes.filter(e=>dist(e,vehicle)<100).map(e=>e.id)].sort();
      if(witnesses[0]===(net?.id||'local')){
        for(const actor of actors)if(!actor.down&&dist(actor,vehicle)<blastRadius&&exposed(actor)){
          const range=dist(actor,vehicle),amount=blastDamage(range,57);
          if(amount>0)hurtNpc(actor,amount,Math.atan2(actor.y-vehicle.y,actor.x-vehicle.x),.92-range*.04);
        }
        const hits=new Set([wear.id]);
        for(const other of [...cars,...remotes,...(car?[{...car,x:p.x,y:p.y,angle:p.angle,isCar:true}]:[])]){
          if(!other.isCar||hits.has(vehicleId(other))||vehicleHealth(other)===0)continue;
          const range=dist(other,vehicle),amount=blastDamage(range,65);
          if(!amount||!exposed(other))continue;
          const hit={id:vehicleId(other),type:other.type,cause:'blast',blast:wear.id,range,x:other.x,y:other.y,angle:other.angle||0};
          hits.add(hit.id);
          if(net?.status==='online')emit('vehicleDamage',hit);
          else receiveChassis(nextChassis(vehicleWear.get(hit.id),hit,amount,epoch),true);
        }
      }
    }
    audio.update({weather:isEnfer?cityClimate(epoch):null,epoch,vehicleType:car?.type||passengerSeat?.type,speed:car?speed:passengerSeat?.speed??Math.hypot(vx,vy),nearby:nearbyMotor(),driving:!!(car||passengerSeat),walking:!car&&!passengerSeat&&p.moving&&traversal.grounded,city:actors.length>5,sirenDistance:Math.min(145,...cars.filter(e=>e.siren).map(e=>dist(e,p))),time});
    const self={...p,...(car||{}),headlamps:!!car&&lightsOn(),fare:!!car&&fareCar===car.id,melee:swing?{kind:swing.kind,phase:clamp((time-swing.begin)/meleeMoves[swing.kind].duration,0,1)}:null,
      recoil:recoilPhase(selfRecoil,epoch),id:'self',self:true,appearance,bleeding:life.bleeding,stunned:incapacitated(),down:life.down,ragdoll:ragdollPose(life.ragdoll,p.angle,epoch),moving:p.moving,move:p.moving,sprinting:p.sprinting,walk:p.walk,turn,impact,fire:shootPose,steer,
      weapon,aiming:!paused&&!reloading&&(fireHeld||touchFireHeld||keys.has('f')),reload:reloading?1-reloading/weapons[weapon].reload:undefined,
      vehicleId:car?.id,bank:suspension?.bank,carPitch:suspension?.pitch,driverSkin:p.color,brake:braking,emote:bubbles.get(net?.id||'self')?.symbol,bubble:bubbles.get(net?.id||'self')?.symbol,speed:car?speed:Math.hypot(vx,vy),isCar:!!car};
    const renderStart=measure?performance.now():0;
    const presented=view.render({p,crossings:crossingView,lostWool:woolPoint,districtIncident,car:car||passengerSeat,speed,yaw,pitch,cameraConfig,vehicleImpact:car?impact*(isAircraft(car.type)?1:.48):0,passengerView:!!passengerSeat,steering:steer,vehiclePitch:suspension?.pitch,epoch,snap:cameraSnap,destroyed,propHealth,propDamageRevision,pickups,entities:[...(passengerSeat?[]:[self]),...remotes,...cars,...actors].map(e=>e.isCar?{...e,chassisHp:vehicleHealth(e),parts:vehicleWear.get(vehicleId(e))?.parts||0,
      wrecked:exploded.has(vehicleId(e))||burnProgress(vehicleWear.get(vehicleId(e)),epoch)===1,
      burning:!!vehicleWear.get(vehicleId(e))?.fireAt&&(vehicleWear.get(vehicleId(e)).explodeAt||Infinity)>epoch,
      burnProgress:burnProgress(vehicleWear.get(vehicleId(e)),epoch),
      doorOpen:e.doorOpen||movingDoor(vehicleId(e)),
      headlamps:e.headlamps??(!!(e.occupied||e.routeId)&&automaticLights(cityClimate(epoch))),
      signalDetail:dist(e,p)<65,passengerId:cabinPassengers.get(vehicleId(e))?.id,passengerSkin:cabinPassengers.get(vehicleId(e))?.color,
      passenger:cabinPassengers.has(vehicleId(e))||!e.noDriver&&!e.self&&!e.peer&&e.routeId&&(e.type==='taxi'||e.type==='bus'),
      driver:!e.noDriver&&!!(e.self||e.peer||e.occupied||e.routeId)}:e)},dt,time);cameraSnap=false;
    const hudStart=measure?performance.now():0;
    drawAimLock();
    networkTick-=dt;if(networkTick<=0){publish();networkTick=.12;}
    hudTick-=dt;if(hudTick<=0){sendHud();hudTick=.12;}
    mapTick-=dt;if(mapTick<=0){mapTick=.16;if(minimap)paintMap(minimap,p,{full:false,peers:remotes,vehicles:cars,parked:myParkedCars(),pickups,tracked:trackedDrop,...policeMap()});}
    if(measure)diagnostics.frame(t,populationMs,renderStart-simStart,hudStart-renderStart,performance.now()-hudStart,presented!==false,()=>({
      actors:actors.length,cars:cars.length+(car?1:0)+remotes.filter(e=>e.isCar).length,peers:remotes.length,
      requests:net?.requestCount??0,rtt:net?.lastRtt,mode:view.mode,draws:view.drawCalls
    }));
    frameId=requestAnimationFrame(frame);
  }
  function selectWeapon(kind){
    if(incapacitated()||!Object.hasOwn(weapons,kind))return false;
    if(!owned.has(kind)){onNotice(weaponLabels[kind]+' · Ramasse cette arme en ville pour l’équiper.');return false;}
    return equipOwned(kind);
  }
  function equipOwned(kind){
    if(kind===weapon)return true;
    weapon=kind;reloading=0;cooldown=.13;fireHeld=touchFireHeld=false;clearAimLock();shootPose=0;shotFacingUntil=-1;unlock();tone(410,.06);sendHud(true);return true;
  }
  function emote(symbol){if(!symbol||incapacitated())return;const s=String(symbol).slice(0,16);bubbles.set(net?.id||'self',{symbol:s,until:epoch+3700});emit('emote',{symbol:s});unlock();tone(590,.12,'sine',.04,710);}
  function travel(key){if(incapacitated())return false;const place=getTravelPoint(key);if(!place)return false;if(!placeAt(place))return false;levelPlace=place;sendHud(true);onNotice(place.label||'Arrivée à destination.');return true;}
  function cycleRideCamera(steps=1){
    const vehicle=car||passengerSeat;
    const modes=Object.keys(cameraModes).filter(mode=>mode!=='driver'||(!!car&&!isAircraft(vehicle.type)&&!isTrain(vehicle.type)&&view.mode!=='canvas'));
    const index=modes.indexOf(cameraConfig.mode);
    setCameraOptions({mode:modes[(index+steps)%modes.length]});
    onNotice('Vue '+cameraModes[cameraConfig.mode].toLowerCase());
  }
  function action(name,pressed=true){
    if(!pressed){
      if(name==='melee')meleeHeld=false;
      if(name==='jump')traversal.setPressed(false);
      if(name==='touchFire'){touchFireHeld=false;aimX=aimY=0;clearAimLock();}
      if(name==='fire'||name==='shoot')fireHeld=false;
      if(name==='sprint')sprintHeld=false;
      return;
    }
    if(paused||incapacitated())return;unlock();
    if(name==='trainDriver'){boardTrainDriver();return;}
    if(name==='trainPassenger'){interact(true);return;}
    if(name==='reverseTrain'&&railRide){
      if(speed>.15){onNotice('Arrête le train avant d’inverser le sens.');return;}
      railRide.direction*=-1;p.angle=railPose(railRide.train,railRide.d,railRide.direction).angle;
      yaw=p.angle;freeLookUntil=0;cameraSnap=true;publish();sendHud(true);return;
    }
    if(boarding&&!['vehicle','drive','interact','use','enter','carCamera'].includes(name))return;
    if(name==='melee'&&!car){meleeHeld=true;startSwing();}
    if(name==='guard'&&!car&&!passengerSeat&&traversal.grounded&&!boarding&&p.motion!=='swim'){
      crouched=!crouched;networkTick=0;onNotice(crouched?'Garde basse · Marche accroupie':'Debout');
    }
    if(name==='jump'&&!car&&!passengerSeat){crouched=false;traversal.setPressed(true);networkTick=0;}
    if(name==='headlamps'&&car){
      if(lampMode==='auto')lampMode=lightsOn()?'off':'on';
      else if((lampMode==='on')===automaticLights(cityClimate(epoch)))lampMode='auto';
      else lampMode=lampMode==='on'?'off':'on';
      onNotice('Phares · '+({auto:'automatiques',on:'allumés',off:'éteints'})[lampMode]);publish();
    }
    if(name==='horn'&&car&&!isAircraft(car.type)&&epoch-hornAt>=800){hornAt=epoch;audio.horn(car.type);emit('horn',{});}
    if(name==='heal')useMedkit();
    if(['vehicle','drive','interact','use','enter'].includes(name))interact();
    if(name==='fire'||name==='shoot'){fireHeld=true;heldSource='button';fire(heldSource);}
    if(name==='touchFire'){touchFireHeld=true;fire('touch');}
    if(name==='sprint')sprintHeld=true;
    if(name==='reload')readyReload();
    if(name==='carCamera'){
      if(boarding){queuedCameraCycle++;return;}
      if(car||passengerSeat)cycleRideCamera();
      name='recenter';
    }
    if(name==='recenter'){meleeCameraAim=false;yaw=p.angle;pitch=.13;freeLookUntil=0;driftX=driftY=0;}
  }
  function down(e){
    if(paused||incapacitated()||isInput(e.target)||e.altKey||e.metaKey||e.ctrlKey)return;
    const k=e.key.toLowerCase();if(!['x','v','e','h','c','r','k','p','j','l','f','arrowup','arrowdown','arrowright','arrowleft','z','q','s','d','w','a',' ','shift'].includes(k))return;
    if(k===' '&&e.target?.closest?.('button'))return;
    e.preventDefault();unlock();
    if(boarding&&k!=='e'&&k!=='c')return;
    if(!e.repeat){if(k==='x')action('guard');if(k==='p')action('headlamps');if(k==='k')action('horn');if(k==='v')startSwing('key');if(k===' ')action('jump');if(k==='e')interact();if(k==='h')useMedkit();if(k==='c')action(car||boarding||passengerSeat?'carCamera':'recenter');if(k==='r'&&!isAircraft(car?.type)){if(railRide)action('reverseTrain');else if(!car&&!passengerSeat&&closestBoardableCar(true))action('trainDriver');else readyReload();}}
    keys.add(k);
  }
  const up=e=>{const k=e.key.toLowerCase();keys.delete(k);if(k===' ')traversal.setPressed(false);};
  function pointerDown(e){
    if(paused||incapacitated())return;e.preventDefault();canvas.focus({preventScroll:true});unlock();
    if(e.button===2||e.button===1||e.pointerType==='touch'){
      aimPointer=null;drag={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};driftX=driftY=0;canvas.setPointerCapture?.(e.pointerId);return;}
    if(e.button===0&&!boarding){clearAimLock();aimPointer={x:e.clientX,y:e.clientY};fireHeld=true;heldSource='pointer';fire(heldSource);canvas.setPointerCapture?.(e.pointerId);}
  }
  function pointerMove(e){
    if(paused)return;
    if(drag?.id===e.pointerId){
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y,sens=(e.pointerType==='touch'?.006:.0054)*cameraConfig.sensitivity;
      const dYaw=clamp(-dx*sens,-.6,.6),dPitch=clamp(dy*sens*.6,-.26,.26),eventTime=performance.now();
      yaw+=dYaw;if(dYaw)meleeCameraAim=true;pitch=clamp(pitch+dPitch,-.32,1.05);
      const elapsed=clamp((eventTime-drag.t)/1000,.015,.14);
      driftX=clamp(dYaw/elapsed,-3,3)*.14;driftY=clamp(dPitch/elapsed,-2,2)*.12;
      drag.x=e.clientX;drag.y=e.clientY;drag.t=eventTime;freeLookUntil=time+2.1;
    }else if(e.pointerType!=='touch')aimPointer={x:e.clientX,y:e.clientY};
  }
  function pointerUp(e){
    if(drag?.id===e.pointerId){if(performance.now()-drag.t>120)driftX=driftY=0;drag=null;}
    if(e.pointerType!=='touch'&&(e.button===0||e.button==null||e.type==='pointercancel'))fireHeld=false;
  }
  const pointerLeave=()=>{if(!fireHeld)aimPointer=null;};
  const menu=e=>e.preventDefault();
  let wheelAt=-Infinity;
  function cycleWeapon(event){
    if(paused||incapacitated()||event.ctrlKey||event.metaKey||!event.deltaY)return;
    event.preventDefault();
    const now=performance.now();
    if(now-wheelAt<135)return;
    const list=ownedWeapons();
    if(list.length<2)return;
    wheelAt=now;
    equipOwned(list[(list.indexOf(weapon)+Math.sign(event.deltaY)+list.length)%list.length]);
  }
  const visibility=()=>{if(document.hidden)resetInputs();else{previousFrame=performance.now();popTick=0;}};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',resetInputs);document.addEventListener('visibilitychange',visibility);
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
  canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerleave',pointerLeave);canvas.addEventListener('contextmenu',menu);canvas.addEventListener('wheel',cycleWeapon,{passive:false});
  const detachEvent=net?.onEvent?.(e=>{
    const d=e.data||{};
    if(e.type==='armory'){
      authoritativeAmmo=d.rounds;
      let unlocked=false;
      for(const w of weaponList){
        if(!Number.isFinite(w.mag))continue;
        const total=Number.isSafeInteger(d.rounds[w.id])?Math.min(ammoCapacity(w.id),Math.max(0,d.rounds[w.id])):0;
        if(Object.hasOwn(d.rounds,w.id)&&!owned.has(w.id)){
          // A local claim will equip its item when the matching receipt resolves.
          const claiming=pickups.some(drop=>drop.weapon===w.id&&pendingPickup.has(drop.id));
          if(!claiming){owned.add(w.id);unlocked=true;}
          ammo[w.id]=Math.min(w.mag,total);
        }else ammo[w.id]=Math.min(total,ammo[w.id]);
        reserve[w.id]=total-ammo[w.id];
      }
      if(unlocked)onLoadoutChange(ownedWeapons());sendHud(true);return;
    }
    if(e.type==='seatResult'){
      if(seatPending?.leave&&!d.seat&&passengerSeat)releasePassenger();
      if(seatPending&&!seatPending.leave&&!d.seat)onNotice('La place est occupée ou le véhicule a démarré.');
      seatPending=null;
    }
    if(e.type==='melee'&&e.player!==net?.id&&Object.hasOwn(meleeMoves,d.kind)&&Math.abs(epoch-d.started)<1400&&dist(d,p)<PEER_RANGE){
      const current=witnessedSwings.get(e.player);
      if(!current||current.started<d.started){
        const playAt=Math.max(d.started,epoch-meleeMoves[d.kind].contact*700);
        witnessedSwings.set(e.player,{kind:d.kind,started:d.started,playAt,angle:d.angle});
      }
    }
    if(e.type==='hit'&&d.cause==='melee'&&e.player!==net?.id&&d.target!==net?.id&&meleeMoves[d.kind]){
      const target=remotes.find(a=>a.id===d.target);
      if(target&&Math.abs(epoch-e.at)<1100){
        witnessedRecoils.set(d.target,{at:epoch,angle:d.angle,force:d.force});
        view.effect('meleeImpact',target.x,target.y,d.angle,d.force,[],(target.lift||0)+meleeMoves[d.kind].height);
      }
    }
    if(e.type==='alert'&&e.player!==net?.id&&Number.isFinite(d.x+d.y))policeReports.set(e.player,{x:d.x,y:d.y,angle:d.angle||0,at:e.at||epoch});
    if(e.type==='horn'&&e.player!==net?.id&&epoch-e.at<1200&&dist(d,p)<70){
      const distance=dist(d,p);
      audio.horn(d.vehicleType||'car',1-distance/70,.36,soundPan(d,distance));
    }
    if(e.type==='emote')bubbles.set(e.player,{symbol:String(d.symbol||''),until:epoch+3600});
    if(e.type==='hit'&&d.target===net?.id){
      const clock=net?.serverTime?.()??epoch,at=Number.isFinite(e.at)?e.at:clock;
      const physical=d.cause==='melee',traffic=d.cause==='traffic';
      // Only the Worker places a shot ID and firing time on a confirmed weapon hit.
      // By delivery time the shooter may already have driven away or left the world.
      const confirmed=d.cause==='weapon'&&typeof d.shotId==='string'&&d.shotId.length>0&&Number.isSafeInteger(d.firedAt)&&Object.hasOwn(weapons,d.weapon);
      const sender=confirmed?null:(net?.peers?.()||[]).find(peer=>peer.id===e.player);
      const eventId=confirmed?e.player+'/fire/'+d.shotId:e.seq==null?null:e.player+'/'+e.seq;
      const eligible=confirmed?d.firedAt>=acceptShotsFrom:
        sender&&dist(sender,p)<=(physical?4.7:traffic?17:maxShotRange+15)&&
        (!physical||(!car&&Object.hasOwn(meleeMoves,d.kind)&&Math.abs(terrainHeight(p.x,p.y)+p.lift-terrainHeight(sender.x,sender.y)-(sender.lift||0))<2));
      if(e.player!==net?.id&&eligible&&Math.abs(clock-at)<5500&&(!eventId||!receivedHits.has(eventId))){
        if(eventId){receivedHits.set(eventId,at);if(receivedHits.size>160)receivedHits.delete(receivedHits.keys().next().value);}
        const angle=Number.isFinite(d.angle)?d.angle:sender?Math.atan2(p.y-sender.y,p.x-sender.x):p.angle;
        epoch=clock;
        if(physical){
          const move=meleeMoves[d.kind];
          damage(move.damage,angle,move.force,'melee',d.kind);
          view.effect('meleeImpact',p.x,p.y,angle,move.force,[],p.lift+move.height);
        }else damage(clamp(Number(d.damage)||0,0,100),angle,clamp(Number.isFinite(d.force)?d.force:(d.damage||0)/55,0,1),traffic?'traffic':'weapon',d.weapon);
      }
    }
    if(e.type==='propDamage'){
      const own=e.player===net?.id&&pendingImpacts.get(d.impactId)?.prop.id===d.id;
      const changed=confirmProp(d);
      if(changed&&d.damage>0&&(d.health===0||!own)){
        propEffect(d.health===0?'propBreak':'propHit',d,d.angle);
      }
      if(own)settlePropImpact(d.impactId,d.health===0&&d.damage>0);
    }
    if(e.type==='propDamageDenied'&&pendingImpacts.get(d.impactId)?.prop.id===d.id)settlePropImpact(d.impactId,false);
    if(e.type==='destroy'){
      if(!destroyed.has(d.id)){
        const o=nearbyProps(p.x,p.y,125).find(o=>o.id===d.id);
        if(o){
          view.effect('burst',o.x,o.y);
          if(d.cause==='melee'&&meleeMoves[d.swingKind])view.effect('meleeImpact',o.x,o.y,0,meleeMoves[d.swingKind].force,[],meleeMoves[d.swingKind].height);
        }
      }
      destroyed.add(d.id);
    }
    if(e.type==='vehicleShunt'&&e.player!==net?.id&&epoch-e.at<1200&&dist(d,p)<45){
      if(car?.id===d.id){
        if(epoch-(lastShunt.get(d.source)??-Infinity)>650){
          kickDriver(d,p.angle);lastShunt.set(d.source,epoch);networkTick=0;
        }
      }else{
        const v=cars.find(v=>v.id===d.id&&dist(v,d)<9);
        if(v&&!v.parkingSlot)displacedCars.push(v,d,e.player);
      }
    }
    if(e.type==='vehicle'&&!retired(d.id)&&!parkingExpired(d,epoch)){
      displacedCars.delete(d.id);
      if(!d.shifted&&epoch-e.at<920)openedDoors.set(d.id,{at:e.at,side:d.eject?Math.sign((d.eject.y-d.y)*Math.cos(d.angle||0)-(d.eject.x-d.x)*Math.sin(d.angle||0))||-1:-1});
      carsShared.set(d.id,{...d,lastSeen:d.lastSeen||e.at||epoch});
      if(d.eject)noteDisplacedDriver(d);
      if(boarding?.vehicle.id===d.id&&d.occupied){
        if(e.player===net?.id&&boarding.sent){boarding.accepted=d;boarding.exitUntil=time+.38;}
        else if(e.player!==net?.id)cancelBoarding('Un autre joueur a pris le volant.');
      }else if(d.eject&&e.player===net?.id&&d.occupied&&car?.id!==d.id&&e.at+5000<epoch){
        emit('vehicle',{id:d.id,type:d.type,x:d.x,y:d.y,angle:d.angle,occupied:false});
      }
    }
    if(e.type==='vehicleDenied'&&d.id===boarding?.vehicle.id)cancelBoarding('Un autre joueur a pris le volant.');
    if(e.type==='vehicleDamage')receiveChassis(d,e.player===net?.id);
    if(e.type==='vehicleRetired'&&d.until>epoch)retireVehicle(d.id,d.until);
    if(e.type==='vehicleDenied'&&d.id===car?.id){
      if(travelClaim?.previousOwners.includes(d.owner)){travelClaim.sent=false;travelClaim.retryAt=epoch+1000;}
      else{dropCar(true);onNotice('Un autre joueur a pris le volant.');}
    }
    if(e.type==='npc'){if(d.kind){
      if((incidents.get(d.id)?.started??0)<d.started)incidents.set(d.id,d);
    }else{
      if(e.player!==net?.id&&d.recoil&&meleeMoves[d.swingKind]&&d.damage>0&&Math.abs(epoch-e.at)<1100&&dist(d,p)<75){
        view.effect('meleeImpact',d.recoil.fromX,d.recoil.fromY,d.recoil.angle,d.recoil.force,[],meleeMoves[d.swingKind].height);
      }
      if(d.damage>0&&['weapon','melee'].includes(d.cause)&&epoch-d.healthAt<4500&&Number.isFinite(d.threatX+d.threatY)){
        const threat={x:d.threatX,y:d.threatY},target=actors.find(o=>o.id===d.id)||d;
        alertCrowd(threat,d.cause==='weapon'?27:8);
        const reaction=reactionTo(target,threat,epoch,true);
        if(reaction)reactions.set(d.id,{...reaction,attacker:e.player});
      }
      rememberNpc(d,true);
    }}
    if(e.type==='shot'&&e.player!==net?.id&&dist(d,p)<180)shotPlayback.push(e,net?.serverTime?.()??epoch);
  });
  ready=true;sendHud(true);
  if(view.available){receivePeerSnapshots();syncPeers();population(.016);publish();frame(previousFrame+.1);}
  return {available:view.available,diagnostics,get graphicsMode(){return view.mode;},getCameraOptions:()=>({...cameraConfig}),setCameraOptions,destinations,travel,exportTravelState,restoreTravelState,getPursuitSnapshot:pursuitSnapshot,getVitalitySnapshot:()=>life.snapshot(),
    setSkin(value){baseSkin=foxSkin(value).id;p.color=withJacket(baseSkin,jacketDye);publish();},
    setCareerOutfit(state){parkingOwner=state.parkingOwner||null;jacketDye=state.dye||null;p.color=withJacket(baseSkin,jacketDye);armorLayer.apply(state);sendHud(true);},
    eatShopFood(amount){if(life.eat(amount,epoch)){p.health=life.health;sendHud(true);publish();}},
    getArmorWear:()=>armorLayer.wear(),
    vendorAvailable(id){return !npcIsDead(npcShared.get(retailClerkId(id,epoch)));},
    setHandbrake(value){mobileHandbrake=!!value&&!paused;},
    vehicleDeliverySpot(type){
      if(car||passengerSeat||incapacitated()||!traversal.grounded||p.motion==='swim')return null;
      const vehicle={id:'delivery-probe',type},air=isAircraft(type);
      for(const distance of [6,9,13,17,20])for(const turn of [0,Math.PI/2,-Math.PI/2,Math.PI,.8,-.8,2.5,-2.5]){
        const center=offset(p,p.angle+turn,distance),angle=deltaAngle(0,p.angle+(Math.abs(turn)>2.3?Math.PI:0));
        const point=travelSpot(center.x,center.y,angle,vehicle,net?.id,0);
        if(!point||swimmingSurface(point.x,point.y,true)!=null)continue;
        if(!air&&!clearsTrafficAtRest({...point,angle},type))continue;
        if(crossingBlocks.some(g=>dist(g,point)<g.halfLength+5))continue;
        return {...point,angle};
      }
      return null;
    },
    setAppearance(value){appearance=value&&typeof value==='object'&&!Array.isArray(value)?{...value}:null;publish();},emote,selectWeapon,action,setPaused(v){paused=!!v;if(paused)resetInputs();},clearInputs:resetInputs,
    setMove(x,y){if(incapacitated())return;stickX=clamp(Number(x)||0,-1,1);stickY=clamp(Number(y)||0,-1,1);if(stickX||stickY)unlock();},
    setFlightVertical(value){mobileLift=isAircraft(car?.type)&&!paused?clamp(Number(value)||0,-1,1):0;},
    setDrive(x,y){mobileSteer=car&&!paused?clamp(Number(x)||0,-1,1):0;mobileThrottle=car&&!paused?clamp(Number(y)||0,-1,1):0;},
    setAim(x,y){
      aimX=clamp(Number(x)||0,-1,1);aimY=clamp(Number(y)||0,-1,1);
      if(Math.hypot(aimX,aimY)>.15){
        clearAimLock();
        if(swing&&!swing.resolved&&(swing.source==='touch'||swing.source==='button'))swing.bearing=aimBearing(swing.source,true);
      }
    },
    setAimAssist(enabled){aimAssist=!!enabled;if(!aimAssist)clearAimLock();},
    setLostWool(point){woolPoint=point;},
    setDistrictIncident(incident){districtIncident=incident;},
    setFarePassenger(id){if(fareCar!==id){fareCar=id||null;publish();}},
    setRadio(v){audio.setRadio(v);},
    setSound(v){audio.toggle(!!v);if(v)unlock();},
    getWeaponAmmo(id){return owned.has(id)?ammo[id]:undefined;},getWeaponReserve(id){return owned.has(id)?reserve[id]:undefined;},
    projectPlace(x,y){return view.projectTarget?.(x,y,2.1);},
    getPosition(){return {x:p.x,y:p.y,angle:p.angle,district:district(),...(traversal.aircraftFall||(isAircraft(car?.type)||isAircraft(passengerSeat?.type))&&heightAboveLanding(p)>.18?{airborne:true}:{}),...(p.motion==='swim'?{swimming:true}:{})};},
    getRoadMotion(){return paused||incapacitated()?null:roadMotion;},
    getAvailableDrops,
    trackDrop(drop){trackedDrop=drop;sendHud(true);},
    drawFullMap(target,districtZoom=false){paintMap(target,p,{districtZoom,full:true,peers:net?.peers?.()||remotes,vehicles:cars,parked:myParkedCars(),pickups:getAvailableDrops(),tracked:trackedDrop,...policeMap()});},
    destroy(){isRunning=false;clearAimLock();cancelAnimationFrame(frameId);detachEvent?.();view.dispose();
      window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',resetInputs);document.removeEventListener('visibilitychange',visibility);
      canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);
      canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('pointerleave',pointerLeave);canvas.removeEventListener('contextmenu',menu);canvas.removeEventListener('wheel',cycleWeapon);audio.dispose();
    }
  };
}
