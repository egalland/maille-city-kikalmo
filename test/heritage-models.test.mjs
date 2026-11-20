import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {heritageSites,heritageByFootprint} from '../public/enfer-heritage.js';
import {heritageModel,heritageHeight} from '../public/heritage-models.js';

const world=(s,u,v)=>[s.x+Math.cos(s.angle)*u-Math.sin(s.angle)*v,s.y+Math.sin(s.angle)*u+Math.cos(s.angle)*v];

test('seven fitted public buildings have distinct three-dimensional roofs and bounded skyline meshes',()=>{
  assert.equal(heritageSites.length,7);
  for(const s of heritageSites){
    const near=heritageModel(s,true),far=heritageModel(s,false),sky=heritageModel(s,'silhouette');
    assert.ok(near.length>far.length, s.key);
    assert.ok(sky.length<=far.length&&sky.length<410,s.key+' distant silhouette');
    assert.ok([...near,...sky].every(f=>[3,4].includes(f.p.length)&&f.p.flat().every(Number.isFinite)));
    assert.ok(near.some(f=>f.mat==='tileRoof')&&near.some(f=>f.mat==='plain'),s.key);
    for(const id of s.ids)assert.equal(heritageByFootprint.get(id),s);
  }
  const [cat,hall,church]=heritageSites;
  const top=(s,u,v)=>heritageHeight(s,...world(s,u,v));
  assert.ok(top(cat,13.2,-10.3)>top(cat,13.2,10.3)+2);
  assert.ok(top(cat,45,1)>31&&top(cat,45,15)<17);
  assert.ok(top(hall,4.2,.15)>22&&top(hall,4.2,11)<19);
  assert.ok(top(church,2.85,0)>20&&top(church,11,1)<11);
});

test('historic models use existing footprints and their actual raised surfaces block camera and aircraft at the mapped height',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {buildings}=await import('../public/paris-data.js');
  const {contactAt,supportAt}=await import('../public/paris-world.js');
  const {terrainHeight,baseTerrainHeight}=await import('../public/terrain-height.js');
  const ids=new Set(buildings.map(b=>String(b.id)));
  for(const s of heritageSites)assert.ok(s.ids.every(id=>ids.has(id)),s.key);
  for(const [s,u,v] of [[heritageSites[0],13.2,-10.3],[heritageSites[0],45,1],[heritageSites[2],2.85,0]]){
    const [x,y]=world(s,u,v),h=heritageHeight(s,x,y)+baseTerrainHeight(s.x,s.y)-terrainHeight(x,y);
    assert.ok(s.ids.includes(String(contactAt(x,y,{radius:.15,height:h-.55,camera:true})?.id)),s.key);
    assert.equal(contactAt(x,y,{radius:.15,height:h+.35,camera:true}),null,s.key);
    assert.ok(Math.abs(supportAt(x,y,h+.2,{},0).top-h)<.02,s.key);
  }
});
