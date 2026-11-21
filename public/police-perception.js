// Observations contain copies. An unseen suspect can never move a previous sighting.
const position = point => ({x:point.x, y:point.y});
const gap = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const searchRadii=[52,70,94,118,145];

export function policeSearchArea(report,stars,visible){
  if(!report||!stars)return null;
  return {x:report.x,y:report.y,radius:searchRadii[stars-1],visible:!!visible};
}

export function searchEscapeDelay(stars){return 8+Math.max(0,stars-1)*2;}

export function canIdentify(observer,suspect,clear) {
  if(!observer||!suspect||observer.down||observer.stunned)return false;
  const distance=gap(observer,suspect);
  if(Math.hypot(distance,(suspect.lift||0)-(observer.lift||0))>(suspect.motion==='crouch'?29:52))return false;
  if(distance>12){
    const bearing=Math.atan2(suspect.y-observer.y,suspect.x-observer.x);
    if(Math.cos(bearing-(observer.angle||0))<-.15)return false;
  }
  return clear(observer,suspect);
}

export function crimeHeardOrSeen(action,source,witnesses,clear) {
  // Direct victims can report an incident. An occupied vehicle also has a witness.
  if(['hitCivilian','hitPlayer','hitOfficer','killCivilian','killOfficer','stealVehicle'].includes(action))return true;
  const audible=action==='gunshot'?14:action==='destroy'?12:0;
  return witnesses.some(w=>{
    if(w.down||w.stunned||w.noDriver)return false;
    const distance=gap(w,source);
    return (audible>0&&distance<audible&&['police','swat'].includes(w.type)&&clear(w,source))||
      (distance<36&&canIdentify(w,source,clear));
  });
}

export function observePursuit(state,{now,observer,suspect,report,clear,walkable,slot=0}) {
  if(!state.lastKnown||state.reportAt<(report.at||0)){
    state.lastKnown=position(report);state.reportAt=report.at||0;state.searched=0;state.searchGoal=null;
  }
  if(!observer)state.visible=false;
  else if(now>=(state.nextLook||0)){
    state.nextLook=now+.28;
    state.visible=canIdentify(observer,suspect,clear);
    if(state.visible){
      state.lastKnown=position(suspect);state.searched=0;state.searchGoal=null;
    }
  }
  if(state.visible&&suspect)return suspect;
  if(observer&&gap(observer,state.lastKnown)<14&&now>=(state.nextSearch||0)){
    state.nextSearch=now+4;
    const phase=slot*1.8+state.searched++*Math.PI*.76;
    for(const offset of [0,.8,-.8,1.6,-1.6]){
      const angle=phase+offset,range=7+Math.min(10,state.searched*2);
      const goal={x:state.lastKnown.x+Math.cos(angle)*range,y:state.lastKnown.y+Math.sin(angle)*range};
      if(walkable(goal)){state.searchGoal=goal;break;}
    }
  }
  return state.searchGoal||state.lastKnown;
}

export function responseUnits(stars) {
  const units=[];
  if(stars>=1)units.push(['police',0]);
  if(stars>=2)units.push(['police',1]);
  if(stars>=3)units.push(['swat',0]);
  if(stars>=4)units.push(['swat',1]);
  if(stars>=5)units.push(['military',0],['tankunit',0],['airunit',0]);
  return units;
}
export function canUseForce(stars) {
  return stars>=2;
}
export function custodyTime(previous,dt,canSurrender){
  return canSurrender?Math.min(2.4,previous+dt):0;
}
