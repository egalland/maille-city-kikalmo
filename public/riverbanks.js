const cellSize=24,bankWidth=7;
const key=(x,y)=>Math.floor(x/cellSize)+Math.floor(y/cellSize)*16384;

export function riverbanks(waters,baseTerrainHeight,waterLevel){
  const areas=waters.filter(w=>w.poly?.length>=3);
  const cells=new Map();
  for(const water of areas){
    const level=waterLevel(water);
    for(const ring of [water.poly,...(water.holes||[])]){
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length];
        const dx=b[0]-a[0],dy=b[1]-a[1],square=dx*dx+dy*dy;
        if(square<.001)continue;
        const edge={a,b,dx,dy,square,level};
        const left=Math.floor((Math.min(a[0],b[0])-bankWidth)/cellSize);
        const right=Math.floor((Math.max(a[0],b[0])+bankWidth)/cellSize);
        const top=Math.floor((Math.min(a[1],b[1])-bankWidth)/cellSize);
        const bottom=Math.floor((Math.max(a[1],b[1])+bankWidth)/cellSize);
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
          const id=x+y*16384;
          if(!cells.has(id))cells.set(id,[]);
          cells.get(id).push(edge);
        }
      }
    }
  }
  function ground(x,y){
    const original=baseTerrainHeight(x,y);
    const near=cells.get(key(x,y));
    if(!near)return original;
    let distance=bankWidth,level;
    for(const {a,dx,dy,square,level:height} of near){
      const t=Math.min(1,Math.max(0,((x-a[0])*dx+(y-a[1])*dy)/square));
      const d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
      if(d<distance){distance=d;level=height;}
    }
    if(level===undefined||original<=level+.20)return original;
    const ratio=distance/bankWidth,blend=ratio*ratio*(3-2*ratio);
    return level+.20+(original-level-.20)*blend;
  }
  return {ground};
}
