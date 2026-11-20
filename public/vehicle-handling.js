// Fictional fleet tuning. Mass in kg, axle load as fraction of static weight.
const tuning={
  helicopter:[1050,.50,'all',1,1],
  airship:[2060,.48,'all',.91,1],
  car:[1270,.54,'rear',.96,5],compact:[920,.61,'front',.94,5],
  sedan:[1480,.52,'rear',.99,5],taxi:[1580,.55,'rear',.98,5],
  van:[2190,.61,'front',.87,5],bus:[9800,.40,'rear',.80,5],
  sport:[1280,.46,'rear',1.18,6],police:[1710,.54,'all',1.08,6],
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
  return Math.min(spec.gears,1+Math.floor(Math.sqrt(ratio)*spec.gears));
}
export function wheelForces(spec,speed,surfaceGrip,tyres,reverse=false){
  const grip=spec.traction*surfaceGrip*Math.max(.44,1-.13*tyres);
  const loadTransfer=speed<0?-.05:.07;
  const drivenLoad=spec.driveAxle==='all'?1:spec.driveAxle==='front'?spec.frontLoad-loadTransfer:1-spec.frontLoad+loadTransfer;
  const gear=automaticGear(spec,Math.abs(speed));
  const gearPower=1-.18*Math.max(0,gear-3)/Math.max(1,spec.gears-3);
  // Static load sets the maximum usable launch torque. All wheels brake.
  const accel=Math.min(spec.accel*(reverse?.63:gearPower),9.81*grip*drivenLoad*1.76);
  const brake=Math.min(spec.brake,13.8*grip);
  const tractionYaw=9.81*grip/Math.max(2,Math.abs(speed));
  return {accel,brake,tractionYaw};
}
export function impactSpeeds(vehicle,other,normalSpeed){
  if(!other)return {own:normalSpeed,struck:0};
  // Change in velocity along the impact normal for a partially inelastic hit.
  const impulse=1.12*normalSpeed/(vehicle.mass+other.mass);
  return {own:impulse*other.mass,struck:impulse*vehicle.mass};
}
