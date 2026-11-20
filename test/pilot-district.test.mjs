import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cityClimate} from '../public/city-climate.js';
import {broadcastBeat} from '../public/car-radio.js';
import {bayDoor,workshopId} from '../public/workshop.js';
import {frontageStyle,careerFronts} from '../public/enfer-frontage.js';

test('a whole city shares a clock, smooth weather transitions and wet-road grip',()=>{
  const samples=Array.from({length:1441},(_,i)=>cityClimate(i*1000));
  assert.equal(samples[0].lamps,1);
  assert.equal(samples[720].daylight,1);
  assert.equal(samples[1440].hour,0);
  assert.ok(samples.some(s=>s.rain>0&&s.grip<1));
  assert.ok(samples.every((s,i)=>!i||Math.abs(s.rain-samples[i-1].rain)<.05));
  assert.deepEqual(samples[720],cityClimate(720000));
  assert.deepEqual(broadcastBeat(0),broadcastBeat(128));
});

test('a city car can cross the actual garage door, while its walls and lintel stop it',async t=>{
  globalThis.location=new URL('https://maille.test/?monde=enfer');
  t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {buildings}=await import('../public/paris-data.js');
  const {contactAt,moveBody}=await import('../public/paris-world.js');
  for(const [id,place] of careerFronts){
    const building=buildings.find(b=>String(b.id)===id);
    assert.equal(frontageStyle(building),place.style);
    assert.ok(building.poly[place.edge]);
  }
  const building=buildings.find(b=>String(b.id)===workshopId);
  const {left,right}=bayDoor(building.poly),center=left.map((v,i)=>(v+right[i])/2);
  const len=Math.hypot(right[0]-left[0],right[1]-left[1]);
  const dx=(right[1]-left[1])/len,dy=(left[0]-right[0])/len;
  const car={halfLength:1.72,halfWidth:.81,bodyHeight:1.65,footZ:0,angle:Math.atan2(dy,dx)};
  const result=moveBody(center[0]-dx*4,center[1]-dy*4,dx*7,dy*7,car);
  assert.ok(Math.hypot(result.x-center[0]-dx*3,result.y-center[1]-dy*3)<.05,JSON.stringify(result));
  assert.ok(contactAt(...center,{...car,bodyHeight:4}));
  assert.ok(contactAt(...building.poly[10],{radius:.4}));
});
