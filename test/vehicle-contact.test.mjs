import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleContact,createVehicleDisplacements,sweptPedestrianContact,slideVehicleVelocity} from '../public/vehicle-contact.js';
import {contactAt,moveBody,vehicleTurn} from '../public/paris-world.js';
import {createTrafficFlow} from '../public/traffic-flow.js';
import {vehicleSpec} from '../public/vehicle-types.js';
import {createGame} from '../public/game.js';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';

const body=(type,x,y,vx,vy)=>({type,x,y,angle:0,vx,vy});
test('a swept scrape keeps its tangent and a turning bumper cannot rotate into a wall',()=>{
  const start={x:325,y:-744},angle=Math.atan2(120,244),c=Math.cos(angle),s=Math.sin(angle);
  const wall={...start,x:start.x+2*c+1.55*s,y:start.y+2*s-1.55*c,
    angle,halfLength:3.5,halfWidth:.2,h:2.4,id:'test-wall'};
  const shape={angle,halfLength:1.82,halfWidth:.83,colliders:[wall],bodyHeight:1.5,precise:true};
  const hit=moveBody(start.x,start.y,3.6*c+.9*s,3.6*s-.9*c,shape);
  assert.equal(hit.touched,wall);
  assert.equal(contactAt(hit.x,hit.y,shape),null);
  assert.ok((hit.x-start.x)*c+(hit.y-start.y)*s>3.55);
  const turn=vehicleTurn(hit.x,hit.y,angle,angle-.45,shape);
  assert.ok(turn>angle-.35);
  assert.ok(!contactAt(hit.x,hit.y,{...shape,angle:turn}));
  const motion=slideVehicleVelocity(14,-3,angle,-s,c);
  assert.ok(Math.abs(motion.speed-14)<.0001 && Math.abs(motion.lateral)<.0001);
});
test('a pedestrian in a fast swept path takes one hit without stopping the player vehicle',t=>{
  const saved=Object.fromEntries(['window','document','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  let frame,scene,receive,stamp=performance.now(),clock=1782250000000;
  globalThis.requestAnimationFrame=cb=>(frame=cb,1);globalThis.cancelAnimationFrame=()=>{};
  const start={x:325,y:-744},angle=Math.atan2(120,244),c=Math.cos(angle),s=Math.sin(angle);
  const at=(d,lateral=0)=>({x:start.x+c*d-s*lateral,y:start.y+s*d+c*lateral});
  const pedestrian={...at(6.8),id:'test-pedestrian',type:'human',health:96,healthAt:clock-3000,
    stunnedUntil:clock+1500,angle:angle+Math.PI/2};
  const spec=vehicleSpec('sedan');
  assert.ok(sweptPedestrianContact(start,at(12),angle,spec,pedestrian));
  assert.ok(!sweptPedestrianContact(start,at(12),angle,spec,at(6.8,2)));
  const events=[];
  const net={id:'test-driver',status:'offline',world:()=>({}),peers:()=>[],serverTime:()=>clock,
    onEvent(fn){receive=fn;},emit:(type,data)=>{events.push({type,data});return true;}};
  const game=createGame({canvas:new EventTarget(),net,buildView:()=>({available:true,render:s=>{scene=s;},aim:()=>0,effect(){},dispose(){}})});
  t.after(()=>{game.destroy();for(const [k,v] of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
  assert.ok(game.restoreTravelState({...game.exportTravelState(),...start,angle,vehicle:{id:'test-car',type:'sedan',speed:17}}));
  receive({type:'npc',player:'witness',data:pedestrian});
  for(let i=0;i<32;i++){stamp+=1000/60;clock+=1000/60;frame(stamp);}
  const contacts=events.filter(e=>e.type==='npc'&&e.data.id===pedestrian.id);
  assert.equal(contacts.length,1);
  assert.equal(contacts[0].data.health,0);
  assert.ok((scene.p.x-pedestrian.x)*c+(scene.p.y-pedestrian.y)*s>0);
  assert.ok(game.exportTravelState().vehicle.speed>14);
});

test('two bumpers share momentum; glancing contact retains tangent and turns the bodies',()=>{
  const car=body('compact',0,0,12,3),truck=body('van',4,0,2,1),normal=[-1,0];
  const hit=vehicleContact(car,truck,...normal),m1=vehicleSpec(car.type).mass,m2=vehicleSpec(truck.type).mass;
  assert.ok(hit.b.vx>0&&hit.b.vx < -hit.a.vx);
  assert.ok(Math.abs(car.vx+hit.a.vx-truck.vx-hit.b.vx)<1e-8);
  assert.ok(Math.abs(m1*hit.a.vx+m2*hit.b.vx)<1e-8);
  assert.ok(hit.a.spin===0&&hit.b.spin===0&&hit.a.vy===0);
  const corner=vehicleContact(car,{...truck,y:.9},...normal);
  assert.ok(Math.abs(corner.a.spin)>.1&&Math.abs(corner.b.spin)>.1);
  assert.equal(vehicleContact({...car,vx:0},truck,...normal),null);
});

test('displaced traffic recovers its moving lane while a parked vehicle retains its new position',()=>{
  const free=(x,y,dx,dy)=>({x:x+dx,y:y+dy});
  const result=[];
  for(const guided of [false,true]){
    const sim=createVehicleDisplacements(),template={id:'sample',x:0,y:0,type:'compact',angle:0,speed:guided?4:0,...(guided?{routeId:'main'}:{})};
    sim.push(template,{vx:0,vy:5,spin:.7},'driver');
    let settled,peak=0,vehicle;
    for(let i=1;i<600&&!settled;i++){
      vehicle={...template,x:i*template.speed/60};
      settled=sim.advance(vehicle,1/60,free,()=>true);peak=Math.max(peak,vehicle.y);
    }
    assert.ok(settled&&peak>.8);assert.equal(settled.parked,!guided);
    result.push(vehicle.y);
  }
  assert.ok(result[0]>1.5&&Math.abs(result[1])<.08);
});

test('a crossing between two approaching traffic cars reports one substantial contact before either can stop',()=>{
  const flow=createTrafficFlow((id,d)=>id==='east'?{x:d,y:0,angle:0}:{x:5,y:d-5,angle:Math.PI/2});
  const seeds=['east','north'].map(id=>({id,type:'sedan',routeId:id,routeDistance:0,speed:12,cruiseSpeed:12}));
  const contacts=[];flow.step(seeds,{dt:0});
  for(let i=0;i<25;i++)flow.step(seeds,{dt:.016,onVehicleContact:(a,b)=>contacts.push([a,b])});
  assert.equal(contacts.length,1);
  const [a,b]=contacts[0];
  assert.notEqual(a.id,b.id);assert.ok(b.traffic&&Math.hypot(a.vx,a.vy)>5);
});

test('driving into another parked car pushes it through normal game frames and permits reversing away',t=>{
  const saved=Object.fromEntries(['window','document','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  let frame,scene,stamp=performance.now(),clock=1782250000000;
  globalThis.requestAnimationFrame=cb=>(frame=cb,1);globalThis.cancelAnimationFrame=()=>{};
  const step=n=>{for(let i=0;i<n;i++){stamp+=1000/60;clock+=1000/60;frame(stamp);}};
  const start={x:325,y:-744},angle=Math.atan2(120,244),c=Math.cos(angle),s=Math.sin(angle);
  const target={id:'test-parked',x:start.x+c*9,y:start.y+s*9,type:'compact',angle,occupied:false};
  const events=[],shared={vehicles:{[target.id]:target}};
  const net={id:'test-driver',status:'online',world:()=>shared,peers:()=>[],serverTime:()=>clock,
    emit:(type,data)=>{events.push({type,data});if(type==='vehicle')shared.vehicles[data.id]=data;return true;}};
  const game=createGame({canvas:new EventTarget(),net,buildView:()=>({available:true,render:s=>{scene=s;},aim:()=>0,effect(){},dispose(){}})});
  t.after(()=>{game.destroy();for(const [k,v] of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
  assert.ok(game.restoreTravelState({...game.exportTravelState(),...start,angle,vehicle:{id:'test-car',type:'sedan',speed:10}}));
  step(50);
  const after=scene.entities.find(v=>v.id===target.id);
  assert.ok(events.some(e=>e.type==='vehicleShunt'&&e.data.id===target.id));
  assert.ok((after.x-target.x)*c+(after.y-target.y)*s>.35);
  const first=game.exportTravelState();
  assert.ok(first.vehicle.speed>=0);
  game.setMove(0,1);step(160);game.setMove(0,0);
  const reverse=game.exportTravelState(),other=scene.entities.find(v=>v.id===target.id);
  assert.ok(reverse.vehicle.speed<-.3);
  assert.ok(Math.hypot(reverse.x-other.x,reverse.y-other.y)>6);
  step(90);assert.ok(events.some(e=>e.type==='vehicle'&&e.data.shifted&&e.data.id===target.id));
});

test('server accepts a nearby driver impulse once and discards remote or on-foot pushes',async()=>{
  const db=localDatabase(),member={id:crypto.randomUUID(),token:crypto.randomUUID()};
  const pose={x:16,y:19,vehicle:{id:'source',type:'compact',x:16,y:19}},data={id:'target',type:'sedan',x:19,y:19,vx:2.5,vy:0,spin:0};
  const post=async(action,state,events=[])=>{
    const resp=await handleApi(new Request('https://test.local/api/world/'+action,{method:'POST',body:JSON.stringify({...member,state,events})}),{DB:db});
    assert.equal(resp.status,200);return resp.json();
  };
  try{
    await post('join',pose);
    const reply=await post('sync',pose,[{op:'near',type:'vehicleShunt',data},{op:'again',type:'vehicleShunt',data},
      {op:'far',type:'vehicleShunt',data:{...data,id:'remote',x:1000}}]);
    const list=reply.events.filter(e=>e.type==='vehicleShunt');
    assert.equal(list.length,1);assert.equal(list[0].data.source,'source');
    await post('sync',{x:16,y:19});
    const onFoot=await post('sync',{x:16,y:19},[{op:'walk',type:'vehicleShunt',data:{...data,id:'on-foot'}}]);
    assert.ok(!onFoot.events.some(e=>e.data?.id==='on-foot'));
  }finally{db.close();}
});
