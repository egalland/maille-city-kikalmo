import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cleanRoadCoast,planRoadCoast,sampleRoadCoast} from '../public/road-coast.js';
import {createNet} from '../public/net.js';
import {handleApi} from '../worker/game-api.js';
import {localDatabase} from '../scripts/local-db.mjs';

test('released chassis carries reverse and sideways momentum, stopping before a thin wall at sports speed',()=>{
  const pos={x:0,y:0,angle:0},at=2000;
  for(const [vx,vy] of [[-6,1],[98,0],[16,5]]){
    const plan=planRoadCoast(pos,vx,vy,at,(x)=>x>=23&&x<=26);
    const car={...pos,roadCoast:cleanRoadCoast(plan,'supercar',at)};
    const initial=sampleRoadCoast(car,at);
    assert.ok(Math.abs(initial.vx-vx)<.01&&Math.abs(initial.vy-vy)<.01);
    const end=sampleRoadCoast(car,at+30000);
    assert.equal(end.speed,0);
    assert.ok(vx>0?end.x>0&&end.x<=23:end.x<0);
    if(vx>90)assert.ok(end.x>22.9);
    assert.deepEqual(end,sampleRoadCoast(car,at+60000));
  }
});

test('a real moving road car releases the driver at its door, then both travel independently',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {createGame}=await import('../public/game.js');
  const {streets}=await import('../public/paris-data.js');
  const {contactAt,routeAgents}=await import('../public/paris-world.js');
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  let frame,scene,hud,published,stamp=performance.now(),now=1782250000000;
  globalThis.requestAnimationFrame=cb=>(frame=cb,1);globalThis.cancelAnimationFrame=()=>{};
  const records=[];
  const net={id:'driver-test',serverTime:()=>now,peers:()=>[],world:()=>({}),status:'online',publish:s=>published=s,
    emit:(type,data)=>{if(type==='vehicle')records.push(data);return true;}};
  const game=createGame({canvas:new EventTarget(),net,onState:s=>hud=s,
    buildView:()=>({available:true,render:s=>scene=s,effect(){},dispose(){}})});
  t.after(()=>{game.destroy();for(const k of ['location','document','window','requestAnimationFrame','cancelAnimationFrame'])delete globalThis[k];});
  const advance=n=>{for(let j=0;j<n;j++){now+=1000/60;stamp+=1000/60;frame(stamp);}};
  let start;
  for(const road of streets){
    if(road.level!==0||road.w<4.8||road.kind==='path')continue;
    for(let i=1;i<road.path.length;i++){
      const [a,b]=[road.path[i-1],road.path[i]],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(len<65)continue;
      const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),cx=Math.cos(angle),cy=Math.sin(angle);
      const x=a[0]+cx*9,y=a[1]+cy*9;
      if(routeAgents(x+cx*11,y+cy*11,25,now).cars.length)continue;
      if([0,2,5,10,15,20,25].some(d=>contactAt(x+cx*d,y+cy*d,{halfWidth:2.4,halfLength:2.4,angle})))continue;
      start={x,y,angle};break;
    }
    if(start)break;
  }
  assert.ok(start);advance(1);
  assert.ok(game.restoreTravelState({...game.exportTravelState(),...start,vehicle:{id:'test-roadster',type:'sport',speed:15}}));
  advance(4);
  assert.ok(hud.canBailRoad);
  const source={...scene.p},entrySpeed=published.speed;
  window.dispatchEvent(Object.assign(new Event('keydown'),{key:'e'}));
  advance(1);
  assert.equal(published.vehicle,null);assert.ok(hud.health<100&&hud.health>60);
  assert.ok(published.ragdoll&&Math.hypot(published.vx,published.vy)>entrySpeed*.67);
  const exit={...scene.p},release=records.at(-1);
  assert.ok(release.roadCoast&&Math.hypot(exit.x-source.x,exit.y-source.y)<3);
  const visible=()=>scene.entities.filter(e=>e.id===release.id);
  advance(21);assert.equal(visible().length,1);assert.ok(visible()[0].moving&&!visible()[0].driver);
  assert.ok(Math.hypot(scene.p.x-exit.x,scene.p.y-exit.y)>1.25);
  assert.ok(Math.hypot(visible()[0].x-release.x,visible()[0].y-release.y)>3.4);
  advance(270);assert.equal(visible().length,1);assert.equal(visible()[0].speed,0);
  assert.ok(Math.hypot(visible()[0].x-scene.p.x,visible()[0].y-scene.p.y)>5);
  const result={car:Math.hypot(visible()[0].x-release.x,visible()[0].y-release.y),person:Math.hypot(scene.p.x-exit.x,scene.p.y-exit.y)};
  assert.ok(game.restoreTravelState({...game.exportTravelState(),...start,health:100,vehicle:{id:'brake-car',type:'sedan',speed:7}}));
  const key=(type,value)=>window.dispatchEvent(Object.assign(new Event(type),{key:value}));
  key('keydown',' ');key('keydown','z');advance(100);
  assert.equal(published.speed,0);assert.equal(published.vehicle.brake,true);
  key('keyup',' ');advance(34);
  assert.ok(published.speed>1);assert.equal(published.vehicle.brake,false);
  key('keyup','z');
  assert.ok(game.restoreTravelState({...game.exportTravelState(),...start,health:100,vehicle:{id:'slow-car',type:'sedan',speed:3.8}}));
  advance(4);assert.ok(!hud.canBailRoad);game.action('vehicle');advance(1);
  assert.equal(published.vehicle,null);assert.ok(!published.ragdoll&&hud.health===100);
  assert.equal(published.motion,'dismount');assert.ok(Math.hypot(published.vx,published.vy)>1.4);
  advance(35);assert.ok(Math.hypot(published.vx,published.vy)<.89);
  t.diagnostic('Release '+(3.6*entrySpeed).toFixed(0)+' km/h, driver '+result.person.toFixed(1)+' m, car '+result.car.toFixed(1)+' m.');
});

