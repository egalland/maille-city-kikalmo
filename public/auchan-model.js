import {auchanEntrance,auchanFrame,auchanFront,auchanMain} from './auchan-layout.js';
import {containsPoint} from './collision-ring.js';

const brick='#934f3d',shade='#744234',silver='#c0bdb1',red='#9a3637',trim='#672729',dark='#646367';
const white='#ffffff';
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const secondaryEdge=22;

export function auchanModel(building,store,ground,detail){
  const {poly,h,baseElevation:base}=building,main=String(building.id)===auchanMain,faces=[];
  const add=(p,color,mat='felt',uv)=>faces.push({p,color,mat,uv});
  const lift=(p,y)=>[p[0],y,p[1]];
  function wall(a,b,bottomA,bottomB,top,color,mat='felt'){
    if(length(a,b)<.03||Math.min(bottomA,bottomB)>=top)return;
    const u=length(a,b)/2.3;
    add([lift(a,bottomA),lift(b,bottomB),lift(b,top),lift(a,top)],color,mat,[[0,bottomA/2.3],[u,bottomB/2.3],[u,top/2.3],[0,top/2.3]]);
  }
  function baseWall(a,b,top){
    const lower=p=>Math.min(-.14,ground(...p)-base-.19);
    wall(a,b,lower(a),lower(b),top,brick,detail?'auchanBrick':'felt');
  }
  const openings=main&&store?store.display:null,skirt=Math.min(h-.65,4.75);
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    if(openings&&i===auchanEntrance.edge){
      const [left,right]=openings.slice().sort((u,v)=>length(a,u)-length(a,v));
      baseWall(a,left,skirt);baseWall(right,b,skirt);
      wall(left,right,store.headroom,store.headroom,skirt,brick,'auchanBrick');
    }else baseWall(a,b,skirt);
    wall(a,b,skirt,skirt,h,silver,detail?'auchanMetal':'felt');
  }
  faces.push({ring:poly,height:h,color:dark,mat:'felt'});
  if(!main)return faces;

  function frameFace(frame,points,color,mat='felt',uv){
    add(points.map(([u,v,y])=>lift(frame.point(u,v),y)),color,mat,uv);
  }
  function rail(frame,left,right,depth,low,high,color){
    frameFace(frame,[[left,depth,low],[right,depth,low],[right,depth,high],[left,depth,high]],color);
  }
  const glazed='#42616a',glassDark='#344a55';
  function porch(frame,door){
    const w=4.05,depth=3.32,eave=4.12,ridge=6.50;
    for(const side of [-1,1]){
      const edge=w*side;
      frameFace(frame,[[0,.12,ridge],[edge,.12,eave],[edge,-depth-.26,eave],[0,-depth-.26,ridge]],red);
      frameFace(frame,[[edge,-depth-.33,eave-.13],[0,-depth-.33,ridge-.13],[0,-depth-.33,ridge+.07],[edge,-depth-.33,eave+.07]],trim);
      frameFace(frame,[[edge,0,.1],[edge,-depth,.1],[edge,-depth,eave],[edge,0,eave]],glassDark,'glass');
      for(const v of [-depth,-2.08,-.88,-.06]){
        frameFace(frame,[[edge+.035,v-.045,.02],[edge+.035,v+.045,.02],
          [edge+.035,v+.045,eave],[edge+.035,v-.045,eave]],red);
      }
      if(detail)for(let u=.34;u<w-.12;u+=.33){
        const y=ridge-(ridge-eave)*u/w;
        frameFace(frame,[[side*u,.12,y+.018],[side*(u+.035),.12,y],[side*(u+.035),-depth-.26,y],[side*u,-depth-.26,y+.018]],'#b04945');
      }
    }
    const face=-depth;
    frameFace(frame,[[-w,face,eave],[0,face,ridge-.12],[w,face,eave]],glassDark,'glass');
    for(const [l,r] of door?[[-w,-1.43],[1.43,w]]:[[-w,w]])rail(frame,l,r,face,.06,eave,glazed);
    rail(frame,-w,w,face-.02,door?3.72:2.46,4.24,red);
    rail(frame,-w,w,face-.015,2.34,2.47,red);
    for(const u of [-w,-2.66,-1.43,1.43,2.66,w]){
      rail(frame,u-.06,u+.06,face-.06,0,eave+.10,red);
    }
    rail(frame,-.07,.07,face-.047,eave,ridge-.15,red);
    // The open door occupies the central bay; keep its transom above standing height.
    if(door)rail(frame,-1.50,1.50,face-.05,store.headroom,store.headroom+.13,red);
  }

  for(const i of [4,5,14,22,34]){
    const a=poly[i],b=poly[i+1],len=length(a,b),frame=auchanFrame(a,b);
    const center=i===14?len*(auchanEntrance.fraction-.5):0;
    const withPorch=i===14||i===secondaryEdge;
    const limit=len*.5-.14;
    for(const [l,r] of withPorch?[[-limit,center-4.1],[center+4.1,limit]]:[[-limit,limit]]){
      if(r-l<.45)continue;
      frameFace(frame,[[l,-.025,4.70],[r,-.025,4.70],[r,-1.72,3.64],[l,-1.72,3.64]],red);
      rail(frame,l,r,-1.73,3.56,3.68,trim);
      if(detail)for(let u=l+.13;u<r-.06;u+=.325){
        frameFace(frame,[[u,-.055,4.71],[u+.038,-.055,4.71],[u+.038,-1.72,3.67],[u,-1.72,3.67]],'#b04e46');
      }
      for(let u=l+.38;u<r;u+=7.65){
        rail(frame,u-.12,u+.12,-.13,0,4.65,shade);
      }
    }
  }
  if(store)porch(auchanFront,true);
  porch(auchanFrame(poly[secondaryEdge],poly[secondaryEdge+1]),false);

  const sign=auchanFront,front=.63,half=9.25,bottom=h+.33,top=h+3.20;
  const uv=[[0,0],[1,0],[1,1],[0,1]];
  for(const at of [-half+.5,-half*.56,0,half*.56,half-.35]){
    rail(sign,at-.055,at+.055,front+.12,h-.12,top-.22,'#aaa59e');
  }
  rail(sign,-half,half,front+.14,h+.30,h+.41,'#aaa59e');
  rail(sign,-half,half,front+.14,h+1.58,h+1.68,'#aaa59e');
  frameFace(sign,[[-half,front,bottom],[half,front,bottom],[half,front,top],[-half,front,top]],white,'auchanLetters',uv);
  if(detail){
    for(const [u,v] of [[-25,11],[-11,14],[5,16],[19,14],[31,11],[38,24],[-11,38],[17,38]]){
      const corners=[[-2,-1],[2,-1],[2,1],[-2,1]].map(([a,b])=>sign.point(u+a,v+b));
      if(!corners.every(p=>containsPoint(p[0],p[1],poly)))continue;
      frameFace(sign,[[u-2,v-1,h+.045],[u+2,v-1,h+.045],[u+2,v,h+.61],[u-2,v,h+.61]],'#a79789');
      frameFace(sign,[[u-2,v,h+.61],[u+2,v,h+.61],[u+2,v+1,h+.045],[u-2,v+1,h+.045]],'#b6aa9c');
    }
  }
  return faces;
}

