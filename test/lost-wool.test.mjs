import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
import {lostWool,woolReward,woolCounter} from '../public/lost-wool.js';

test('world clock opens and closes hunts, changes drop and permits carrying until the shared deadline',()=>{
  assert.equal(lostWool(479999).phase,'find');assert.equal(lostWool(480000).phase,'closed');
  assert.equal(lostWool(719999,{slot:0,paid:false}).goal,woolCounter);
  assert.equal(lostWool(719999,{slot:0,paid:true}).phase,'paid');
  assert.notEqual(lostWool(720000,{slot:0,paid:false}).point.id,lostWool(0).point.id);
  assert.equal(lostWool(720000,{slot:0,paid:true}).phase,'find');
});

test('all three pieces of wool and the return desk are clear walkable pavement outside vehicle lanes',async t=>{
  globalThis.location=new URL('https://maille.test/?monde=enfer');
  t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {nearbyDrivableStreets,contactAt}=await import('../public/paris-world.js');
  for(const p of [woolCounter,...[0,720000,1440000].map(now=>lostWool(now).point)]){
    assert.equal(contactAt(p.x,p.y,{radius:.8}),null,p.id);
    const nearby=nearbyDrivableStreets(p.x,p.y,25);
    const clearance=Math.min(...nearby.flatMap(q=>q.path.slice(1).map((b,i)=>{
      const a=q.path[i],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy)-q.w/2;
    })));
    assert.ok(clearance>.80&&clearance<1.2,p.id+': '+clearance);
  }
});

test('wool persists through reconnect, requires walking to both real stops and pays exactly once per career and event',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  let now=720000*15000+1500;t.mock.method(Date,'now',()=>now);
  const session={id:crypto.randomUUID(),token:crypto.randomUUID(),profile:crypto.randomUUID(),map:'enfer'};
  const run=async(path,body)=>{const r=await handleApi(new Request('https://city.test/api/world/'+path,{method:'POST',body:JSON.stringify({...session,...body})}),{DB});return r.json();};
  const event=lostWool(now);
  const claim=(action,revision,slot=event.slot)=>run('career',{action,revision,slot});
  const move=(p,vehicle=null)=>run('sync',{state:{x:p.x,y:p.y,vehicle,health:100}});
  await run('join',{state:woolCounter});await claim('state',0);
  assert.ok(!(await claim('woolPick',0)).ok);
  await move(event.point,{id:'test-car',type:'van'});
  assert.ok(!(await claim('woolPick',0)).ok);
  await move(event.point);
  const pick=await claim('woolPick',0);assert.ok(pick.ok);assert.equal(pick.state.cash,45);
  assert.ok(!(await claim('woolPick',1)).ok);
  await run('leave',{});await run('join',{state:woolCounter});
  assert.equal((await claim('state',1)).state.wool.slot,event.slot);
  assert.ok(!(await claim('woolReturn',1)).ok);
  now+=60000;await run('join',{state:woolCounter});
  const replies=await Promise.all([claim('woolReturn',1),claim('woolReturn',1)]);
  assert.equal(replies.filter(r=>r.ok).length,1);
  assert.equal(replies.find(r=>r.ok).state.cash,45+woolReward);
  assert.ok(!(await claim('woolReturn',2)).ok);
  now=(event.slot+1)*720000;
  await run('join',{state:lostWool(now).point});
  assert.ok(!(await claim('woolPick',2)).ok);
  assert.ok((await claim('woolPick',2,event.slot+1)).ok);
});
