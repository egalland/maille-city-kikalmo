import {vehicleSpec} from './vehicle-types.js';
import {weaponCatalog} from './weapon-catalog.js';

export function chassisHealth(value){return Number.isFinite(value)?Math.max(0,Math.min(100,value)):100;}
export function chassisStage(value){
  const hp=chassisHealth(value);
  return hp===0?3:hp<=32?2:hp<=72?1:0;
}
export function enginePower(value){return [1,.82,.50,0][chassisStage(value)];}
export function chassisDamage(type,{cause,speed,weapon,part}){
  if(cause==='weapon')return Object.hasOwn(weaponCatalog,weapon)&&weapon!=='fist'?Math.round(weaponCatalog[weapon].damage*({engine:1.18,glass:.23,frontLeft:.28,frontRight:.28,rearLeft:.28,rearRight:.28}[part]??.90)):0;
  if(cause!=='crash'||!Number.isFinite(speed)||speed<4.2)return 0;
  const spec=vehicleSpec(type),weight=Math.max(.82,Math.min(1.3,2.08/spec.halfLength));
  return Math.min(61,Math.round((Math.min(42,speed)-3)*2.15*weight));
}

export const partMask={body:0,engine:0,glass:1,frontLeft:2,frontRight:4,rearLeft:8,rearRight:16};
export const vehicleBurnDelay=2700;

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

export function nextChassis(previous,hit,amount,now){
  const hp=Math.max(0,chassisHealth(previous?.hp)-amount);
  return {...hit,hp,parts:(previous?.parts||0)|(partMask[hit.part]||0),
    fireAt:hp<=32?(previous?.fireAt||now):0,explodeAt:hp===0?(previous?.explodeAt||now+vehicleBurnDelay):0};
}
