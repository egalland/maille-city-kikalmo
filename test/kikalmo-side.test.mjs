import test from 'node:test';
import assert from 'node:assert/strict';
import {installKikalmoRaster} from './fixtures/kikalmo-raster.mjs';
import {appearanceSchema} from '../public/kikalmo-schema.js';
import {modeledItems} from '../public/kikalmo-items.js';
import {itemDyes} from '../public/kikalmo-dyes.js';
import {createKikalmoModel} from '../public/kikalmo-model.js';
import {createMeshRenderer} from '../public/mesh-renderer.js';
import {Box3,Color,PerspectiveCamera,Scene,Vector3} from '../public/three.js';

test('linked avatars have round heads, wearable geometry and independent joint motion',()=>{
  const canvasApi=installKikalmoRaster();
  for(const appearance of [{shape:2,costume:161,color:'#6667ba'},{shape:2,costume:163},{shape:4,headwear:210,adornment:221,premiumHair:34}]){
    const person=createKikalmoModel(appearance),actor={id:'profile'};
    person.update(actor,.016,0);
    const head=person.group.getObjectByName('kikalmo-head-volume');
    const coat=person.group.getObjectByName('kikalmo-jacket');
    for(const part of [head,coat]){
      const box=new Box3().setFromBufferAttribute(part.geometry.attributes.position);
      assert.ok((box.max.x-box.min.x)*part.scale.x>.32,'depth is comparable to body width');
      assert.ok(part.material.map.isDataTexture&&!part.material.transparent,'cloth has a solid dyed surface');
    }
    if(appearance.costume===161){
      const hood=person.group.getObjectByName('kikalmo-costume-head-161');
      const mantle=person.group.getObjectByName('kikalmo-costume-body-161');
      person.group.updateMatrixWorld(true);
      const crest=new Box3().setFromObject(hood);
      assert.ok(crest.max.y-person.group.getObjectByName('kikalmo-head').position.y>.64);
      assert.ok(mantle.children.length>45,'the mantle contains separate panels, brooches and braids');
    }
    if(appearance.costume===163)assert.ok(person.group.getObjectByName('kikalmo-costume-head-163').children.length>12,'the ornament is made of meshes');

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
    assert.ok(new Vector3(0,1,0).applyQuaternion(person.group.getObjectByName('kikalmo-head').quaternion).x>.85,'head follows the fallen body');
    person.dispose();
  }
});

test('every registered catalogue item builds without a portrait and meshes are attached to the outfit',()=>{
  for(const [slot,ids] of Object.entries(appearanceSchema)){
    if(modeledItems[slot])assert.deepEqual(Object.keys(modeledItems[slot]).map(Number).sort((a,b)=>a-b),ids);
    for(const id of ids){
      assert.ok(itemDyes[id]?.length===2,`dyes for ${slot} ${id}`);
      const model=createKikalmoModel({shape:1,[slot]:id});
      const label=slot==='costume'?'costume-head':slot;
      const part=model.group.getObjectByName(`kikalmo-${label}-${id}`);
      assert.ok(part,`model for ${slot} ${id}`);
      let triangles=0;
      part.traverse(node=>{if(node.isMesh)triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;});
      assert.ok(triangles>0,`geometry for ${slot} ${id}`);
      model.dispose();
    }
  }
  const crown=createKikalmoModel({shape:3,headwear:17});
  const bounds=new Box3().setFromObject(crown.group.getObjectByName('kikalmo-headwear-17'));
  assert.ok(bounds.max.z-bounds.min.z>.44,'the crown band wraps around the whole head');
  crown.dispose();
  const combined=createKikalmoModel({shape:2,costume:163,headwear:19,facewear:96,adornment:227,fabric:79});
  for(const part of ['costume-head-163','costume-body-163','headwear-19','facewear-96','adornment-227','fabric-79'])
    assert.ok(combined.group.getObjectByName('kikalmo-'+part),part);
  combined.dispose();
});
