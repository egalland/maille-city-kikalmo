import test from 'node:test';
import assert from 'node:assert/strict';
import {installDriveControls} from '../public/drive-controls.js';

test('steering and pedals accept simultaneous touch and release independently',()=>{
  const inputs=[],buttons=Object.fromEntries(['left','right','throttle','brake'].map(name=>[name,Object.assign(new EventTarget(),{
    dataset:{drive:name},classList:{toggle(){}},setPointerCapture(){}
  })]));
  const root={hidden:true,querySelectorAll:()=>Object.values(buttons)};
  const controls=installDriveControls(root,(x,y)=>inputs.push([x,y]));
  const touch=(name,type,pointerId)=>buttons[name].dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{button:0,pointerId}));
  controls.setActive(true);
  touch('left','pointerdown',1);touch('throttle','pointerdown',2);touch('brake','pointerdown',3);
  touch('brake','pointercancel',3);touch('left','lostpointercapture',1);
  controls.setActive(false);
  assert.equal(root.hidden,true);
  assert.deepEqual(inputs,[[-1,0],[-1,1],[-1,-1],[-1,1],[0,1],[0,0]]);
});

test('a pilot holds altitude, yaw and forward thrust independently and releases on exit',()=>{
  const inputs=[],buttons=Object.fromEntries(['left','throttle','ascend','descend'].map(name=>[name,Object.assign(new EventTarget(),{
    dataset:{drive:name},classList:{toggle(){}},setPointerCapture(){}
  })]));
  const controls=installDriveControls({querySelectorAll:()=>Object.values(buttons)},(...axes)=>inputs.push(axes));
  const touch=(name,type,pointerId)=>buttons[name].dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{button:0,pointerId}));
  controls.setActive(true);
  touch('ascend','pointerdown',1);touch('left','pointerdown',2);touch('throttle','pointerdown',3);
  assert.deepEqual(inputs.at(-1),[-1,1,1,false]);
  touch('ascend','pointercancel',1);touch('descend','pointerdown',4);
  assert.deepEqual(inputs.at(-1),[-1,1,-1,false]);
  controls.setActive(false);assert.deepEqual(inputs.at(-1),[0,0,0,false]);
});
