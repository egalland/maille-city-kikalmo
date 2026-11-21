import test from 'node:test';
import {tuningCatalog,tuningSites} from '../public/vehicle-tuning.js';
import assert from 'node:assert/strict';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
import {careerPlaces,careerContracts,careerGarage} from '../public/career-catalog.js';
import {retailStores} from '../public/enfer-retail.js';
import {lotSpaces,parkingLots,parkingLease} from '../public/enfer-parking-lots.js';
import {dealership} from '../public/vehicle-dealership.js';
import {driveBays,driveOrderWait} from '../public/mont-renaud.js';

test('the Auchan Drive debits a single order and hands it to the driver in a valid bay after reconnecting',async t=>{
  const {active,who,pose,post,drive,car,tick,actor}=await harness(t);
  const initial=(await active(who,'state')).state;
  const command=(user,action,revision,product)=>post('career',user,{action,revision,product});
  assert.equal((await command(who,'orderDrive',initial.revision,'ballon')).ok,false);
  const orders=await Promise.all([
    command(who,'orderDrive',initial.revision,'provisions'),
    command(who,'orderDrive',initial.revision,'provisions')
  ]);
  const [order]=orders.filter(r=>r.ok);
  assert.equal(orders.filter(r=>r.ok).length,1);
  assert.equal(order.state.cash,initial.cash-14);
  assert.deepEqual(order.state.goods,{});
  const bay=driveBays[2],revision=order.state.revision;
  await pose(bay,{angle:bay.angle});
  assert.equal((await command(who,'collectDrive',revision)).ok,false);
  tick(driveOrderWait+500);
  const next={...actor(),profile:who.profile};
  await post('join',next,{state:drive(bay,{vehicle:null,angle:bay.angle})});
  assert.deepEqual((await active(next,'state')).state.driveOrder,order.state.driveOrder);
  assert.equal((await command(next,'collectDrive',revision)).ok,false);
  const passengerCar={id:'drive-test',type:car.type};
  const record={...passengerCar,x:bay.x,y:bay.y,angle:bay.angle,occupied:true};
  await post('sync',next,{state:drive(bay,{vehicle:passengerCar,angle:bay.angle,speed:2}),
    events:[{type:'vehicle',op:'drive-claim',data:record}]});
  assert.equal((await command(next,'collectDrive',revision)).ok,false);
  await post('sync',next,{state:drive(bay,{vehicle:passengerCar,angle:bay.angle})});
  const receipts=await Promise.all([command(next,'collectDrive',revision),command(next,'collectDrive',revision)]);
  const [receipt]=receipts.filter(r=>r.ok);
  assert.equal(receipts.filter(r=>r.ok).length,1);
  assert.deepEqual(receipt.state.goods,{provisions:1});
  assert.equal(receipt.state.cash,order.state.cash);
  assert.equal(receipt.state.driveOrder,null);
});

test('a vehicle license is bought once at the garage and supports free nearby delivery after reconnecting',async t=>{
  const {DB,active,who,pose,post,drive,actor,tick}=await harness(t);
  const initial=(await active(who,'state')).state,model='compact',price=dealership.get(model).price;
  await DB.prepare('UPDATE mc_careers SET cash=? WHERE profile=?').bind(price+100,initial.parkingOwner).run();
  const garage=careerPlaces.garage;
  const buy=()=>post('career',who,{action:'buyVehicleLicense',model,revision:initial.revision});
  assert.equal((await buy()).ok,false);
  await pose(garage,{vehicle:null});
  const purchases=(await Promise.all([buy(),buy()])).filter(result=>result.ok);
  assert.equal(purchases.length,1);assert.equal(purchases[0].state.cash,100);
  const returning={...actor(),profile:who.profile},target=careerPlaces.quay;
  const onFoot=drive(target,{vehicle:null});
  await post('join',returning,{state:onFoot});
  const {state}=await active(returning,'state');
  assert.deepEqual(state.vehicleLicenses,[model]);
  const call=(delivery,revision=state.revision)=>post('career',returning,{action:'deliverVehicle',model,revision,delivery});
  assert.equal((await call({...target,x:target.x+70,angle:0})).ok,false);
  const delivery={x:target.x+7,y:target.y,angle:.3};
  const first=await call(delivery);
  assert.ok(first.ok,first.error);assert.equal(first.state.cash,100);assert.equal(first.vehicle.type,model);
  assert.equal((await call(delivery,first.state.revision)).ok,false);
  tick(26_000);await post('join',returning,{state:onFoot});
  const second=await call(delivery,first.state.revision);
  assert.ok(second.ok,second.error);assert.notEqual(second.vehicle.id,first.vehicle.id);
  const rejoined=await post('join',who,{state:onFoot});
  assert.ok(rejoined.world.vehicles[second.vehicle.id]);assert.equal(rejoined.world.vehicles[first.vehicle.id],undefined);
});

