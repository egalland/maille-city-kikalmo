import {terrainHeight} from './terrain-height.js';
import * as T from './three.js';
import {firearmModel} from './puppets3d.js';
import {pickupStyle,pickupPatch,pickupMarkerWidth,pickupRange,pickupLift,pickupPhase} from './pickup-art.js';

export function createPickupDisplay(scene){
  const instances=new Map(),styles=new Map();
  const base=new T.CylinderGeometry(.48,.52,.11,8);
  const trim=new T.CylinderGeometry(.46,.46,.028,8);
  const plinth=new T.MeshLambertMaterial({color:'#384449'});
  const rim=new T.MeshLambertMaterial({color:'#aa9674'});
  const ammoBox=new T.BoxGeometry(.5,.24,.30);
  const ammoMaterial=new T.MeshLambertMaterial({color:'#6c8172'});
  function palette(kind){
    if(styles.has(kind))return styles.get(kind);
    const texture=new T.CanvasTexture(pickupPatch(kind));
    texture.colorSpace=T.SRGBColorSpace;
    const materials={artwork:new T.SpriteMaterial({map:texture,alphaTest:.12,transparent:false,toneMapped:false})};
    styles.set(kind,materials);return materials;
  }
  const mesh=(geometry,material,y)=>{const m=new T.Mesh(geometry,material);m.position.y=y;return m;};
  function create(kind){
    const materials=palette(kind),group=new T.Group();
    group.add(mesh(base,plinth,.075),mesh(trim,rim,.135));
    const model=kind==='ammo'?mesh(ammoBox,ammoMaterial,0):firearmModel(kind).clone(true);
    model.scale.setScalar(1.65);group.add(model);
    const sprite=new T.Sprite(materials.artwork);sprite.scale.set(pickupMarkerWidth,pickupMarkerWidth*.8,1);group.add(sprite);
    group.name='Équipement · '+kind;scene.add(group);
    return {kind,group,sprite,model};
  }
  function update(list,player,t){
    for(const item of instances.values())item.keep=false;
    for(const p of list||[]){
      const kind=p.ammoOnly?'ammo':p.weapon;
      if(!pickupStyle(kind)||!Number.isFinite(p.x+p.y))continue;
      if((p.x-player.x)**2+(p.y-player.y)**2>pickupRange**2)continue;
      let item=instances.get(p.id);
      if(item&&item.kind!==kind){item.group.removeFromParent();instances.delete(p.id);item=null;}
      if(!item){item=create(kind);item.phase=pickupPhase(p.id);instances.set(p.id,item);}
      item.keep=true;item.group.position.set(p.x,terrainHeight(p.x,p.y),p.y);
      const phase=t*2.36+item.phase,lift=pickupLift(t,item.phase);
      item.sprite.position.y=lift;
      item.model.position.y=.80+.055*Math.sin(phase);item.model.rotation.y=t*.81+item.phase;item.model.rotation.z=.07*Math.sin(phase*.7);

    }
    for(const [id,item] of instances)if(!item.keep){item.group.removeFromParent();instances.delete(id);}
  }
  return {update,dispose(){
    for(const item of instances.values())item.group.removeFromParent();
    for(const mats of styles.values()){mats.artwork.map.dispose();for(const m of Object.values(mats))m.dispose();}
    base.dispose();trim.dispose();plinth.dispose();rim.dispose();ammoBox.dispose();ammoMaterial.dispose();instances.clear();styles.clear();
  }};
}
