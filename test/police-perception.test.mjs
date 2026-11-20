import test from 'node:test';
import assert from 'node:assert/strict';
import {canIdentify,crimeHeardOrSeen,responseUnits,observePursuit,canUseForce,custodyTime} from '../public/police-perception.js';
import {createWanted} from '../public/wanted.js';

const eye={x:0,y:0,angle:0}, clear=()=>true;
test('a unit needs a clear view or receives a report; an unknown suspect does not move the search point',()=>{
  const report={x:10,y:0,at:400}, state={},suspect={x:21,y:0};
  const look=(now,visible,observer=eye)=>observePursuit(state,{now,observer,suspect,report,clear:()=>visible,walkable:clear});
  assert.deepEqual(look(0,false,null),{x:10,y:0});
  assert.equal(look(1,true),suspect);
  suspect.y=30;
  assert.deepEqual(look(2,false),{x:21,y:0});
  const next=look(7,false,{x:20,y:0});
  assert.notDeepEqual(next,suspect);assert.ok(Math.hypot(next.x-21,next.y)<=17);
  report.at++;report.x=-51;report.y=3;
  assert.deepEqual(look(8,false),{x:-51,y:3});
});
test('unobserved actions, hearing, line of sight and incapacitated witnesses',()=>{
  const suspect={x:20,y:0};
  assert.equal(crimeHeardOrSeen('gunshot',suspect,[],clear),false);
  assert.equal(crimeHeardOrSeen('gunshot',suspect,[eye],()=>false),true);
  assert.equal(crimeHeardOrSeen('stealService',suspect,[eye],()=>false),false);
  assert.equal(crimeHeardOrSeen('destroy',suspect,[{...eye,stunned:true}],clear),false);
  assert.equal(crimeHeardOrSeen('hitOfficer',suspect,[],clear),true);
  assert.equal(canIdentify(eye,{x:-28,y:0},clear),false);
  assert.equal(canIdentify(eye,{x:-4,y:0},clear),true);
});
test('units scale through five levels; patrol attempts arrest when no active threat',()=>{
  for(let i=0;i<=5;i++){
    const units=responseUnits(i);assert.equal(units.length,i);
    assert.equal(new Set(units.map(pair=>pair.join(':'))).size,i);
  }
  assert.equal(canUseForce(1,-Infinity,0),false);assert.equal(canUseForce(2,14,18),true);
  assert.equal(canUseForce(2,14,25),false);assert.equal(canUseForce(3,-Infinity,20),true);
  assert.equal(custodyTime(1.9,.4,false),0);assert.equal(custodyTime(2.3,.2,true),2.4);
});
test('pursuit stays active under observation, begins cooling after last observation',()=>{
  const wanted=createWanted();
  wanted.add('stealVehicle',0);
  assert.equal(wanted.tick(52,false,true).points,24);
  assert.equal(wanted.tick(60,true).points,24);
  assert.equal(wanted.tick(68,true).points,0);
});

import {nextChassis} from '../public/vehicle-damage.js';
import {wreckExpired} from '../public/vehicle-lifecycle.js';
test('a series of scrapes can immobilise a car without fire; major impacts can ignite it',()=>{
  let wear;
  const impact={cause:'crash',speed:14};
  for(let i=0;i<5;i++)wear=nextChassis(wear,impact,21,2000+i);
  assert.equal(wear.hp,0);assert.equal(wear.fireAt,0);assert.equal(wear.explodeAt,0);
  assert.equal(wreckExpired(wear,30000),true);
  const hard=nextChassis({hp:50},{...impact,speed:30},42,5000);
  assert.equal(hard.fireAt,5000);assert.ok(hard.explodeAt>5000);
});
