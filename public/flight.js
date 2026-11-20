import {flightCeiling} from './airfield.js';
import {vehicleSpec} from './vehicle-types.js';
export {helipad,mooring} from './airfield.js';

const constrain=(n,a,b)=>Math.max(a,Math.min(n,b));
const approach=(a,b,step)=>a+constrain(b-a,-step,step);
const profile={
  helicopter:{climb:6.8,sink:4.6,verticalAccel:7.8,horizontalAccel:7.2,yaw:1.14},
  airship:{climb:2.8,sink:2.2,verticalAccel:2.7,horizontalAccel:2.1,yaw:.41}
};

// The skid/nacelle and the upper rotor/envelope occupy different volumes.
// Both query the same terrain, obstacles and active vehicles as the ground game.
export function aircraftObstructed(type,pos,angle,worldAltitude,contact,opt={}){
  const dx=Math.cos(angle),dy=Math.sin(angle);
  const common={...opt,angle,swimmer:true,footWorldZ:worldAltitude};
  if(type==='airship'){
    return contact(pos.x+dx*.7,pos.y+dy*.7,{...common,halfLength:1.55,halfWidth:.83,bodyHeight:1.55})
      ||contact(pos.x,pos.y,{...common,halfLength:5.66,halfWidth:2.08,footWorldZ:worldAltitude+1.46,bodyHeight:3.65});
  }
  return contact(pos.x,pos.y,{...common,halfLength:3.58,halfWidth:.86,bodyHeight:2.34})
    ||contact(pos.x+.28*dx,pos.y+.28*dy,{...common,footWorldZ:worldAltitude+2.48,radius:3.14,bodyHeight:.18});
}

export function stepAircraft(type,pose,input,dt,world){
  const spec=vehicleSpec(type),tuning=profile[type],power=constrain(input.power??1,0,1);
  const oldGround=world.ground(pose.x,pose.y);
  let altitude=Number.isFinite(pose.altitude)?pose.altitude:oldGround+Math.max(0,pose.lift||0);
  const previousRecovery=Math.max(0,(pose.recovery||0)-dt);
  const recovering=previousRecovery>0;
  let recovery=previousRecovery,impact=0,impactKind=null;
  const deckAt=(x,y,ground)=>world.deck?.(x,y)??ground;
  const deck=deckAt(pose.x,pose.y,oldGround);
  const landingDeck=deck>oldGround+.42&&altitude>=deck-.05?deck:oldGround;
  const desiredClimb=power?(input.vertical||0)*(input.vertical>0?tuning.climb:tuning.sink)*Math.sqrt(power):-tuning.sink*(type==='helicopter'?2.1:1);
  let vertical=recovering&&previousRecovery>.40
    ?Math.max(-15,(pose.verticalSpeed||0)-5.8*dt)
    :approach(pose.verticalSpeed||0,desiredClimb,tuning.verticalAccel*dt);
  const water=world.water(pose.x,pose.y);
  const floor=water==null?landingDeck:Math.max(landingDeck,water+.75);
  const nextZ=constrain(altitude+vertical*dt,floor,Math.max(floor,oldGround+flightCeiling));
  const blocked=(x,y,angle,z)=>aircraftObstructed(type,{x,y},angle,z,world.contact,world.options);
  const rotorClearance=type==='helicopter'?2.65:5.1;
  const deckAbove=deck>oldGround+.42&&altitude<deck-.05;
  if(nextZ!==altitude&&(!deckAbove||nextZ+rotorClearance<deck-.32)&&!blocked(pose.x,pose.y,pose.angle,nextZ)){
    altitude=nextZ;
    if(vertical<0&&altitude<=floor+.0001){
      if(type==='helicopter'&&vertical< -3.2){impact=-vertical;impactKind='landing';}
      vertical=impactKind?Math.min(1.7,impact*.17):0;
    }
  }else if(nextZ!==altitude){
    if(type==='helicopter'&&Math.abs(vertical)>2.6){impact=Math.abs(vertical)*1.2;impactKind='vertical';vertical=-vertical*.24;}
    else vertical=0;
  }
  if(vertical<0&&altitude<=floor+.0001||vertical>0&&altitude>=oldGround+flightCeiling-.0001)vertical=0;
  const hovering=altitude>floor+.22;
  const throttle=constrain(input.throttle||0,-1,1);
  const oldSpeed=pose.speed||0,cruise=Math.min(1,Math.abs(oldSpeed)/spec.powerBand);
  const decelerating=throttle&&throttle*oldSpeed<0;
  const rate=type==='helicopter'?(decelerating?spec.brake:throttle?spec.accel*(1-.48*cruise):4.6):tuning.horizontalAccel*(throttle?1:1.45);
  let speed=approach(oldSpeed,hovering&&!recovering?throttle*(throttle<0?spec.reverse:spec.forward)*power:0,rate*dt);
  let x=pose.x,y=pose.y,angle=pose.angle;
  let kick=(pose.kick||0)*Math.exp(-4.8*dt);
  if(hovering||Math.abs(speed)>.5&&impactKind==='landing'){
    const yawRate=type==='helicopter'?tuning.yaw/(1+Math.abs(speed)*.078):tuning.yaw;
    const wantedAngle=angle+((input.steer||0)*yawRate+kick*1.6)*dt;
    if(wantedAngle!==angle&&!blocked(x,y,wantedAngle,altitude))angle=wantedAngle;
    const distance=speed*dt,steps=Math.max(1,Math.ceil(Math.abs(distance)/.55));
    if(Math.abs(distance)>.0001)for(let i=0;i<steps;i++){
      const nx=x+Math.cos(angle)*distance/steps,ny=y+Math.sin(angle)*distance/steps;
      const ground=world.ground(nx,ny),lake=world.water(nx,ny),nextDeck=deckAt(nx,ny,ground);
      const hitsDeck=nextDeck>ground+.42&&altitude<nextDeck-.04&&altitude+rotorClearance>nextDeck-.35;
      if(altitude<ground+.08||lake!=null&&altitude<lake+.74||hitsDeck||blocked(nx,ny,angle,altitude)){
        impact=Math.abs(speed);impactKind='forward';
        if(type==='helicopter'){
          kick=Math.sign((input.steer||0)||speed)*Math.min(.42,.065+impact*.012);
          recovery=Math.min(1.7,.22+impact*.042);
          speed=-Math.sign(speed)*Math.min(6.4,impact*.31);
          if(impact>=11)vertical=Math.min(vertical,-Math.min(12,2+impact*.25));
        }else speed=0;
        break;
      }
      x=nx;y=ny;
    }
  }else speed=0;
  if(impactKind==='landing'&&type==='helicopter')kick=Math.max(kick,Math.min(.3,impact*.03));
  return {x,y,angle,altitude,verticalSpeed:vertical,speed,lift:Math.max(0,altitude-world.ground(x,y)),recovery,kick,
    pitch:approach(pose.pitch||0,(hovering?-speed/spec.forward*.12:0)+Math.abs(kick)*.9,(kick?2.9:.44)*dt),
    bank:approach(pose.bank||0,(hovering?(input.steer||0)*(.08+.12*Math.abs(speed)/spec.forward):0)+kick,(kick?3.7:.65)*dt),
    impact,impactKind};
}
