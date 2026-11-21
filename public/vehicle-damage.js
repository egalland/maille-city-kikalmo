import {vehicleSpec} from './vehicle-types.js';
import {isHeavyShot,weaponCatalog} from './weapon-catalog.js';

export function chassisHealth(value){return Number.isFinite(value)?Math.max(0,Math.min(100,value)):100;}
export function chassisStage(value){
  const hp=chassisHealth(value);
  return hp===0?3:hp<=34?2:hp<=96?1:0;
}
// Wear takes torque away gradually. The last few points leave enough power to limp to a stop.
export function enginePower(value){
  const integrity=chassisHealth(value)/100;
  return integrity===0?0:.23+.77*(1-(1-integrity)**1.5);
}
export function chassisGrip(value){return .76+.24*chassisHealth(value)/100;}
export const ignitionHealth=16;
export const meleeWearFloor=42;
export function armoredHull(type){return type==='tank'||type==='armored';}
export function chassisDamage(type,{cause,speed,weapon,part,swingKind,tankRam}){
  if(cause==='weapon'&&isHeavyShot(weapon)){
    const direct=part==='engine',tank=type==='tank',armored=type==='armored';
    if(weapon==='tankShell')return direct?(tank?32:armored?61:180):(tank?15:armored?25:75);
    return direct?(tank?9:armored?28:145):(tank?4:armored?12:48);
  }
  if(cause==='crash'&&tankRam&&speed>=1.45)return type==='tank'?8:type==='armored'?25:135;
  const mass=vehicleSpec(type).mass;
  const vulnerability=Math.max(.60,Math.min(1.25,(1350/mass)**.24));
  if(cause==='melee')return swingKind==='kick'?2:1;
  if(cause==='weapon'){
    if(!Object.hasOwn(weaponCatalog,weapon)||weapon==='fist')return 0;
    const factor=part==='engine'?.50:part==='glass'?.09:(partMask[part]&30)?.10:.31;
    return Math.max(1,Math.round(weaponCatalog[weapon].damage*factor*vulnerability));
  }
  if(cause!=='crash'||!Number.isFinite(speed))return 0;
  if(type==='helicopter'){
    if(speed<=3.2)return 0;
    const closing=speed-3;
    return Math.min(105,Math.max(1,Math.round(closing*.72+.18*closing**2)));
  }
  if(speed<5.5)return 0;
  const closing=Math.min(85,speed)-4.5;
  return Math.min(76,Math.max(1,Math.round((.12*closing+.037*closing**2)*vulnerability*(type==='tank'?.18:type==='armored'?.46:1))));
}

export const partMask={body:0,engine:0,glass:1,frontLeft:2,frontRight:4,rearLeft:8,rearRight:16,
  frontPanel:32,rearPanel:64,leftPanel:128,rightPanel:256};
export function impactPanel(vehicle,dx,dy){
  const spec=vehicleSpec(vehicle.type),c=Math.cos(vehicle.angle||0),s=Math.sin(vehicle.angle||0);
  const length=(dx*c+dy*s)/spec.halfLength,side=(dy*c-dx*s)/spec.halfWidth;
  return Math.abs(length)>Math.abs(side)?length>0?'frontPanel':'rearPanel':side>0?'rightPanel':'leftPanel';
}
export const vehicleBurnDelay=12_000;
export const blastRadius=8.5;
export function blastDamage(distance,max=52){
  return Math.max(0,Math.round(max*(1-distance/blastRadius)));
}
export const vehicleBlastDamage=(type,distance)=>blastDamage(distance,type==='tank'?8:type==='armored'?25:65);
export function chassisHealthAt(wear,now){
  const hp=chassisHealth(wear?.hp);
  if(!wear?.fireAt)return hp;
  const ends=wear.explodeAt||wear.fireAt+vehicleBurnDelay;
  if(now>=ends)return 0;
  return Math.max(1,Math.min(hp||1,Math.ceil((wear.fireHp||Math.min(hp||1,32))*(ends-now)/Math.max(1,ends-wear.fireAt))));
}
export function burnProgress(wear,now){
  if(!wear?.fireAt)return 0;
  return Math.max(0,Math.min(1,(now-wear.fireAt)/Math.max(1,(wear.explodeAt||wear.fireAt+vehicleBurnDelay)-wear.fireAt)));
}

