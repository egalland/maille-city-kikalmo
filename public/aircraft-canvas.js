import {vehicleSpec} from './vehicle-types.js';

// Emergency canvas view. Project the same metre-sized features and cabin seats as the meshes.
export function drawCanvasAircraft(ctx,entity,x,y,height,time,bearing){
  const scale=height/vehicleSpec(entity.type).height,s=Math.sin(bearing),c=Math.cos(bearing);
  const paint=entity.wrecked?'#584c49':entity.color||'#78a89e';
  const project=([a,h,b])=>[-s*a+c*b,-h+(c*a+s*b)*.11];
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';
  function path(points,color,width,fill=false){
    ctx.beginPath();
    for(let i=0;i<points.length;i++){const point=project(points[i]);i?ctx.lineTo(...point):ctx.moveTo(...point);}
    if(fill){ctx.closePath();ctx.fillStyle=color;ctx.fill();}
    else{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  }
  function oval(point,l,h,w,color){
    const [u,v]=project(point);ctx.beginPath();ctx.fillStyle=color;
    ctx.ellipse(u,v,Math.hypot(l*s,w*c),h,0,0,Math.PI*2);ctx.fill();
  }
  function occupants(a,h){
    for(const [occupied,side] of [[entity.driver,-1],[entity.passenger,1]]){
      if(!occupied)continue;
      oval([a,h,side*.32],.13,.15,.14,'#595b73');
      oval([a+.05,h+.20,side*.32],.145,.15,.14,'#e1b993');
    }
  }
  if(entity.type==='helicopter'){
    for(const side of [-1,1]){
      path([[-1.4,.12,side*.83],[.98,.10,side*.83],[1.50,.21,side*.83]],'#43484c',.12);
      for(const a of [-.65,.84])path([[a,.1,side*.83],[a,.70,side*.54]],'#84877f',.09);
    }
    path([[-1,.95,0],[-3.40,1.56,0],[-3.53,2.14,0],[-3.24,2.11,0],[-3.02,1.70,0],[-.94,1.48,0]],paint,0,true);
    oval([.15,1.02,0],1.59,.59,.82,paint);oval([.58,1.48,0],1.10,.61,.73,'#9bbbbb');
    path([[.15,1.95,-.46],[.03,1.19,-.73],[.03,1.19,.73],[.15,1.95,.46]],'#e8d2ac',.055);
    occupants(.53,1.25);
    path([[-.81,1.42,0],[-.50,1.91,0],[.12,1.97,0],[.12,2.55,0]],'#5d655e',.13);
    const phase=entity.driver&&!entity.wrecked?time*16:.32;
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3+phase;
      path([[.1,2.56,0],[.1+3.08*Math.cos(a),2.56,3.08*Math.sin(a)]],'#3c4647',.105);
    }
    path([[-3.30-.45*Math.cos(phase),1.68-.45*Math.sin(phase),.16],[-3.30+.45*Math.cos(phase),1.68+.45*Math.sin(phase),.16]],'#e6d6ad',.085);
  }else{
    for(const side of [-1,1]){
      path([[-2.42,2.15,side*1.14],[-.70,.6,side*.65],[1.99,.65,side*.62],[2.65,2.3,side]],'#bca67e',.063);
    }
    path([[-5.26,3.48,0],[-5.50,4.64,0],[-4.06,4.18,0],[-3.35,3.44,0]],'#386d66',0,true);
    oval([0,3.36,0],5.54,1.56,2.08,paint);
    for(const side of [-1,1]){
      const pts=[];for(let k=0;k<=16;k++){
        const t=k/16;pts.push([(t-.5)*10.85,3.35+.18*Math.sin(Math.PI*t),side*2.03*Math.sin(Math.PI*t)**.68]);
      }
      path(pts,'#e4d4ad',.065);
    }
    oval([.64,.64,0],1.40,.46,.72,'#6e6453');oval([.61,1.08,0],1.31,.36,.63,'#a5c4bf');occupants(.67,.88);
  }
  ctx.restore();
}
