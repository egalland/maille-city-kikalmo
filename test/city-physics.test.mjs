import test from 'node:test';
import assert from 'node:assert/strict';
import {pavementRuns} from '../public/curb-clearance.js';
import {bridgeGround,selectBridgeDecks} from '../public/enfer-bridges.js';
import {stepVehicleBody} from '../public/vehicle-motion.js';
import {blastDamage,burnProgress,chassisHealthAt,nextChassis} from '../public/vehicle-damage.js';
import {wreckExpired} from '../public/vehicle-lifecycle.js';

test('a raised sidewalk stops before a side street and resumes beyond its carriageway',()=>{
  const runs=pavementRuns([-10,0],[10,0],3.5,1,[{a:[0,-10],d:[0,10],street:{w:5}}]);
  assert.equal(runs.length,2);
  assert.ok(runs[0][1][0]<-2.5&&runs[1][0][0]>2.5);
  assert.deepEqual(runs[0][0],[-10,0]);assert.deepEqual(runs[1][1],[10,0]);
});

test('a bridge rejoins the terrain on both ends without a vertical step',()=>{
  const ground=()=>0;
  selectBridgeDecks([{bridge:true,w:8,path:[[0,0],[18,0]],deck:[[0,0,5],[18,0,5]]}],[],ground);
  assert.equal(bridgeGround(9,0,0),5);
  assert.equal(bridgeGround(-70,0,0),0);
  assert.equal(bridgeGround(85,0,0),0);
  assert.ok(bridgeGround(-10,0,0)>2);
  let prev=0,largest=0;
  for(let i=-1000;i<1500;i++){
    const z=bridgeGround(i/15,0,0);largest=Math.max(largest,Math.abs(z-prev));prev=z;
  }
  assert.ok(largest<.08);
});

test('speed over a rising crest gives suspension lift, gravity and a landing',()=>{
  const ramp=x=>Math.max(0,Math.min(x*.34,4.1));
  const run=speed=>{
    const dt=1/90;
    let x=0,state,peak=0,impact=0;
    for(;x<45;x+=speed*dt){
      state=stepVehicleBody(state,{x,y:0,angle:0,speed,halfLength:2.15,dt},ramp);
      peak=Math.max(peak,state.lift);impact=Math.max(impact,state.landed);
    }
    assert.equal(state.lift,0);
    return {peak,impact};
  };
  assert.equal(run(6).peak,0);
  const jump=run(23);assert.ok(jump.peak>.45&&jump.impact>3,JSON.stringify(jump));
});

test('engine fire reduces integrity before an explosion and the wreck expires later',()=>{
  const start=3000,fire=nextChassis(null,{id:'car',part:'engine'},77,start);
  assert.equal(fire.hp,23);assert.equal(chassisHealthAt(fire,start),23);
  assert.ok(chassisHealthAt(fire,fire.explodeAt-1800)<23);
  assert.ok(burnProgress(fire,fire.explodeAt-1800)>.5);
  assert.equal(chassisHealthAt(fire,fire.explodeAt),0);
  assert.ok(!wreckExpired(fire,fire.explodeAt+23999)&&wreckExpired(fire,fire.explodeAt+24000));
  assert.ok(blastDamage(1)>blastDamage(6)&&blastDamage(9)===0);
});
