import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from '../public/three.js';
import {createPuppet} from '../public/puppets3d.js';
import {weaponPose} from '../public/held-weapon.js';

const tally=group=>{
  let triangles=0,meshes=0;
  group.traverse(node=>{
    if(node.isMesh){triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;meshes++;}
  });
  return {triangles,meshes};
};

test('the field wardrobe preserves its street clothes at distance in one lightweight batch',()=>{
  for(const [type,seed] of [['human',0],['human',1],['human',2],['human',3],['human',4],['human',5],['fox',13],['medic',8],['police',9],['firefighter',7],['swat',5]]){
    const figure=createPuppet(type,'lagon',seed),[close,far]=figure.group.children[0].levels;
    const nearBudget=tally(close.object),farBudget=tally(far.object);
    assert.equal(farBudget.meshes,1);
    assert.ok(farBudget.triangles<2300,type+' far triangle count '+farBudget.triangles);
    assert.ok(nearBudget.triangles<(type==='fox'?12000:9600));
    const nearBox=new Box3().setFromObject(close.object),farBox=new Box3().setFromObject(far.object);
    assert.ok(Math.abs(farBox.max.y-nearBox.max.y)<.15,type+' keeps the silhouette when changing detail');
    for(const joint of ['head','armL','elbowR','kneeL','legR'])assert.ok(close.object.getObjectByName(joint));
    figure.dispose();
  }
});

test('the hand, weapon and barrel stay aligned during aim and recoil',()=>{
  for(const [role,kind] of [['fox','pistol'],['police','smg'],['swat','shotgun']]){
    const figure=createPuppet(role,'lagon',9);
    const show=extra=>{
      const pose={weapon:kind,aiming:true,...extra},rig=weaponPose(kind,pose);
      figure.update(pose,.016,.2);figure.group.updateMatrixWorld(true);
      const gun=figure.group.getObjectByName(kind);
      const muzzle=gun.localToWorld(new Vector3(rig.length,.056,0));
      const hand=figure.group.getObjectByName('elbowR').localToWorld(new Vector3(.054,-.17,.011));
      assert.ok(muzzle.distanceTo(new Vector3(...rig.muzzle))<.001);
      assert.ok(hand.distanceTo(new Vector3(...rig.grip))<.035);
      return muzzle;
    };
    const aim=show({fire:0}),recoil=show({fire:1});
    assert.ok(recoil.x<aim.x-.04&&recoil.y>aim.y+.04);
    figure.update({weapon:kind,melee:{kind:'jab',phase:.4}});
    assert.equal(figure.group.getObjectByName(kind),undefined);
    figure.dispose();
  }
});

test('standing figures retain independent animation joints for identically dressed figures',()=>{
  const a=createPuppet('player','bruyere~indigo',15),b=createPuppet('player','bruyere~indigo',15);
  const cape=object=>object.group.getObjectByName('cape');
  const geometry=cape(a).children.find(n=>n.isMesh).geometry;
  assert.equal(geometry,cape(b).children.find(n=>n.isMesh).geometry);
  assert.notEqual(cape(a),cape(b));
  a.update({id:'first',motion:'run',moving:true,speed:5},.07,.75);
  b.update({id:'second',motion:'idle'},.016,.12);
  const delta=cape(a).getWorldPosition(new Vector3()).distanceTo(cape(b).getWorldPosition(new Vector3()));
  assert.ok(delta>.001);
  a.dispose();b.dispose();
});
