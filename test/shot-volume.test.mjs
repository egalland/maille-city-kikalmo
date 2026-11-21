import test from 'node:test';
import assert from 'node:assert/strict';
import {npcWeaponDamage,traceElevated,reticleDepth} from '../public/shot-volume.js';

const origin={x:0,y:0,z:1.05};
const target={id:'rider',x:8,y:0,hitKind:'npc'};
const trace=(slope,contact=()=>null)=>traceElevated(origin,0,slope,25,[target],()=>0,contact);

test('one bearing hits different body regions according to the elevation',()=>{
  assert.equal(trace(-.084).zone,'legs');
  assert.equal(trace(0).zone,'body');
  assert.equal(trace(.064).zone,'head');
  assert.equal(trace(.25).hit,null);
  assert.equal(trace(-.28).hit,null);
  assert.ok(trace(-.28).length<4);
});

test('a low fence hides the legs and torso without intercepting an elevated shot',()=>{
  const fence=(x,y,z)=>x>6&&x<6.4&&z<1.16?{id:'fence'}:null;
  assert.equal(trace(0,fence).hit,null);
  assert.equal(trace(.062,fence).hit,target);
});

test('helmet protection and leg wounds have different bounded damage',()=>{
  assert.equal(npcWeaponDamage(17,'human','head'),100);
  assert.equal(npcWeaponDamage(17,'swat','head'),8);
  assert.equal(npcWeaponDamage(17,'firefighter','head'),8);
  assert.equal(npcWeaponDamage(17,'human','body'),17);
  assert.equal(npcWeaponDamage(17,'human','legs'),11);
});

test('a reticle above someone uses their depth without snapping the shot to their body',()=>{
  const eye={x:-5,y:0,z:2.9};
  const camera=traceElevated(eye,0,-.016,60,[target],()=>0,()=>null);
  assert.equal(camera.hit,null);
  assert.equal(reticleDepth(eye,0,[target],camera),13);
  const height=eye.z-.016*13;
  assert.equal(trace((height-origin.z)/target.x).hit,null);
});
