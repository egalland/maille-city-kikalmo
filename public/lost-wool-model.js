import * as THREE from './three.js';
import {terrainHeight} from './terrain-height.js';

export function woolDisplay(scene){
  let model;
  function build(){
    const group=new THREE.Group(),red=new THREE.MeshLambertMaterial({color:'#ad4164'}),weave=new THREE.MeshLambertMaterial({color:'#f9979c'});
    const globe=new THREE.Mesh(new THREE.SphereGeometry(.30,18,12),red);
    globe.scale.y=.94;group.add(globe);
    const winding=new THREE.TorusGeometry(.285,.016,5,30);
    for(let i=0;i<9;i++){
      const loop=new THREE.Mesh(winding,weave),offset=(i%3-1)*.068;
      loop.rotation.set(.24+i*.58,i*.43,.46+i*.22);
      loop.translateZ(offset);group.add(loop);
    }
    const thread=new THREE.CatmullRomCurve3([[.13,-.23,.05],[.30,-.26,.20],[.49,-.27,.16],[.58,-.27,.31]].map(v=>new THREE.Vector3(...v)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(thread,12,.017,5,false),weave));
    scene.add(group);return group;
  }
  return {
    update(point,viewer){
      const visible=point&&Math.hypot(point.x-viewer.x,point.y-viewer.y)<84;
      if(!visible){if(model)model.visible=false;return;}
      model??=build();model.visible=true;model.position.set(point.x,terrainHeight(point.x,point.y)+.482,point.y);
    },
    dispose(){if(model){model.removeFromParent();for(const g of new Set(model.children.map(n=>n.geometry)))g.dispose();for(const m of new Set(model.children.map(n=>n.material)))m.dispose();}}
  };
}
