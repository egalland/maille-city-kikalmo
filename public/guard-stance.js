export const crouchedPace=.46;
export const isLow=actor=>actor?.motion==='crouch';

// A raised guard absorbs frontal hand strikes. An impact angle runs from attacker to victim.
export function guardedFraction(motion,facing,impactAngle,cause){
  if(motion!=='crouch'||cause!=='melee'||!Number.isFinite(impactAngle))return 1;
  return Math.cos(impactAngle+Math.PI-facing)>.34?.36:1;
}

// Probe the strip immediately between the sheltering person and the observer.
export function behindCar(observer,target,vehicles,contains){
  if(!isLow(target))return false;
  const dx=observer.x-target.x,dy=observer.y-target.y,range=Math.hypot(dx,dy);
  if(range<1)return false;
  return vehicles.some(v=>{
    if((v.id&&v.id===observer.id)||v.type==='scooter'||Math.hypot(v.x-target.x,v.y-target.y)>6)return false;
    for(let d=.35;d<Math.min(range,3.6);d+=.60){
      if(contains(v,{x:target.x+dx*d/range,y:target.y+dy*d/range},0))return true;
    }
    return false;
  });
}