test('an expired street car loses its old damage, while a parked car keeps it',async t=>{
  const {DB,who,post,drive,tick}=await harness(t);
  const spot=careerPlaces.market;
  for(const [id,expiresAt] of [['street-returns',Date.now()+3000],['still-parked',Date.now()+60_000]]){
    const item=(kind,data)=>DB.prepare("INSERT INTO mc_items(room,kind,item,seq,data,owner,at) VALUES('enfer:public',?,?,0,?,'',?)")
      .bind(kind,id,JSON.stringify(data),Date.now()).run();
    await item('vehicle',{id,type:'compact',...spot,expiresAt});
    await item('vehicleDamage',{id,type:'compact',hp:47,parts:132,...spot});
  }
  tick(3200);
  const world=(await post('join',who,{state:drive(spot,{vehicle:null})})).world;
  assert.equal(world.vehicles['street-returns'],undefined);
  assert.equal(world.vehicleDamage['street-returns'],undefined);
  assert.equal(world.vehicleDamage['still-parked'].hp,47);
});

test('the Mont Renaud garage installs a part once and keeps it on the next delivery',async t=>{
  const {DB,active,who,pose,post,drive,tick}=await harness(t);
  const model='compact',price=dealership.get(model).price,part=tuningCatalog.get('engine');
  const initial=(await active(who,'state')).state;
  const site=tuningSites[1],onFoot=drive(site,{vehicle:null});
  await DB.prepare('UPDATE mc_careers SET cash=? WHERE profile=?').bind(price+part.price+120,initial.parkingOwner).run();
  await pose(site,{vehicle:null});
  const command=(action,revision,extra)=>post('career',who,{action,revision,...extra});
  const bought=await command('buyVehicleLicense',initial.revision,{model});
  assert.ok(bought.ok,bought.error);
  const delivery={x:site.x+6,y:site.y,angle:0};
  const first=await command('deliverVehicle',bought.state.revision,{model,delivery});
  assert.ok(first.ok,first.error);
  const car=first.vehicle,driver=drive(delivery,{vehicle:car});
  assert.equal((await command('installTuning',first.state.revision,{upgrade:part.id})).ok,false);
  const joined=await post('sync',who,{state:driver,events:[{type:'vehicle',op:'board-tuning',data:{...car,occupied:true}}]});
  assert.ok(joined.events?.some(e=>e.type==="vehicle"&&e.data.id===car.id),JSON.stringify(joined));
  const install=()=>command('installTuning',first.state.revision,{upgrade:part.id});
  const applied=(await Promise.all([install(),install()])).filter(r=>r.ok);
  assert.equal(applied.length,1);
  assert.equal(applied[0].state.cash,120);
  await post('sync',who,{state:onFoot,events:[{type:'vehicle',op:'exit-tuning',data:{...car,occupied:false}}]});
  tick(26_000);
  await post('join',who,{state:onFoot});
  const next=await command('deliverVehicle',applied[0].state.revision,{model,delivery});
  assert.ok(next.ok,next.error);
  assert.equal(next.vehicle.tune,part.bit);
});

