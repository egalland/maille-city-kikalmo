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
  const {nearbySignals}=await import('../public/paris-world.js');
  const signals=nearbySignals(SPAWN.x,SPAWN.y,380);
  assert.ok(signals.length>=2);
  const signal=signals[0],activeEpoch=(720-signal.offset+18)*1000;
  const poles=nearbyProps(signal.x,signal.y,20).filter(p=>p.type==='signal');
  assert.equal(poles.length,signal.arms.length);
  assert.ok(poles.every(p=>blocked(p.x,p.y,.35)));
  const walking=routeAgents(signal.x,signal.y,21,activeEpoch).actors.find(a=>a.id==='n-cross-'+signal.id);
  assert.ok(walking);
  assert.equal(SPAWN.key,'noyon');
  assert.equal(districtAt(SPAWN.x,SPAWN.y),'Les Vieilles Mailles');
  assert.ok(coreDestinations.every(p=>!/Noyon|Pontoise|Couarcy/i.test(p.label)));
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

  await t.test('a surveyed brick garden wall stops a car and a pedestrian at the mesh, while its gate stays open',async()=>{
    const {nearbyEnclosures,moveBody}=await import('../public/paris-world.js');
    const walls=nearbyEnclosures(-115.15,-292.7,1);
    const wall=[...walls].find(s=>s.way===1276069241);
    assert.ok(wall);
    const sn=Math.sin(wall.angle),c=Math.cos(wall.angle);
    for(const size of [{radius:.35},{angle:wall.angle+Math.PI/2,halfLength:1.7,halfWidth:.78}]){
      const result=moveBody(wall.x-3*sn,wall.y+3*c,6*sn,-6*c,size);
      assert.equal(result.touched?.id,wall.id);
      assert.ok((result.x-wall.x)*-sn+(result.y-wall.y)*c>0);
    }
    assert.equal(contactAt(wall.x,wall.y,{radius:.2,height:wall.h+.1,camera:true}),null);
    // OSM gate 11847156328 opens onto the street at the end of this wall.
    assert.equal(contactAt(-116.1,-271.1,{radius:.55}),null);
    for(const [x,y,r] of [[-12,-236,8],[20,-68,9]])assert.equal(nearbyEnclosures(x,y,r).size,0);
    const visited={x:wall.x,y:wall.y};
    for(let i=0;i<5;i++)city.update(visited,i,{props:[],destroyed:new Set()});
    let material;
    scene.traverse(m=>{if(m.material?.name==='enclosure-brick')material=m.material;});
    assert.ok(material?.map?.image);
    const mesh=[...nearbyEnclosures(visited.x,visited.y,600)].find(s=>s.style==='mesh');
    assert.ok(mesh);
    for(let i=0;i<5;i++)city.update(mesh,10+i,{props:[],destroyed:new Set()});
    let lattice;
    scene.traverse(m=>{if(m.material?.name==='enclosure-mesh')lattice=m.material;});
    assert.equal(lattice?.alphaTest,.32);
    const pixels=lattice.map.image.getContext('2d').getImageData(0,0,96,96).data;
    const clear=pixels.filter((v,i)=>i%4===3&&v===0).length;
    assert.ok(clear>96*96*.35&&clear<96*96*.92);
  });

  await t.test('shoreline, swim strokes, surfacing under a bridge and returning to dry land',async()=>{
    const {swimmingSurface}=await import('../public/paris-world.js');
    const {createParkour}=await import('../public/parkour.js');
    const {terrainGradient}=await import('../public/terrain-height.js');
    const {sampleLocomotion}=await import('../public/locomotion-pose.js');
    const bank={x:2932.45,y:-4733.9},direction={x:.15616305,y:.98773129};
    const p={x:bank.x-2*direction.x,y:bank.y-2*direction.y,angle:Math.atan2(direction.y,direction.x)};
    const control=createParkour(p,terrainHeight,terrainGradient);
    const step=(x,y)=>control.step(1/60,{x,y,angle:p.angle},{});
    const simulate=(x,y,seconds)=>{let output;for(let i=0;i<seconds*60;i++)output=step(x,y);return output;};
    assert.equal(swimmingSurface(p.x,p.y),null);
    const waterMove=simulate(direction.x,direction.y,3.2);
    assert.equal(p.motion,'swim');assert.equal(control.grounded,false);
    assert.ok(waterMove.actual>1.35&&waterMove.actual<1.45);
    assert.ok(contactAt(p.x,p.y,{angle:0,halfLength:1.8,halfWidth:.9}));
    assert.equal(contactAt(p.x,p.y,{swimmer:true,radius:.5}),null);
    const a=sampleLocomotion(p,1,43),b=sampleLocomotion(p,1.57,43);
    assert.ok(Math.abs(a.left.arm-b.left.arm)>.2);
    assert.notEqual(a.left.arm,a.right.arm);
    const before={x:p.x,y:p.y};
    control.setPressed(true);control.setPressed(false);
    simulate(0,0,.36);assert.ok(Math.hypot(before.x-p.x,before.y-p.y)>.42);
    simulate(-direction.x,-direction.y,6);
    assert.equal(p.motion,'walk');assert.equal(control.grounded,true);
    const bridge=[-1096.1,953.8];
    assert.equal(swimmingSurface(...bridge),null);assert.ok(Number.isFinite(swimmingSurface(...bridge,true)));
    p.x=bridge[0];p.y=bridge[1];control.reset();step(0,0);assert.equal(p.motion,'idle');
    p.motion='swim';step(0,0);assert.equal(p.motion,'swim');
  });

  await t.test('walking up to an Enfer depot grants the item and equips it in the HUD',async t=>{
    const [{createGame},{createNet},{handleApi},{localDatabase},{enferWeaponDrops}]=await Promise.all([
      import('../public/game.js'),import('../public/net.js'),import('../worker/game-api.js'),
      import('../scripts/local-db.mjs'),import('../public/drop-id.js')
    ]);
    const {setTimeout:sleep}=await import('node:timers/promises');
    const DB=localDatabase(),requests=new Set();
    const globals=['window','document','requestAnimationFrame','cancelAnimationFrame'];
    const previous=globals.map(key=>globalThis[key]);
    const document=Object.assign(new EventTarget(),{createElement:previous[1].createElement});
    let frame,hud,loadout,game;
    Object.assign(globalThis,{
      window:new EventTarget(),document,
      requestAnimationFrame:callback=>{frame=callback;return 1;},
      cancelAnimationFrame:()=>{frame=null;}
    });
    const net=createNet({map:'enfer',name:'Bobine',fetcher(url,init){
      const pending=handleApi(new Request('https://maille.test'+url,init),{DB});
      requests.add(pending);pending.then(()=>requests.delete(pending),()=>requests.delete(pending));
      return pending;
    }});
    t.after(async()=>{
      game?.destroy();net.stop();await Promise.allSettled([...requests]);DB.close();
      globals.forEach((key,i)=>{if(previous[i]===undefined)delete globalThis[key];else globalThis[key]=previous[i];});
    });
    const canvas=Object.assign(new EventTarget(),{focus(){},setPointerCapture(){}});
    game=createGame({canvas,net,onState:value=>{hud=value;},onLoadoutChange:value=>{loadout=value;},
      buildView:()=>({available:true,mode:'webgl',render(){},effect(){},dispose(){}})});
    const depot=enferWeaponDrops[1];assert.ok(weaponDrops.some(drop=>drop.id===depot.id));
    assert.equal(await net.start(),true);
    assert.ok(game.restoreTravelState({...game.exportTravelState(),x:depot.x+1.8,y:depot.y}));
    const now=performance.now();
    for(let i=0;i<45&&!loadout?.includes(depot.weapon);i++){
      frame(now+16*i);await sleep(10);
    }
    assert.ok(loadout?.includes(depot.weapon));
    assert.equal(hud.weapon,depot.weapon);
    assert.ok(hud.ammo>0);
    assert.ok(net.world().pickups[depot.id]>net.serverTime());
  });

});