test('a passenger follows the free rolling car after the driver quits and a late observer sees the same stop',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  let now=1780000000000;t.mock.method(Date,'now',()=>now);
  const session=()=>({id:crypto.randomUUID(),token:crypto.randomUUID(),map:'enfer'});
  const [driver,rider,late]=Array.from({length:3},session),pose={x:10,y:20,angle:0,health:100,speed:0};
  const cv={...pose,id:'car-rolling',type:'sedan',occupied:true};
  const req=async(who,path,data={})=>{const r=await handleApi(new Request('https://m.test/api/world/'+path,{method:'POST',body:JSON.stringify({...who,...data})}),{DB});assert.equal(r.status,200);return r.json();};
  const event=(type,op,data)=>({type,op,data});
  for(const who of [driver,rider])await req(who,'join',{state:pose});
  await req(driver,'sync',{state:{...pose,vehicle:cv},events:[event('vehicle','take',cv)]});
  await req(rider,'sync',{state:pose,events:[event('seat','board',{driver:driver.id,car:cv.id})]});
  now+=1000;const roadCoast=planRoadCoast(cv,18,0,now,()=>false);
  const release={...cv,occupied:false,speed:18,roadCoast};
  await req(driver,'sync',{state:{...pose,vehicle:null},events:[event('vehicle','release',release)]});
  await req(driver,'leave');now+=500;
  const seen=await req(late,'join',{state:pose}),record=seen.world.vehicles[cv.id],aboard=seen.players.find(p=>p.id===rider.id);
  assert.equal(record.occupied,false);assert.ok(aboard.passenger.coasting&&aboard.x>pose.x+5);
  assert.ok(Math.abs(aboard.x-sampleRoadCoast(record,now).x)<.001);
  const denied=await req(late,'sync',{events:[event('vehicle','premature',cv)]});assert.equal(denied.denied[0].owner,'coasting');
  now=Math.ceil(roadCoast.until)+30;
  const stopped=(await req(rider,'sync')).players.find(p=>p.id===rider.id);
  assert.equal(stopped.speed,0);assert.ok(stopped.passenger.coasting);
  const parked={...cv,x:stopped.x,y:stopped.y};
  const reunited=await req(late,'sync',{state:{...parked,vehicle:parked},events:[event('vehicle','retake',parked)]});
  assert.ok(!reunited.denied.length);assert.equal(reunited.players.find(p=>p.id===rider.id).passenger.driver,late.id);
  const freed=await req(rider,'sync',{events:[event('seat','step-out',{leave:true})]});assert.ok(!freed.players.find(p=>p.id===rider.id).passenger);
});

