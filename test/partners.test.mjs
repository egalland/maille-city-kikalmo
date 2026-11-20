import assert from 'node:assert/strict';
import test from 'node:test';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
test('session-scoped duos require consent, preserve every global player, and end on leaving or timeout',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  let now=Date.now();t.mock.method(Date,'now',()=>now);
  const user=()=>({id:crypto.randomUUID(),token:crypto.randomUUID(),map:'enfer'});
  const [a,b,c]=[user(),user(),user()];
  async function call(who,op,more={}){
    const r=await handleApi(new Request('https://city.test/api/world/'+op,{method:'POST',body:JSON.stringify({...who,...more})}),{DB});
    return r.json();
  }
  const team=(who,action,target)=>call(who,'partners',{action,target:target?.id});
  for(const who of [a,b,c])await call(who,'join',{state:{x:40,y:50}});
  assert.ok(!(await team(b,'accept',a)).ok);
  assert.ok(!(await team({...a,token:b.token},'invite',b)).ok);
  assert.ok((await team(a,'invite',b)).ok);
  assert.deepEqual((await team(c,'state')).state.received,[]);
  assert.deepEqual((await team(b,'state')).state.received,[a.id]);
  assert.ok((await team(b,'decline',a)).ok);
  assert.ok(!(await team(b,'accept',a)).ok);
  await team(a,'invite',b);await team(c,'invite',b);
  const answers=await Promise.all([team(b,'accept',a),team(b,'accept',c)]);
  assert.equal(answers.filter(x=>x.ok).length,1);
  const peer=answers[0].ok?a:c;
  assert.equal((await team(peer,'state')).state.partner,b.id);
  assert.equal((await call(c,'sync')).players.length,3);
  await team(b,'leave');assert.equal((await team(peer,'state')).state.partner,null);
  await team(a,'invite',b);await team(b,'accept',a);await call(b,'leave');
  assert.equal((await team(a,'state')).state.partner,null);
  await call(b,'join',{state:{x:42,y:60}});await team(a,'invite',b);await team(b,'accept',a);
  now+=15000;await call(a,'sync',{state:{x:41,y:40}});
  now+=11000;await call(a,'sync',{state:{x:42,y:41}});
  assert.equal((await team(a,'state')).state.partner,null);
  await call(b,'join',{state:{x:42,y:59}});
  assert.equal((await team(b,'state')).state.partner,null);
});
