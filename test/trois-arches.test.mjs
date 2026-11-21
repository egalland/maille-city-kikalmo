import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('the Trois Arches arrival and camera stay on the upper road, including a view toward the bank',async t=>{
  globalThis.location=new URL('https://maille.test/');
  t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {contactAt,getTravelPoint}=await import('../public/paris-world.js');
  const {aircraftDeck,baseTerrainHeight,terrainHeight}=await import('../public/terrain-height.js');
  const {createWorldCamera}=await import('../public/world-camera.js');
  const arrival=getTravelPoint('trois-ponts');
  const formerArrival={x:-621.865,y:2016.332,angle:.748};
  for(const p of [arrival,formerArrival]){
    const deck=aircraftDeck(p.x,p.y);
    assert.ok(deck>baseTerrainHeight(p.x,p.y)+2);
    assert.ok(Math.abs(terrainHeight(p.x,p.y,p.angle)-deck)<.2);
    for(const car of [null,{type:'compact'}]){
      const camera=createWorldCamera(p);
      for(const turn of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
        const frame=camera({p,car,yaw:p.angle+turn,pitch:.13,snap:true},1/60,0);
        assert.ok(frame.z>deck+1,'the camera must stay above the span as it swings out over the bank');
      }
    }
  }
  for(let d=0;d<=8;d++){
    const x=arrival.x+Math.cos(arrival.angle)*d,y=arrival.y+Math.sin(arrival.angle)*d;
    assert.equal(contactAt(x,y,{radius:.55}),null,'the direction of arrival should be clear on foot');
    assert.ok(Math.abs(terrainHeight(x,y,arrival.angle)-aircraftDeck(x,y))<.2);
  }
});
