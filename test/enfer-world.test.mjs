import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectedWorld,switchWorldURL} from '../public/world-link.js';

test('map links clear coordinates and room parameters from the previous map',()=>{
  const paris='https://maille.test/?lon=2.3&lat=48.8&lieu=Paris&room=old#marker';
  assert.equal(selectedWorld(paris),'paris');
  const enfer=switchWorldURL(paris,'enfer');
  assert.equal(enfer,'https://maille.test/?monde=enfer');
  assert.equal(selectedWorld(enfer),'enfer');
  assert.equal(switchWorldURL(enfer,'paris'),'https://maille.test/');
});

test('the bundled Noyonnais map opens on usable streets and includes water, terrain and real buildings',async t=>{
  const url=new URL('https://maille.test/?monde=enfer');
  t.mock.method(globalThis,'fetch',async path=>{
    assert.equal(path,'/map-enfer.gz');
    return new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url)));
  });
  globalThis.location=url;
  t.after(()=>delete globalThis.location);
  const data=await import('../public/paris-data.js');
  const {coreDestinations,SPAWN,blocked,districtAt,streetAt,parkedCars}=await import('../public/paris-world.js');
  const {terrainHeight}=await import('../public/terrain-height.js');
  const {weaponDrops}=await import('../public/weapon-drops.js');
  assert.equal(data.metadata.world,'enfer');
  assert.ok(data.buildings.length>11_000);
  assert.ok(data.buildings.some(b=>String(b.id)==='317663579'&&b.poly.length>100&&b.observedHeight));
  assert.ok(data.streets.length>3_000);
  assert.ok(data.streets.some(r=>r.name?.toLowerCase().includes('parvis notre')));
  assert.ok(data.water.some(w=>w.elevation>0));
  assert.equal(SPAWN.key,'noyon');
  assert.match(districtAt(SPAWN.x,SPAWN.y),/Noyon/);
  assert.equal(coreDestinations.length,9);
  for(const point of coreDestinations){
    assert.equal(blocked(point.x,point.y,.65),false,point.label);
    assert.ok(streetAt(point.x,point.y));
  }
  const pontoise=coreDestinations.find(p=>p.key==='pontoise');
  assert.ok(Math.hypot(SPAWN.x-pontoise.x,SPAWN.y-pontoise.y)>4_000);
  assert.ok(Math.abs(terrainHeight(SPAWN.x,SPAWN.y)-terrainHeight(pontoise.x,pontoise.y))>5);
  assert.ok(parkedCars.length>0);
  assert.ok(weaponDrops.length>0);
});
