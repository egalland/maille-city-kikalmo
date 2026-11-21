import {driveApproach,driveExit,driveBays,marketDrive,marketPoint,fuelApproach,fuelLanes,fuelExit,marketPaving,marketParking} from './mont-renaud.js';
import {lotSpaces,lotPoint} from './enfer-parking-lots.js';
import {vehicleSpec} from './vehicle-types.js';

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

function road(points,turn=4.5){
  const line=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1];
    const p=lerp(b,a,Math.min(.44,turn/Math.max(.001,distance(b,a))));
    const q=lerp(b,c,Math.min(.44,turn/Math.max(.001,distance(b,c))));
    for(let j=0;j<=8;j++){const t=j/8;line.push(lerp(lerp(p,b,t),lerp(b,q,t),t));}
  }
  line.push(points.at(-1));
  const lengths=[0];
  for(let i=1;i<line.length;i++)lengths.push(lengths.at(-1)+distance(line[i],line[i-1]));
  return {line,lengths,length:lengths.at(-1)};
}
function pose(path,metres,reverse=false){
  let i=1;
  while(i<path.line.length-1&&path.lengths[i]<metres)i++;
  const a=path.line[i-1],b=path.line[i],length=path.lengths[i]-path.lengths[i-1];
  const [x,y]=lerp(a,b,clamp((metres-path.lengths[i-1])/(length||1),0,1));
  return {x,y,angle:Math.atan2(b[1]-a[1],b[0]-a[0])+(reverse?Math.PI:0)};
}
const shiftDrive=(u,v)=>marketPoint(marketDrive,u,v);
const driveJobs=[driveBays[2],driveBays[1]].map(({across},slot)=>({
  type:slot?'sedan':'compact',stop:slot?18:15,
  approach:road([...driveApproach.slice(0,-2),shiftDrive(-20,1),shiftDrive(-13,across),shiftDrive(0,across)]),
  depart:road([shiftDrive(0,across),shiftDrive(10,across),shiftDrive(17,1.5),...driveExit.slice(1)])
}));
const fuelJobs=[fuelLanes[2],fuelLanes[1]].map(lane=>({
  type:'compact',stop:11,
  approach:road([...fuelApproach.slice(0,-1),...lane.slice(0,3),lerp(lane[2],lane[3],.5)]),
  depart:road([lerp(lane[2],lane[3],.5),...lane.slice(3),...fuelExit.slice(1)])
}));
const lot=marketParking[0],spots=lotSpaces(lot);
const lotLink=side=>marketPaving.filter(r=>r.id.startsWith(lot.id+'-acces-'+side+'-')).at(-1).b;
const parkJobs=[5,9,12].map(col=>{
  const target=spots[lot.columns+col];
  const localX=(col+.5-lot.columns/2)*lot.bayWidth,radius=6;
  const entry=lotPoint(lot,localX-radius,0);
  const arc=Array.from({length:13},(_,i)=>{
    const turn=i*Math.PI/24;
    return lotPoint(lot,localX-radius+radius*Math.sin(turn),radius*(1-Math.cos(turn)));
  });
  arc.push([target.x,target.y]);
  const foot=road([lotPoint(lot,localX-1.35,(lot.aisle+lot.bayDepth)/2),lotPoint(lot,localX-1.35,-1.8),
    lotPoint(lot,-lot.width/2-2,-1.8)]);
  return {type:col===5?'sedan':'compact',stop:Math.ceil(foot.length/1.45)*2+8,foot,
    approach:road([lotLink(-1),lotPoint(lot,-lot.width/2+1,0),entry,...arc.slice(1)],1.1),
    reverse:road(arc.slice().reverse(),.5),depart:road([entry,lotPoint(lot,lot.width/2-1,0),lotLink(1)])};
});
const schedules=[
  {id:'parking',period:47,offset:0,max:2,jobs:parkJobs},
  {id:'drive',period:10,offset:2,max:2,jobs:driveJobs},
  {id:'fuel',period:30,offset:5,max:1,jobs:fuelJobs}
];
const painters=['#6c8e92','#a97962','#a29a78','#8391ab','#a56a72'];

