import test from 'node:test';
import assert from 'node:assert/strict';
import {createWanted, wantedThresholds, wantedTuning} from '../public/wanted.js';

test('Reported gunshots increase slowly and stop at one star',()=>{
  const wanted=createWanted();
  assert.equal(wanted.add('peaceful',0).points,0);
  const first=wanted.add('gunshot',2);
  assert.equal(first.level,0);assert.equal(first.nextThreshold,24);assert.equal(first.progress,2/24);
  assert.equal(wanted.add('gunshot',3).lastGain,0);
  assert.equal(wanted.add('gunshot',4.5).points,4);
  for(let i=0;i<40;i++)wanted.add('gunshot',7+i*2.5);
  assert.equal(wanted.state().level,1);assert.equal(wanted.state().points,24);
});

test('Carjacking gives a star, minor offences cap early and reaching five takes about fifty civilian kills',()=>{
  const wanted=createWanted();
  assert.equal(wanted.add('stealVehicle',0).level,1);
  for(let i=0;i<30;i++)wanted.add('destroy',.5+i*.25);
  assert.equal(wanted.state().points,109);
  assert.equal(wanted.add('hitCivilian',8).level,2);
  for(let i=0;i<200;i++)wanted.add('hitOfficer',9+i*.2);
  assert.equal(wanted.state().level,3);
  const serious=createWanted();
  for(let i=0;i<49;i++)serious.add('killCivilian',i);
  assert.equal(serious.state().level,4);
  assert.equal(serious.add('killCivilian',49).level,5);
});

test('Cooldown begins after sustained calm and never rewinds time',()=>{
  const wanted=createWanted();
  wanted.add('stealService',2);
  assert.equal(wanted.tick(23).points,38);
  assert.equal(wanted.add('peaceful',24).points,38);
  assert.equal(wanted.tick(26).points,32.5);
  assert.equal(wanted.tick(25).points,32.5);
  assert.equal(wanted.add('unknown',30).points,21.5);
  assert.equal(wanted.tick(42).points,0);
  const other=createWanted();other.add('stealService',2);
  assert.equal(other.tick(30).points,21.5);
});

test('All five stars use explicit thresholds, including when cooling and hitting the points cap', () => {
  const wanted = createWanted();
  for (let i = 0; i < wantedThresholds.length; i++) {
    let state = wanted.restore({points: wantedThresholds[i] - .01}, 0);
    assert.equal(state.level, i);
    state = wanted.restore({points: wantedThresholds[i]}, 0);
    assert.equal(state.level, i + 1);
    assert.equal(state.nextThreshold, wantedThresholds[i + 1] ?? null);
    assert.equal(state.progress, i === 4 ? 1 : 0);
  }
  for (let i = 0; i < 30; i++) wanted.add('killCivilian', 1 + i / 10);
  assert.equal(wanted.state().points, wantedTuning.maxPoints);
  assert.equal(wanted.state().level, 5);
  assert.equal(wanted.state().lastGain, 0);
  assert.equal(wanted.tick(68).level, 4);
});

test('Sector travel transfers the exact points, remaining grace and repeat window to a fresh timeline', () => {
  const first = createWanted();
  first.add('hitCivilian', 101);
  first.add('destroy', 102);
  const wire = JSON.parse(JSON.stringify(first.snapshot(103)));
  const second = createWanted(wire, 0);
  assert.deepEqual(second.state(), first.state());
  assert.equal(second.add('destroy', .5).points, first.add('destroy', 103.5).points);
  assert.equal(second.tick(29).points, first.tick(132).points);
  const afterDecay = second.snapshot(29);
  const third = createWanted(afterDecay, 0);
  assert.equal(third.tick(1).points, second.tick(30).points);
  assert.equal(third.clear().level, 0);
  assert.deepEqual(third.snapshot().ages, {});
});

test('Legacy saves retain their displayed level and malformed or unknown inputs remain bounded', () => {
  const wanted = createWanted();
  assert.equal(wanted.restore({heat: .16, sinceCrime: 12}, 20).level, 1);
  assert.equal(wanted.restore({wanted: 3, heat: 2.2}, 0).points, wantedThresholds[2]);
  assert.equal(wanted.add('__proto__', 0).points, wantedThresholds[2]);
  assert.equal(wanted.add('toString', 0).points, wantedThresholds[2]);
  for(const [index,points] of [18,55,110,185,280].entries())
    assert.equal(wanted.restore({version:1,points}).level,index+1);
  wanted.restore({points: 20, lastAction: 'gunshot', ages: {gunshot: [6, -2, '1']}}, 0);
  assert.equal(wanted.add('gunshot', 0).lastGain, 2);
  assert.equal(wanted.restore({points: 1e12}, 1).points, wantedTuning.maxPoints);
  assert.equal(wanted.restore(null, NaN).level, 0);
});

test('Breaking line of sight lowers the pursuit sooner', () => {
  const hidden = createWanted(), visible = createWanted();
  hidden.add('stealVehicle', 0);
  visible.add('stealVehicle', 0);
  assert.equal(hidden.tick(9, true).points, 24);
  assert.equal(hidden.tick(15, true).level, 0);
  assert.equal(visible.tick(15).level, 1);
});
