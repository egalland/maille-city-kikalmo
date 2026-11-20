// Long river outlines can cover many neighbourhoods. Group their segments into
// horizontal bands while retaining exact vertices, edge tests and hole parity.
const ringIndices=new WeakMap();
const threshold=48,band=48;
function indexFor(ring){
  let index=ringIndices.get(ring);
  if(index)return index;
  index=new Map();
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[i===0?ring.length-1:i-1];
    const lo=Math.floor(Math.min(a[1],b[1])/band),hi=Math.floor(Math.max(a[1],b[1])/band);
    for(let row=lo;row<=hi;row++){
      let edges=index.get(row);if(!edges){edges=[];index.set(row,edges);}edges.push(i);
    }
  }
  ringIndices.set(ring,index);return index;
}
export function containsPoint(x,y,ring){
  const candidates=ring.length>threshold?indexFor(ring).get(Math.floor(y/band)):null;
  if(!candidates&&ring.length>threshold)return false;
  let inside=false;
  for(let k=0,n=candidates?.length??ring.length;k<n;k++){
    const i=candidates?candidates[k]:k,a=ring[i],b=ring[i===0?ring.length-1:i-1];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function edgeContact(ring,left,top,right,bottom,test){
  const index=ring.length>threshold?indexFor(ring):null;
  const first=index?Math.floor(top/band):0,last=index?Math.floor(bottom/band):0;
  for(let row=first;row<=last;row++){
    const edges=index?.get(row);if(index&&!edges)continue;
    for(let k=0,n=edges?.length??ring.length;k<n;k++){
      const i=edges?edges[k]:k,a=ring[i],b=ring[i===0?ring.length-1:i-1];
      if(a[0]<left&&b[0]<left||a[0]>right&&b[0]>right||a[1]<top&&b[1]<top||a[1]>bottom&&b[1]>bottom)continue;
      if(test(a,b))return true;
    }
  }
  return false;
}
