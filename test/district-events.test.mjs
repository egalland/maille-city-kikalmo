import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
import {incidentDepot,incidentKinds,incidentObjectives,incidentPeriod,incidentPosts,incidentStop} from '../public/district-events.js';

function fixture(t,kind){
  const DB=localDatabase();t.after(()=>DB.close());
  let now=incidentPeriod*12345+1000;
  t.mock.method(Date,'now',()=>now);
  const roll=Object.keys(incidentKinds).indexOf(kind);
  t.mock.method(crypto,'getRandomValues',a=>{a[0]=roll;return a;});
  const person=(profile=crypto.randomUUID())=>({id:crypto.randomUUID(),token:crypto.randomUUID(),profile,map:'enfer'});
  async function post(player,path,body={}){
    const request=new Request('https://fixture/api/world/'+path,{method:'POST',body:JSON.stringify({...player,...body})});
    return (await handleApi(request,{DB})).json();
  }
  return {
    person,now:()=>now,add:n=>{now+=n;},post,
    join:(p,point=incidentDepot)=>post(p,'join',{state:{...point,health:100}}),
    move:(p,point,extra={})=>post(p,'sync',{state:{...point,health:100,...extra}}),
    read:p=>post(p,'career',{action:'state'}),
    act:(p,e,task,operation='work')=>post(p,'career',{action:'incident',slot:e.slot,task,operation})
  };
}

test('concurrent clients draw one event and share actual repaired lights, payments, late joins and the next random draw',async t=>{
  const f=fixture(t,'lights'),a=f.person(),b=f.person(),late=f.person();
  await Promise.all([f.join(a),f.join(b)]);
  const [{incident:e},{incident:shared}]=await Promise.all([f.read(a),f.read(b)]);
  assert.equal(e.kind,'lights');assert.deepEqual(e,shared);
  assert.equal(incidentObjectives(e,f.now()).length,3);
  assert.equal((await f.act(a,e,2)).ok,false);
  await Promise.all([f.move(a,incidentStop(e,2)),f.move(b,incidentStop(e,2))]);
  const results=await Promise.all([f.act(a,e,2),f.act(b,e,2)]);
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal((await f.read(a)).state.cash+(await f.read(b)).state.cash,90+incidentKinds.lights.pay);
  const publicUpdate=await f.post(b,'sync',{cursor:0});
  assert.ok(publicUpdate.events.some(v=>v.type==='districtUpdate'&&v.data.slot===e.slot));
  await f.join(late,incidentStop(e,0));
  const after=await f.read(late);
  assert.equal(after.incident.tasks[2].done,true);
  assert.equal(after.incident.tasks[2].holder,undefined);
  assert.equal((await f.act(late,e,0)).ok,true);
  await f.move(a,incidentStop(e,1));assert.equal((await f.act(a,e,1)).ok,true);
  assert.deepEqual(incidentObjectives((await f.read(b)).incident,f.now()),[]);
  f.add(e.ends-f.now()+1);await f.join(a,incidentStop(e,1));
  assert.equal((await f.act(a,e,1)).ok,false);
  f.add(e.next-f.now()+1);await f.join(a,incidentDepot);
  const fresh=(await f.read(a)).incident;
  assert.notEqual(fresh.kind,e.kind);assert.equal(fresh.slot,e.slot+1);
  assert.ok(fresh.tasks.every(t=>!t.done));
  assert.equal((await f.act(a,e,1)).ok,false);
});
test('the shared courier relay locks later posts until an earlier player passes it forward',async t=>{
  const f=fixture(t,'relay'),a=f.person(),b=f.person();
  await f.join(a);await f.join(b);
  const e=(await f.read(a)).incident;assert.equal(e.kind,'relay');
  const go=async(p,i)=>{await f.move(p,incidentStop(e,i));return f.act(p,e,i);};
  assert.equal((await go(b,1)).ok,false);
  assert.equal((await go(a,0)).ok,true);
  assert.deepEqual(incidentObjectives((await f.read(b)).incident,f.now()).map(v=>v.task),[1]);
  assert.equal((await go(b,1)).ok,true);
  assert.equal((await go(a,2)).ok,true);
  assert.equal((await go(b,2)).ok,false);
  assert.equal((await f.read(a)).state.cash,45+2*incidentKinds.relay.pay);
  assert.equal((await f.read(b)).state.cash,45+incidentKinds.relay.pay);
});
test('ballots have one carrier, survive reconnect, recover expired cargo and atomically pay only for returns',async t=>{
  const f=fixture(t,'parcels'),a=f.person(),b=f.person();await f.join(a);await f.join(b);
  const e=(await f.read(a)).incident,p0=incidentStop(e,0),p1=incidentStop(e,1);assert.equal(e.kind,'parcels');
  await f.move(a,p0,{vehicle:{id:'test-van',type:'van'}});assert.equal((await f.act(a,e,0)).ok,false);
  await f.move(a,p0,{health:0});assert.equal((await f.act(a,e,0)).ok,false);
  await f.move(a,p0);await f.move(b,p0);
  const pickup=await f.act(a,e,0);
  assert.equal(pickup.ok,true);assert.equal(pickup.state.cash,45);
  assert.equal(incidentObjectives(pickup.incident,f.now())[0].point.id,incidentDepot.id);
  assert.equal((await f.act(b,e,0)).ok,false);
  await f.move(a,p1);assert.equal((await f.act(a,e,1)).ok,false);
  await f.move(b,p1);assert.equal((await f.act(b,e,1)).ok,true);
  await f.post(a,'leave');const resumed=f.person(a.profile);await f.join(resumed,incidentDepot);
  assert.equal((await f.read(resumed)).incident.tasks[0].mine,true);
  assert.equal((await f.act(resumed,e,0,'deliver')).ok,false);
  f.add(10000);
  const payments=await Promise.all([f.act(resumed,e,0,'deliver'),f.act(resumed,e,0,'deliver')]);
  assert.equal(payments.filter(r=>r.ok).length,1);
  assert.equal((await f.read(resumed)).state.cash,45+incidentKinds.parcels.pay);
  f.add(180001);await f.join(resumed,p1);await f.join(b,incidentDepot);
  assert.equal((await f.act(b,e,1,'deliver')).ok,false);
  assert.equal((await f.act(resumed,e,1)).ok,true);
});
test('all incident objects have safe footing outside the road on the released geometry',async t=>{
  globalThis.location=new URL('https://map.test/?monde=enfer');t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {contactAt,nearbyDrivableStreets}=await import('../public/paris-world.js');
  for(const p of [...incidentPosts,incidentDepot]){
    assert.equal(contactAt(p.x,p.y,{radius:.9}),null,p.name);
    const gaps=nearbyDrivableStreets(p.x,p.y,25).flatMap(r=>r.path.slice(1).map((b,i)=>{
      const a=r.path[i],dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(p.x-a[0]-dx*u,p.y-a[1]-dy*u)-r.w/2;
    }));
    assert.ok(Math.min(...gaps)>1.15&&Math.min(...gaps)<1.7,p.name);
  }
});
