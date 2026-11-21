import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auchanFront,auchanMain,auchanParts} from '../public/auchan-layout.js';
import {auchanModel} from '../public/auchan-model.js';
import {storeByBuilding,atShopCounter} from '../public/enfer-retail.js';

test('the Auchan wings share the same datum while the terrain rises behind them',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.after(()=>delete globalThis.location);
  const archive=await readFile(new URL('../public/map-enfer.gz',import.meta.url));
  t.mock.method(globalThis,'fetch',async()=>new Response(archive));
  const {buildings}=await import('../public/paris-data.js');
  const {baseTerrainHeight,terrainHeight}=await import('../public/terrain-height.js');
  const {contactAt,moveBody,insideRetail}=await import('../public/paris-world.js');
  const wings=buildings.filter(b=>b.auchan),main=wings.find(b=>b.id===auchanMain);
  assert.equal(wings.length,auchanParts.size);
  const floor=main.baseElevation;
  assert.ok(wings.every(w=>w.baseElevation===floor));
  const rear=terrainHeight(...auchanFront.point(8,84));
  assert.ok(rear-floor>5);
  assert.ok(floor+main.h-rear<3);

  const shop=storeByBuilding.get(auchanMain);
  const faces=auchanModel(main,shop,baseTerrainHeight,true);
  assert.ok(faces.some(f=>f.mat==='auchanLetters'&&Math.min(...f.p.map(p=>p[1]))>main.h));
  assert.ok(faces.some(f=>f.mat==='auchanBrick'));
  const from=auchanFront.point(0,-9),to=[shop.buyerX,shop.buyerY];
  const body={radius:.42,footZ:0,bodyHeight:1.55};
  const walk=moveBody(...from,to[0]-from[0],to[1]-from[1],body);
  assert.ok(Math.hypot(walk.x-to[0],walk.y-to[1])<.04);
  assert.ok(insideRetail(walk)&&atShopCounter(walk)===shop);
  assert.ok(Math.abs(terrainHeight(...auchanFront.point(0,-3.32))-floor)<.04);
  assert.ok(contactAt(...auchanFront.point(2.8,-3.32),body)?.id.startsWith('auchan-porche'));
  assert.ok(storeByBuilding.get('2206464950')?.id==='sport-noyon');
});
