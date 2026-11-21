import {alongRail,railDistance,railSections,railXY} from './enfer-rail.js';

const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
export function createRailCrossings(streets,overpass){
  const sites=[];
  for(const road of streets){
    if(road.level!==0||road.bridge||road.kind==='motorway'||road.kind==='path'||road.w<3.2)continue;
    for(let i=1;i<road.path.length;i++){
      const [a,b]=[road.path[i-1],road.path[i]],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      const minX=Math.min(a[0],b[0])-4,maxX=Math.max(a[0],b[0])+4;
      const minY=Math.min(a[1],b[1])-4,maxY=Math.max(a[1],b[1])+4;
      if(length<.3||maxX< -370||minX>1490||maxY<245||minY>1320)continue;
      for(const segment of railSections){
        if(segment.x<minX||segment.x>maxX||segment.y<minY||segment.y>maxY)continue;
        const [x,y]=railXY(segment.start),[u,v]=railXY(segment.end),rx=u-x,ry=v-y;
        const denominator=cross(dx,dy,rx,ry),sin=Math.abs(denominator)/(length*Math.hypot(rx,ry));
        if(sin<.34)continue;
        const r=cross(x-a[0],y-a[1],rx,ry)/denominator,t=cross(x-a[0],y-a[1],dx,dy)/denominator;
        if(r<0||r>1||t<0||t>1)continue;
        const px=a[0]+dx*r,py=a[1]+dy*r;
        if(overpass(road,i-1,px,py)||sites.some(q=>Math.hypot(q.x-px,q.y-py)<9))continue;
        const angle=Math.atan2(dy,dx),width=Math.max(4.4,road.w+.7),offset=3.82/sin+2.7;
        const gates=[-1,1].map(side=>({x:px+dx/length*offset*side,y:py+dy/length*offset*side,angle:angle+side*Math.PI/2,width}));
        const deckHalfLength=3.7/sin+.65,deckHalfWidth=road.w*.5+.05;
        const deck=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([front,side])=>[
          px+(dx*front*deckHalfLength-dy*side*deckHalfWidth)/length,
          py+(dy*front*deckHalfLength+dx*side*deckHalfWidth)/length
        ]);
        sites.push({id:'rail-gate-'+sites.length,x:px,y:py,d:railDistance(px,py),
          deck,railDeckRadius:deckHalfWidth/sin+3.4,gates});
      }
    }
  }
  return sites;
}

export function crossingSignal(site,trains){
  let warning=false,close=false;
  for(const train of trains){
    const ahead=alongRail(train.d,site.d,train.direction),behind=alongRail(site.d,train.d,train.direction);
    const approach=Math.max(20,(train.speed||0)*5.8);
    if(ahead<approach||behind<17)warning=true;
    if(ahead<Math.max(14,approach-12)||behind<15)close=true;
  }
  return {warning,close};
}

export function crossingBarriers(site){
  return site.gates.map((g,i)=>({...g,id:site.id+'-'+i,halfWidth:.18,halfLength:g.width*.5,h:1.36,
    lift:0,vx:0,vy:0,railGate:true}));
}
