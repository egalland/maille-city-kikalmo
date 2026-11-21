// IGN BD TOPO®, Ligne de Creil à Jeumont, coordinates projected to the Noyon game map.
const alignment=[[-294.74,752.1],[-289.94,747.9],[-284.95,743.4],[-283.05,741.7],
  [-242.49,706.62],[-166.46,645.54],[-93.42,592.56],[-39.87,558.27],[-23.98,548.28],
  [52.76,503.8],[125.09,465.51],[211.02,425.13],[231.61,416.44],[235.11,415.14],
  [238.2,413.64],[261.68,403.74],[341.82,374.06],[380.59,359.67],[393.28,356.17],
  [435.74,344.48],[485.6,331.99],[536.16,320.4],[604.21,308.11],[669.76,297.72],
  [741.4,287.63],[803.85,282.55],[858.41,280.25],[884.69,279.06]];
const segments=[];
let length=0;
for(let i=1;i<alignment.length;i++){
  const a=alignment[i-1],b=alignment[i],dx=b[0]-a[0],dy=b[1]-a[1],span=Math.hypot(dx,dy);
  segments.push({a,b,dx,dy,span,start:length,angle:Math.atan2(dy,dx)});
  length+=span;
}
export const railLength=length;
export const railSpacing=4.32, railGauge=1.435, railEnd=10;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function railPoint(distance,offset=0){
  const d=clamp(distance,0,length),seg=segments.find(s=>d<=s.start+s.span)||segments.at(-1);
  const t=(d-seg.start)/seg.span;
  return {x:seg.a[0]+seg.dx*t-Math.sin(seg.angle)*offset,y:seg.a[1]+seg.dy*t+Math.cos(seg.angle)*offset,angle:seg.angle};
}
export function railDistance(x,y){
  let best=Infinity,d=0;
  for(const {a,dx,dy,span,start} of segments){
    const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(span*span),0,1);
    const error=(x-a[0]-dx*t)**2+(y-a[1]-dy*t)**2;
    if(error<best){best=error;d=start+span*t;}
  }
  return d;
}
export const railStations=[
  {id:'gare-oise',name:'Halte de l’Oise',d:130,side:-1},
  {id:'gare-noyon',name:'Gare de Noyon',d:881,side:1}
].map(station=>({...station,...railPoint(station.d,station.side*7.15)}));
export const railPlatform=(train,d)=>railPoint(d,train.track*(railSpacing/2+3.35));
export const nearestRailStation=d=>railStations.reduce((a,b)=>Math.abs(a.d-d)<Math.abs(b.d-d)?a:b);
export const atRailStation=d=>railStations.find(s=>Math.abs(s.d-d)<=15);
export const railTrains=[
  {id:'train-oise-1',type:'train',track:-1,d:railStations[0].d,direction:1,color:'#36878b'},
  {id:'train-oise-2',type:'train',track:1,d:railStations[1].d,direction:-1,color:'#577aa4'}
];
export const railTrain=id=>railTrains.find(train=>train.id===id);
export function railPose(train,d,direction){
  const p=railPoint(d,train.track*railSpacing/2);
  const a=railPoint(d-3),b=railPoint(d+3);
  return {...p,angle:Math.atan2(b.y-a.y,b.x-a.x)+(direction<0?Math.PI:0)};
}
export function validatedRailPose(id,p){
  const train=railTrain(id);
  if(!train||![p.x,p.y,p.angle].every(Number.isFinite))return null;
  const d=clamp(railDistance(p.x,p.y),railEnd,length-railEnd);
  const forward=railPose(train,d,1),direction=Math.cos(p.angle-forward.angle)>=0?1:-1;
  const fixed=railPose(train,d,direction);
  if(Math.hypot(fixed.x-p.x,fixed.y-p.y)>2.2)return null;
  return {...fixed,speed:clamp(p.speed||0,0,26)};
}
export function stepRail(train,d,direction,speed,pedal,brake,dt){
  const left=direction>0?length-railEnd-d:d-railEnd;
  const limit=Math.min(26,Math.sqrt(Math.max(0,left-.18)*2*2.7));
  const force=brake?3.6:pedal<0?2.65*Math.abs(pedal):pedal>.05?-1.02*pedal:.17;
  const pace=Math.min(limit,Math.max(0,speed-force*dt));
  const next=clamp(d+direction*(speed+pace)*dt/2,railEnd,length-railEnd);
  return {...railPose(train,next,direction),d:next,speed:pace,limit};
}
export const railSections=[];
for(let i=0;i<length;i+=5){
  const end=Math.min(length,i+5),center=(i+end)/2;
  railSections.push({start:i,end,center,...railPoint(center)});
}
export const railXY=(d,offset=0)=>{const {x,y}=railPoint(d,offset);return [x,y];};
export const railGaugeOffsets=[-railSpacing/2,railSpacing/2].flatMap(center=>[center-railGauge/2,center+railGauge/2]);
export const railwayPlatformOffset=5.95,railwayPlatformLength=34;