// Private manoeuvres stay out of the public traffic planner: they can reverse
// into an aisle and reserve a service bay without reserving the main street.
export function createMarketTraffic(){
  const visits=new Map(),seen=new Map();
  function reset(){visits.clear();seen.clear();}
  function step({observer,epoch,dt,excluded=new Set(),clear,unavailable=()=>false}){
    if(Math.hypot(observer.x+1670,observer.y-1142)>320){reset();return {cars:[],actors:[]};}
    const cars=[],actors=[],active=()=>[...visits.values()];
    for(const schedule of schedules){
      const stamp=Math.floor((epoch/1000-schedule.offset)/schedule.period);
      if(seen.get(schedule.id)===stamp)continue;
      const age=(epoch/1000-schedule.offset)-stamp*schedule.period;
      if(age>7){seen.set(schedule.id,stamp);continue;}
      const current=active().filter(v=>v.service===schedule.id);
      const options=schedule.jobs.map((_,i)=>(i+Math.abs(stamp))%schedule.jobs.length);
      for(const index of options){
        const job=schedule.jobs[index],id='market-'+schedule.id+'-'+stamp,start=pose(job.approach,0);
        const end=pose(job.approach,job.approach.length);
        if(current.length>=schedule.max||current.some(v=>v.job===job)||excluded.has(id))continue;
        if(!clear(id,job.type,start,active().map(v=>v.car)))continue;
        if(schedule.id!=='drive'&&!clear(id,job.type,end,active().map(v=>v.car)))continue;
        visits.set(id,{job,id,service:schedule.id,stage:'approach',metres:0,wait:0,
          car:{...start,id,type:job.type,isCar:true,color:painters[Math.abs(stamp)%painters.length],speed:0}});
        seen.set(schedule.id,stamp);break;
      }
    }
    for(const [id,v] of visits){
      if(excluded.has(id)||unavailable(id)){visits.delete(id);continue;}
      const {job,stage,car}=v;
      const parked=stage==='stop'&&v.service==='parking';
      if(stage==='stop'){
        v.wait+=dt;
        if(parked&&job.foot&&v.wait>1&&v.wait<job.stop-1){
          const a=v.wait-1,leg=job.foot.length,pace=1.45;
          const metres=Math.min(leg,a*pace),back=v.wait>job.stop*.5;
          const d=back?Math.min(leg,Math.max(0,(job.stop-v.wait-1)*pace)):metres;
          const walker=pose(job.foot,d,back);
          actors.push({...walker,id:id+'-visitor',type:'human',color:car.color,speed:d<leg?pace:0,moving:d<leg,activity:'shopping'});
        }
        if(v.wait>=job.stop){v.stage=job.reverse?'reverse':'depart';v.wait=0;v.metres=0;}
      }else{
        const reverse=stage==='reverse',path=job[stage],pace=reverse?2.2:v.service==='drive'?4.2:3.6;
        const next=Math.min(path.length,v.metres+pace*dt);
        const queueing=v.service==='drive'&&stage==='approach'&&next>=path.length-15&&
          active().some(a=>a!==v&&a.service==='drive'&&a.id!==id&&
            (a.stage==='stop'||a.stage==='depart'&&a.metres<16||a.stage==='approach'&&a.metres>next+2));
        const result=pose(path,next,reverse);
        const lookout=pose(path,Math.min(path.length,next+(reverse?.28:.8)),reverse);
        const others=active().filter(other=>other!==v).map(other=>other.car);
        if(!queueing&&clear(id,car.type,result,others)&&clear(id,car.type,lookout,others)){
          v.metres=next;v.wait=0;Object.assign(car,result,{speed:reverse?-pace:pace,moving:true});
          if(next>=path.length){
            if(stage==='depart'){visits.delete(id);continue;}
            v.stage=reverse?'depart':'stop';v.wait=0;v.metres=0;
            Object.assign(car,{speed:0,moving:false});
          }
        }else{
          v.wait+=dt;Object.assign(car,{speed:0,moving:false});
          if(v.wait>22){visits.delete(id);continue;}
        }
      }
      car.activity=v.stage==='stop'?v.service:v.stage==='approach'&&v.wait>.35?'queue':v.stage;
      car.noDriver=v.stage==='stop'&&v.service==='parking';car.occupied=!car.noDriver;
      cars.push({...car});
    }
    return {cars,actors};
  }
  return {step,reset};
}

export function marketCarShape(type){
  const {halfLength,halfWidth,height}=vehicleSpec(type);
  return {halfLength,halfWidth,bodyHeight:height};
}
