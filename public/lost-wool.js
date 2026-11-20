// Server time gives every player the same timed find; completion belongs to their career.
const period=12*60000,hunt=8*60000;
const places=[
  {id:'wool-garage',name:'Rue des Glycines',x:-74.31,y:-156.38},
  {id:'wool-station',name:'Rue des Prés',x:40.73,y:-96.29},
  {id:'wool-quay',name:'Rue des Tisserands',x:162.75,y:-162.92}
];
export const woolCounter={id:'wool-return',name:'Mercerie des Halles',x:-7.37,y:-277.54};
export const woolReward=24;
export const woolRadius=2.6;
export function lostWool(now,progress){
  const slot=Math.floor(now/period),start=slot*period,point=places[(slot%places.length+places.length)%places.length];
  const record=progress?.slot===slot?progress:null;
  const phase=record?.paid?'paid':record?'carrying':now-start<hunt?'find':'closed';
  return {slot,phase,point,goal:phase==='carrying'?woolCounter:point,ends:start+(phase==='find'?hunt:period)};
}
