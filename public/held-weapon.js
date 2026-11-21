import {weaponCatalog} from './weapon-catalog.js';
import {vehicleSpec} from './vehicle-types.js';
import {isAircraft} from './airfield.js';

const shapes={
  pistol:[.235,.084,false],smg:[.365,.100,true],shotgun:[.486,.077,true],
  yarn:[.302,.088,false],ribbonbow:[.467,.088,true],pompom:[.404,.136,true],
  confetti:[.408,.146,true],boomerang:[.198,.116,false],bubbles:[.298,.126,false],
  spool:[.272,.154,false],star:[.283,.149,false],chime:[.258,.164,false],
  needle:[.516,.092,true],shuttle:[.399,.092,true],button:[.346,.101,true],spark:[.359,.090,true],
  service:[.262,.078,false],marksman:[.483,.106,true],rocket:[.61,.176,true]
};
const bound=value=>Math.max(0,Math.min(1,value));

export function heldWeapon(pose){
  const kind=pose.kit?.arm||pose.weapon;
  if(!Object.hasOwn(shapes,kind)||pose.stunned||pose.down||pose.ragdoll||pose.melee||['climb','vault','swim'].includes(pose.motion))return null;
  if(pose.emote&&!pose.fire&&!pose.aiming&&!pose.engaged)return null;
  return kind;
}

// Local metres, facing +X, with the actor's right hand on +Z. The rig,
// weapon model and both renderers share the hand and barrel coordinates.
export function weaponPose(kind,pose){
  const [length,bulk,twoHanded]=shapes[kind],shot=bound(pose.fire||0);
  const recoil=shot**3*(kind==='shotgun'?.10:kind==='smg'?.043:.065);
  const ready=pose.aiming||pose.engaged?1:Math.min(1,shot*3.6);
  const loading=Number.isFinite(pose.reload)?Math.sin(Math.PI*bound(pose.reload)):0;
  const pitch=-.78*(1-ready)+4.2*recoil-.57*loading+(pose.aimElevation||0)*ready;
  const c=Math.cos(pitch),s=Math.sin(pitch);
  const grip=[.158+ready*.159-recoil-.074*loading,.675+ready*.212+.55*recoil+.051*loading,.218-.058*ready];
  function point(forward,up,side=0){
    return [grip[0]+forward*c-up*s,grip[1]+forward*s+up*c,grip[2]+side];
  }
  const cycle=kind==='shotgun'?.066*shot**2:['pistol','smg','service','marksman'].includes(kind)?.04*shot**4:0;
  return {length,bulk,twoHanded,grip,pitch,cycle,muzzle:point(length,.056),
    support:point(twoHanded?.088-(kind==='shotgun'?cycle*.55:0):.014,-.039,-.052),supporting:twoHanded||ready>.72||loading>.15,
    palette:weaponCatalog[kind].palette};
}

export function shotMuzzle(kind,actor,angle){
  if(actor.isCar||actor.vehicle){
    const vehicle=actor.vehicle||actor, spec=vehicleSpec(vehicle.type);
    const heading=vehicle.angle??actor.angle??angle;
    if(vehicle.type==='tank')return {x:actor.x+Math.cos(angle)*3.05-Math.cos(heading)*.55,
      y:actor.y+Math.sin(angle)*3.05-Math.sin(heading)*.55,height:1.93+(actor.lift||0),aircraft:false};
    const side=Math.sin(angle-heading)>.05?1:-1;
    const width=(vehicle.type==='airship'?.76:spec.halfWidth)+(spec.openSeat?.01:.09);
    const forward=vehicle.type==='bus'?3.55:spec.seatOffset;
    const c=Math.cos(heading),s=Math.sin(heading);
    const windowHeight=vehicle.type==='airship'?1.11:vehicle.type==='helicopter'?1.33:
      spec.openSeat?.90:Math.min(spec.height*.77,1.91);
    return {x:actor.x+c*forward-s*side*width,y:actor.y+s*forward+c*side*width,
      height:windowHeight+(actor.lift||0),aircraft:isAircraft(vehicle.type)};
  }
  const {muzzle:[forward,up,side]}=weaponPose(kind,actor),c=Math.cos(angle),s=Math.sin(angle);
  return {x:actor.x+c*forward-s*side,y:actor.y+s*forward+c*side,height:(actor.lift||0)+up};
}

export function renderShotRay(ray,muzzle){
  const dx=ray.x+Math.cos(ray.angle)*ray.length-muzzle.x;
  const dy=ray.y+Math.sin(ray.angle)*ray.length-muzzle.y;
  const along=dx*Math.cos(ray.angle)+dy*Math.sin(ray.angle);
  return {...muzzle,angle:along<=0?ray.angle:Math.atan2(dy,dx),length:along<=0?0:Math.hypot(dx,dy)};
}
