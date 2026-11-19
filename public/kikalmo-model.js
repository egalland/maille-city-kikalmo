import {motionSeed,sampleLocomotion,linkedPose} from './locomotion-pose.js';
import * as THREE from './three.js';
import {appearanceKey} from './kikalmo-avatar.js';
import {ball,wardrobe} from './kikalmo-items.js';

const up=new THREE.Vector3(0,1,0);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

function stretch(mesh,a,b,radius,delta){
  delta.subVectors(b,a);mesh.position.copy(a).addScaledVector(delta,.5);
  mesh.scale.set(radius,Math.max(.01,delta.length()*.63),radius);
  mesh.quaternion.setFromUnitVectors(up,delta.normalize());
}

export function createKikalmoModel(value,seed=0){
  const a=JSON.parse(appearanceKey(value)),group=new THREE.Group();
  const chest=new THREE.Group(),head=new THREE.Group(),limbs=new THREE.Group();
  chest.name='kikalmo-chest';head.name='kikalmo-head';limbs.name='kikalmo-limbs';
  group.add(chest,head,limbs);
  const {coat,trim,pants,glove}=wardrobe(a,head,chest);
  const arms=[],legs=[];
  for(let i=0;i<2;i++){
    const hand=ball(limbs,glove,0,0,0,.076,.080,.068);
    ball(hand,glove,.48,-.13,i?-.64:.64,.50,.58,.46);
    const shoe=ball(limbs,a.costume?coat:'#534049',0,0,0,.140,.082,.093);
    shoe.name='kikalmo-boot';
    ball(shoe,'#2d2935',.05,-.62,0,.98,.43,1.03);
    ball(shoe,trim,.27,.62,0,.46,.38,.72);
    const sleeve=ball(limbs,coat,0,0,0,1,1,1),cuff=ball(limbs,coat,0,0,0,1,1,1);
    ball(cuff,trim,0,-.69,0,1.04,.20,1.04);
    arms.push([sleeve,cuff,hand]);
    legs.push([ball(limbs,pants,0,0,0,1,1,1),ball(limbs,pants,0,0,0,1,1,1),shoe]);
  }
  let style=motionSeed(seed),lastId;
  const p=new THREE.Vector3(),q=new THREE.Vector3(),r=new THREE.Vector3(),delta=new THREE.Vector3(),target=new THREE.Vector3();
  const orientation=new THREE.Quaternion();
  function rotate(part,anchor,joint,below,gait,blend,lean){
    part.position.fromArray(anchor);
    part.rotation.set(gait.roll,gait.twist*lean,-gait.lean*lean);
    const squash=gait.squash*(1-blend);
    part.scale.set(1-squash*.5,1+squash,1-squash*.5);
    if(joint&&blend){
      part.position.lerp(target.fromArray(joint),blend);
      if(below){
        delta.fromArray(joint).sub(target.fromArray(below));
        if(delta.lengthSq()>.0001)part.quaternion.slerp(orientation.setFromUnitVectors(up,delta.normalize()),blend);
      }
    }
  }
  function update(e,dt=.016,t=0){
    if(e.id!==lastId){lastId=e.id;style=motionSeed(lastId??seed);}
    const pose=e.pose||e,gait=sampleLocomotion(pose,t,style),rig=linkedPose(pose,gait,t);
    const rag=e.ragdoll||pose.ragdoll,blend=clamp(rag?.blend||0);
    rotate(chest,rig.anchors[1],rag?.chest,rag?.hips,gait,blend,1);
    rotate(head,rig.anchors[2],rag?.head,rag?.chest,gait,blend,.65);
    head.rotateY(-gait.turn*.13*(1-blend));
    for(const side of [0,1]){
      const name=side?'right':'left',arm=arms[side],leg=legs[side];
      p.fromArray(rig.arms[side][0]);q.fromArray(rig.arms[side][1]);r.fromArray(rig.arms[side][2]);
      if(blend){
        if(rag[name+'Shoulder'])p.lerp(target.fromArray(rag[name+'Shoulder']),blend);
        if(rag[name+'Elbow'])q.lerp(target.fromArray(rag[name+'Elbow']),blend);
        if(rag[name+'Hand'])r.lerp(target.fromArray(rag[name+'Hand']),blend);
      }
      stretch(arm[0],p,q,.087,delta);stretch(arm[1],q,r,.073,delta);arm[2].position.copy(r);arm[2].quaternion.copy(arm[1].quaternion);
      p.fromArray(rig.legs[side][0]);q.fromArray(rig.legs[side][1]);r.fromArray(rig.legs[side][2]);
      if(blend){
        if(rag.hips)p.lerp(target.fromArray(rag.hips),blend);
        if(rag[name+'Knee'])q.lerp(target.fromArray(rag[name+'Knee']),blend);
        if(rag[name+'Foot'])r.lerp(target.fromArray(rag[name+'Foot']),blend);
      }
      stretch(leg[0],p,q,.096,delta);stretch(leg[1],q,r,.083,delta);
      leg[2].position.copy(r);leg[2].position.x+=.054;leg[2].position.y+=.019;
    }
  }
  return {group,update,dispose(){group.removeFromParent();}};
}
