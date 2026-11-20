// A mounted figure uses the same face, clothes, limbs and yarn as its walking rig.
// All contact points are in the bike's sprung frame, in metres (+X forward).
import {Quaternion,Vector3} from './three.js';
import {motionSeed} from './locomotion-pose.js';

export const saddles=Object.freeze({
  scooter: {hip:[-.18,.776,0],foot:[-.01,.355,.145],grip:[.20,1.055,.32],fork:.61,lean:.16},
  motorbike:{hip:[-.26,.820,0],foot:[-.23,.405,.210],grip:[.20,1.055,.36],fork:.69,lean:.35},
  cargo:   {hip:[-.69,.905,0],foot:[-.46,.265,.175],grip:[-.30,1.098,.307],fork:-.12,lean:.22}
});

export function riderIdentity(e){
  if(e.wrecked||e.noDriver||e.driver===false||!(e.driver||e.self||e.peer||e.occupied||!e.parked&&e.routeId))return null;
  const player=!!(e.self||e.peer),role=player?'fox':'human';
  // An ejected driver is represented on foot as exit-<vehicle id>.
  const id=player?e.id:'exit-'+(e.vehicleId||e.id);
  return {id,role,skin:player?e.driverSkin:undefined,seed:motionSeed(id)%65535};
}

export function gripOnFork(mount,side,steering,out){
  const [x,y,z]=mount.grip,dx=x-mount.fork,c=Math.cos(steering),s=Math.sin(steering);
  return out.set(mount.fork+dx*c-side*z*s,y,dx*s+side*z*c);
}

const normal=new Vector3(),perpendicular=new Vector3(),midpoint=new Vector3(),direction=new Vector3(),inverse=new Quaternion();
function fitLimb(limb,goal){
  const {upper,lower,restUpper,restEnd,pole,first,second}=limb;
  direction.copy(goal).sub(upper.position);
  const distance=Math.max(.001,direction.length());normal.copy(direction).divideScalar(distance);
  // Keep a little elbow and knee bend even on the outside of a tight steering lock.
  const stretch=Math.max(1,distance/(first+second)*1.025);
  const a=first*stretch,b=second*stretch,along=Math.min(a,(a*a-b*b+distance*distance)/(2*distance));
  perpendicular.copy(pole).addScaledVector(normal,-pole.dot(normal)).normalize();
  midpoint.copy(normal).multiplyScalar(along).addScaledVector(perpendicular,Math.sqrt(Math.max(0,a*a-along*along)));
  upper.quaternion.setFromUnitVectors(restUpper,direction.copy(midpoint).normalize());
  inverse.copy(upper.quaternion).invert();lower.position.copy(midpoint).applyQuaternion(inverse);
  for(const mesh of upper.children)if(mesh.isMesh)mesh.scale.y=stretch;
  direction.copy(goal).sub(upper.position).sub(midpoint).applyQuaternion(inverse).normalize();
  lower.quaternion.setFromUnitVectors(restEnd,direction);lower.scale.setScalar(stretch);
}

export function createSaddleRig(group,mount,type){
  const bone={};group.traverse(node=>{if(node.name)bone[node.name]=node;});
  group.name='conducteur';
  const limbs=[],target=new Vector3(),coreInverse=new Quaternion();
  for(const side of [-1,1]){
    const suffix=side<0?'L':'R';
    for(const arm of [true,false]){
      const upper=bone[(arm?'arm':'leg')+suffix],lower=bone[(arm?'elbow':'knee')+suffix];
      const restUpper=lower.position.clone(),restEnd=arm?new Vector3(.061,-.166,side*.011):new Vector3(.073,-.218,side*.002);
      const pole=arm?new Vector3(-.40,-.72,side*.66):new Vector3(.94,.38,side*.41);
      limbs.push({side,arm,upper,lower,first:restUpper.length(),second:restEnd.length(),restUpper:restUpper.normalize(),restEnd:restEnd.normalize(),pole});
    }
  }
  const pedal=type==='cargo',[hx,hy]=mount.hip;
  function update(motion,e,time){
    const {roll,steering,phase}=motion,speed=Math.abs(e.speed||0);
    const bounce=.005*Math.sin(time*4.5+phase)*Math.min(1,speed/8);
    const core=bone.core;
    core.position.set(hx+.035,hy+.223+bounce,0);
    core.rotation.set(-roll*.21,0,-mount.lean-.035*Math.min(speed/16,1)+(e.brake?.065:0));
    coreInverse.copy(core.quaternion).invert();
    for(const limb of limbs){
      const {side}=limb;
      if(limb.arm)gripOnFork(mount,side,steering,target);
      else{
        const [x,y,z]=mount.foot;
        target.set(x+(pedal?.054*Math.sin(phase*2)*side:0),y+(pedal?.054*Math.cos(phase*2)*side:0),side*z);
      }
      fitLimb(limb,target.sub(core.position).applyQuaternion(coreInverse));
    }
    bone.head.rotation.set(-roll*.55,-steering*.32,mount.lean*.72-.024*Math.min(speed/16,1));
    bone.eyes.scale.y=1-.9*Math.max(0,1-Math.abs((time%3.63)-.10)/.079);
    if(bone.cape){bone.cape.rotation.z=-.23-.16*Math.min(1,speed/14);bone.cape.rotation.x=-roll*.3;}
    if(bone.tail){bone.tail.rotation.z=-.15+.045*Math.sin(time*4);bone.tail.rotation.y=-roll*.28;}
  }
  return {group,update};
}
