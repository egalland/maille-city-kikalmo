import {vehicleSpec} from './vehicle-types.js';

export const dealership=new Map([
  ['compact',420,'#b07758'],['estate',780,'#679287'],['sport',1450,'#ad5657'],
  ['gt',2650,'#505e74'],['supercar',4900,'#a34e5c'],['armored',6400,'#64726a'],
  ['helicopter',7900,'#c08254'],['tank',11800,'#72775c']
].map(([id,price,color])=>[id,{id,price,color,name:vehicleSpec(id).label}]));
export const deliveryRange=24;