export function vehiclePart(vehicle,point,height){
  const spec=vehicleSpec(vehicle.type),c=Math.cos(vehicle.angle||0),s=Math.sin(vehicle.angle||0);
  const dx=point.x-vehicle.x,dy=point.y-vehicle.y;
  const along=(dx*c+dy*s)/spec.halfLength,across=(dy*c-dx*s)/spec.halfWidth;
  if(vehicle.type==='boxtruck'||vehicle.type==='tipper'){
    const rear=along*spec.halfLength,tipper=vehicle.type==='tipper';
    const axle=tipper?[2.18,-.85,-2.05]:[2.65,-2.09];
    if(height*spec.height<.86&&Math.abs(across)>.52&&axle.some(x=>Math.abs(rear-x)<.54))
      return (rear>0?'front':'rear')+(across>0?'Right':'Left');
    const inCab=rear>spec.halfLength-2.16;
    if(inCab&&height*spec.height>1.50&&height*spec.height<(tipper?2.57:2.46))return 'glass';
    if(inCab&&height*spec.height<1.49&&height*spec.height>.44)return 'engine';
    return 'body';
  }
  if(height<.33&&Math.abs(along)>.39&&Math.abs(along)<1.2){
    return (along>0?'front':'rear')+(across>0?'Right':'Left');
  }
  if(vehicle.type==='gt'||vehicle.type==='supercar'){
    // First-contact rays enter the *outside* edge of the plan-view collider.
    // Above the bonnet or engine lid an end-on ray continues into the windshield.
    const midEngine=vehicle.type==='supercar',motorEnd=midEngine?-along:along;
    const sideGlass=midEngine?along>-.29&&along<.55:along>-.71&&along<.21;
    const endGlass=Math.abs(along)>.98&&Math.abs(across)<.78;
    if(height>(midEngine?.61:.62)&&(sideGlass||endGlass&&height>.72))return 'glass';
    if(height>.29&&height<.76&&motorEnd>(midEngine?.33:.23))return 'engine';
    return 'body';
  }
  if(height>.57&&!spec.openSeat&&(Math.abs(along)<.82||height>.69))return 'glass';
  if(height>.29&&along>.48)return 'engine';
  return 'body';
}
export function damagedTires(parts){return [2,4,8,16].filter(bit=>parts&bit).length;}
export function wheelPart(front,right){return (front?2:8)*(right?2:1);}

// Bodywork can crumple or a tyre can fail without starting an engine fire.
export function incendiaryImpact(hit) {
  return instantImpact(hit)||hit.cause==='blast'||hit.part==='engine'&&!armoredHull(hit.type)||hit.cause==='crash'&&hit.speed>=27;
}

export function instantImpact(hit){
  return hit.cause==='weapon'&&isHeavyShot(hit.weapon)||hit.cause==='crash'&&!!hit.tankRam;
}
export function nextChassis(previous,hit,amount,now){
  const start=chassisHealth(previous?.hp);
  const floor=hit.cause==='melee'?Math.min(start,meleeWearFloor):0;
  const hp=Math.max(floor,start-amount);
  const fireAt=previous?.fireAt||(hp<=ignitionHealth&&incendiaryImpact(hit)?now:0);
  const disabledAt=hp===0&&!fireAt?now:0;
  return {...hit,hp,...(previous?.repairedAt?{repairedAt:previous.repairedAt}:{}),parts:(previous?.parts||0)|(partMask[hit.part]||0),
    disabledAt,fireAt,fireHp:fireAt?(previous?.fireHp||hp||1):0,explodeAt:hp===0&&instantImpact(hit)?now:fireAt?(previous?.explodeAt||fireAt+vehicleBurnDelay):0};
}