test('a defeated player drops part of their wallet and the cash can be collected once',async t=>{
  const {DB,active,who,b,post,drive,tick}=await harness(t);
  const spot=careerPlaces.market;
  await active(who,'state');await active(b,'state');
  await post('sync',who,{state:drive(spot,{vehicle:null})});
  tick(150);
  const hit=await post('sync',who,{events:[{op:'test-cash-hit',type:'hit',data:{target:b.id,damage:35,cause:'weapon'}}]});
  assert.ok(hit.events.some(e=>e.type==='hit'&&e.data.target===b.id),JSON.stringify(hit.events));
  tick(150);
  await post('sync',b,{state:drive(spot,{vehicle:null,health:0})});
  const victim=(await active(b,'state')).state;
  assert.equal(victim.cash,36);
  const collector=(await active(who,'state')).state;
  const [drop]=collector.cashDrops;
  assert.equal(drop.amount,9);
  const collect=()=>post('career',who,{action:'collectCash',revision:collector.revision,drop:drop.id});
  const [result,...extra]=(await Promise.all([collect(),collect()])).filter(r=>r.ok);
  assert.equal(extra.length,0);
  assert.equal(result.state.cash,54);
  assert.equal(result.state.cashDrops.length,0);
  const npcTime=Date.now();
  await DB.prepare("INSERT INTO mc_events(room,player,op,name,type,data,at) VALUES('enfer:public',?,'test-cash-npc','Test','npc',?,?)")
    .bind(who.id,JSON.stringify({id:'civilian',type:'walker',healthAt:npcTime,dead:true,damage:30,x:spot.x,y:spot.y}),npcTime).run();
  const npc=(await active(who,'state')).state.cashDrops[0];
  assert.ok(npc.id.startsWith('npc:civilian:'));
  assert.ok(npc.amount>=7&&npc.amount<=17);
});
test('retail checks the correct counter, debits once and retains purchases across reconnects',async t=>{
  const {active,who,pose,post,drive,actor}=await harness(t);
  const grocery=retailStores.find(s=>s.id==='bobines'),position={x:grocery.buyerX,y:grocery.buyerY};
  const initial=(await active(who,'state')).state;
  const buy=(product,revision=initial.revision)=>post('career',who,{action:'buyProduct',product,revision});
  assert.equal((await buy('pommes')).ok,false);
  await pose(position);
  assert.equal((await buy('pommes')).ok,false);
  await pose(position,{vehicle:null,health:66});
  assert.equal((await buy('bouquet')).ok,false);
  const results=await Promise.all([buy('pommes'),buy('pommes')]);
  const [purchase,...duplicates]=results.filter(r=>r.ok);
  assert.ok(purchase);assert.equal(duplicates.length,0);
  assert.equal(purchase.state.cash,40);assert.equal(purchase.state.goods.pommes,1);
  const next={...actor(),profile:who.profile};
  await post('join',next,{state:drive(careerPlaces.quay,{vehicle:null,health:65})});
  const {state}=await active(next,'state');
  assert.equal(state.goods.pommes,1);
  const used=await post('career',next,{action:'eatProduct',product:'pommes',revision:state.revision});
  assert.equal(used.food,10);assert.deepEqual(used.state.goods,{});
  let revision=used.state.revision;
  for(const [id,product,price] of [['action-noyon','bougie',6],['kiabi-noyon','bonnet',8]]){
    const store=retailStores.find(s=>s.id===id);
    await post('sync',next,{state:drive({x:store.buyerX,y:store.buyerY},{vehicle:null})});
    const result=await post('career',next,{action:'buyProduct',product,revision});
    assert.equal(result.state.revision,revision+1);
    assert.equal(result.state.goods[product],1);
    assert.equal(result.state.cash,id==='action-noyon'?40-price:34-price);
    revision=result.state.revision;
  }
});

