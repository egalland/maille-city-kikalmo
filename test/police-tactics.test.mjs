import test from 'node:test';
import assert from 'node:assert/strict';
import {roadblockSite,findOfficerCover} from '../public/police-tactics.js';
import {planDistantDispatch,stepDispatch} from '../public/dispatch-roads.js';
import {vehicleSpec} from '../public/vehicle-types.js';

const report={x:0,y:0,angle:0},road={w:8,path:[[-180,0],[0,0],[120,0],[240,0]]},clear=()=>true;
test('a reinforcement physically approaches one lane of a road ahead of the report and leaves an escape lane',()=>{
  const spec=vehicleSpec('swat'),position=roadblockSite(report,[road],spec,clear);
  assert.ok(position.x>20&&position.x<85);assert.ok(position.y>spec.halfWidth);
  assert.ok(position.y+spec.halfWidth<road.w*.5);
  const plan=planDistantDispatch(position,'swat',[road],clear,clear,null,position);
  assert.ok(plan&&Math.hypot(plan.park.x-position.x,plan.park.y-position.y)<.5);
  const state={plan,arrived:null,distance:null};
  let previous=stepDispatch(state,0,1/30,clear);
  assert.ok(Math.hypot(previous.x-position.x,previous.y-position.y)>110);
  for(let i=1;i<1800&&state.arrived==null;i++){
    const current=stepDispatch(state,i/30,1/30,clear);
    assert.ok(Math.hypot(current.x-previous.x,current.y-previous.y)<.8);previous=current;
  }
  assert.ok(state.arrived>0);assert.ok(Math.hypot(previous.x-position.x,previous.y-position.y)<.5);
});
test('narrow, obstructed and single-direction streets do not receive a blockade',()=>{
  const spec=vehicleSpec('swat');
  for(const change of [{w:4},{oneway:1},{bridge:true}])assert.equal(roadblockSite(report,[{...road,...change}],spec,clear),null);
  assert.equal(roadblockSite(report,[road],spec,q=>q.y>0),null);
});
test('officers require a real occluder and a nearby clear observation point',()=>{
  const unit={x:0,y:0};
  const target={x:12,y:0};
  assert.equal(findOfficerCover(unit,target,clear,clear),null);
  const sight=(_observer,point)=>point.y>-.7;
  const result=findOfficerCover(unit,target,clear,sight);
  assert.ok(result);assert.equal(sight(target,result.shelter),false);assert.equal(sight(target,result.peek),true);
  assert.equal(findOfficerCover(unit,target,()=>false,sight),null);
  assert.equal(findOfficerCover(unit,{x:150,y:0},clear,sight),null);
});
