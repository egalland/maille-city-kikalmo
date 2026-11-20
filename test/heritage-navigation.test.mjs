import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {heritageSites} from '../public/enfer-heritage.js';
import {heritageWaypoints} from '../public/career-navigation.js';
import {makeCareerRouter} from '../public/career-route.js';

test('the GPS reaches the public frontage of each modelled landmark from the spawn district',async t=>{
  globalThis.location=new URL('https://maille.test/');t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {SPAWN,blocked}=await import('../public/paris-world.js');
  const {streets}=await import('../public/paris-data.js');
  const router=makeCareerRouter(streets);
  assert.equal(heritageWaypoints.length,heritageSites.length);
  for(const site of heritageSites){
    const place=heritageWaypoints.find(p=>p.id==='heritage/'+site.key);
    const path=router(SPAWN,place),end=path.at(-1);
    assert.ok(end&&Math.hypot(end.x-place.x,end.y-place.y)<10,site.name+' street access');
    assert.ok(Math.hypot(place.x-site.x,place.y-site.y)<31,site.name+' frontage');
    const depth=(site.x-place.x)*Math.cos(site.angle)+(site.y-place.y)*Math.sin(site.angle);
    assert.ok(depth>1,site.name+' front of building');
    const count=Math.ceil(Math.hypot(end.x-place.x,end.y-place.y)*2);
    for(let i=0;i<=count;i++){
      const t=i/(count||1);
      assert.ok(!blocked(end.x+(place.x-end.x)*t,end.y+(place.y-end.y)*t,.42),site.name+' accessible on foot');
    }
  }
});
