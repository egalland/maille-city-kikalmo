import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {careerPlaces,careerContracts} from '../public/career-catalog.js';
import {makeCareerRouter} from '../public/career-route.js';

test('race distance limits follow the current directed course on the deployed map',()=>{
  const map=JSON.parse(gunzipSync(readFileSync(new URL('../public/map-enfer.gz',import.meta.url))));
  const route=makeCareerRouter(map.streets.map(([,path,w,kind,,,oneway])=>({path,w,kind,oneway})));
  const course=careerContracts.race;
  for(let i=1;i<course.stages.length;i++){
    const path=route(careerPlaces[course.stages[i-1].place],careerPlaces[course.stages[i].place]);
    const metres=path.slice(1).reduce((d,p,j)=>d+Math.hypot(p.x-path[j].x,p.y-path[j].y),0);
    assert.equal(Math.round(metres),course.roadMetres[i],'Update course distances when the road network changes');
  }
});
