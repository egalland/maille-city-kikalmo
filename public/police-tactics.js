const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));

// Fit the stopped van in one lane, leaving a drivable corridor on its left.
export function roadblockSite(report,roads,spec,clear){
  const heading=Number.isFinite(report.angle)?report.angle:0;
  const lead={x:report.x+Math.cos(heading)*53,y:report.y+Math.sin(heading)*53};
  let best=null,cost=Infinity;
  for(const road of roads){
    if(road.oneway||road.bridge||road.w<6.6||road.kind==='path')continue;
    for(let i=1;i<road.path.length;i++){
      const [x,y]=road.path[i-1],[bx,by]=road.path[i],length=Math.hypot(bx-x,by-y);
      if(length<spec.halfLength*2+2)continue;
      let dx=(bx-x)/length,dy=(by-y)/length;
      const margin=spec.halfLength+1,t=clamp((lead.x-x)*dx+(lead.y-y)*dy,margin,length-margin);
      const cx=x+t*dx,cy=y+t*dy;
      if(dx*Math.cos(heading)+dy*Math.sin(heading)<0){dx=-dx;dy=-dy;}
      const side=road.w*.5-spec.halfWidth-.36;
      const park={x:cx-dy*side,y:cy+dx*side,angle:Math.atan2(dy,dx)};
      const ahead=(cx-report.x)*Math.cos(heading)+(cy-report.y)*Math.sin(heading);
      if(ahead<18||gap(report,park)>90)continue;
      const score=gap(park,lead);
      if(score>=cost||!clear(park,spec))continue;
      const escape={x:cx+dy*road.w*.24,y:cy-dx*road.w*.24,angle:park.angle};
      if(!clear(escape,{halfLength:2.2,halfWidth:1.12}))continue;
      best=park;cost=score;
    }
  }
  return best;
}

// Probe only a few positions every few seconds. Both shelter and its adjacent
// firing position must exist in the collision geometry at the reported location.
export function findOfficerCover(officer,threat,walkable,visible){
  if(!officer||gap(officer,threat)<7||gap(officer,threat)>33)return null;
  const axis=Math.atan2(threat.y-officer.y,threat.x-officer.x);
  for(const radius of [1.6,3.8,6.2])for(const turn of [-1.42,1.42,-2.25,2.25,Math.PI,0]){
    const angle=axis+turn;
    const shelter={x:officer.x+radius*Math.cos(angle),y:officer.y+radius*Math.sin(angle),motion:'crouch'};
    if(!walkable(shelter)||visible(threat,shelter))continue;
    for(const side of [-1,1])for(const step of [1.25,2.5]){
      const peek={x:shelter.x-side*Math.sin(axis)*step,y:shelter.y+side*Math.cos(axis)*step};
      const midpoint={x:(peek.x+shelter.x)/2,y:(peek.y+shelter.y)/2};
      if(walkable(midpoint)&&walkable(peek)&&visible(threat,peek))return {shelter,peek};
    }
  }
  return null;
}
