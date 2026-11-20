import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/game-api.js';
import {localDatabase} from '../scripts/local-db.mjs';

test('world reports retain accepted chat privately, and only a driver can sound a nearby horn',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  const user=name=>({name,map:'enfer',id:crypto.randomUUID(),token:crypto.randomUUID()});
  const a=user('Mousse'),b=user('Ficelle');
  const call=async(who,op,extra={})=>(await handleApi(new Request('https://city.test/api/world/'+op,{
    method:'POST',body:JSON.stringify({...who,...extra})}),{DB})).json();
  await call(a,'join',{state:{x:1,y:2}});
  await call(b,'join',{state:{x:2,y:2}});
  const chat=await call(b,'sync',{events:[{op:'chat-test',type:'chat',data:{text:'Test de modération'}}]});
  assert.ok(chat.events.some(e=>e.type==='chat'));
  const reported=await call(a,'report',{reason:'chat',subject:b.id});
  assert.equal(reported.ok,true);
  assert.equal((await call(a,'report',{reason:'chat',subject:a.id})).ok,false);
  const report=await DB.prepare('SELECT evidence FROM mc_reports').first();
  assert.equal(JSON.parse(report.evidence)[0].text,'Test de modération');
  const horn={type:'horn',op:'horn-test',data:{}};
  const foot=await call(b,'sync',{events:[horn]});
  assert.ok(!foot.events.some(e=>e.type==='horn'||e.type==='report'));
  const ride=await call(b,'sync',{state:{x:2,y:2,vehicle:{id:'auto-h',type:'car'}},events:[horn]});
  assert.ok(ride.events.some(e=>e.type==='horn'&&e.data.x===2));
});
