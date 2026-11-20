import {fleetHandling} from './vehicle-handling.js';
// Metres and seconds. steering is the peak yaw rate, cruise scales normal city traffic.
const specs={};
// Longitudinal seat anchors (metres forward of centre) for vehicles with a cab-over or saddle.
const seatOffsets={helicopter:.54,airship:.70,cargo:-.74,scooter:-.24,motorbike:-.26,estate:.07,camper:1.32,flatbed:1.50};
function define(type,label,length,width,height,forward,reverse,accel,brake,steering,cruise,openSeat=false){
  specs[type]=Object.freeze({...fleetHandling(type),label,seatOffset:seatOffsets[type]??length*.08,halfLength:length/2,halfWidth:width/2,height,forward,reverse,accel,brake,steering,cruise,openSeat});
}
define('car','Berline rétro',4.12,1.80,1.72,30,7,7.6,14,1.26,1.00);
define('compact','Citadine',3.42,1.62,1.65,24,6.5,8.1,14.8,1.62,.94);
define('sedan','Grande berline',4.58,1.87,1.56,32,7.2,7.1,13.1,1.18,1.04);
define('taxi','Taxi parisien',4.62,1.86,1.85,29,7,7.2,14,1.23,1.02);
define('van','Fourgonnette',4.84,2.02,2.17,24,5,5.4,11.5,.99,.86);
define('bus','Autobus parisien',8.50,2.45,2.95,20,3.7,3.9,8.8,.67,.72);
define('sport','Coupé sport',4.24,1.91,1.26,39,8,11.3,17.5,1.32,1.16);
define('police','Voiture de police',4.32,1.83,1.84,34,7.2,9.2,16,1.32,1.03);
define('ambulance','Ambulance',5.06,2.08,2.32,27,5.2,6,13.8,.97,.90);
define('firetruck','Fourgon de pompiers',5.72,2.26,2.49,24,4.5,5.1,11.8,.86,.79);
define('swat','Fourgon d’intervention',5.17,2.14,2.33,26,5.3,6.7,13.4,.98,.87);
define('scooter','Scooter rétro',2.02,.78,1.20,22,2.2,6.9,12.6,2.10,.90,true);
define('cargo','Triporteur de livraison',2.73,1.08,1.22,8,1.7,2.9,7.5,1.53,.63,true);
define('motorbike','Moto roadster',2.22,.83,1.26,38,2.4,11.4,15.7,1.91,1.08,true);
define('estate','Break du Tisserand',4.59,1.89,1.78,30.5,6.9,7.3,14.4,1.22,1.02);
define('camper','Combi des Saules',4.67,2.03,2.27,21.5,4.4,4.9,10.7,.96,.82);
define('flatbed','Porte-bobines',5.50,2.14,2.20,23,4.3,4.7,11.7,.83,.78);
define('pickup','Camionnette de marché',4.84,1.98,1.86,28,5.8,6.1,12.7,1.06,.87);
define('airship','Dirigeable · Navette Nuage',11.4,4.2,5.1,16,4,2.1,4.1,.46,.50);
define('helicopter','Hélicoptère Libellule',6.9,1.80,2.68,25,7,6.2,8,1.02,.75);
export const vehicleTypes=Object.freeze(Object.keys(specs));
export const isVehicleType=type=>Object.hasOwn(specs,type);
export const vehicleSpec=type=>isVehicleType(type)?specs[type]:specs.car;

// Sidewalk-facing passenger doors on the bus, front doors on the other vehicles.
export function vehicleDoorways(vehicle,clearance=0){
  const {halfLength,halfWidth,seatOffset}=vehicleSpec(vehicle.type),angle=vehicle.angle||0;
  const c=Math.cos(angle),s=Math.sin(angle),side=(vehicle.type==='airship'?.76:halfWidth)+clearance;
  const local=vehicle.type==='bus'?[[halfLength*.73,side],[0,side],[halfLength*.73,-side]]:[[seatOffset,-side],[seatOffset,side]];
  return local.map(([forward,right])=>({x:vehicle.x+c*forward-s*right,y:vehicle.y+s*forward+c*right}));
}
