import {vehicleSpec} from './vehicle-types.js';

// A trajectory stays compact on the wire: half-second samples of distance along
// the launch heading and height above the surveyed terrain, both in metres.
export const flightSampleMs=500;
const maxSamples=65;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function planAutorotation(pose,world,obstructed){
  const airship=pose.type==='airship';
  const drag=airship?.38:.56, sink=airship?2.7:6.5, descent=airship?1.65:3.8;
  const points=[[0,pose.lift]],c=Math.cos(pose.angle),s=Math.sin(pose.angle);
  let run=0,z=world.ground(pose.x,pose.y)+pose.lift,v=pose.speed||0,vz=pose.verticalSpeed||0,done=false;
  for(let i=1;i<maxSamples&&!done;i++){
    for(let k=0;k<10&&!done;k++){
      const step=.05;
      v*=Math.exp(-drag*step);
      const movement=v*step,sweeps=Math.max(1,Math.ceil(Math.abs(movement)/.55));
      if(Math.abs(v)<=.05)v=0;
      for(let n=0;n<sweeps&&v;n++){
        const next=run+movement/sweeps,nx=pose.x+c*next,ny=pose.y+s*next;
        if(world.ground(nx,ny)>=z||(world.water(nx,ny)??-Infinity)>=z-.6||obstructed(nx,ny,z)){v=0;break;}
        run=next;
      }
      const x=pose.x+c*run,y=pose.y+s*run;
      const ground=world.ground(x,y),water=world.water(x,y),deck=world.deck?.(x,y)??ground;
      const floor=Math.max(z>=deck-.05?deck:ground,water==null?-Infinity:water+.75);
      vz=Math.max(-sink,vz-descent*step);
      const nextZ=Math.max(floor,z+vz*step);
      if(obstructed(x,y,nextZ)){if(vz<=0)done=true;else vz=0;}
      else z=nextZ;
      if(z<=floor+.002){z=floor;done=true;}
    }
    const h=Math.max(0,z-world.ground(pose.x+c*run,pose.y+s*run));
    points.push([Math.round(run*100)/100,Math.round(h*100)/100]);
  }
  return points;
}

export function validFlightPath(raw,type='helicopter'){
  if(!Array.isArray(raw)||raw.length<2||raw.length>maxSamples)return false;
  const distancePerSample=vehicleSpec(type).forward*flightSampleMs/1000;
  return raw.every((p,i)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<200&&
    p[1]>=0&&p[1]<=100&&(i?Math.abs(p[0]-raw[i-1][0])<=distancePerSample+.01:p[0]===0));
}

export function sampleAutorotation(car,now){
  const points=car.flightPath,t=clamp((now-car.flightAt)/flightSampleMs,0,points.length-1);
  const index=Math.min(Math.floor(t),points.length-2),fraction=t-index;
  const a=points[index],b=points[index+1],distance=a[0]+(b[0]-a[0])*fraction;
  const c=Math.cos(car.angle),s=Math.sin(car.angle),landed=t>=points.length-1;
  const speed=landed?0:(b[0]-a[0])*1000/flightSampleMs;
  return {x:car.x+distance*c,y:car.y+distance*s,angle:car.angle,lift:a[1]+(b[1]-a[1])*fraction,
    speed,vx:speed*c,vy:speed*s,verticalSpeed:landed?0:(b[1]-a[1])*1000/flightSampleMs,moving:!landed,landed};
}
