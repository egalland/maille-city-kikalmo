import * as T from './three.js';
import {terrainHeight} from './terrain-height.js';

export function createCrossingDisplay(scene){
  const entries=new Map(),cube=new T.BoxGeometry(1,1,1),round=new T.SphereGeometry(1,10,6);
  const felt=color=>new T.MeshLambertMaterial({color});
  const post=felt('#4b4a4c'),ivory=felt('#f2dfbf'),stripe=felt('#b64549');
  const rest=new T.MeshBasicMaterial({color:'#4e2428'}),active=new T.MeshBasicMaterial({color:'#ff342c'});
  function box(g,material,x,y,z,w,h,d,geometry=cube){
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);g.add(mesh);return mesh;
  }
  function gate(site){
    const group=new T.Group();group.position.set(site.x,terrainHeight(site.x,site.y),site.y);
    group.rotation.y=-site.angle;
    const x=-site.width/2;
    box(group,post,x,1.11,0,.19,2.22,.19);
    box(group,post,x,.2,0,.46,.4,.43);
    box(group,post,x,1.9,0,.72,.32,.27);
    const lights=[-.20,.20].map(off=>box(group,rest,x+off,1.9,-.16,.107,.107,.065,round));
    const arm=new T.Group();group.add(arm);arm.position.set(x,.92,0);arm.rotation.z=Math.PI*.48;
    const spans=Math.ceil(site.width/.65);
    for(let i=0;i<spans;i++){const w=site.width/spans;box(arm,i%2?stripe:ivory,(i+.5)*w,0,0,w+.008,.13,.12);}
    scene.add(group);return {group,arm,lights};
  }
  return {
    update(sites,epoch,dt){
      const keep=new Set();
      for(const site of sites||[]){
        keep.add(site.id);
        if(!entries.has(site.id))entries.set(site.id,site.gates.map(gate));
        for(const {arm,lights} of entries.get(site.id)){
          arm.rotation.z+=((site.close?0:Math.PI*.48)-arm.rotation.z)*(1-Math.exp(-3.2*dt));
          lights.forEach((light,i)=>{light.material=site.warning&&Math.floor(epoch/365)%2===i?active:rest;});
        }
      }
      for(const [id,gates] of entries)if(!keep.has(id)){
        for(const g of gates)scene.remove(g.group);
        entries.delete(id);
      }
    },
    dispose(){
      for(const gates of entries.values())for(const g of gates)scene.remove(g.group);
      entries.clear();for(const resource of [cube,round,post,ivory,stripe,rest,active])resource.dispose();
    }
  };
}
