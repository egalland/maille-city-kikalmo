import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {selectedWorld,switchWorldURL} from '../public/world-link.js';

test('map links clear coordinates and room parameters from the previous map',()=>{
  const paris='https://maille.test/?lon=2.3&lat=48.8&lieu=Paris&room=old#marker';
  assert.equal(selectedWorld(paris),'paris');
  const enfer=switchWorldURL(paris,'enfer');
  assert.equal(enfer,'https://maille.test/');
  assert.equal(selectedWorld(enfer),'enfer');
  assert.equal(switchWorldURL(enfer,'paris'),'https://maille.test/?monde=paris');
});

test('the bundled Noyonnais map opens on usable streets and includes water, terrain and real buildings',async t=>{
  const url=new URL('https://maille.test/?monde=enfer');
  t.mock.method(globalThis,'fetch',async path=>{
    assert.equal(path.split('?')[0],'/map-enfer.gz');
    return new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url)));
  });
  globalThis.location=url;
  t.after(()=>delete globalThis.location);
  const data=await import('../public/paris-data.js');
  const {coreDestinations,SPAWN,blocked,districtAt,streetAt,parkedCars,nearbyProps,routeAgents,contactAt,nearbyDrivableStreets}=await import('../public/paris-world.js');
  const {terrainHeight,baseTerrainHeight}=await import('../public/terrain-height.js');
  const {weaponDrops}=await import('../public/weapon-drops.js');
  assert.equal(data.metadata.world,'enfer');
  const [west,south,east,north]=data.metadata.coverage;
  for(const [left,bottom,right,top] of [[2.970339,49.547815,3.044372,49.608235],[3.017185,49.529655,3.075092,49.558825]])
    assert.ok(west<left&&south<bottom&&east>right&&north>top);
  assert.ok(data.buildings.length>18_000);
  const bridges=data.streets.filter(road=>road.bridge&&road.deck?.length);
  assert.ok(bridges.length>=100);
  assert.ok(bridges.some(road=>road.deck.some(([x,y])=>terrainHeight(x,y)>baseTerrainHeight(x,y)+1.3)));
  assert.ok(nearbyProps(2100,2050,360).filter(prop=>prop.wooded).length>95);
  assert.ok(routeAgents(SPAWN.x,SPAWN.y,90).actors.every(actor=>actor.type==='human'));
  assert.ok(data.buildings.some(b=>String(b.id)==='317663579'&&b.poly.length>100&&b.observedHeight));
  assert.ok(data.streets.length>3_000);
  assert.ok(data.streets.some(r=>r.name?.toLowerCase().includes('parvis notre')));
  assert.ok(data.water.some(w=>w.elevation>0));
  assert.equal(SPAWN.key,'noyon');
  assert.match(districtAt(SPAWN.x,SPAWN.y),/Noyon/);
  assert.equal(coreDestinations.length,11);
  for(const point of coreDestinations){
    assert.equal(blocked(point.x,point.y,.65),false,point.label);
    assert.ok(streetAt(point.x,point.y));
  }
  const pontoise=coreDestinations.find(p=>p.key==='pontoise');
  assert.ok(Math.hypot(SPAWN.x-pontoise.x,SPAWN.y-pontoise.y)>4_000);
  assert.ok(Math.abs(terrainHeight(SPAWN.x,SPAWN.y)-terrainHeight(pontoise.x,pontoise.y))>5);
  assert.ok(parkedCars.length>0);
  assert.ok(weaponDrops.length>0);
  const {planDistantDispatch,stepDispatch}=await import('../public/dispatch-roads.js');
  const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const clear=(pos,spec)=>!contactAt(pos.x,pos.y,{angle:pos.angle,halfLength:spec.halfLength+.16,halfWidth:spec.halfWidth+.12});
  for(const scene of [SPAWN,pontoise]){
    const plan=planDistantDispatch(scene,'police',nearbyDrivableStreets(scene.x,scene.y,260),clear,p=>!blocked(p.x,p.y,.55));
    assert.ok(plan,scene.label);
    const state={plan};
    const first=stepDispatch(state,0,1/60,clear);
    assert.ok(gap(first,scene)>100);
    let last;
    for(let i=1;i<2000&&state.arrived==null;i++)last=stepDispatch(state,i/60,1/60,clear);
    assert.ok(last&&gap(last,scene)<gap(first,scene)-8,scene.label);
  }
  const require=createRequire(import.meta.url);
  const {createCanvas,Path2D}=require(require.resolve('@napi-rs/canvas',{paths:[process.cwd(),process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}));
  const priorDocument=globalThis.document,priorPath=globalThis.Path2D;
  globalThis.Path2D=Path2D;
  globalThis.document={createElement:()=>createCanvas(1,1)};
  t.after(()=>{
    if(priorDocument)globalThis.document=priorDocument;else delete globalThis.document;
    if(priorPath)globalThis.Path2D=priorPath;else delete globalThis.Path2D;
  });
  const [{Scene},{createCity3D},{enferLighting}]=await Promise.all([
    import('../public/three.js'),import('../public/city3d.js'),import('../public/enfer-lighting.js')
  ]);
  const scene=new Scene(),renderer={shadowMap:{}},lighting=enferLighting(scene,renderer,false),city=createCity3D(scene);
  t.after(()=>{city.dispose();lighting.dispose();});
  lighting.update(SPAWN,terrainHeight(SPAWN.x,SPAWN.y),0,true);
  city.update(SPAWN,0,{props:nearbyProps(SPAWN.x,SPAWN.y,140),destroyed:new Set()});
  const meshes=[];
  scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
  assert.ok(renderer.shadowMap.enabled&&renderer.shadowMap.needsUpdate);
  assert.ok(meshes.some(mesh=>mesh.castShadow&&mesh.receiveShadow&&mesh.geometry.attributes.position.count>50));
  assert.ok(meshes.some(mesh=>mesh.material.isMeshStandardMaterial&&mesh.material.bumpMap));

});
