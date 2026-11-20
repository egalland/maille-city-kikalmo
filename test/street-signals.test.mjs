import test from 'node:test';
import assert from 'node:assert/strict';
import {lampState,pedestrianGreen,crossingWalker,sidewalkRoutine} from '../public/street-signals.js';
import {createTrafficFlow} from '../public/traffic-flow.js';

const signal={axis:0,offset:0};
const arm={x:0,y:0,width:7,angle:0,setback:5,approach:8};

test('the timed crossing gives every approach amber and a pedestrian-only window',()=>{
  const phases=new Set();
  for(let t=0;t<50000;t+=100){
    const a=lampState(signal,0,t),b=lampState(signal,Math.PI/2,t);
    assert.equal(a,lampState(signal,Math.PI,t));
    if(pedestrianGreen(signal,t))assert.ok(a==='red'&&b==='red');
    assert.ok(a==='red'||b==='red');
    phases.add(a+b);
    const walker=crossingWalker(arm,signal,t);
    if(Math.abs(walker.y)<arm.width/2)assert.equal(pedestrianGreen(signal,t),true);
    const next=crossingWalker(arm,signal,t+100);
    assert.ok(Math.hypot(next.x-walker.x,next.y-walker.y)<.19,'continuous at every leg and cycle boundary');
  }
  assert.deepEqual(phases,new Set(['greenred','amberred','redred','redgreen','redamber']));
  assert.equal(crossingWalker(arm,signal,27000).activity,'waiting');
  assert.ok(crossingWalker(arm,signal,44999).y<0);
});

test('red genuinely stops a car, preserves its identity and releases it when the parallel light turns green',()=>{
  const flow=createTrafficFlow((id,d)=>({x:d,y:1.4,angle:0,routeLength:500,routeLoop:false,
    junction:d>=-35&&d<=7?{id:'intersection',x:0,y:0,distance:-d,angle:0,signal}:null}));
  const seeds=[{id:'driver',routeId:'east',type:'sedan',cruiseSpeed:7,speed:7,routeDistance:-30}];
  let tail,wasStopped=false;
  for(let t=18000;t<57000;t+=50){
    [tail]=flow.step(seeds,{epoch:t,dt:.05,observer:{x:0,y:0},recycleAfter:8});
    assert.ok(tail);
    if(t<50000)assert.ok(tail.x< -6);
    if(t>30000&&t<50000&&tail.speed<.1)wasStopped=true;
  }
  assert.ok(wasStopped);assert.ok(tail.x>15);
});

test('a citizen finishes a walk after nightfall and ordinary routes pause at destinations',()=>{
  const route={key:3,count:1,length:100};
  assert.ok(sidewalkRoutine(13,route,0,22.06));
  assert.equal(sidewalkRoutine(13,route,0,23),null);
  const positions=Array.from({length:145},(_,i)=>sidewalkRoutine(i,route,0,12));
  assert.ok(positions.some(trip=>trip.activity==='visiting'&&trip.distance===route.length&&trip.speed===0));
  assert.ok(positions.some(trip=>trip.returning&&trip.speed>0));
});
