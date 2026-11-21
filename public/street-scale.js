// Metres beyond each surveyed edge of the carriageway.
export function streetVerge(road){
  if(road.kind==='path'||road.kind==='motorway')return 0;
  if(road.bridge||road.builtUp===undefined)return Math.min(3,road.w*.30);
  if(!road.builtUp)return .65;
  if(road.w<4.8)return 1.55;
  if(road.w<7)return 1.8;
  return 2.2;
}

export function pavedStreetWidth(road){
  return road.w+2*streetVerge(road);
}

export function streetHasCentreMarking(road){
  return road.kind!=='path'&&(!road.bridge||road.w>9)&&road.w>=(road.oneway?5.8:5.5);
}

export function pedestrianStreetOffset(road){
  return road.kind==='path'?0:road.w*.5+streetVerge(road)*.53;
}

export function assignBuiltUpStreets(streets,buildings){
  const cellSize=42,cells=new Map();
  const key=(x,y)=>x+','+y;
  for(const {poly,h,kind} of buildings){
    if(h<3.8||!['residential','mixed','commercial'].includes(kind))continue;
    let x=0,y=0;
    for(const point of poly){x+=point[0];y+=point[1];}
    x/=poly.length;y/=poly.length;
    const id=key(Math.floor(x/cellSize),Math.floor(y/cellSize));
    if(!cells.has(id))cells.set(id,[]);
    cells.get(id).push([x,y]);
  }
  function settled(x,y){
    const col=Math.floor(x/cellSize),row=Math.floor(y/cellSize);
    let count=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      for(const [bx,by] of cells.get(key(col+dx,row+dy))||[]){
        if((bx-x)**2+(by-y)**2<cellSize**2&&++count>=2)return true;
      }
    }
    return false;
  }
  for(const road of streets){
    let length=0,built=0;
    for(let i=1;i<road.path.length;i++){
      const [x,y]=road.path[i-1],[u,v]=road.path[i];
      const span=Math.hypot(u-x,v-y),samples=Math.ceil(span/cellSize);
      if(!samples)continue;
      length+=span;
      for(let j=0;j<samples;j++){
        const t=(j+.5)/samples;
        if(settled(x+(u-x)*t,y+(v-y)*t))built+=span/samples;
      }
    }
    road.builtUp=length>0&&built>=length*.5;
  }
}