test('the passenger touch release carries momentum without changing the driver’s car',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {createGame}=await import('../public/game.js');
  const {helipad}=await import('../public/airfield.js');
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  let frame,pose,hud,listener,stamp=performance.now(),now=1790000000000,leave,changed=0;
  globalThis.requestAnimationFrame=cb=>(frame=cb,1);globalThis.cancelAnimationFrame=()=>{};
  const car={id:'sedan-ride',type:'sedan',x:helipad.x,y:helipad.y,angle:0,speed:12};
  const driver={id:'chauffeur',name:'Chauffeur',vehicle:car,...helipad,angle:0,speed:12,vx:12,vy:0,moving:true,updatedAt:now};
  const rider={id:'passager',passenger:{driver:driver.id,car:car.id}};
  const net={id:rider.id,status:'online',serverTime:()=>now,peers:()=>[driver],players:()=>[driver,rider],world:()=>({}),
    publish:s=>pose=s,onEvent:fn=>{listener=fn;},emit:(type,data)=>{if(type==='vehicle')changed++;if(type==='seat'&&data.leave)leave=true;return true;}};
  const game=createGame({canvas:new EventTarget(),net,onState:s=>hud=s,buildView:()=>({available:true,render(){},effect(){},dispose(){}})});
  t.after(()=>{game.destroy();for(const k of ['location','document','window','requestAnimationFrame','cancelAnimationFrame'])delete globalThis[k];});
  const ticks=n=>{for(let i=0;i<n;i++){stamp+=20;now+=20;frame(stamp);}};
  ticks(5);assert.ok(hud.passenger&&hud.canBailRoad);
  game.action('vehicle');assert.ok(leave);delete rider.passenger;
  listener({type:'seatResult',data:{seat:null},player:rider.id,at:now});
  ticks(1);assert.ok(!hud.inVehicle);assert.ok(pose.ragdoll&&pose.vx>8);
  const at=pose.x;ticks(15);assert.ok(pose.x>at+1.4);
  assert.equal(driver.vehicle,car);assert.equal(changed,0);
});


test('closing a driver tab before its next poll preserves the released car for the next connection',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  const now=Date.now(),pose={x:30,y:45,angle:.5,health:100};
  const car={id:'tab-close',type:'sedan',...pose};
  let leave;
  const fetcher=(url,init)=>{
    const result=handleApi(new Request('https://maille.test'+url,init),{DB});
    if(url.endsWith('/leave'))leave=result;
    return result;
  };
  const driver=createNet({fetcher,map:'enfer',pollMs:30000});
  t.after(()=>driver.stop({preservePresence:true}));
  driver.publish({...pose,vehicle:car});assert.equal(await driver.start(),true);
  const request=(path,body)=>fetcher('/api/world/'+path,{method:'POST',body:JSON.stringify({...body,map:'enfer'})}).then(r=>r.json());
  await request('sync',{...driver.getTransferIdentity(),state:{...pose,vehicle:car},events:[{op:'take',type:'vehicle',data:{...car,occupied:true}}]});
  const record={...car,occupied:false,roadCoast:planRoadCoast(pose,12,2,now,()=>false)};
  driver.emit('vehicle',record);driver.publish({...pose,vehicle:null});driver.stop();await leave;
  const observer=await request('join',{id:crypto.randomUUID(),token:crypto.randomUUID(),state:pose});
  assert.ok(!observer.players.some(p=>p.id===driver.id));
  assert.deepEqual(observer.world.vehicles[car.id].roadCoast.vx,12);
});
