import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {driverOnBoard} from '../public/vehicle-seating.js';

test('an empty police cabin has no driver to render or hit',()=>{
  const patrol={occupied:true,driverRole:'police'};
  assert.equal(driverOnBoard(patrol),true);
  assert.equal(driverOnBoard({...patrol,occupied:false,driverOutside:true}),false);
  assert.equal(driverOnBoard({...patrol,cabinStopped:true}),false);
  assert.equal(driverOnBoard({peer:true,vehicle:null}),false);
});

test('a destroyed patrol is replaced by a new unit departing the station',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {createGame}=await import('../public/game.js');
  const {patrolHome}=await import('../public/paris-world.js');
  const {wantedThresholds}=await import('../public/wanted.js');
  globalThis.window=new EventTarget();
  globalThis.document=new EventTarget();
  let frame,scene,receive,stamp=performance.now(),now=1782250000000;
  globalThis.requestAnimationFrame=cb=>(frame=cb,1);
  globalThis.cancelAnimationFrame=()=>{};
  const calls=[];
  const net={id:'driver-test',serverTime:()=>now,peers:()=>[],world:()=>({}),status:'online',publish(){},
    onEvent:cb=>{receive=cb;},emit(type,data){if(type==='npc'&&data.unit)calls.push(data);return true;}};
  const game=createGame({canvas:new EventTarget(),net,buildView:()=>({available:true,render:s=>scene=s,effect(){},dispose(){}})});
  t.after(()=>{game.destroy();for(const k of ['location','document','window','requestAnimationFrame','cancelAnimationFrame'])delete globalThis[k];});
  const advance=n=>{for(let i=0;i<n;i++){now+=1000/30;stamp+=1000/30;frame(stamp);}};
  const departure=game.exportTravelState(),origin=game.getPosition();
  assert.ok(game.restoreTravelState({...departure,pursuit:{points:wantedThresholds[1]+30,report:{...origin,enfer:true}}}));
  advance(6);
  const lost=calls.find(call=>call.kind==='police');
  assert.ok(lost);
  const killed='patrol-'+lost.unit+'-foot';
  receive({type:'npc',player:'other',data:{id:killed,x:lost.origin.x,y:lost.origin.y,type:'police',damage:100,health:0,healthAt:now,dead:true}});
  advance(275);
  assert.equal(calls.filter(call=>call.id===lost.id).length,1);
  advance(190);
  const replacement=calls.find(call=>call.id===lost.id&&call.started>lost.started);
  assert.ok(replacement?.reserve);
  const home=patrolHome(replacement.unit).home;
  assert.deepEqual([replacement.origin.x,replacement.origin.y],[home.x,home.y]);
  assert.ok(scene.entities.every(entity=>entity.id!==killed||entity.down));
});
