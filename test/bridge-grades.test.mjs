import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {selectBridgeDecks,roadGround} from '../public/enfer-bridges.js';
import {baseTerrainHeight,selectSectorTerrain,terrainHeight} from '../public/terrain-height.js';
import {stepVehicleBody} from '../public/vehicle-motion.js';

test('Enfer bridge decks, adjoining road records, raised footways and tyres share continuous grades',()=>{
  const archive=JSON.parse(gunzipSync(readFileSync(new URL('../public/map-enfer.gz',import.meta.url))));
  const streets=archive.streets.map(([id,path,w,kind,name,level,,deck])=>({id,path,w,kind,name,bridge:level>0,deck}));
  const lakes=archive.water.map(([poly,holes,elevation])=>({poly,holes,elevation}));
  selectSectorTerrain(archive.relief);
  selectBridgeDecks(streets,lakes,baseTerrainHeight);
  const bridges=streets.filter(s=>s.bridge),joints=new Map();
  for(const road of streets)for(const [point,index] of [[road.path[0],0],[road.path.at(-1),road.path.length-2]]){
    const id=point.join();
    if(!joints.has(id))joints.set(id,[]);
    joints.get(id).push({road,index,point});
  }
  const connected=new Set(bridges);
  for(const road of bridges)for(const point of [road.path[0],road.path.at(-1)])
    for(const link of joints.get(point.join()))connected.add(link.road);
  assert.equal(bridges.length,114);assert.equal(connected.size,334);
  let maxDeckTurn=0,maxApproachTurn=0,maxWheelError=0,maxSideError=0;
  for(const road of connected){
    let previousGrade;
    for(let i=1;i<road.path.length;i++){
      const a=road.path[i-1],b=road.path[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      if(!length)continue;
      const steps=Math.ceil(length/.5),angle=Math.atan2(dy,dx);
      let previous;
      for(let j=0;j<=steps;j++){
        const x=a[0]+dx*j/steps,y=a[1]+dy*j/steps;
        const height=terrainHeight(x,y,angle);
        const pavement=(offset)=>{
          const cx=x-dy*offset/length,cy=y+dx*offset/length;
          return roadGround(road,i-1,cx,cy,baseTerrainHeight(cx,cy));
        };
        maxWheelError=Math.max(maxWheelError,Math.abs(pavement(0)-height));
        if(road.bridge){
          const edge=road.w*.5+Math.min(3,road.w*.3);
          maxSideError=Math.max(maxSideError,Math.abs(pavement(edge)-height),Math.abs(pavement(-edge)-height));
          for(const side of [-1,1]){
            const offset=road.w*.32*side;
            const tyre=terrainHeight(x-dy*offset/length,y+dx*offset/length,angle,height);
            maxWheelError=Math.max(maxWheelError,Math.abs(tyre-height));
          }
        }
        if(j>0){
          const grade=(height-previous)*steps/length;
          if(previousGrade!=null){
            const change=Math.abs(grade-previousGrade);
            if(road.bridge)maxDeckTurn=Math.max(maxDeckTurn,change);
            else maxApproachTurn=Math.max(maxApproachTurn,change);
          }
          previousGrade=grade;
        }
        previous=height;
      }
    }
  }
  assert.ok(maxDeckTurn<.022&&maxApproachTurn<.018,JSON.stringify({maxDeckTurn,maxApproachTurn}));
  assert.ok(maxWheelError<.002&&maxSideError<.001,JSON.stringify({maxWheelError,maxSideError}));
  for(const links of joints.values()){
    if(!links.some(l=>connected.has(l.road)))continue;
    const levels=links.map(({road,index,point})=>roadGround(road,index,...point,baseTerrainHeight(...point)));
    assert.ok(Math.max(...levels)-Math.min(...levels)<.001,JSON.stringify(links[0].point));
  }

  // Two IGN records cross in plan at this overpass. Drive each road in both directions
  // and compare its actual suspension height with its mesh at the same position.
  const upper=streets.find(s=>s.id==='39410312'),lower=streets.find(s=>s.id==='39410328');
  const crossing=[-1448.021875,-1522.23671875],floors=[];
  for(const road of [upper,lower]){
    const index=road.path.findIndex((a,i)=>{
      const b=road.path[i+1];
      return b&&Math.abs(Math.hypot(a[0]-crossing[0],a[1]-crossing[1])+Math.hypot(b[0]-crossing[0],b[1]-crossing[1])-Math.hypot(b[0]-a[0],b[1]-a[1]))<.001;
    });
    assert.ok(index>=0);
    const a=road.path[index],b=road.path[index+1],angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
    const floor=roadGround(road,index,...crossing,baseTerrainHeight(...crossing));floors.push(floor);
    for(const yaw of [angle,angle+Math.PI]){
      let suspension;
      for(let distance=-3;distance<=3;distance+=.25){
        const x=crossing[0]+Math.cos(yaw)*distance,y=crossing[1]+Math.sin(yaw)*distance;
        suspension=stepVehicleBody(suspension,{x,y,angle:yaw,speed:15,halfLength:2,dt:1/60},terrainHeight);
        assert.ok(Math.abs(suspension.height-roadGround(road,index,x,y,baseTerrainHeight(x,y)))<.025);
        assert.equal(suspension.lift,0);
      }
    }
  }
  assert.ok(floors[0]-floors[1]>4.5);
});
