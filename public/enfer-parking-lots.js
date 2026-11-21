import {isVehicleType,vehicleSpec} from './vehicle-types.js';
import {isAircraft} from './airfield.js';
import {marketParking} from './mont-renaud.js';

export const parkingLots=[
  {id:'parking-parvis',name:'Parking du Parvis',road:'39413741',x:43.87,y:-299.56,angle:-2.71342,colors:['#aa695e','#629490']},
  {id:'parking-teinturiers',name:'Parking des Teinturiers',road:'39413423',x:111.42,y:-195.82,angle:2.32949,colors:['#8195aa','#c59b68']},
  ...marketParking
];
export const parkingWidth=14.2,parkingDepth=9.8,parkingBayWidth=3.3;
export function lotPoint(lot,along,across){
  const c=Math.cos(lot.angle),s=Math.sin(lot.angle);
  return [lot.x+c*along-s*across,lot.y+s*along+c*across];
}
export function parkingMarkings(lot){
  if(lot.mall){
    const halfDepth=lot.depth/2,halfWidth=lot.columns*3.3/2;
    return (lot.rows===2?[-1,1]:[1]).flatMap(side=>{
      const line=(u,v)=>lotPoint(lot,u,v*side);
      const edge=halfDepth-.35;
      return [[line(-halfWidth,edge),line(halfWidth,edge)],
        ...Array.from({length:lot.columns+1},(_,i)=>{
          const u=-halfWidth+i*3.3;
          return [line(u,edge-4.87),line(u,edge)];
        })];
    });
  }
  const point=(a,b)=>lotPoint(lot,a,b),stripes=[];
  for(const x of [-6.6,-3.3,0,3.3,6.6])stripes.push([point(x,-.35),point(x,4.68)]);
  stripes.push([point(-6.6,4.68),point(6.6,4.68)]);
  for(const side of [-1,1])stripes.push([point(6.96*side,-4.7),point(6.96*side,.38)],
    [point(3.2*side,-6.38),point(3.2*side,-4.7)]);
  return stripes;
}
export function lotSpaces(lot){
  if(lot.mall)return (lot.rows===2?[-1,1]:[1]).flatMap((side,row)=>
    Array.from({length:lot.columns},(_,column)=>{
      const [x,y]=lotPoint(lot,(column+.5-lot.columns/2)*3.3,side*(lot.depth/2-2.8));
      return {id:lot.id+'-'+row+'-'+column,x,y,angle:lot.angle+side*Math.PI/2};
    }));
  return [-4.95,-1.65,1.65,4.95].map((along,index)=>{
    const [x,y]=lotPoint(lot,along,2.22);
    return {id:lot.id+'-'+index,x,y,angle:lot.angle+Math.PI/2};
  });
}
export function parkingSign(lot){return lotPoint(lot,lot.mall?-lot.width/2+1.15:-5.86,lot.mall?-3.6:-4.26);}
const spaces=parkingLots.flatMap(lot=>lotSpaces(lot).map(bay=>({...bay,lot})));
export const parkingLease=7*24*60*60*1000;
export function parkingBay(p,type){
  if(!p||!isVehicleType(type)||isAircraft(type))return null;
  const spec=vehicleSpec(type);
  return spaces.find(bay=>{
    const delta=p.angle-bay.angle,dx=p.x-bay.x,dy=p.y-bay.y;
    const c=Math.cos(bay.angle),s=Math.sin(bay.angle),a=Math.abs(Math.sin(delta)),b=Math.abs(Math.cos(delta));
    return a<.47&&Math.abs(dx*c+dy*s)+spec.halfLength*b+spec.halfWidth*a<=2.64&&
      Math.abs(-dx*s+dy*c)+spec.halfWidth*b+spec.halfLength*a<=1.66;
  })||null;
}
export const parkingDriveways=new Map();
for(const lot of parkingLots){
  if(!lot.road)continue;
  if(!parkingDriveways.has(lot.road))parkingDriveways.set(lot.road,[]);
  parkingDriveways.get(lot.road).push({a:lotPoint(lot,0,-6),d:lotPoint(lot,0,-4.6),street:{w:6.5}});
}
