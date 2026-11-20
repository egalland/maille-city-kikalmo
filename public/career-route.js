// Route on surveyed street geometry. One-way legs and curved centre lines use the same
// street data as ambient traffic. Destination pins stay useful outside the road graph.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cell=90;
export function makeCareerRouter(streets){
  const vertices=new Map(),grid=new Map();
  function vertex([x,y]){
    const key=x+','+y;
    if(!vertices.has(key))vertices.set(key,{x,y,edges:[]});
    return vertices.get(key);
  }
  const gridKey=(i,j)=>i+','+j;
  for(const road of streets){
    if(road.kind==='path'||road.w<3)continue;
    for(let i=1;i<road.path.length;i++){
      const a=vertex(road.path[i-1]),b=vertex(road.path[i]),length=distance(a,b);
      if(!length)continue;
      const segment={a,b,length,oneway:road.oneway||0};
      if(segment.oneway!==-1)a.edges.push([b,length]);
      if(segment.oneway!==1)b.edges.push([a,length]);
      for(let x=Math.floor(Math.min(a.x,b.x)/cell);x<=Math.floor(Math.max(a.x,b.x)/cell);x++){
        for(let y=Math.floor(Math.min(a.y,b.y)/cell);y<=Math.floor(Math.max(a.y,b.y)/cell);y++){
          const key=gridKey(x,y);
          if(!grid.has(key))grid.set(key,[]);
          grid.get(key).push(segment);
        }
      }
    }
  }
  function snap(pos){
    const gx=Math.floor(pos.x/cell),gy=Math.floor(pos.y/cell);
    let best=110,hit=null;
    for(let x=gx-2;x<=gx+2;x++)for(let y=gy-2;y<=gy+2;y++){
      for(const s of grid.get(gridKey(x,y))||[]){
        const {a,b,length}=s,dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.min(1,Math.max(0,((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(length*length)));
        const point={x:a.x+dx*t,y:a.y+dy*t};
        const d=distance(pos,point);
        if(d<best){best=d;hit={...point,t,s};}
      }
    }
    return hit;
  }
  return function route(origin,target){
    const start=snap(origin),end=snap(target);
    if(!start||!end)return [];
    if(start.s===end.s&&(!start.s.oneway||start.s.oneway*(end.t-start.t)>=0))return [start,end];
    const queue=[],best=new Map(),via=new Map();
    function offer(point,cost,prev){
      if(cost>=(best.get(point)??Infinity))return;
      best.set(point,cost);via.set(point,prev);
      const priority=cost+distance(point,end);
      let lo=0,hi=queue.length;
      while(lo<hi){const mid=(lo+hi)>>1;if(queue[mid].priority>priority)lo=mid+1;else hi=mid;}
      queue.splice(lo,0,{point,cost,priority});
    }
    if(start.s.oneway!==1)offer(start.s.a,start.s.length*start.t,start);
    if(start.s.oneway!==-1)offer(start.s.b,start.s.length*(1-start.t),start);
    while(queue.length){
      const {point,cost}=queue.pop();
      if(cost!==best.get(point))continue;
      if(point===end){const path=[];for(let v=end;v;v=via.get(v))path.push({x:v.x,y:v.y});return path.reverse();}
      if((point===end.s.a&&end.s.oneway!==-1)||(point===end.s.b&&end.s.oneway!==1))offer(end,cost+distance(point,end),point);
      for(const [next,length] of point.edges)offer(next,cost+length,point);
    }
    return [];
  };
}
