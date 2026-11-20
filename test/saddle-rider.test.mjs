import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../public/three.js';
import {createCar,createPuppet} from '../public/puppets3d.js';
import {gripOnFork,riderIdentity,saddles} from '../public/saddle-rider.js';

const names=(root,name)=>{
  const result=[];root.traverse(node=>{if(node.name===name)result.push(node);});return result;
};
function geometryOf(root,joint){
  return root.getObjectByName(joint).children.find(node=>node.isMesh).geometry;
}

test('an open seat carries the walking model for this driver, replaces it on transfer and empties on ejection',()=>{
  const car=createCar('motorbike'),root=car.group;
  const ambient={id:'route-11',routeId:'r12',speed:6};
  try{
    car.update(ambient,1/30,0);
    const occupant=root.getObjectByName('conducteur'),person=riderIdentity(ambient);
    const npc=createPuppet('human',undefined,person.seed);
    assert.equal(geometryOf(occupant,'head'),geometryOf(npc.group,'head'));
    assert.equal(person.id,'exit-route-11');
    npc.dispose();
    car.update({...ambient,noDriver:true},1/30,.1);
    assert.equal(names(root,'conducteur').length,0);
    car.update({id:'self',self:true,driverSkin:'bruyere'},1/30,.2);
    const player=root.getObjectByName('conducteur'),walking=createPuppet('fox','bruyere',0);
    assert.notEqual(player,occupant);assert.equal(geometryOf(player,'torso'),geometryOf(walking.group,'torso'));
    walking.dispose();
    car.update({id:'peer-21',peer:true,driverSkin:'foret'},1/30,.3);
    const other=root.getObjectByName('conducteur');
    assert.notEqual(other,player);assert.notEqual(geometryOf(player,'torso'),geometryOf(other,'torso'));
    assert.equal(names(root,'conducteur').length,1);
    car.update({...ambient,driver:false,parked:true},1/30,.4);
    assert.equal(names(root,'conducteur').length,0);
  }finally{car.dispose();}
});

for(const type of ['scooter','motorbike','cargo']){
  test(type+' keeps both hands on the moving handlebars and flexes independently of the leaning frame',()=>{
    const car=createCar(type),mount=saddles[type],root=car.group;
    try{
      const base={id:'me',self:true,driverSkin:'lagon',speed:9};
      car.update(base,1/30,0);
      const rider=root.getObjectByName('conducteur'),elbow=rider.getObjectByName('elbowL');
      const resting=elbow.getWorldQuaternion(elbow.quaternion.clone());
      for(let i=1;i<30;i++)car.update({...base,steer:.86},1/30,i/30);
      root.updateMatrixWorld(true);
      const fork=root.getObjectByName('guidon'),frame=fork.parent;
      assert.ok(Math.abs(fork.rotation.y)>.3);
      assert.ok(resting.angleTo(elbow.getWorldQuaternion(elbow.quaternion.clone()))>.12);
      assert.ok(Math.abs(rider.getObjectByName('head').rotation.x)>.015);
      for(const side of [-1,1]){
        const arm=rider.getObjectByName('elbow'+(side<0?'L':'R'));
        const actual=arm.localToWorld(new Vector3(.061,-.166,.011*side));
        const expected=frame.localToWorld(gripOnFork(mount,side,-fork.rotation.y,new Vector3()));
        assert.ok(actual.distanceTo(expected)<.008);
        if(type!=='cargo'){
          const knee=rider.getObjectByName('knee'+(side<0?'L':'R'));
          const boot=knee.localToWorld(new Vector3(.073,-.218,.002*side));
          const [x,y,z]=mount.foot;
          assert.ok(boot.distanceTo(frame.localToWorld(new Vector3(x,y,z*side)))<.008);
        }
      }
    }finally{car.dispose();}
  });
}

test('an open bike turns its headlight with the fork and leaves a fallen two-wheel frame after destruction',()=>{
  for(const type of ['motorbike','scooter']){
    const car=createCar(type);
    try{
      car.update({id:'me',self:true,speed:5,headlamps:true,steer:.7},.05,1);
      const lamp=car.group.getObjectByName('Feux de croisement');
      assert.equal(lamp.parent.name,'guidon');
      car.update({self:true,wrecked:true,chassisHp:0},.05,1.1);
      assert.equal(lamp.visible,false);assert.equal(names(car.group,'conducteur').length,0);
      assert.ok(car.group.getObjectByName('Cadre couché').rotation.x<-1);
    }finally{car.dispose();}
  }
});
