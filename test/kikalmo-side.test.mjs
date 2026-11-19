import test from 'node:test';
import assert from 'node:assert/strict';
import {installKikalmoRaster} from './fixtures/kikalmo-raster.mjs';
import {getKikalmoLook} from '../public/kikalmo-avatar.js';
import {createKikalmoModel} from '../public/kikalmo-model.js';
import {createMeshRenderer} from '../public/mesh-renderer.js';
import {Box3,Color,PerspectiveCamera,Scene,Vector3} from '../public/three.js';

test('linked avatars keep opaque rounded heads and jackets with independent joint motion',async()=>{
  const canvasApi=installKikalmoRaster();
  for(const appearance of [{shape:2,costume:163},{shape:4,headwear:210,adornment:221,premiumHair:34}]){
    assert.ok(await getKikalmoLook(appearance).promise);
    const person=createKikalmoModel(appearance),actor={id:'profile'};
    person.update(actor,.016,0);
    const head=person.group.getObjectByName('kikalmo-head-volume');
    const coat=person.group.getObjectByName('kikalmo-jacket');
    for(const part of [head,coat]){
      const box=new Box3().setFromBufferAttribute(part.geometry.attributes.position);
      assert.ok(box.max.x-box.min.x>.32,'depth is comparable to body width');
      const map=part.material.map.image,rgba=map.getContext('2d').getImageData(0,0,map.width,map.height).data;
      assert.ok(rgba.every((value,i)=>i%4!==3||value===255),'skin and textiles fully cover the volume');
    }
    if(appearance.costume===163)assert.ok(head.children.length>12,'the crest and hood trims have their own geometry');

    const canvas=canvasApi.createCanvas(220,220),scene=new Scene();
    const camera=new PerspectiveCamera(39,1,.12,25);
    const render=createMeshRenderer(canvas);
    scene.background=new Color('#90ada3');scene.add(person.group);render.setSize(220,220);
    const profiles=[];
    for(const angle of [0,Math.PI/2,Math.PI]){
      camera.position.set(Math.cos(angle)*3.2,1.25,Math.sin(angle)*3.2);
      camera.lookAt(0,.9,0);render.render(scene,camera,true);
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let dark=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]<340)dark++;
      assert.ok(dark>600,'model draws from each angle');
      profiles.push(Buffer.from(pixels));
    }
    assert.ok(!profiles[0].equals(profiles[1])&&!profiles[1].equals(profiles[2]));

    const boot=person.group.getObjectByName('kikalmo-boot');
    const before=boot.position.clone();
    person.update({...actor,moving:true,speed:4,walk:2},.016,.33);
    assert.ok(boot.position.distanceTo(before)>.025,'boot follows walking motion');
    person.update({...actor,ragdoll:{blend:1,hips:[0,.2,0],chest:[.4,.22,0],head:[.7,.24,0]}},.016,0);
    assert.ok(new Vector3(0,1,0).applyQuaternion(head.parent.quaternion).x>.85,'head follows the fallen body');
    person.dispose();
  }
});
