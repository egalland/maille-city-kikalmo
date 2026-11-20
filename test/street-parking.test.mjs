import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {vehicleSpec,vehicleDoorways} from '../public/vehicle-types.js';
import {careerPlaces} from '../public/career-catalog.js';

test('street parking is sparse, clear of traffic, accessible and stationary between visits',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {parkedCars,contactAt,routeAgents,clearsTrafficAtRest,nearbyParkedCars}=await import('../public/paris-world.js');
  const slots=parkedCars.filter(c=>c.bay);
  assert.ok(slots.length>=100);
  assert.equal(new Set(slots.map(c=>c.id)).size,slots.length);
  assert.ok(new Set(slots.map(c=>c.type)).size>=10);
  for(const car of slots){
    assert.ok(nearbyParkedCars(car.x,car.y,1).has(car));
    const {halfLength,halfWidth}=vehicleSpec(car.type);
    assert.equal(contactAt(car.x,car.y,{angle:car.angle,halfLength,halfWidth}),null,car.id);
    assert.ok(clearsTrafficAtRest(car,car.type),car.id);
    assert.ok(vehicleDoorways(car,.75).every(d=>!contactAt(d.x,d.y,{radius:.42})),car.id);
    assert.ok(slots.every(other=>other===car||Math.hypot(car.x-other.x,car.y-other.y)>94),car.id);
  }
  for(const [type,venue] of [['gt',careerPlaces.garage],['supercar',careerPlaces.quay]]){
    const spot=slots.find(c=>c.type===type);assert.ok(spot?.parked);
    assert.ok(Math.hypot(spot.x-venue.x,spot.y-venue.y)<180);
    for(const clock of [870000,966000]){
      const seen=routeAgents(spot.x,spot.y,8,clock).cars.find(c=>c.id===spot.id);
      assert.ok(seen&&!seen.moving&&seen.speed===0);assert.equal(seen.x,spot.x);
    }
  }
});
