export const auchanMain='317656059';
export const auchanParts=new Map([
  [auchanMain,7.45],['317656056',7.1],['317656058',6.2],['317656060',5.05],
  ['317656061',8.55],['317656062',8.1],['2494154257',5.8]
]);
export const auchanEntrance={edge:14,a:[-1703.7,1147.3],b:[-1696.1,1129.5],fraction:.27};

export function auchanFrame(a,b,fraction=.5){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const x=a[0]+dx*fraction,y=a[1]+dy*fraction,angle=Math.atan2(dy,dx)-Math.PI/2;
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x,y,angle,point:(u,v)=>[x-s*u+c*v,y+c*u+s*v]};
}
const door=auchanFrame(auchanEntrance.a,auchanEntrance.b,auchanEntrance.fraction);
export const auchanFront=door;
const fade=t=>{
  const k=Math.max(0,Math.min(1,t));
  return k*k*(3-2*k);
};

export function auchanGrade(x,y,raw,floor){
  const dx=x-door.x,dy=y-door.y;
  if(dx*dx+dy*dy>50*50)return raw;
  const c=Math.cos(door.angle),s=Math.sin(door.angle),along=dx*c+dy*s,across=dy*c-dx*s;
  const weight=fade((26-Math.abs(across))/8)*fade((along+11)/7)*fade((34-along)/9);
  return raw+(floor-raw)*weight;
}

export const auchanApron=[[-13,-7],[15,-7],[15,.06],[-13,.06]].map(p=>door.point(...p));

export function auchanVestibuleColliders(baseElevation){
  const panels=[[-4.10,-3.98,-3.4,.02],[3.98,4.10,-3.4,.02],
    [-4.10,-1.43,-3.38,-3.26],[1.43,4.10,-3.38,-3.26]];
  return panels.map(([l,r,a,b],i)=>({
    id:'auchan-porche-'+i,type:'building',h:4.12,baseElevation,
    poly:[[l,a],[r,a],[r,b],[l,b]].map(p=>door.point(...p))
  }));
}