export function paintAuchanLetters(c,w,h){
  c.save();
  c.scale(w/800,h/122);
  c.font='900 137px Arial Black, Arial, sans-serif';
  const width=c.measureText('Auchan').width;
  if(width>0)c.scale(770/width,1);
  c.textBaseline='alphabetic';c.lineJoin='round';
  c.lineWidth=2.8;c.strokeStyle='#713031';c.strokeText('Auchan',11,109,775);
  c.fillStyle='#bc403b';c.fillText('Auchan',11,109,775);
  c.beginPath();
  c.moveTo(9,53);c.lineTo(75,46);c.lineTo(100,24);
  c.quadraticCurveTo(122,13,143,32);c.lineTo(154,35);c.lineTo(143,40);
  c.quadraticCurveTo(144,64,112,73);c.lineTo(125,105);c.lineTo(115,107);
  c.lineTo(101,75);c.lineTo(90,74);c.lineTo(102,107);c.lineTo(92,108);
  c.lineTo(78,75);c.lineTo(13,77);c.closePath();
  c.fillStyle='#337860';c.fill();c.strokeStyle='#e0c4a6';c.lineWidth=2;c.stroke();
  c.beginPath();c.arc(131,32,3,0,Math.PI*2);c.fillStyle='#f6e8ce';c.fill();
  c.restore();
}
