// Occupants remain in walking-world metres. Seats describe points inside the sprung body
// (+X towards the bonnet, -Z at the driver's door), including the clearance under its roof.
import {Vector3,Quaternion} from './three.js';
import {motionSeed} from './locomotion-pose.js';
import {seatedLimbs,fitLimb} from './saddle-rider.js';

const fittings={
  car:[.046,.47,.385,.21,1.58],sedan:[.046,.39,.385,.31,1.59],taxi:[.046,.46,.385,.22,1.60],
  police:[.046,.46,.385,.22,1.60],compact:[-.31,.37,.35,.22,1.53],sport:[-.00,.25,.39,.46,1.17],
  van:[.01,.69,.39,.18,1.87],ambulance:[.01,.67,.39,.20,1.87],swat:[.01,.67,.39,.20,1.87],
  firetruck:[.01,.67,.39,.20,1.87],bus:[3.55,1.06,.60,.13,2.50],
  estate:[.07,.39,.36,.23,1.52],camper:[1.32,.73,.39,.16,1.89],flatbed:[1.50,.84,.40,.15,2.00],
  pickup:[.345,.56,.374,.20,1.69],helicopter:[.56,.80,.34,.24,1.96],airship:[.74,.38,.32,.23,1.47]
};
export function cabinFit(type,mount){
  const [x,y,spacing,recline,roof]=fittings[type]||fittings.car;
  const hip=mount.hipY??y,lean=mount.recline??recline;
  const ft=mount.units||[1,1,1];
  return {x:mount.hipY===undefined?x:mount.x,y:hip,spacing:mount.hipY===undefined?spacing:mount.spacing,
    recline:lean,roof:mount.roof??roof,units:ft,radius:mount.wheelRadius??.155,
    wheel:mount.wheel??[x+.32/ft[0],hip+.44/ft[1],-spacing]};
}

const serviceCrew={police:'police',ambulance:'medic',firetruck:'firefighter',swat:'swat'};
export function cabinOccupant(pose,index,type,fallback){
  const active=index===0?pose.driver:index===1?pose.passenger:pose.fare;
  if(!active||pose.wrecked)return null;
  const vehicle=pose.vehicleId||pose.id||fallback;
  const player=index===0?!!(pose.self||pose.peer):index===1&&!!(pose.passengerId||pose.passengerSkin);
  const id=player?(index===0?pose.id:pose.passengerId)||'player':index===0?pose.driverId||'exit-'+vehicle:(index===2?'fare-':'rider-')+vehicle;
  return {role:player?'fox':index===0?pose.driverRole||(pose.siren&&serviceCrew[type])||'human':'human',
    skin:player?(index===0?pose.driverSkin:pose.passengerSkin):undefined,seed:motionSeed(id)%65535};
}

export function fitCabinPuppet(group,fit,index){
  const bone={};group.traverse(n=>{if(n.name)bone[n.name]=n;});
  const {core,head}=bone,limbs=seatedLimbs(bone),target=new Vector3(),inverse=new Quaternion();
  const [ux,uy,uz]=fit.units,x=fit.x-(index===2?.82:0),z=index?fit.spacing:-fit.spacing;
  group.position.set(x,fit.y,z);
  group.scale.set(1/ux,1/uy,1/uz);
  const floorClearance=(fit.roof-fit.y)*uy,compact=floorClearance<1.17;
  // Recline a continuous, full-size spine under a low roof. Long fabric ears fold at
  // their stitched base. The soles rest on the footwell even in a very low coupé.
  const lean=Math.max(fit.recline,Math.acos(Math.min(1,Math.max(0,(floorClearance-.36)/.747))));
  core.rotation.z=lean;
  core.position.set(-.247*Math.sin(lean),.247*Math.cos(lean),0);
  inverse.copy(core.quaternion).invert();
  head.rotation.z=-lean*.75;
  if(compact){
    head.position.y-=.048+(floorClearance<1?.06:0);
    head.position.x+=.048;
  }
  if(bone.tail){
    bone.tail.rotation.set(-.1,2.5,.06);
    bone.tail.quaternion.premultiply(inverse);
  }
  if(bone.cape)bone.cape.rotation.z=-.28;
  if(bone.earL)for(const [i,ear] of [bone.earL,bone.earR].entries()){
    ear.rotation.z=compact?1.45:.62;ear.rotation.x=(i?1:-1)*(compact?.28:.14);
  }
  let lastSteer;
  function update(value=0){
    const steer=index?0:Math.round(Math.max(-1,Math.min(1,value||0))*18)/18;
    if(lastSteer===steer)return;
    for(const limb of limbs){
      if(lastSteer!==undefined&&!limb.arm)continue;
      const s=limb.side;
      if(limb.arm&&index===0){
        const theta=steer*.62,c=Math.cos(theta),sin=Math.sin(theta);
        const lift=fit.radius*(.30*c+s*.95*sin),side=fit.radius*(s*.95*c-.30*sin);
        target.set((fit.wheel[0]-x)*ux-.32*lift,(fit.wheel[1]-fit.y)*uy+.948*lift,(fit.wheel[2]-z)*uz+side);
      }else if(limb.arm)target.set(.19,.125,s*.11);
      else target.set(compact?.34:.27,Math.max(compact?-.15:-.19,.23-fit.y*uy),s*.12);
      fitLimb(limb,target.sub(core.position).applyQuaternion(inverse));
    }
    head.rotation.y=-steer*.15;lastSteer=steer;
  }
  update();return update;
}
