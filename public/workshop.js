// This door, its lintel and the collision opening use the same surveyed façade.
export const workshopId='317660742';
export const workshopEdge=9;
export const headroom=3.12;
export function bayDoor(poly){
  const a=poly[workshopEdge],b=poly[workshopEdge+1];
  const left=a.map((x,i)=>x+(b[i]-x)*.27),right=a.map((x,i)=>x+(b[i]-x)*.73);
  return {left,right};
}
export function workshopColliders(building){
  const {poly}=building,{left,right}=bayDoor(poly);
  const walls=[];
  function wall(a,b){
    const dx=b[0]-a[0],dy=b[1]-a[1],k=.13/Math.hypot(dx,dy);
    const ring=[[a[0]-dy*k,a[1]+dx*k],[b[0]-dy*k,b[1]+dx*k],[b[0]+dy*k,b[1]-dx*k],[a[0]+dy*k,a[1]-dx*k]];
    walls.push({type:'building',id:workshopId+'-wall-'+walls.length,poly:ring,h:building.h});
  }
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    if(i===workshopEdge){wall(a,left);wall(right,b);}else wall(a,b);
  }
  return [...walls,{...building,type:'building',minHeight:headroom}];
}
