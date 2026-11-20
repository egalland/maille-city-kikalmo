import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
import {careerPlaces,careerContracts,careerGarage} from '../public/career-catalog.js';

async function harness(t){
  const DB=localDatabase();t.after(()=>DB.close());
  let now=Date.now();t.mock.method(Date,'now',()=>now);
  const actor=()=>({id:crypto.randomUUID(),token:crypto.randomUUID(),profile:crypto.randomUUID(),map:'enfer'});
  const a=actor(),b=actor(),car={id:'cab-7',type:'car'};
  const post=async(path,user,extra)=>{
    const response=await handleApi(new Request('https://city.test/api/world/'+path,{method:'POST',body:JSON.stringify({...user,...extra})}),{DB});
    return response.json();
  };
  const drive=(p,extra={})=>({x:p.x,y:p.y,health:100,angle:0,speed:0,vehicle:car,...extra});
  const pose=(point,extra)=>post('sync',a,{state:drive(point,extra)});
  const active=(who,action,revision,contract)=>post('career',who,{action,revision,contract});
  const market=careerPlaces.market;
  await post('join',a,{state:drive(market)});
  await post('join',b,{state:drive(market,{vehicle:null})});
  await post('sync',a,{state:drive(market),events:[{type:'vehicle',op:'board',data:{...car,x:market.x,y:market.y,occupied:true}}]});
  return {DB,who:a,b,actor,active,pose,post,drive,car,tick:ms=>{now+=ms;}};
}
test('three street contracts pay once via live driven vehicle, persist across sessions and fund a delivered city car',async t=>{
  const {active,who,actor,pose,post,drive,tick}=await harness(t);
  let state=(await active(who,'state')).state;
  assert.equal(state.cash,45);
  for(const c of Object.values(careerContracts)){
    state=(await active(who,'start',state.revision,c.id)).state;
    for(let i=0;i<c.stages.length;i++){
      tick(12000);await pose(careerPlaces[c.stages[i].place]);
      const before=state;
      const results=await Promise.all([active(who,'advance',state.revision),active(who,'advance',state.revision)]);
      assert.equal(results.filter(r=>r.ok).length,1,JSON.stringify(results));
      state=results.find(r=>r.ok).state;
      assert.equal(state.cash,before.cash+(i===c.stages.length-1?c.reward:0));
    }
  }
  assert.equal(state.completed,3);
  await pose(careerPlaces.garage,{vehicle:null});
  const purchase=await active(who,'buy',state.revision);
  assert.ok(purchase.ok,JSON.stringify(purchase));assert.equal(purchase.vehicle.type,careerGarage.type);
  assert.equal(purchase.state.cash,state.cash-careerGarage.price);
  const second={...actor(),profile:who.profile};
  const hello=await post('join',second,{state:drive(careerPlaces.garage,{vehicle:null})});
  assert.ok(hello.world.vehicles[purchase.vehicle.id]);
  const resumed=await active(second,'state');assert.deepEqual(resumed.state,purchase.state);
  assert.ok(!(await active(second,'buy',resumed.state.revision)).ok);
  const duplicate=await active(second,'collect',resumed.state.revision);
  assert.equal(duplicate.vehicle.id,purchase.vehicle.id);assert.equal(duplicate.state.cash,purchase.state.cash);
  tick(40000);
  await post('join',second,{state:drive(careerPlaces.garage,{vehicle:null})});
  const collected=await active(second,'collect',resumed.state.revision);assert.ok(collected.ok);
  assert.equal(collected.vehicle.id,purchase.vehicle.id);
});
test('mission checkpoints check distance, travel time, authenticated vehicle, expiry and incapacitation',async t=>{
  const {active,who,pose,post,drive,tick}=await harness(t);
  let state=(await active(who,'start',0,'delivery')).state;
  await pose(careerPlaces.quay);
  assert.ok(!(await active(who,'advance',1)).ok);
  await pose(careerPlaces.market,{vehicle:{id:'unclaimed',type:'car'}});
  assert.ok(!(await active(who,'advance',1)).ok);
  await pose(careerPlaces.market);state=(await active(who,'advance',1)).state;assert.equal(state.mission.stage,1);
  await pose(careerPlaces.quay);assert.ok(!(await active(who,'advance',2)).ok);
  tick(301000);
  await post('join',who,{state:drive(careerPlaces.quay)});
  state=(await active(who,'state')).state;assert.equal(state.mission,null);assert.equal(state.cash,45);
  state=(await active(who,'start',state.revision,'taxi')).state;
  await pose(careerPlaces.quay,{health:0});assert.equal((await active(who,'state')).state.mission,null);
  assert.ok(!(await active({...who,token:crypto.randomUUID()},'state')).ok);
});
test('repair charges once, restores chassis and resets shared damage for every observer',async t=>{
  const {DB,active,who,b,pose,post,drive,car}=await harness(t);
  await pose(careerPlaces.garage);
  const damage={id:car.id,hp:61,parts:3,type:car.type};
  await DB.prepare("INSERT INTO mc_items(room,kind,item,seq,owner,data,at) VALUES('enfer:public','vehicleDamage',?,0,'',?,?)")
    .bind(car.id,JSON.stringify(damage),Date.now()).run();
  const both=await Promise.all([active(who,'repair',0),active(who,'repair',0)]);
  assert.equal(both.filter(r=>r.ok).length,1);
  assert.equal(both.find(r=>r.ok).state.cash,45-careerGarage.repair);
  const hello=await post('join',b,{state:drive(careerPlaces.garage,{vehicle:null})});
  assert.equal(hello.world.vehicleDamage[car.id].hp,100);
  assert.equal(hello.world.vehicleDamage[car.id].parts,0);
  assert.ok(hello.world.vehicleDamage[car.id].repairedAt);
  assert.ok(!(await active(who,'repair',1)).ok);
});
test('only a different career sharing the ride at both ends receives a single cooperative fee',async t=>{
  const {DB,active,who,b,pose,post,drive,car,tick}=await harness(t);
  await active(b,'state');await active(who,'start',0,'delivery');
  await post('sync',b,{state:drive(careerPlaces.market,{vehicle:null}),events:[{type:'seat',op:'climb-in',data:{driver:who.id,car:car.id}}]});
  assert.ok(await DB.prepare('SELECT rider FROM mc_seats WHERE rider=?').bind(b.id).first());
  await active(who,'advance',1);tick(15000);await pose(careerPlaces.quay);
  const r=await active(who,'advance',2);assert.ok(r.ok);
  assert.ok(!(await active(who,'advance',2)).ok);
  const passenger=(await active(b,'state')).state;
  assert.equal(passenger.cash,45+Math.round(careerContracts.delivery.reward*.35));
});
