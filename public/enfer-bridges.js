// The IGN level field identifies surface crossings even when the road has no name.
const cells=new Map(),cell=32;
export function selectBridgeDecks(streets,water,ground){
  cells.clear();
  const bounds=water.map(w=>({w,left:Math.min(...w.poly.map(p=>p[0])),right:Math.max(...w.poly.map(p=>p[0])),
    top:Math.min(...w.poly.map(p=>p[1])),bottom:Math.max(...w.poly.map(p=>p[1]))}));
  for(const road of streets){
    if(!road.bridge)continue;
    const profile=road.deck||[];
    const ends=road.path.map(([x,y])=>{
      let closest=null,distance=21;
      for(const [u,v,z] of profile){
        const d=Math.hypot(u-x,v-y);
        if(d<distance){closest=z;distance=d;}
      }
      const wet=bounds.find(({w,left,right,top,bottom})=>x>=left&&x<=right&&y>=top&&y<=bottom&&inside(x,y,w.poly)&&!w.holes?.some(h=>inside(x,y,h)));
      return Math.max(closest??ground(x,y),wet?.w.elevation==null?-Infinity:wet.w.elevation+2.4);
    });
    for(let i=1;i<road.path.length;i++){
      const a=road.path[i-1],b=road.path[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
      if(len2<.01)continue;
      const r=road.w*.5+2.35,segment={a,dx,dy,len2,r,z0:ends[i-1],z1:ends[i]};
      for(let x=Math.floor((Math.min(a[0],b[0])-r)/cell);x<=Math.floor((Math.max(a[0],b[0])+r)/cell);x++)
        for(let y=Math.floor((Math.min(a[1],b[1])-r)/cell);y<=Math.floor((Math.max(a[1],b[1])+r)/cell);y++){
          const key=x+4096*y;
          if(!cells.has(key))cells.set(key,[]);
          cells.get(key).push(segment);
        }
    }
  }
}
function inside(x,y,ring){
  let yes=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
}
export function bridgeGround(x,y,base){
  const here=cells.get(Math.floor(x/cell)+4096*Math.floor(y/cell));
  if(!here)return base;
  let limit=.9999,z=base;
  for(const {a,dx,dy,len2,r,z0,z1} of here){
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len2));
    const d=Math.hypot(a[0]+dx*t-x,a[1]+dy*t-y)/r;
    if(d>=limit)continue;
    limit=d;
    const deck=z0+(z1-z0)*t,weight=Math.min(1,(1-d)*8);
    z=base+Math.max(0,deck-base)*weight;
  }
  return z;
}
