import {vehicleSpec} from './vehicle-types.js';
import {weaponCatalog} from './weapon-catalog.js';

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
export function chassisDamage(type,{cause,speed,weapon,part,swingKind}){
  const mass=vehicleSpec(type).mass;
  const vulnerability=Math.max(.60,Math.min(1.25,(1350/mass)**.24));
  if(cause==='melee')return swingKind==='kick'?2:1;
  if(cause==='weapon'){
    if(!Object.hasOwn(weaponCatalog,weapon)||weapon==='fist')return 0;
    const factor=part==='engine'?.50:part==='glass'?.09:partMask[part]>1?.10:.31;
    return Math.max(1,Math.round(weaponCatalog[weapon].damage*factor*vulnerability));
  }
  if(cause!=='crash'||!Number.isFinite(speed)||speed<5.5)return 0;
  const closing=Math.min(85,speed)-4.5;
  return Math.min(76,Math.max(1,Math.round((.12*closing+.037*closing**2)*vulnerability)));
}

export const partMask={body:0,engine:0,glass:1,frontLeft:2,frontRight:4,rearLeft:8,rearRight:16};
export const vehicleBurnDelay=12_000;
export const blastRadius=8.5;
export function blastDamage(distance,max=52){
  return Math.max(0,Math.round(max*(1-distance/blastRadius)));
}
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
  if(height<.33&&Math.abs(along)>.39&&Math.abs(along)<1.2){
    return (along>0?'front':'rear')+(across>0?'Right':'Left');
  }
  if(height>.57&&!spec.openSeat&&(Math.abs(along)<.82||height>.69))return 'glass';
  if(height>.29&&along>.48)return 'engine';
  return 'body';
}
export function damagedTires(parts){return [2,4,8,16].filter(bit=>parts&bit).length;}
export function wheelPart(front,right){return (front?2:8)*(right?2:1);}

// Bodywork can crumple or a tyre can fail without starting an engine fire.
export function incendiaryImpact(hit) {
  return hit.cause==='blast'||hit.part==='engine'||hit.cause==='crash'&&hit.speed>=27;
}

export function nextChassis(previous,hit,amount,now){
  const start=chassisHealth(previous?.hp);
  const floor=hit.cause==='melee'?Math.min(start,meleeWearFloor):0;
  const hp=Math.max(floor,start-amount);
  const fireAt=previous?.fireAt||(hp<=ignitionHealth&&incendiaryImpact(hit)?now:0);
  const disabledAt=hp===0&&!fireAt?now:0;
  return {...hit,hp,...(previous?.repairedAt?{repairedAt:previous.repairedAt}:{}),parts:(previous?.parts||0)|(partMask[hit.part]||0),
    disabledAt,fireAt,fireHp:fireAt?(previous?.fireHp||hp||1):0,explodeAt:fireAt?(previous?.explodeAt||fireAt+vehicleBurnDelay):0};
}
