import {careerPlaces} from './career-catalog.js';

export const tuningSites=[
  careerPlaces.garage,
  {id:'atelier-mont-renaud',name:'Atelier Norauto · Mont Renaud',x:-1535.2,y:1023.4,mall:true}
];
export const tuningCatalog=new Map([
  ['engine','Moteur sport',380,1],['brakes','Freins renforcés',245,2],
  ['grip','Suspension et pneus sport',315,4],['nitro','Nitro',580,8],
  ['spoiler','Aileron arrière',170,16],['splitter','Lame avant',130,32]
].map(([id,name,price,bit])=>[id,{id,name,price,bit}]));
const roadTypes=new Set(['compact','car','sedan','estate','sport','gt','supercar','pickup']);
export const tunable=type=>roadTypes.has(type);
export const tuningBits=value=>Number.isInteger(value)?value&63:0;
export const atTuningSite=p=>tuningSites.find(s=>Math.hypot(p.x-s.x,p.y-s.y)<=14);
export function tunedHandling(spec,parts){
  if(!(parts&7))return spec;
  return {...spec,accel:spec.accel*(parts&1?1.2:1),forward:spec.forward*(parts&1?1.05:1),
    powerBand:spec.powerBand*(parts&1?1.045:1),brake:spec.brake*(parts&2?1.23:1),
    traction:spec.traction*(parts&4?1.13:1),steering:spec.steering*(parts&4?1.09:1)};
}
