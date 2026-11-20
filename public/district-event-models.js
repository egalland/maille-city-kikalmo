import * as THREE from './three.js';
import {terrainHeight} from './terrain-height.js';
import {incidentStop,incidentDepot} from './district-events.js';

// Each street prop is constructed on first approach. Only the active draw has meshes.
export function districtEventDisplay(scene){
  const models=new Map(),resources=[],materials=new Map();
  let slot=-1;
  function material(color,glow=false){
    const key=color+glow;
    if(!materials.has(key)){
      const m=glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshLambertMaterial({color});
      materials.set(key,m);
    }
    return materials.get(key);
  }
  function mesh(parent,geometry,coat,x,y,z){
    resources.push(geometry);
    const part=new THREE.Mesh(geometry,coat);
    part.position.set(x,y,z);parent.add(part);return part;
  }
  function box(parent,x,y,z,w,h,d,coat){
    return mesh(parent,new THREE.BoxGeometry(w,h,d),coat,x,y,z);
  }
  function drum(parent,x,y,z,top,bottom,h,coat){
    return mesh(parent,new THREE.CylinderGeometry(top,bottom,h,8),coat,x,y,z);
  }
  function make(kind){
    const group=new THREE.Group(),oak=material('#955f45'),metal=material('#365052'),brass=material('#d4a763');
    const yarn=material('#c97561'),cord=material('#f1cd84'),dark=material('#563e3b');
    let indicator;
    if(kind==='lights'){
      drum(group,0,.08,0,.23,.27,.16,metal);drum(group,0,.82,0,.055,.085,1.5,metal);
      box(group,.03,.64,.07,.23,.34,.14,brass);
      box(group,.03,.65,.155,.09,.055,.045,dark);
      drum(group,0,1.48,0,.22,.13,.12,metal);
      indicator=drum(group,0,1.70,0,.18,.15,.35,material('#9d8770'));
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2+Math.PI/4;
        drum(group,Math.cos(a)*.173,1.70,Math.sin(a)*.173,.012,.012,.36,metal);
      }
      drum(group,0,1.93,0,.045,.23,.15,metal);drum(group,0,2.03,0,.018,.047,.075,brass);
    }else if(kind==='parcels'){
      for(let i=0;i<3;i++){
        const ball=drum(group,0,.145+i*.073,(i-1)*.12,.14,.14,.48,yarn);
        ball.rotation.z=Math.PI/2;
      }
      for(const x of [-.14,.14]){
        box(group,x,.19,0,.03,.29,.43,cord);
        box(group,x,.355,0,.035,.025,.38,cord);
      }
      box(group,.07,.37,.08,.12,.012,.09,material('#ffdfaa'));
    }else if(kind==='depot'){
      for(const x of [-.38,.38])for(const z of [-.24,.24])box(group,x,.34,z,.07,.68,.07,oak);
      box(group,0,.63,0,.90,.12,.62,oak);
      for(const z of [-.20,.20])box(group,0,.80,z,.68,.17,.045,brass);
      for(const x of [-.32,.32])box(group,x,.80,0,.045,.17,.42,brass);
      box(group,0,.72,0,.62,.05,.37,metal);
    }else{
      drum(group,0,.06,0,.19,.23,.12,metal);
      box(group,0,.72,0,.10,1.38,.10,oak);box(group,.075,1.38,0,.47,.36,.075,metal);
      indicator=box(group,.075,1.40,.045,.33,.045,.018,brass);
      const pouch=box(group,.06,1.04,.10,.29,.22,.13,material('#a26046'));pouch.rotation.z=-.12;
      box(group,.06,1.12,.18,.27,.065,.035,brass);
    }
    group.rotation.y=.42;
    scene.add(group);return {group,indicator};
  }
  function clear(){
    for(const m of models.values())m.group.removeFromParent();
    for(const g of resources)g.dispose();
    for(const m of materials.values())m.dispose();
    resources.length=0;materials.clear();models.clear();
  }
  return {
    update(event,p,now){
      if(event?.slot!==slot){clear();slot=event?.slot;}
      if(!event)return;
      const complete=event.tasks.every(t=>t.done),next=event.tasks.find(t=>!t.done)?.index;
      function place(key,kind,point,show,lit){
        let model=models.get(key);
        if(!show||Math.hypot(point.x-p.x,point.y-p.y)>72){if(model)model.group.visible=false;return;}
        if(!model){
          model=make(kind);models.set(key,model);
          model.group.position.set(point.x,terrainHeight(point.x,point.y)+.17,point.y);
        }
        model.group.visible=true;
        if(model.indicator)model.indicator.material=lit?material('#ffe59a',true):material('#87796d');
      }
      for(const t of event.tasks){
        const visible=event.kind!=='parcels'||(!t.done&&t.heldUntil<=now);
        place(t.index,event.kind,incidentStop(event,t.index),visible,event.kind==='lights'?t.done:next===t.index);
      }
      if(event.kind==='parcels')place('counter','depot',incidentDepot,!complete,false);
    },
    dispose:clear
  };
}
