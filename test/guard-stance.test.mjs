import test from 'node:test';
import assert from 'node:assert/strict';
import {guardedFraction,behindCar,crouchedPace} from '../public/guard-stance.js';
import {sampleLocomotion} from '../public/locomotion-pose.js';
test('a low guard protects from frontal punches, with open flanks and no effect on blast or bullets',()=>{
  assert.ok(guardedFraction('crouch',.2,.2+Math.PI,'melee')<.5);
  for(const cause of ['traffic','fall','police','weapon'])assert.equal(guardedFraction('crouch',0,Math.PI,cause),1);
  assert.equal(guardedFraction('crouch',0,0,'melee'),1);assert.equal(guardedFraction('idle',0,Math.PI,'melee'),1);
});
test('parked cars hide a crouching player only when they physically intersect the sightline',()=>{
  const observer={x:10,y:0},target={x:0,y:0,motion:'crouch'},cover={x:2,y:0,type:'sedan'};
  const contains=(v,p)=>Math.hypot(v.x-p.x,v.y-p.y)<1;
  assert.equal(behindCar(observer,target,[cover],contains),true);
  assert.equal(behindCar(observer,target,[{...cover,y:3}],contains),false);
  assert.equal(behindCar(observer,{...target,motion:'walk'},[cover],contains),false);
  assert.ok(sampleLocomotion(target).bob<-.1&&crouchedPace<.5);
});
