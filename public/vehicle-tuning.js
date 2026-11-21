import {careerPlaces} from './career-catalog.js';

export const tuningSites=[
  careerPlaces.garage,
  {id:'atelier-mont-renaud',name:'Atelier Norauto · Mont Renaud',x:-1535.2,y:1023.4,mall:true}
];
export const tuningCatalog=new Map([
  ['engine','Moteur sport',380,1,'Relances plus franches et vitesse de pointe accrue.'],
  ['brakes','Freins renforcés',245,2,'Distance de freinage réduite.'],
  ['grip','Suspension et pneus sport',315,4,'Plus de tenue en virage et moins de glisse.'],
  ['nitro','Nitro',580,8,'Maintiens J en accélérant. La réserve se recharge quand tu relâches.'],
  ['spoiler','Aileron arrière',170,16,'Aileron visible et meilleure stabilité à grande vitesse.'],
  ['splitter','Lame avant',130,32,'Lame visible sous le pare-chocs avant.'],
  ['skirts','Bas de caisse et diffuseur',195,64,'Jupes latérales et diffuseur arrière visibles en jeu.']
].map(([id,name,price,bit,description])=>[id,{id,name,price,bit,description}]));
const roadTypes=new Set(['compact','car','sedan','estate','sport','gt','supercar','pickup']);
export const tunable=type=>roadTypes.has(type);
export const tuningBits=value=>Number.isInteger(value)?value&127:0;
export const atTuningSite=p=>tuningSites.find(s=>Math.hypot(p.x-s.x,p.y-s.y)<=14);
export function tunedHandling(spec,parts,speed=0){
  if(!(parts&23))return spec;
  const aero=parts&16?Math.max(0,Math.min(1,(Math.abs(speed)-12)/22))*.10:0;
  return {...spec,accel:spec.accel*(parts&1?1.2:1),forward:spec.forward*(parts&1?1.05:1),
    powerBand:spec.powerBand*(parts&1?1.045:1),brake:spec.brake*(parts&2?1.23:1),
    traction:spec.traction*(parts&4?1.19:1)*(1+aero),steering:spec.steering*(parts&4?1.12:1)};
}
