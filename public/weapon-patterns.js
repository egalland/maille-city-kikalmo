import { weaponCatalog,weaponDamageAt,isHeavyShot } from './weapon-catalog.js';

// Aim-assist, manual shots and the fan all use the same caller-provided first-contact trace.
const spreads={
  shuttle:[0,.045],
  button:[0,-.048,.048,-.096,.096],
  confetti:[0,-.10,.10,-.21,.21,-.34,.34],
  bubbles:[0,-.126,.126],
  star:[0,-.059,.059],
  chime:[0,-.19,.19,-.39,.39,-.62,.62,-.85,.85,-1.09,1.09,-1.32,1.32]
};
const interactions={
  pompom:{area:3.1,limit:5},
  rocket:{area:9.5,limit:9},
  tankShell:{area:13.5,limit:13},
  shotgun:{cone:.16,limit:10},
  boomerang:{chain:5.1,limit:1},
  spool:{chain:3.5,limit:3},
  spark:{chain:4.8,limit:2}
};
const straight=[0];
export function weaponShotShape(kind){
  return {spreads:spreads[kind]||straight,...interactions[kind]};
}
export const legacyShotgunSpread=[0,-.072,.072];
export function coneContact(shot,target,aperture,reach,padding=0){
  const dx=target.x-shot.x,dy=target.y-shot.y,c=Math.cos(shot.angle),s=Math.sin(shot.angle);
  const along=dx*c+dy*s,horizontal=dy*c-dx*s;
  const vertical=Number.isFinite(shot.z)&&Number.isFinite(target.z)?target.z-shot.z-along*(shot.slope||0):0;
  const side=Math.hypot(horizontal,vertical);
  const width=Math.tan(aperture)*Math.max(.45,along)+padding;
  if(along<-.15||along>reach+padding||side>width)return null;
  return {distance:Math.hypot(dx,dy),weight:1-.64*Math.min(1,side/width)};
}
export function touchesVehicleBlast(target,impact){
  if(target.hitKind!=='vehicle'||!impact||!target.halfLength||!target.halfWidth)return false;
  const angle=target.angle||0,c=Math.cos(angle),s=Math.sin(angle),dx=impact.x-target.x,dy=impact.y-target.y;
  const x=Math.max(0,Math.abs(dx*c+dy*s)-(target.halfLength||0));
  const y=Math.max(0,Math.abs(dy*c-dx*s)-(target.halfWidth||0));
  return Math.hypot(x,y)<=.78;
}
const radians=(from,to)=>Math.atan2(to.y-from.y,to.x-from.x);
const distance=(from,to)=>Math.hypot(to.x-from.x,to.y-from.y);
function tip(ray){return {x:ray.origin.x+Math.cos(ray.angle)*ray.length,y:ray.origin.y+Math.sin(ray.angle)*ray.length};}
export function resolveWeaponShot(kind,angle,trace,targets=[],visible,firstRay=null){
  const weapon=weaponCatalog[kind];
  const rays=[],hits=[],used=new Set();
  if(!weapon||!Number.isFinite(angle)||typeof trace!=='function')return {rays,hits,impact:null};
  const add=(target,damage,zone)=>{
    if(!target||target.id===undefined||used.has(target.id))return;
    used.add(target.id);hits.push({target,damage:Math.max(1,Math.round(damage)),...(zone?{zone}:{})});
  };
  const shape=weaponShotShape(kind);
  if(shape.cone){
    const center=firstRay||trace(angle);
    if(!center?.origin||!Number.isFinite(center.length))return {rays,hits,impact:null};
    rays.push({...center,angle:center.angle??angle});
    const ray={...center.origin,angle,slope:center.slope};
    const candidates=targets.filter(t=>!t.stunned).map(target=>({
      target,contact:coneContact(ray,target,shape.cone,weapon.range,.19)
    })).filter(t=>t.contact).sort((a,b)=>a.contact.distance-b.contact.distance);
    if(center.hit)add(center.hit,weaponDamageAt(kind,center.length));
    for(const {target,contact} of candidates){
      if(used.has(target.id)||!target.id||hits.length>=shape.limit)continue;
      const bearing=radians(center.origin,target),path=trace(bearing,target);
      if(path?.hit?.id===target.id)add(target,weaponDamageAt(kind,contact.distance)*contact.weight);
    }
    return {rays,hits,impact:null};
  }
  for(const spread of shape.spreads){
    const direction=angle+spread;
    const result=(spread===0&&firstRay)||trace(direction);
    if(!result?.origin||!Number.isFinite(result.length))continue;
    const ray={...result,angle:result.angle??direction};rays.push(ray);
    add(ray.hit,weaponDamageAt(kind,ray.length),ray.zone);
  }
  if(kind==='chime'&&rays.length){
    const length=Math.max(...rays.map(r=>r.length));
    rays.splice(1);rays[0]={...rays[0],length};
  }
  const mode=shape,primary=rays[0];
  if(!(mode.area||mode.chain)||!primary)return {rays,hits,impact:null};
  let origin=tip(primary),sourceId=primary.hit?.id;
  // Start visibility just outside the sampled impact surface, on the incoming side.
  const splashSight=isHeavyShot(kind)&&primary.surface?tip({...primary,length:Math.max(0,primary.length-.35)}):null;
  const impact=mode.area?{...origin,radius:mode.area}:null;
  if(impact&&isHeavyShot(kind)&&primary.hit?.hitKind==='vehicle')impact.directId=primary.hit.id;
  if(impact&&isHeavyShot(kind)&&!primary.hit&&primary.surface===true&&typeof visible==='function'){
    const touching=targets.filter(target=>touchesVehicleBlast(target,origin)&&
      (!Number.isFinite(primary.origin.z)||!Number.isFinite(target.z)||Math.abs(primary.origin.z+primary.slope*primary.length-target.z)<1.45))
      .sort((a,b)=>distance(origin,a)-distance(origin,b));
    const contact=touching.find(target=>visible(splashSight||origin,target,sourceId));
    if(contact){impact.directId=contact.id;add(contact,weaponDamageAt(kind,primary.length));}
  }
  if(typeof visible!=='function'||(mode.chain&&!primary.hit))return {rays,hits,impact};
  for(let i=0;i<mode.limit;i++){
    const reach=mode.area||mode.chain;
    const options=targets.filter(t=>!used.has(t.id)&&!t.stunned&&Number.isFinite(t.x+t.y))
      .map(target=>({target,d:distance(origin,target)})).filter(r=>r.d<=reach)
      .sort((a,b)=>a.d-b.d||String(a.target.id).localeCompare(String(b.target.id)));
    const next=options.find(r=>visible(splashSight||origin,r.target,sourceId));
    if(!next)break;
    add(next.target,weapon.damage*(mode.area?1-.6*next.d/reach:Math.pow(.78,i+1)));
    if(mode.chain){
      rays.push({origin:{...origin},angle:radians(origin,next.target),length:next.d,hit:next.target});
      origin={x:next.target.x,y:next.target.y};sourceId=next.target.id;
    }
  }
  return {rays,hits,impact};
}