test('a parked vehicle keeps its pose and can only be reclaimed by its profile before expiry',async t=>{
  const {active,who,b,post,drive,car,tick,actor}=await harness(t);
  const [,spot]=lotSpaces(parkingLots.find(p=>p.id==='mont-renaud-parking-principal')),owner=(await active(who,'state')).state.parkingOwner;
  await active(b,'state');
  await post('sync',who,{state:drive(spot)});
  const park={...car,x:spot.x,y:spot.y,angle:spot.angle,occupied:false,parkingSlot:spot.id,parkingOwner:owner};
  const atFoot=drive(spot,{vehicle:null});
  const released=await post('sync',who,{state:atFoot,events:[{type:'vehicle',op:'park',data:park}]});
  const record=released.events.find(e=>e.data.parkingSlot)?.data;
  assert.deepEqual([record.x,record.y,record.parkingSlot],[spot.x,spot.y,spot.id]);
  assert.equal(record.expiresAt-released.now,parkingLease);
  tick(4*60_000);
  const visitor=await post('join',b,{state:atFoot});
  assert.equal(visitor.world.vehicles[car.id].parkingOwner,owner);
  const claim={...park,parkingSlot:null,parkingOwner:null,occupied:true};
  const denied=await post('sync',b,{state:atFoot,events:[{type:'vehicle',op:'claim-parked',data:claim}]});
  assert.notEqual(denied.claims?.find(v=>v.id===car.id)?.owner,b.id);
  const returning={...actor(),profile:who.profile};
  await post('join',returning,{state:atFoot});await active(returning,'state');
  const accepted=await post('sync',returning,{state:atFoot,events:[{type:'vehicle',op:'claim-parked',data:claim}]});
  assert.ok(accepted.events.some(e=>e.player===returning.id&&e.data.id===car.id&&e.data.occupied));
});

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
  const active=(who,action,revision,contract,amount)=>post('career',who,{action,revision,contract,amount});
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
  for(const c of Object.values(careerContracts).filter(c=>!c.cooperative)){
    state=(await active(who,'start',state.revision,c.id)).state;
    for(let i=0;i<c.stages.length;i++){
      tick(c.id==='race'?23000:12000);await pose(careerPlaces[c.stages[i].place]);
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

test('bank counters enforce balances, proximity and duplicate protection; old wallets migrate on read',async t=>{
  const {active,who,pose,DB}=await harness(t);
  const old=await active(who,'state');
  await DB.prepare('DELETE FROM mc_enterprises').run();
  const migrated=await active(who,'state');assert.deepEqual(migrated.state,old.state);
  await pose(careerPlaces.quay);
  assert.ok(!(await active(who,'deposit',0,null,10)).ok);
  await pose(careerPlaces.market);
  for(const invalid of [0,-1,2.7,46,'10'])assert.ok(!(await active(who,'deposit',0,null,invalid)).ok);
  const simultaneous=await Promise.all([active(who,'deposit',0,null,25),active(who,'deposit',0,null,25)]);
  assert.equal(simultaneous.filter(r=>r.ok).length,1);
  const saved=(await active(who,'state')).state;
  assert.equal(saved.cash,20);assert.equal(saved.bank,25);
  assert.ok(!(await active(who,'withdraw',saved.revision,null,26)).ok);
  const back=await active(who,'withdraw',saved.revision,null,15);
  assert.equal(back.state.cash,35);assert.equal(back.state.bank,10);
});

test('garage license pays only after finished contracts up to the reserve cap and grants discounted repairs',async t=>{
  const {active,who,pose,tick,DB,car}=await harness(t);
  let state=(await active(who,'state')).state;
  async function finish(id){
    state=(await active(who,'start',state.revision,id)).state;
    for(const s of careerContracts[id].stages){
      tick(12000);await pose(careerPlaces[s.place]);
      const reply=await active(who,'advance',state.revision);assert.ok(reply.ok,JSON.stringify(reply));state=reply.state;
    }
  }
  await finish('delivery');await finish('taxi');
  assert.equal(state.cash,245);assert.equal(state.revenue,0);
  assert.ok(!(await active(who,'license',state.revision)).ok);
  await pose(careerPlaces.garage);state=(await active(who,'license',state.revision)).state;
  assert.ok(state.licensed);assert.equal(state.cash,245-careerGarage.licensePrice);
  assert.ok(!(await active(who,'license',state.revision)).ok);
  for(let i=0;i<6;i++)await finish('delivery');
  assert.equal(state.revenue,careerGarage.rentCap);
  await pose(careerPlaces.garage);
  const before=state.cash;
  state=(await active(who,'collectRent',state.revision)).state;
  assert.equal(state.revenue,0);assert.equal(state.cash,before+careerGarage.rentCap);
  assert.ok(!(await active(who,'collectRent',state.revision)).ok);
  await DB.prepare("INSERT INTO mc_items(room,kind,item,seq,owner,data,at) VALUES('enfer:public','vehicleDamage',?,0,'',?,?)")
    .bind(car.id,JSON.stringify({hp:70,id:car.id,parts:1}),Date.now()).run();
  assert.equal((await active(who,'repair',state.revision)).state.cash,state.cash-careerGarage.memberRepair);
});

test('the relay requires the same second player at every checkpoint and pays both careers',async t=>{
  const {active,who,b,pose,post,drive,car,tick}=await harness(t);
  await active(b,'state');
  let state=(await active(who,'start',0,'relay')).state;
  assert.ok(!(await active(who,'advance',state.revision)).ok);
  const seat=(place,op,leave)=>post('sync',b,{state:drive(place,{vehicle:null}),events:[{type:'seat',op,data:{driver:who.id,car:car.id,leave}}]});
  await seat(careerPlaces.market,'join-team',false);
  state=(await active(who,'advance',state.revision)).state;assert.equal(state.mission.stage,1);
  tick(12000);await pose(careerPlaces.garage);
  await seat(careerPlaces.garage,'get-out',true);
  assert.ok(!(await active(who,'advance',state.revision)).ok);
  await seat(careerPlaces.garage,'get-back-in',false);
  state=(await active(who,'advance',state.revision)).state;assert.equal(state.mission.stage,2);
  tick(12000);await pose(careerPlaces.quay);
  state=(await active(who,'advance',state.revision)).state;
  assert.equal(state.completed,1);assert.equal(state.cash,45+careerContracts.relay.reward);
  const buddy=(await active(b,'state')).state;
  assert.equal(buddy.completed,1);assert.equal(buddy.cash,45+Math.round(careerContracts.relay.reward*.35));
});


test('ranked lap uses server start gate, directed-road minima, anonymous-by-default records and a five-alias public board',async t=>{
  const {active,who,b,pose,tick,DB}=await harness(t);
  let state=(await active(who,'start',0,'race')).state;
  tick(12000);await pose(careerPlaces.garage);
  state=(await active(who,'advance',state.revision)).state;
  tick(8000);await pose(careerPlaces.quay);
  assert.ok(!(await active(who,'advance',state.revision)).ok,'straight-line time is too short for the one-way streets');
  tick(15000);await pose(careerPlaces.quay);
  state=(await active(who,'advance',state.revision)).state;
  tick(12000);await pose(careerPlaces.market);
  state=(await active(who,'advance',state.revision)).state;
  assert.equal(state.bestLapMs,35000);assert.equal(state.publicLapMs,null);assert.deepEqual(state.leaders,[]);
  for(let i=1;i<=6;i++)await DB.prepare('INSERT INTO mc_laps(profile,best,public,alias) VALUES(?,?,?,?)')
    .bind('seed'+i,41000+i,41000+i,'Coureur '+i).run();
  state=(await active(who,'publishLap',state.revision)).state;
  assert.equal(state.leaders.length,5);assert.equal(state.publicLapMs,35000);
  assert.deepEqual(Object.keys(state.leaders[0]).sort(),['ms','name']);
  assert.equal(state.leaders[0].ms,35000);
  state=(await active(who,'hideLap',state.revision)).state;
  assert.equal(state.publicLapMs,null);assert.equal(state.bestLapMs,35000);assert.equal(state.leaders[0].ms,41001);
  assert.ok(!(await active(b,'publishLap',0)).ok);
});

test('Halles sells one durable armor layer to its active wearer and replicates only owned coat dyes',async t=>{
  const {who,b,post,pose,drive,active,tick}=await harness(t);
  let s=(await active(who,'start',0,'delivery')).state;
  s=(await active(who,'advance',s.revision)).state;tick(12000);await pose(careerPlaces.quay);
  s=(await active(who,'advance',s.revision)).state;
  assert.ok(!(await active(who,'buyArmor',s.revision)).ok);
  await pose(careerPlaces.market,{type:'fox',color:'foret'});
  s=(await active(who,'buyArmor',s.revision)).state;
  assert.equal(s.armor,40);assert.ok(s.wearable);assert.equal(s.cash,75);assert.ok(s.armorId);
  assert.ok(!(await active(who,'buyArmor',s.revision)).ok);
  assert.equal((await post('career',who,{action:'state',wear:{id:s.armorId,remaining:26}})).state.armor,26);
  assert.equal((await post('career',who,{action:'state',wear:{id:s.armorId,remaining:33}})).state.armor,26,'late reports cannot restore an absorbed hit');
  const other={...b,profile:who.profile};
  let mirrored=await post('career',other,{action:'state',wear:{id:s.armorId,remaining:2}});
  assert.equal(mirrored.state.armor,26);assert.ok(!mirrored.state.wearable);
  const dye=async(action,value)=>post('career',who,{action,revision:s.revision,dye:value});
  assert.ok(!(await dye('equipDye','indigo')).ok);
  s=(await dye('buyDye','rubis')).state;
  assert.deepEqual(s.dyes,['rubis']);assert.equal(s.cash,40);
  const peer=await post('sync',b,{state:drive(careerPlaces.market,{vehicle:null})});
  assert.equal(peer.players.find(p=>p.id===who.id).color,'foret~rubis');
  assert.ok(!(await dye('buyDye','rubis')).ok);
  s=(await dye('equipDye',null)).state;assert.equal(s.dye,null);
  await post('leave',who,{});
  mirrored=await post('career',other,{action:'state'});assert.ok(mirrored.state.wearable);assert.equal(mirrored.state.armor,26);
});
