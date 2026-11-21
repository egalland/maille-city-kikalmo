import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMarketTraffic,marketCarShape} from '../public/market-traffic.js';

test('in the surveyed zone, drivers park and walk, queue at the Drive and fuel up before departing',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.after(()=>delete globalThis.location);
  const map=await readFile(new URL('../public/map-enfer.gz',import.meta.url));
  t.mock.method(globalThis,'fetch',async()=>new Response(map));
  const {parkedCars,contactAt}=await import('../public/paris-world.js');
  const collision=c=>({...c,...marketCarShape(c.type)});
  const parked=parkedCars.filter(c=>c.x< -1500&&c.y>1000&&c.y<1310).map(collision);
  const sim=createMarketTraffic(),observer={x:-1660,y:1160};
  const states=new Set(),departures=new Set();
  let shopping=false;
  for(let i=0;i<1850;i++){
    const {cars,actors}=sim.step({observer,epoch:1763600400000+i*150,dt:.15,
      clear:(id,type,{x,y,angle},others)=>!contactAt(x,y,{...marketCarShape(type),angle,footZ:0,ignoreId:id,
        colliders:[...parked,...others.map(collision)]})});
    for(const car of cars){
      states.add(car.activity);
      if(car.activity==='depart')departures.add(car.id.split('-')[1]);
      if(['parking','drive','fuel','queue'].includes(car.activity))assert.equal(car.speed,0);
    }
    shopping||=actors.some(a=>a.activity==='shopping');
  }
  for(const activity of ['parking','queue','drive','fuel','reverse'])assert.ok(states.has(activity),activity);
  assert.deepEqual([...departures].sort(),['drive','fuel','parking']);
  assert.equal(shopping,true);
});
