// An unoccupied chassis rolls on its release velocity. All clients evaluate the
// same clock and stopping distance, including clients that arrive after the stop.
import {vehicleMotionLimit} from './vehicle-types.js';
export const tumbleSpeed=8;
const brakeRate=speed=>2.7+speed*.16;
function coast(vx,vy,range,at){
  const v=Math.hypot(vx,vy),a=brakeRate(v);
  const limit=Math.min(range,v*v/(2*a));
  const seconds=2*limit/(v+Math.sqrt(Math.max(0,v*v-2*a*limit)));
  return {vx,vy,range:limit,at,until:at+seconds*1000};
}
export function planRoadCoast(p,vx,vy,now,blocked){
  const v=Math.hypot(vx,vy);
  if(v<.55)return null;
  const max=v*v/(2*brakeRate(v)),count=Math.ceil(max/.52);
  let clear=0;
  for(let i=1;i<=count;i++){
    const run=max*i/count;
    if(blocked(p.x+vx/v*run,p.y+vy/v*run)){
      let lo=clear,hi=run;
      for(let j=0;j<5;j++){
        const mid=(lo+hi)*.5;
        if(blocked(p.x+vx/v*mid,p.y+vy/v*mid))hi=mid;else lo=mid;
      }
      clear=lo;break;
    }
    clear=run;
  }
  return coast(vx,vy,clear,now);
}
export function cleanRoadCoast(raw,type,now){
  if(!raw||![raw.vx,raw.vy,raw.range,raw.at].every(Number.isFinite))return null;
  const v=Math.hypot(raw.vx,raw.vy);
  if(v<.55||v>vehicleMotionLimit(type)||raw.range<0)return null;
  return coast(raw.vx,raw.vy,raw.range,Math.max(now-1800,Math.min(now,raw.at)));
}
export function sampleRoadCoast(vehicle,now){
  const c=vehicle.roadCoast,initial=Math.hypot(c.vx,c.vy),a=brakeRate(initial);
  const elapsed=Math.max(0,Math.min(now,c.until)-c.at)/1000;
  const distance=Math.min(c.range,Math.max(0,initial*elapsed-a*elapsed*elapsed*.5));
  const v=now>=c.until?0:Math.max(0,initial-a*elapsed);
  const ux=c.vx/initial,uy=c.vy/initial;
  const backwards=ux*Math.cos(vehicle.angle)+uy*Math.sin(vehicle.angle)<0;
  return {x:vehicle.x+ux*distance,y:vehicle.y+uy*distance,angle:vehicle.angle,
    speed:backwards&&v>0?-v:v,
    vx:ux*v,vy:uy*v,moving:v>.05,lift:0,verticalSpeed:0};
}
