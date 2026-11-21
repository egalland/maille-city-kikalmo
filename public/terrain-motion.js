// Surface contact is sampled before moving. A rise cannot carry a body up
// by changing its height reference after it has crossed the edge.
export function terrainBarrier(x,y,dx,dy,ground,{grade,step,lift=0,reach=.65}){
  const run=Math.hypot(dx,dy);
  if(run<.0001)return null;
  const nx=dx/run,ny=dy/run,start=ground(x,y);
  const look=Math.max(run,reach);
  for(const d of [run,look]){
    if(ground(x+nx*d,y+ny*d)-start<=lift+Math.max(step,d*grade))continue;
    return {x,y,hit:true,normalX:-nx,normalY:-ny,touched:{id:'steep-ground',type:'terrain'}};
  }
  return null;
}
