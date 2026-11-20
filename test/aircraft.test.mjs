import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {airfields,flightCeiling,isAircraft} from '../public/airfield.js';
import {stepAircraft,aircraftObstructed} from '../public/flight.js';
import {vehicleDoorways} from '../public/vehicle-types.js';
import {createCar} from '../public/puppets3d.js';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';

test('two kinds of aircraft hover, cruise, bank, stop and land without crossing walls or water',()=>{
  const world={ground:()=>0,water:()=>null,contact:(x,y,opt)=>{
    const reach=opt.halfLength||opt.radius;
    return x+reach>20&&x-reach<22&&opt.footWorldZ<10&&Math.abs(y)<10;
  }};
  for(const {type} of airfields){
    let pos={x:0,y:0,angle:0,lift:0,speed:0,verticalSpeed:0};
    const fly=(seconds,input)=>{for(let i=0;i<seconds*50;i++)pos=stepAircraft(type,pos,input,.02,world);};
    fly(2,{throttle:1});assert.equal(pos.x,0,'no ground sliding');
    fly(3,{vertical:1});assert.ok(pos.lift>6);
    fly(12,{vertical:-1});fly(2,{});assert.ok(pos.lift<2);
    fly(1,{vertical:1});fly(10,{throttle:1});
    assert.ok(pos.x<20&&pos.lift<10,'collision at speed');
    fly(10,{vertical:1});assert.ok(pos.lift>15);
    fly(4,{throttle:1});assert.ok(pos.x>22);
    fly(.4,{steer:1});assert.ok(pos.angle>0&&pos.bank>0);
    fly(70,{vertical:1});assert.equal(pos.lift,flightCeiling);
    fly(70,{vertical:-1});assert.equal(pos.lift,0);
    assert.equal(pos.verticalSpeed,0);
    const lake={...world,water:()=>1.25};
    let water={...pos,lift:4};
    for(let i=0;i<200;i++)water=stepAircraft(type,water,{vertical:-1},.04,lake);
    assert.equal(water.lift,2);
  }
});

test('the two-layer clearance volume stops the body and outboard rotor independently',()=>{
  const query=[];
  const collider=(x,y,opt)=>{query.push(opt);return !!(opt.radius&&opt.radius>3&&opt.footWorldZ<7);};
  assert.equal(aircraftObstructed('helicopter',{x:0,y:0},0,4,collider),true);
  assert.equal(query.length,2);assert.ok(!query[0].radius&&query[1].radius);
  assert.equal(aircraftObstructed('helicopter',{x:0,y:0},0,9,collider),false);
});

test('rotors are independent of the fuselage, and the two actual occupants leave empty seats',()=>{
  for(const field of airfields){
    const model=createCar(field.type,field.color,12);
    const rotor=model.group.getObjectByName('Rotor principal');
    model.update({},.05,0);
    assert.equal(model.group.getObjectByName('Conducteur assis'),undefined);
    model.update({driver:true,passenger:true,self:true,driverSkin:'foret',passengerSkin:'bruyere',chassisHp:100},.05,.05);
    assert.ok(model.group.getObjectByName('Conducteur assis')?.visible);
    assert.ok(model.group.getObjectByName('Passager assis')?.visible);
    if(field.type==='helicopter'){
      assert.ok(rotor.rotation.y>0);
      assert.ok(model.group.getObjectByName('Rotor de queue').rotation.z>0);
      assert.equal(model.group.getObjectByName('Cellule en feutre').rotation.y,0);
    }
    model.update({},.05,.1);assert.equal(model.group.getObjectByName('Conducteur assis').visible,false);
    model.dispose();
  }
});

