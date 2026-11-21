const zones=['legs','body','head'];
export const isHitZone=zone=>zones.includes(zone);
export function npcWeaponDamage(amount,type,zone){
  if(zone==='legs')return Math.max(1,Math.round(amount*.62));
  if(zone==='head'){
    if(type==='swat'||type==='firefighter')return Math.max(1,Math.round(amount*.46));
    return 100;
  }
  return amount;
}
export function reticleDepth(eye,angle,targets,impact){
  const person=impact.hit?.hitKind==='npc'||impact.hit?.hitKind==='peer';
  if(impact.hit)return Math.max(.3,impact.length+(person?.11:0));
  const c=Math.cos(angle),s=Math.sin(angle);
  let depth=impact.surface?impact.length:Math.min(32,impact.length);
  // When the crosshair sits just above or below a nearby figure, use its
  // depth to correct the offset between the chase camera and the weapon.
  for(const target of targets){
    const x=target.x-eye.x,y=target.y-eye.y,along=x*c+y*s,side=Math.abs(y*c-x*s);
    if(along>.4&&along<depth&&side<(target.r||.4)+.19)depth=along;
  }
  return Math.max(.3,depth);
}

function slab(at,velocity,lo,hi){
  if(Math.abs(velocity)<1e-7)return at>=lo&&at<=hi?[-Infinity,Infinity]:[Infinity,-Infinity];
  const a=(lo-at)/velocity,b=(hi-at)/velocity;
  return [Math.min(a,b),Math.max(a,b)];
}

// Distances are measured horizontally so the existing range, spreads and
// network representation also work for tilted shots.
export function traceElevated(origin,angle,slope,range,targets,ground,contact){
  const dx=Math.cos(angle),dy=Math.sin(angle);
  let hit=null,length=range,zone;
  const intersect=(span,bottom,top,name,target)=>{
    const [low,high]=slab(origin.z,slope,bottom,top);
    const near=Math.max(.025,span[0],low),far=Math.min(length,span[1],high);
    if(near<=far&&near<length){length=near;hit=target;zone=name;}
  };
  for(const target of targets){
    const ox=origin.x-target.x,oy=origin.y-target.y;
    const base=ground(target.x,target.y)+(target.lift||0);
    if(target.isCar&&target.halfLength&&target.halfWidth){
      const c=Math.cos(target.angle||0),s=Math.sin(target.angle||0);
      const [a,b]=slab(ox*c+oy*s,dx*c+dy*s,-target.halfLength,target.halfLength);
      const [l,r]=slab(-ox*s+oy*c,-dx*s+dy*c,-target.halfWidth,target.halfWidth);
      intersect([Math.max(a,l),Math.min(b,r)],base,base+(target.bodyHeight||1.5),undefined,target);
      continue;
    }
    const front=-ox*dx-oy*dy,side=ox*dy-oy*dx;
    const column=(radius,lo,hi,name)=>{
      if(Math.abs(side)>radius)return;
      const half=Math.sqrt(radius*radius-side*side);
      intersect([front-half,front+half],base+lo,base+hi,name,target);
    };
    if(target.hitKind==='prop'){column(target.r||.4,0,target.h||1.25);continue;}
    const crouch=target.motion==='crouch'?.72:1;
    column(.23,.04,.66*crouch,'legs');
    column(.35,.66*crouch,1.29*crouch,'body');
    column(.23,1.29*crouch,1.67*crouch,'head');
  }
  let surface=null;
  for(let d=0;d<length;d+=.19){
    const x=origin.x+dx*d,y=origin.y+dy*d,z=origin.z+slope*d;
    if(z<ground(x,y)+.02){surface=true;hit=null;zone=undefined;length=d;break;}
    const obstruction=contact(x,y,z,hit?.id);
    if(!obstruction)continue;
    hit=targets.find(target=>target.id===obstruction.id)||null;
    surface=obstruction;zone=undefined;length=d;break;
  }
  return {origin,angle,length,hit,zone,slope,surface};
}
