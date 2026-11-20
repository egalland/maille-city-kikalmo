import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createTrafficFlow} from '../public/traffic-flow.js';
import {receiveTraffic,packTraffic} from '../public/traffic-sync.js';

test('a through road carries both lorries, opposing traffic and the same drivers for two observers',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {routeAgents,sampleTrafficRoute,trafficVehicleAt,contactAt,coreDestinations}=await import('../public/paris-world.js');
  const epoch=1770000000000,spot={x:2430.25,y:2038.24,id:'one',joinedAt:1},other={...spot,x:spot.x+15,id:'two',joinedAt:2};
  const seen=new Set(),ages=new Map(),bearings=new Set(),radii=[];
  let walkers=0,totalCars=0,longest=0,cost=[];
  const traffic=createTrafficFlow(sampleTrafficRoute);
  // Simulate three minutes along the approach to Le Bout-du-Pont. Use normal body
  // checks, local planning and the network checkpoint codec. No rendered frames.
  let ambient=[];
  const blockers=(x,y,angle,spec)=>contactAt(x,y,{angle,halfLength:spec.halfLength,halfWidth:spec.halfWidth});
  for(let tick=0;tick<3600;tick++){
    const at=epoch+tick*50,start=performance.now();
    if(tick%4===0){
      const frame=routeAgents(spot.x,spot.y,130,at);
      ambient=frame.cars.filter(c=>c.regional);walkers+=frame.actors.length;totalCars+=ambient.length;
    }
    const vehicles=traffic.step(ambient,{dt:.05,epoch:at,observer:spot,blockedPose:blockers});
    cost.push(performance.now()-start);
    for(const car of vehicles){
      const old=ages.get(car.id);if(!old){ages.set(car.id,{step:tick,x:car.x,y:car.y});continue;}
      const metres=Math.hypot(car.x-old.x,car.y-old.y);
      if(tick>old.step+1){old.step=tick;old.x=car.x;old.y=car.y;continue;}
      if(metres>.20){
        longest=Math.max(longest,old.run=(old.run||0)+metres);
        assert.ok(metres<1.3,'no discontinuity between frames');
        bearings.add(Math.sign(Math.cos(car.angle)));seen.add(car.type);
      }
      Object.assign(old,{x:car.x,y:car.y,step:tick});
    }
    if(tick%20===0&&vehicles.length){
      const packet=packTraffic(vehicles,spot,new Set(),at),fromLeader=receiveTraffic([{...spot,traffic:packet}],other,[],at,trafficVehicleAt,sampleTrafficRoute);
      for(const ck of fromLeader.checkpoints){
        const local=vehicles.find(v=>v.id===ck.id);
        assert.equal(ck.type,local.type);assert.ok(Math.hypot(ck.x-local.x,ck.y-local.y)<.03);
        radii.push(ck.id);
      }
    }
  }
  t.diagnostic('Rolling vehicles: '+[...seen].join(', '));
  assert.ok(seen.has('tipper')&&seen.has('boxtruck'),'both delivery fleets move in actual lanes');
  assert.equal(bearings.size,2);assert.ok(longest>130&&new Set(radii).size>=7);
  assert.ok(totalCars>walkers*5);
  // Both formerly blocked bridge approaches and the two villages now carry trips.
  for(const key of ['couarcy','pontoise','varesnes','trois-ponts']){
    const stop=coreDestinations.find(s=>s.key===key);
    let count=0;for(const seconds of [0,16,32,48])count+=routeAgents(stop.x,stop.y,130,epoch+seconds*1000).cars.filter(s=>s.regional).length;
    assert.ok(count>=4,key+' has through traffic on nearby streets');
  }
  cost.sort((a,b)=>a-b);
  t.diagnostic('Followed a driver for '+longest.toFixed(0)+' m; simulation cost at p95 '+cost[Math.floor(cost.length*.95)].toFixed(2)+' ms.');
});

test('an interurban trip entering the map next to an established observer stays off screen',()=>{
  const origin={x:0,y:0},sample=(_,d)=>d>=0&&d<=400?{x:d,y:0,angle:0,routeLength:400,routeLoop:false}:null;
  const flow=createTrafficFlow(sample),seed={id:'visible-border',regional:true,routeId:'test',routeIndex:1,routeLoop:false,type:'sedan',speed:9,cruiseSpeed:9,routeDistance:2,x:2,y:0};
  flow.step([],{observer:origin});
  assert.deepEqual(flow.step([seed],{observer:origin,dt:.05}),[]);
  // A new observer can see the trip if it was already in progress upon arrival.
  flow.reset();assert.equal(flow.step([seed],{observer:origin,dt:.05}).length,1);
});

test('traffic reaches the rural network and settlements without filling the country roads with pedestrians',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {streets}=await import('../public/paris-data.js');
  const {routeAgents}=await import('../public/paris-world.js');
  const {enferDistrict}=await import('../public/enfer-places.js');
  const probes=[];
  for(const road of streets){
    if(!['primary','secondary','motorway'].includes(road.kind)||road.w<(road.oneway?3:4))continue;
    let distance=0,next=130;
    for(let i=1;i<road.path.length;i++){
      const a=road.path[i-1],b=road.path[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      while(next<=distance+length){
        const f=(next-distance)/length,x=a[0]+dx*f,y=a[1]+dy*f;
        if(probes.every(p=>Math.hypot(p.x-x,p.y-y)>410))probes.push({x,y,rural:enferDistrict(x,y)==='Vallée des Aulnes'});
        next+=360;
      }
      distance+=length;
    }
  }
  for(const rural of [true,false]){
    const group=probes.filter(p=>p.rural===rural);
    let covered=0,cars=0,pedestrians=0;
    for(const {x,y} of group){
      let vehicles=0;
      for(const sec of [0,19,36,57]){
        const sample=routeAgents(x,y,130,1770000000000+sec*1000);
        vehicles+=sample.cars.filter(c=>c.moving).length;pedestrians+=sample.actors.length;
      }
      if(vehicles)covered++;cars+=vehicles;
    }
    assert.ok(group.length>20&&covered/group.length>.95);
    assert.ok(cars/(4*group.length)>(rural?4:6));
    if(rural)assert.ok(pedestrians/(4*group.length)<1);
    t.diagnostic((rural?'Country':'Town')+' roads: '+covered+'/'+group.length+' sampled locations with traffic; '+
      (cars/(4*group.length)).toFixed(2)+' moving vehicles and '+(pedestrians/(4*group.length)).toFixed(2)+' pedestrians per 130-metre view.');
  }
});