test('the flight inputs, door, takeoff, blocked exit, landing and safe dismount work in the Enfer game',async t=>{
  globalThis.location=new URL('https://maille.test/?monde=enfer');
  t.mock.method(globalThis,'fetch',async path=>new Response(await readFile(new URL('../public'+String(path).split('?')[0],import.meta.url))));
  const {createGame}=await import('../public/game.js');
  const {routeAgents,contactAt}=await import('../public/paris-world.js');
  let draw,hud,frame,stamp=performance.now(),now=1782250000000,published;
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  globalThis.requestAnimationFrame=cb=>(frame=cb,1);globalThis.cancelAnimationFrame=()=>{};
  const canvas=new EventTarget();const net={id:'pilot',status:'offline',world:()=>({}),peers:()=>[],publish:state=>published=state,serverTime:()=>now};
  const game=createGame({canvas,net,onState:s=>hud=s,buildView:()=>({available:true,effect(){},render(s){draw=s;},dispose(){}})});
  const ticks=n=>{for(let i=0;i<n;i++){stamp+=50;now+=50;frame(stamp);}};
  function keyboard(key,held){
    const event=new Event(held?'keydown':'keyup',{cancelable:true});
    Object.defineProperty(event,'key',{value:key});window.dispatchEvent(event);
  }
  t.after(()=>{game.destroy();for(const k of ['location','window','document','requestAnimationFrame','cancelAnimationFrame'])delete globalThis[k];});
  for(const field of airfields){
    const vehicle=routeAgents(field.x,field.y,12,now).cars.find(v=>isAircraft(v.type));
    assert.equal(vehicle?.type,field.type);assert.equal(contactAt(field.x,field.y,{radius:4.5}),null);
    const door=vehicleDoorways(vehicle,.85)[0];
    assert.ok(game.restoreTravelState({...game.exportTravelState(),...door,vehicle:null,vx:0,vy:0}));
    ticks(4);game.action('vehicle');ticks(10);assert.ok(hud.piloting);
    const byKeyboard=field.type==='helicopter';
    if(byKeyboard)keyboard(' ',true);else game.setFlightVertical(1);
    ticks(65);
    if(byKeyboard)keyboard(' ',false);else game.setFlightVertical(0);
    ticks(10);
    assert.ok(hud.flightHeight>=8);assert.equal(published.vehicle.type,field.type);
    assert.ok(draw.entities.find(e=>e.self).lift>8);
    game.action('vehicle');ticks(5);assert.ok(hud.piloting);
    game.setDrive(.4,.5);ticks(15);game.setDrive(0,0);ticks(55);
    if(byKeyboard)keyboard('Control',true);else game.setFlightVertical(-1);
    ticks(150);
    if(byKeyboard)keyboard('Control',false);else game.setFlightVertical(0);
    assert.equal(hud.flightHeight,0);game.action('vehicle');ticks(9);
    assert.equal(hud.inVehicle,false);assert.ok(!contactAt(draw.p.x,draw.p.y,{radius:.42}));
  }
});

test('a second client receives flight-height, heading and attitude and can only board on the ground',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  const user=()=>({id:crypto.randomUUID(),token:crypto.randomUUID(),name:'Essai',map:'enfer'});
  let stamp=1782250000000;t.mock.method(Date,'now',()=>stamp);
  const post=async(who,path,extra={})=>{
    const r=await handleApi(new Request('https://maille.test/api/world/'+path,{method:'POST',body:JSON.stringify({...who,...extra})}),{DB});
    assert.equal(r.status,200);return r.json();
  };
  for(const field of airfields){
    const pilot=user(),rider=user();
    const pose={x:10,y:12,angle:.9,speed:0,health:100},craft={id:'air-'+field.id,type:field.type,...pose,bank:.13,carPitch:-.09};
    await post(pilot,'join',{state:pose});await post(rider,'join',{state:pose});
    const fly=lift=>({state:{...pose,lift,verticalSpeed:4,vehicle:craft,motion:'carAir'}});
    await post(pilot,'sync',{...fly(55),events:[{type:'vehicle',op:'take',data:{...craft,occupied:true}}]});
    const ask=op=>post(rider,'sync',{events:[{type:'seat',op,data:{car:craft.id,driver:pilot.id}}]});
    let body=await ask('sky');
    const remote=body.players.find(p=>p.id===pilot.id);
    assert.equal(remote.lift,55);assert.equal(remote.vehicle.bank,.13);assert.equal(remote.angle,.9);
    assert.ok(body.players.every(p=>!p.passenger));
    await post(pilot,'sync',fly(0));body=await ask('ground');
    assert.deepEqual(body.players.find(p=>p.id===rider.id).passenger,{car:craft.id,driver:pilot.id});
    await post(pilot,'sync',fly(28));body=await post(rider,'sync');
    assert.equal(body.players.find(p=>p.id===rider.id).lift,28);
    body=await post(rider,'sync',{events:[{type:'seat',op:'exit-in-air',data:{leave:true}}]});
    assert.ok(body.players.find(p=>p.id===rider.id).passenger);
    stamp+=1700;await post(pilot,'sync',fly(26));await post(pilot,'leave');
    body=await post(rider,'sync');assert.ok(!body.players.find(p=>p.id===rider.id).passenger);
    const replay=await post(rider,'join');
    assert.equal(replay.world.vehicles[craft.id].x,field.x);assert.equal(replay.world.vehicles[craft.id].lift,0);
    await post(rider,'leave');
  }
});
