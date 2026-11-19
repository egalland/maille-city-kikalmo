// Raised pavement may follow one street only where it clears the carriageway of its neighbours.
function distance(x,y,{a,d}){
  const dx=d[0]-a[0],dy=d[1]-a[1],uu=dx*dx+dy*dy;
  const t=uu?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/uu)):0;
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
}

export function pavementRuns(a,b,offset,half,neighbours){
  if(!neighbours.length)return [[a,b]];
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const nx=-dy/length,ny=dx/length,steps=Math.ceil(length/.43),runs=[];
  const at=t=>[a[0]+dx*t,a[1]+dy*t];
  const clear=t=>{
    const [x,y]=at(t);
    for(const other of neighbours){
      const r=(other.street.w||5)*.5+.04;
      for(const curb of [offset-half,offset,offset+half])
        if(distance(x+nx*curb,y+ny*curb,other)<r)return false;
    }
    return true;
  };
  let was=false,start=0;
  for(let i=0;i<steps;i++){
    const t=i/steps,end=(i+1)/steps,open=clear(t)&&clear((t+end)*.5)&&clear(end);
    if(open&&!was)start=t;
    if(!open&&was)runs.push([at(start),at(t)]);
    was=open;
  }
  if(was)runs.push([at(start),b]);
  return runs.filter(([p,q])=>Math.hypot(p[0]-q[0],p[1]-q[1])>.34);
}
