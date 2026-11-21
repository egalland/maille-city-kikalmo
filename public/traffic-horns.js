const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function hornCause(driver,player){
  if(!player||player.lift>.75)return null;
  const dx=player.x-driver.x,dy=player.y-driver.y,range=Math.hypot(dx,dy);
  if(range>23||range<.1)return null;
  const c=Math.cos(driver.angle),s=Math.sin(driver.angle);
  const forward=dx*c+dy*s,side=-dx*s+dy*c;
  const playerSpeed=Math.hypot(player.vx||0,player.vy||0);
  const rvx=(player.vx||0)-c*driver.speed,rvy=(player.vy||0)-s*driver.speed;
  const relativeSpeed=rvx*rvx+rvy*rvy;
  const closing=-(rvx*dx+rvy*dy)/range;
  const eta=relativeSpeed>0?closing*range/relativeSpeed:Infinity;
  if(forward>0&&playerSpeed>4.5&&closing>5.2&&eta>=0&&eta<1.65&&
    Math.hypot(dx+rvx*eta,dy+rvy*eta)<(player.halfWidth||.46)+1.26&&range<8.5+closing*.72)
    return 'danger';
  if(!driver.waitingAtSignal&&driver.speed<1.55&&driver.brake&&playerSpeed<1.65&&
    forward>1.4&&forward<8.8&&Math.abs(side)<(player.halfWidth||.40)+1.02)
    return 'obstruction';
  return null;
}

export function createTrafficHorns(random=Math.random){
  const drivers=new Map();
  let lastHorn=-Infinity;
  return {reset(){drivers.clear();lastHorn=-Infinity;},step(traffic,player,epoch,visible){
    let chosen=null;
    for(const driver of traffic){
      const cause=hornCause(driver,player);
      let state=drivers.get(driver.id);
      if(!cause){
        if(state&&epoch-state.seen>480)state.cause=null;
        continue;
      }
      if(!state){state={ready:-Infinity};drivers.set(driver.id,state);}
      if(!state.cause||epoch-state.seen>480||cause==='danger'&&state.cause!=='danger'){
        state.cause=cause;
        state.reacts=random()<(cause==='danger'?.84:.57);
        state.sounded=false;
        state.delay=cause==='danger'?85+random()*345:1800+random()*3750;
        state.since=epoch;
      }
      state.seen=epoch;
      if(!state.reacts||state.sounded||epoch<state.ready||epoch-state.since<state.delay||epoch-lastHorn<950)continue;
      if(!visible(driver,player))continue;
      const distance=Math.hypot(driver.x-player.x,driver.y-player.y);
      const priority=distance-(cause==='danger'?12:0);
      if(!chosen||priority<chosen.priority)chosen={driver,state,cause,priority};
    }
    for(const [id,state] of drivers)if(epoch-state.seen>33000)drivers.delete(id);
    if(!chosen)return null;
    chosen.state.sounded=true;chosen.state.ready=epoch+13500+random()*12500;
    lastHorn=epoch;
    return {driver:chosen.driver,duration:chosen.cause==='danger'?.24+random()*.20:clamp(.26+random()*.45,.24,.68)};
  }};
}
