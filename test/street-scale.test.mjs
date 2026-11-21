import test from 'node:test';
import assert from 'node:assert/strict';
import {assignBuiltUpStreets,pavedStreetWidth,pedestrianStreetOffset,streetHasCentreMarking} from '../public/street-scale.js';
import {enferFacadeFloors,enferRoof} from '../public/enfer-architecture.js';

test('only built-up carriageways receive urban-width pavements',()=>{
  const street={w:5,kind:'residential',path:[[0,0],[30,0]]};
  const rural={...street,path:[[400,0],[430,0]]};
  const buildings=[-9,9].map(y=>({
    poly:[[0,y],[12,y],[12,y+5],[0,y+5]],kind:'residential',h:6.4
  }));
  assignBuiltUpStreets([street,rural],buildings);
  assert.equal(pavedStreetWidth(street),8.6);
  assert.equal(pavedStreetWidth(rural),6.3);
  for(const road of [street,rural]){
    assert.ok(pedestrianStreetOffset(road)>road.w/2);
    assert.ok(pedestrianStreetOffset(road)<pavedStreetWidth(road)/2);
  }
  const path={...street,kind:'path',w:2.3};
  assert.equal(pavedStreetWidth(path),2.3);
  assert.equal(pedestrianStreetOffset(path),0);
  assert.equal(pavedStreetWidth({...street,kind:'motorway'}),5);
  assert.equal(streetHasCentreMarking({...street,w:7}),true);
  assert.equal(streetHasCentreMarking({...street,w:5.5,oneway:1}),false);
});

test('the surveyed ridge stays at its true height above human-scale residential floors',()=>{
  const footprint=[[0,0],[12,0],[12,8],[0,8]];
  for(const [h,expected] of [[4.8,1],[6.4,2],[9.5,3]]){
    const roof=enferRoof(footprint,h,0,true);
    const floors=enferFacadeFloors(0,roof.wall,roof);
    assert.equal(floors,expected);
    assert.ok(roof.wall/floors>=2.55&&roof.wall/floors<=3.2);
    assert.equal(roof.top([6,4]),h);
    assert.ok(roof.wall<h-1);
  }
});
