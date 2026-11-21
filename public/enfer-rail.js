// IGN BD TOPO® for the original alignment, extended with a surveyed return loop.
const alignment=[[-294.74,752.1],[-289.94,747.9],[-284.95,743.4],[-283.05,741.7],
  [-242.49,706.62],[-166.46,645.54],[-93.42,592.56],[-39.87,558.27],[-23.98,548.28],
  [52.76,503.8],[125.09,465.51],[211.02,425.13],[231.61,416.44],[235.11,415.14],
  [238.2,413.64],[261.68,403.74],[341.82,374.06],[380.59,359.67],[393.28,356.17],
  [435.74,344.48],[485.6,331.99],[536.16,320.4],[604.21,308.11],[669.76,297.72],
  [741.4,287.63],[803.85,282.55],[858.41,280.25],[884.69,279.06]];
const returnWay=[alignment.at(-1),[990,280],[1120,330],[1060,580],[1080,620],[1150,680],
  [1160,680],[1340,770],[1350,780],[1340,830],[1400,970],[1460,1030],[1450,1080],
  [1440,1090],[1430,1100],[1390,1130],[1320,1150],[760,1210],[380,1260],[-220,1260],
  [-325,950],[-342,805],[-335,790],alignment[0]];
for(let i=1;i<returnWay.length-1;i++){
  const a=returnWay[i-1],b=returnWay[i],c=returnWay[i+1];
  const first=Math.hypot(a[0]-b[0],a[1]-b[1]),second=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const reach=Math.min(32,first*.35,second*.35);
  const inlet=b.map((n,j)=>n+(a[j]-n)*reach/first),outlet=b.map((n,j)=>n+(c[j]-n)*reach/second);
  for(let j=0;j<=8;j++){
    const t=j/8,q=1-t;
    alignment.push(inlet.map((n,k)=>q*q*n+2*q*t*b[k]+t*t*outlet[k]));
  }
}
alignment.push(returnWay.at(-1));
const segments=[];
let length=0;
for(let i=1;i<alignment.length;i++){
  const a=alignment[i-1],b=alignment[i],dx=b[0]-a[0],dy=b[1]-a[1],span=Math.hypot(dx,dy);
  segments.push({a,b,dx,dy,span,start:length,angle:Math.atan2(dy,dx)});
  length+=span;
}
export const railLength=length;
export const railSpacing=4.32, railGauge=1.435;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const wrap=(d,w=length)=>((d%w)+w)%w;
export const alongRail=(from,to,direction)=>wrap((to-from)*direction);
export function railPoint(distance,offset=0){
  const d=wrap(distance);
  let lo=0,hi=segments.length-1;
  while(lo<hi){
    const mid=(lo+hi)>>1,s=segments[mid];
    if(d>s.start+s.span)lo=mid+1;else hi=mid;
  }
  const seg=segments[lo];
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
const fieldStop=railDistance(410,1254);
export const railStations=[
  {id:'gare-oise',name:'Halte des Aulnes',d:130,side:-1,style:17},
  {id:'gare-noyon',name:'Gare des Filatures',d:881,side:1,style:16},
  {id:'gare-verrieres',name:'Gare des Verrières',d:2195,side:-1,style:19},
  {id:'gare-pres',name:'Gare des Prés',d:fieldStop,side:1,style:18}
].map(station=>({...station,...railPoint(station.d,station.side*7.15)}));
export const railPlatform=(train,d)=>railPoint(d,train.track*(railSpacing/2+3.35));
export const atRailStation=d=>railStations.find(s=>Math.min(alongRail(d,s.d,1),alongRail(d,s.d,-1))<=15);
export const nextRailStation=(d,direction)=>railStations.reduce((a,b)=>
  alongRail(d+direction*.05,a.d,direction)<alongRail(d+direction*.05,b.d,direction)?a:b);
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
  const d=railDistance(p.x,p.y);
  const forward=railPose(train,d,1),direction=Math.cos(p.angle-forward.angle)>=0?1:-1;
  const fixed=railPose(train,d,direction);
  if(Math.hypot(fixed.x-p.x,fixed.y-p.y)>2.2)return null;
  return {...fixed,d,direction,speed:clamp(p.speed||0,0,26)};
}
export function stepRail(train,d,direction,speed,pedal,brake,dt){
  const force=brake?3.6:pedal<0?2.65*Math.abs(pedal):pedal>.05?-1.02*pedal:.17;
  const pace=clamp(speed-force*dt,0,26),next=wrap(d+direction*(speed+pace)*dt/2);
  return {...railPose(train,next,direction),d:next,speed:pace};
}
const dwellSeconds=17,autoSpeed=21,acceleration=1.2,deceleration=1.9;
const scheduleEpoch=1_760_000_000_000;
function railLeg(from,to,direction,speed,wait=0){
  const distance=alongRail(from,to,direction);
  const slow=Math.min(speed,Math.sqrt(2*deceleration*distance));
  const peak=Math.min(Math.max(autoSpeed,slow),Math.sqrt((2*distance+slow*slow/acceleration)/(1/acceleration+1/deceleration)));
  const accel=(peak-slow)/acceleration,brake=peak/deceleration;
  const accelDistance=(peak+slow)*accel/2,brakeDistance=peak*brake/2;
  const cruise=Math.max(0,distance-accelDistance-brakeDistance)/Math.max(.01,peak);
  return {from,wait,slow,peak,accel,cruise,brake,accelDistance,brakeDistance,duration:wait+accel+cruise+brake};
}
function railCycle(d,direction){
  const legs=[];
  for(let i=0;i<railStations.length;i++){
    const next=nextRailStation(d,direction);
    legs.push(railLeg(d,next.d,direction,0,dwellSeconds));d=next.d;
  }
  return legs;
}
const cycles=new Map(railTrains.map(train=>[train.id,railCycle(train.d,train.direction)]));
export function autonomousRail(train,epoch,release=null){
  let direction=train.direction,seconds=(epoch-scheduleEpoch)/1000;
  let legs=cycles.get(train.id);
  if(release){
    const start=validatedRailPose(train.id,release);
    if(start){
      direction=start.direction;seconds=Math.max(0,(epoch-release.railAt)/1000);
      const station=atRailStation(start.d);
      if(station&&Math.abs(start.d-station.d)<2&&start.speed<.4)legs=railCycle(station.d,direction);
      else{
        let station=nextRailStation(start.d,direction);
        if(alongRail(start.d,station.d,direction)<start.speed**2/(2*deceleration)+2)
          station=nextRailStation(station.d,direction);
        const first=railLeg(start.d,station.d,direction,start.speed);
        if(seconds<first.duration)return sample(first,seconds);
        seconds-=first.duration;legs=railCycle(station.d,direction);
      }
    }
  }
  seconds=wrap(seconds,legs.reduce((n,leg)=>n+leg.duration,0));
  const leg=legs.find(candidate=>{
    if(seconds<candidate.duration)return true;
    seconds-=candidate.duration;return false;
  })||legs[0];
  return sample(leg,seconds);
  function sample(leg,t){
    const {from,wait,slow,peak,accel,cruise,accelDistance}=leg;
    const doors=t<wait;
    const a=clamp(t-wait,0,accel),c=clamp(t-wait-accel,0,cruise),b=Math.max(0,t-wait-accel-cruise);
    const travelled=a<accel?slow*a+acceleration*a*a/2:accelDistance+peak*c+(peak-deceleration*b/2)*b;
    const speed=doors?0:a<accel?slow+acceleration*a:Math.max(0,peak-deceleration*b);
    const d=wrap(from+direction*travelled);
    return {...train,...railPose(train,d,direction),d,direction,speed,doors,moving:speed>.13,isCar:true,automatic:true};
  }
}
export const railSections=[];
for(let i=0;i<length;i+=5){
  const end=Math.min(length,i+5),center=(i+end)/2;
  railSections.push({start:i,end,center,...railPoint(center)});
}
export const railXY=(d,offset=0)=>{const {x,y}=railPoint(d,offset);return [x,y];};
export const railGaugeOffsets=[-railSpacing/2,railSpacing/2].flatMap(center=>[center-railGauge/2,center+railGauge/2]);
export const railwayPlatformOffset=5.95,railwayPlatformLength=34;
export const railStationBuildings=railStations.map(station=>{
  const size=station.style===16?13.5:station.style===19?10.5:7.1;
  const edge=station.side*10.8,back=station.side*(station.style===16?19.3:17.3),p=(u,v)=>railXY(station.d+u,v);
  const poly=[p(-size,edge),p(size,edge),p(size,back),p(-size,back)];
  if(station.side<0)poly.reverse();
  return {id:station.id+'-batiment',kind:'commercial',station,h:station.style===16?8.7:6.0,poly,holes:[]};
});
