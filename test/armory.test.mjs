import assert from 'node:assert/strict';
import test from 'node:test';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
import {ammoCapacity,reloadMagazine} from '../public/ammunition.js';
import {enferWeaponDrops} from '../public/drop-id.js';

test('two sessions share ammunition and cannot replay a pickup or skip a reload',async t=>{
  const db=localDatabase();t.after(()=>db.close());
  let clock=1800000000000;t.mock.method(Date,'now',()=>clock);
  const user=()=>({id:crypto.randomUUID(),token:crypto.randomUUID()});
  const ammoKey=crypto.randomUUID(),a=user(),b=user(),pose={x:10,y:5,health:100,weapon:'pistol'};
  async function post(route,who,extra={}){
    const response=await handleApi(new Request('https://test.local/api/world/'+route,{method:'POST',
      body:JSON.stringify({map:'enfer',...who,ammoKey,state:pose,ammoSync:true,...extra})}),{DB:db});
    assert.equal(response.status,200);return response.json();
  }
  function trigger(weapon='pistol'){
    const shotId=crypto.randomUUID();
    return {type:'fire',op:crypto.randomUUID(),data:{kind:weapon,shotId,firedAt:clock,x:pose.x+.35,y:pose.y,angle:0,length:8}};
  }
  assert.deepEqual((await post('join',a)).ammo,{pistol:36});await post('join',b);
  await post('sync',a,{events:[trigger('yarn')]});
  const round=trigger(),both=await Promise.all([post('sync',a,{events:[round]}),post('sync',a,{events:[round]})]);
  assert.equal(both[1].ammo.pistol,35);
  for(let i=1;i<12;i++){clock+=300;await post('sync',i%2?a:b,{events:[trigger()]});}
  clock+=300;
  const impatient=await post('sync',a,{events:[trigger()]});assert.equal(impatient.ammo.pistol,24);
  for(let mag=0;mag<2;mag++){
    clock+=1200;
    for(let i=0;i<12;i++){await post('sync',b,{events:[trigger()]});clock+=300;}
  }
  clock+=1500;
  const blank=trigger();
  const empty=await post('sync',a,{events:[blank,{type:'vehicleDamage',op:'empty-impact',data:{
    id:'probe-car',type:'sedan',x:16,y:5,cause:'weapon',part:'engine',weapon:'pistol',shotId:blank.data.shotId
  }}]});
  assert.equal(empty.ammo.pistol,0);
  assert.equal(empty.events.filter(e=>e.type==='shot').length,36);
  assert.ok(!empty.events.some(e=>e.type==='vehicleDamage'));
  await post('leave',a);const rejoined=await post('join',user());assert.equal(rejoined.ammo.pistol,0);
  const drop=enferWeaponDrops[0];Object.assign(pose,{x:drop.x,y:drop.y});
  const pick={op:'pick-'+clock.toString(36)+'-1',type:'pickup',data:{id:drop.id,weapon:drop.weapon}};
  const collected=await post('sync',b,{events:[pick]});assert.equal(collected.pickupResults[0].ok,true);
  assert.equal(collected.ammo[drop.weapon],ammoCapacity(drop.weapon));assert.equal(collected.ammo.pistol,12);
  const replay=await post('sync',b,{events:[pick]});assert.deepEqual(replay.ammo,collected.ammo);
  assert.equal((await post('join',user())).ammo[drop.weapon],ammoCapacity(drop.weapon));
});

test('partial reloading transfers only rounds still carried in reserve',()=>{
  assert.deepEqual(reloadMagazine(4,3,12),{clip:7,reserve:0});
  assert.deepEqual(reloadMagazine(4,18,12),{clip:12,reserve:10});
  assert.deepEqual(reloadMagazine(0,0,12),{clip:0,reserve:0});
});
