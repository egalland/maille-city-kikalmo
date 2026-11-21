import test from 'node:test';
import assert from 'node:assert/strict';
import {railTrains,railPose,railDistance,railStations,railSpacing,railLength,railEnd,stepRail,validatedRailPose} from '../public/enfer-rail.js';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';

test('independent parallel tracks support traction, braking, reverse and terminal braking',()=>{
  const [first,second]=railTrains;
  for(const d of [25,130,400,881,railLength-18]){
    const a=railPose(first,d,1),b=railPose(second,d,-1);
    assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-railSpacing)<.001);
    assert.ok(Math.abs(railDistance(a.x,a.y)-d)<.35);
    assert.equal(validatedRailPose(first.id,b),null);
  }
  let p={d:first.d,speed:0};
  for(let i=0;i<800;i++)p=stepRail(first,p.d,1,p.speed,1,false,.05);
  assert.ok(p.d>first.d+600&&p.speed<=26);
  for(let i=0;i<180;i++)p=stepRail(first,p.d,1,p.speed,0,true,.05);
  assert.equal(p.speed,0);
  const stop=p.d;
  for(let i=0;i<60;i++)p=stepRail(first,p.d,-1,p.speed,1,false,.05);
  assert.ok(p.d<stop-4);
  for(let i=0;i<1800;i++)p=stepRail(first,p.d,1,p.speed,1,false,.05);
  assert.ok(p.d<railLength-railEnd+.001);
  assert.ok(p.speed<.1);
});

test('train uses the fixed track and can transfer control after a release at a station',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  const guest=()=>({id:crypto.randomUUID(),token:crypto.randomUUID(),map:'enfer'});
  const driver=guest(),other=guest(),train=railTrains[0],a=railPose(train,train.d,1);
  const b=railPose(train,railStations[1].d,1),middle=railPose(train,400,1);
  const send=async(path,guest,body)=>(await handleApi(new Request('https://city.test/api/world/'+path,
    {method:'POST',body:JSON.stringify({...guest,...body})}),{DB})).json();
  const state=({x,y,angle},vehicle=null)=>({x,y,angle,health:100,vehicle});
  const event=(op,pose,occupied)=>({type:'vehicle',op,data:{id:train.id,type:train.type,...pose,occupied}});
  await send('join',driver,{state:state(a)});
  await send('join',other,{state:state(a)});
  const boarded=await send('sync',driver,{state:state(a),events:[event('board',a,true)]});
  assert.ok(boarded.events.some(e=>e.op==='board'||e.player===driver.id&&e.data.occupied));
  const unauthorized=await send('sync',other,{state:state(a),events:[event('take',a,true)]});
  assert.ok(!unauthorized.events.some(e=>e.player===other.id&&e.type==='vehicle'));
  const offPlatform=await send('sync',driver,{state:state(middle),events:[event('drop-mid',middle,false)]});
  assert.ok(!offPlatform.events.some(e=>e.type==='vehicle'&&!e.data.occupied));
  const atPlatform=await send('sync',driver,{state:state(b),events:[event('drop',b,false)]});
  assert.ok(atPlatform.events.some(e=>e.type==='vehicle'&&!e.data.occupied&&Math.abs(e.data.x-b.x)<.4));
  const arrived=await send('join',other,{state:state(b)});
  assert.equal(arrived.world.vehicles[train.id].occupied,false);
  const far=await send('sync',other,{state:state({x:b.x+100,y:b.y,angle:b.angle}),events:[event('too-far',b,true)]});
  assert.ok(!far.events.some(e=>e.player===other.id&&e.data.occupied));
  const reclaimed=await send('sync',other,{state:state(b),events:[event('reclaim',b,true)]});
  assert.ok(reclaimed.events.some(e=>e.player===other.id&&e.data.occupied));
});
