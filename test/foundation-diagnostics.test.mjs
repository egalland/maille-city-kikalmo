import assert from 'node:assert/strict';
import test from 'node:test';
import {cameraFieldOfView,cameraOptions} from '../public/camera-options.js';
import {containsPoint,edgeContact} from '../public/collision-ring.js';
import {createFrameMeter} from '../public/diagnostics.js';
import {createGame} from '../public/game.js';
import {createDriverView} from '../public/driver-view.js';
import {Scene} from '../public/three.js';
import {vehicleSpec} from '../public/vehicle-types.js';

test('spatial polygon bands preserve point parity and all potential boundary contacts',()=>{
  const ring=Array.from({length:218},(_,i)=>{
    const u=i*2*Math.PI/218,r=170+50*Math.cos(u*7);return [Math.cos(u)*r,Math.sin(u)*r];
  });
  for(let x=-230;x<231;x+=11)for(let y=-230;y<231;y+=12){
    let inside=false;const crossed=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+ring.length-1)%ring.length];
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      if(Math.max(a[0],b[0])>=x-5&&Math.min(a[0],b[0])<=x+5&&Math.max(a[1],b[1])>=y-12&&Math.min(a[1],b[1])<=y+12)crossed.push(a);
    }
    assert.equal(containsPoint(x,y,ring),inside);
    const got=new Set();edgeContact(ring,x-5,y-12,x+5,y+12,a=>{got.add(a);return false;});
    assert.deepEqual(got,new Set(crossed));
  }
});

test('frame window measures displayed frames, excludes background gaps and samples only on demand',()=>{
  const meter=createFrameMeter(),counts=()=>({actors:11});
  meter.enabled=true;
  for(let k=0;k<=60;k++)meter.frame(k*1000/60,1,3,k%2?6:0,1,k%2,counts);
  assert.equal(meter.read().fps,30);assert.equal(meter.read().render,6);assert.equal(meter.read().actors,11);
  meter.frame(9000,0,0,0,0,1,counts);assert.equal(meter.read(),null);
});

test('the actual game loop exposes telemetry and applies cycle/sensitivity/FOV to its rendered vehicle',()=>{
  const saved=new Map(['window','document','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  let queued,stamp=performance.now(),scene;
  globalThis.requestAnimationFrame=cb=>(queued=cb,1);globalThis.cancelAnimationFrame=()=>{};
  const game=createGame({canvas:new EventTarget(),net:{serverTime:()=>1800000000000+stamp,peers:()=>[],requestCount:42,lastRtt:31},buildView:()=>({
    mode:'webgl',available:true,render:s=>{scene=s;},aim:()=>0,effect(){},dispose(){},drawCalls:72
  })});
  try{
    game.diagnostics.enabled=true;game.setCameraOptions({sensitivity:1.2,fov:92});
    game.action('vehicle');game.action('carCamera');
    for(let k=0;k<90;k++){stamp+=17;queued(stamp);}
    assert.equal(scene.cameraConfig.mode,'near');assert.equal(scene.cameraConfig.fov,92);
    const sample=game.diagnostics.read();assert.equal(sample.draws,72);assert.equal(sample.requests,42);
    assert.equal(sample.rtt,31);assert.ok(sample.simulation>=sample.population&&sample.fps>55);
  }finally{
    game.destroy();for(const [k,v] of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
  }
});

test('invalid camera saves migrate and driver view places the steering in front of the seated eye',()=>{
  assert.deepEqual(cameraOptions(null),{sensitivity:1,fov:80,mode:'chase'});
  assert.equal(cameraOptions({mode:'toString',sensitivity:-9,fov:456}).fov,100);
  assert.ok(cameraFieldOfView(16/9,92)>cameraFieldOfView(16/9,80));
  assert.ok(cameraFieldOfView(.6,80)>cameraFieldOfView(2,80));
  const scene=new Scene(),driver=createDriverView(scene);
  driver.set(true,vehicleSpec('sedan'),{x:9,y:40,angle:0,lift:.5},3,.8,0);
  assert.ok(driver.eye.x>9&&driver.eye.y>3.5);assert.ok(scene.children[0].visible);
  driver.set(false);assert.equal(scene.children[0].visible,false);driver.dispose();assert.equal(scene.children.length,0);
});

test('gearboxes, wet tyres, axle loads and collision mass differentiate the fleet',async()=>{
  const {automaticGear,wheelForces,impactSpeeds}=await import('../public/vehicle-handling.js');
  const car=vehicleSpec('compact'),heavy=vehicleSpec('firetruck'),sport=vehicleSpec('sport');
  assert.equal(automaticGear(sport,-3),-1);assert.equal(automaticGear(sport,0),1);assert.equal(automaticGear(sport,sport.forward),6);
  const dry=wheelForces(sport,15,1,0),wet=wheelForces(sport,15,.78,0),damaged=wheelForces(sport,15,.78,2);
  assert.ok(wet.accel<dry.accel&&wet.brake<dry.brake&&wet.tractionYaw<dry.tractionYaw);
  assert.ok(damaged.brake<wet.brake&&damaged.accel<wet.accel);
  const collision=impactSpeeds(car,heavy,13),reverse=impactSpeeds(heavy,car,13);
  assert.ok(collision.own>collision.struck*7);assert.equal(collision.own,reverse.struck);
  assert.deepEqual(impactSpeeds(car,null,10),{own:10,struck:0});
});
