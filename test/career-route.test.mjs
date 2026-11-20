import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {makeCareerRouter} from '../public/career-route.js';
import {careerContracts,careerPlaces} from '../public/career-catalog.js';
const street=(path,oneway=0)=>({kind:'road',w:5,path,oneway});
test('route follows connected streets in the legal direction',()=>{
  const route=makeCareerRouter([street([[0,0],[50,0]],1),street([[50,0],[50,50],[0,50],[0,0]],1)]);
  const points=route({x:40,y:2},{x:10,y:1});
  assert.ok(points.some(p=>p.y===50));
  assert.equal(points[0].x,40);assert.equal(points.at(-1).x,10);
  assert.equal(route({x:1000,y:1000},{x:10,y:1}).length,0);
});
test('each published contract has a navigable route between its named stops',()=>{
  const map=JSON.parse(gunzipSync(readFileSync(new URL('../public/map-enfer.gz',import.meta.url))));
  const route=makeCareerRouter(map.streets.map(([,path,w,kind,,,oneway])=>({path,w,kind,oneway})));
  for(const job of Object.values(careerContracts))for(let i=1;i<job.stages.length;i++){
    const from=careerPlaces[job.stages[i-1].place],to=careerPlaces[job.stages[i].place];
    const path=route(from,to);
    assert.ok(path.length>2,job.id);
    assert.ok(Math.hypot(from.x-path[0].x,from.y-path[0].y)<10);
    assert.ok(Math.hypot(to.x-path.at(-1).x,to.y-path.at(-1).y)<10);
  }
});
