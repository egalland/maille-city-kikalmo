import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficHorns,hornCause} from '../public/traffic-horns.js';
import {engineTone,vehicleSoundProfile} from '../public/vehicle-audio-profiles.js';

const driver={id:'compact-route',x:0,y:0,angle:0,speed:.3,brake:true},clear=()=>true;
const blocked={x:6,y:.3,vx:0,vy:0};

test('impatience needs a sustained blockage and can remain silent',()=>{
  const willing=createTrafficHorns(()=>.1),patient=createTrafficHorns(()=>.94);
  for(const horns of [willing,patient]){
    assert.equal(horns.step([driver],blocked,0,clear),null);
    assert.equal(horns.step([driver],blocked,100,clear),null);
    for(let t=200;t<1900;t+=100)assert.equal(horns.step([driver],blocked,t,clear),null);
  }
  let honk=null;
  for(let t=1900;t<=2400;t+=100){
    honk=willing.step([driver],blocked,t,clear)||honk;
    assert.equal(patient.step([driver],blocked,t,clear),null);
  }
  assert.equal(honk.driver,driver);
  for(let t=2500;t<15000;t+=100)assert.equal(willing.step([driver],blocked,t,clear),null);
  assert.equal(hornCause({...driver,waitingAtSignal:true},blocked),null);
  assert.equal(hornCause(driver,{...blocked,y:3}),null);
});

test('a driver can warn a vehicle closing in quickly, with room for a silent response',()=>{
  const oncoming={x:14,y:.1,vx:-12,vy:0,halfWidth:.85};
  const moving={...driver,speed:5};
  const horns=createTrafficHorns(()=>.1);
  assert.equal(hornCause(moving,oncoming),'danger');
  assert.equal(hornCause(moving,{...oncoming,y:3.5}),null);
  assert.equal(horns.step([moving],oncoming,1000,clear),null);
  assert.equal(horns.step([moving],oncoming,1130,()=>false),null);
  assert.equal(horns.step([moving],oncoming,1240,clear)?.driver,moving);
});

test('the city car, heavy diesel, sports car and helicopter have distinct sounds',()=>{
  const fleet=['compact','boxtruck','sport','helicopter'];
  assert.equal(new Set(fleet.map(type=>engineTone(type,18).frequency)).size,fleet.length);
  assert.ok(engineTone('boxtruck',18).rumble>engineTone('compact',18).rumble);
  assert.ok(engineTone('helicopter',18).pulse>10);
  assert.notDeepEqual(vehicleSoundProfile('train').horn,vehicleSoundProfile('compact').horn);
});
