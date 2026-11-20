// Fictional fleet tuning. Mass in kg, axle load as fraction of static weight.
const tuning={
  helicopter:[1050,.50,'all',1,1],
  airship:[2060,.48,'all',.91,1],
  car:[1270,.54,'rear',.96,5],compact:[920,.61,'front',.94,5],
  sedan:[1480,.52,'rear',.99,5],taxi:[1580,.55,'rear',.98,5],
  van:[2190,.61,'front',.87,5],bus:[9800,.40,'rear',.80,5],
  sport:[1280,.46,'rear',1.18,6],gt:[1610,.51,'all',1.14,7],
  supercar:[1380,.44,'all',1.28,7],police:[1710,.54,'all',1.08,6],
  ambulance:[3470,.56,'all',.90,5],firetruck:[8200,.46,'all',.84,5],
  swat:[3520,.53,'all',.91,5],scooter:[205,.43,'rear',.85,1],
  estate:[1530,.56,'front',1.01,5],camper:[2270,.43,'rear',.83,4],
  flatbed:[4190,.48,'rear',.87,5],motorbike:[229,.48,'rear',1.09,6],
  cargo:[380,.47,'rear',.76,1],pickup:[2070,.57,'all',.95,5]
};
export function fleetHandling(type){
  const [mass,frontLoad,driveAxle,traction,gears]=tuning[type]||tuning.car;
  return {mass,frontLoad,driveAxle,traction,gears};
}
export function automaticGear(spec,speed){
  if(speed<-.45)return -1;
  const ratio=Math.min(.999,Math.max(0,speed/spec.forward));
  return Math.min(spec.gears,1+Math.floor(ratio*spec.gears));
}
export function wheelForces(spec,speed,surfaceGrip,tyres,reverse=false){
  const grip=spec.traction*surfaceGrip*Math.max(.44,1-.13*tyres);
  const loadTransfer=speed<0?-.05:.07;
  const drivenLoad=spec.driveAxle==='all'?1:spec.driveAxle==='front'?spec.frontLoad-loadTransfer:1-spec.frontLoad+loadTransfer;
  const gear=automaticGear(spec,Math.abs(speed));
  const gearPower=1-.18*Math.max(0,gear-3)/Math.max(1,spec.gears-3);
  // Static load sets the maximum usable launch torque. All wheels brake.
  const accel=Math.min(spec.accel*(reverse?.63:gearPower),9.81*grip*drivenLoad*1.22);
  const brake=Math.min(spec.brake,10.4*grip);
  const tractionYaw=9.81*grip/Math.max(2,Math.abs(speed));
  return {accel,brake,tractionYaw};
}
// Integrate speed in metres/second. Road load always acts, including while
// coasting or braking. At full throttle the governor balances it at the model's top speed.
export function stepRoadDrive(spec,{speed,pedal,grip,tyres,power,grounded,incline,dt}){
  const magnitude=Math.abs(speed),direction=Math.sign(speed);
  const braking=direction!==Math.sign(pedal)&&Math.abs(pedal)>.12&&magnitude>.45;
  const forces=wheelForces(spec,speed,grip,tyres,pedal<0);
  const rolling=.22,aero=.00017+.60*spec.halfWidth*spec.height/spec.mass;
  const roadLoad=rolling+aero*magnitude*magnitude;
  const limit=(pedal<0?spec.reverse:spec.forward)*Math.sqrt(power);
  const ratio=magnitude/Math.max(.01,limit);
  const available=forces.accel*power;
  const fraction=Math.min(1,ratio),topGear=fraction**3;
  const thrust=(1-topGear)*available*(1-.45*fraction)+topGear*(rolling+aero*limit*limit);
  const engine=Math.max(0,thrust-available*3.2*Math.max(0,ratio-1));
  const gravity=magnitude>.10||pedal?-9.81*Math.max(-.35,Math.min(.35,incline)):0;
  const acceleration=grounded?pedal*(braking?forces.brake:engine)-direction*roadLoad+gravity:-direction*.30;
  let next=speed+dt*acceleration;
  if((braking||!pedal)&&Math.sign(next)!==direction)next=0;
  if(!pedal&&Math.abs(next)<.10)next=0;
  return {speed:next,braking,tractionYaw:forces.tractionYaw};
}
export function impactSpeeds(vehicle,other,normalSpeed){
  if(!other)return {own:normalSpeed,struck:0};
  // Change in velocity along the impact normal for a partially inelastic hit.
  const impulse=1.12*normalSpeed/(vehicle.mass+other.mass);
  return {own:impulse*other.mass,struck:impulse*vehicle.mass};
}
