import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleSpec} from '../public/vehicle-types.js';
import {stepRoadDrive} from '../public/vehicle-handling.js';
import {recordPeerMotion,readPeerMotion} from '../public/peer-motion-net.js';

const dry={grip:1,tyres:0,power:1,grounded:true,incline:0,dt:1/60};
function accelerate(type,dt){
  const spec=vehicleSpec(type);
  let speed=0,hundred=Infinity;
  for(let frame=1;frame<=150/dt;frame++){
    speed=stepRoadDrive(spec,{...dry,dt,speed,pedal:1}).speed;
    if(speed>=100/3.6&&hundred===Infinity)hundred=frame*dt;
  }
  return {top:speed*3.6,hundred};
}

test('full throttle reaches the tuned road speeds, with different launches at different frame rates',()=>{
  const profiles=[['van',140,13,16],['compact',145,10,12],['sedan',203,6,7],['sport',240,3.9,4.3],['gt',276,3.2,3.6],['supercar',318,2.5,2.9]];
  for(const [type,top,low,high] of profiles){
    for(const dt of [1/45,1/120]){
      const result=accelerate(type,dt);
      assert.ok(Math.abs(top-result.top)<.1,type+' top '+result.top);
      assert.ok(result.hundred>=low&&result.hundred<=high,type+' 0-100 '+result.hundred);
    }
  }
});

test('high speed coasting, engine wear and deliberate braking preserve momentum',()=>{
  const spec=vehicleSpec('supercar'),speed=spec.forward;
  const run=(pedal,power)=>stepRoadDrive(spec,{...dry,speed,pedal,power}).speed;
  const coast=run(0,1),worn=run(1,.50),braked=run(-1,1);
  assert.ok(speed-coast<.2&&coast<speed);
  assert.ok(worn>=braked&&worn<speed&&speed-worn<.3);
  assert.ok(speed-braked>.2);
});

test('vehicle prediction keeps full speed between snapshots while walking stays bounded',()=>{
  const sample={id:'pilot',joinedAt:1,x:0,y:0,vx:84,vy:0,angle:0,moving:true};
  for(const [extra,velocity] of [[{vehicle:{id:'fast',type:'supercar'}},84],[{lift:20,motion:'fall'},84],[{},8]]){
    const track={};
    recordPeerMotion(track,{...sample,...extra,updatedAt:1000},1000);
    assert.ok(Math.abs(readPeerMotion(track,1100).x-velocity*.1)<.001);
    if(extra.vehicle){
      recordPeerMotion(track,{...sample,...extra,x:25.2,updatedAt:1300},1300);
      assert.equal(track.samples.length,2);
      assert.ok(Math.abs(readPeerMotion(track,1400).x-33.6)<.001);
    }
  }
});
