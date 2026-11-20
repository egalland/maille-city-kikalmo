import {paintKnit,yarnPalette as dye} from './wool-art.js';

import {paintStreetTree} from './street-trees.js';

// Paint once per kind, dye lot and damage stage. Sized in sprite units, not screen pixels.
export function paintStreetProp(g,type,seed,stage){
  const tau=Math.PI*2,ink=dye.ink,brass=dye.ochre,iron=dye.petrol;
  g.lineCap='round';g.lineJoin='round';
  function oval(x,y,a,b,fill,edge=null,width=1.1){
    g.beginPath();g.ellipse(x,y,a,b,0,0,tau);g.fillStyle=fill;g.fill();
    if(edge){g.strokeStyle=edge;g.lineWidth=width;g.stroke();}
  }
  function cord(points,color,width){
    g.beginPath();g.moveTo(points[0][0],points[0][1]);
    for(const p of points.slice(1))if(p.length===4)g.quadraticCurveTo(...p);else g.lineTo(...p);
    g.lineWidth=width;g.strokeStyle=color;g.stroke();
  }
  function tube(points,color,width){
    cord(points,ink,width+2);cord(points,color,width);
  }
  function patch(x,y,w,h,r,col,lit,edge=ink){
    const tint=g.createLinearGradient(x,y,x+w*.18,y+h);tint.addColorStop(0,lit);tint.addColorStop(.38,col);tint.addColorStop(1,col);
    g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=tint;g.fill();g.strokeStyle=edge;g.lineWidth=1.6;g.stroke();
    g.save();g.clip();paintKnit(g,x,y,w,h,{step:5.7,seed:3,opacity:.38,light:lit,dark:edge});g.restore();
  }
  function trim(x1,y,x2,tint){
    g.setLineDash([2,3]);cord([[x1,y],[x2,y]],tint,1.2);g.setLineDash([]);
  }
  if(type==='tree'){
    paintStreetTree(g,seed%3,stage);
    return;
  }
  if(type==='bench'){
    for(const x of [22,80]){
      tube([[x,140],[x-2,117,x,87],[x+1,72]],iron,5.8);tube([[x-5,141],[x+4,141]],iron,3.7);
      tube([[x,97],[x+3,86,x+8,89]],'#607e74',3);
    }
    const slat=(x,y,w)=>{patch(x,y,w,13,4,'#b8805f','#ecc998','#685052');trim(x+4,y+9,x+w-4,'#f5d29f');};
    for(const y of [43,62]){
      if(stage===2){slat(7,y,35);slat(53,y+1,43);}
      else slat(7,y,89);
    }
    slat(5,87,94);
    for(const x of [21,81]){
      for(const y of [49,68])oval(x,y,1.9,2.4,'#876650','#f5dab0',.7);
      cord([[x-5,87],[x-9,76,x-5,76],[x+1,73,x+3,81],[x+4,86]],iron,2.8);
    }
    return;
  }
  if(type==='lamp'){
    tube([[52,142],[51,31]],iron,4.8);patch(44,127,15,15,4,iron,'#769185');patch(41,140,21,5,2,iron,'#738981');
    for(const y of [35,50,123,130])patch(47,y,9,3,1.2,'#b38763','#e0b780',iron);
    g.beginPath();g.moveTo(38,13);g.lineTo(66,13);g.lineTo(59,32);g.lineTo(45,32);g.closePath();
    const lantern=g.createLinearGradient(40,14,61,30);lantern.addColorStop(0,stage===2?'#aaa091':'#fff0be');
    lantern.addColorStop(1,stage===2?'#746c72':'#e1a85f');g.fillStyle=lantern;g.fill();g.strokeStyle=iron;g.lineWidth=2.6;g.stroke();
    cord([[52,14],[52,30]],'#6c655a',1.6);
    g.beginPath();g.moveTo(34,13);g.quadraticCurveTo(44,6,52,4);g.quadraticCurveTo(62,6,70,13);g.closePath();g.fillStyle=iron;g.fill();
    cord([[37,13],[67,13]],'#8da399',1.5);oval(52,3,2.2,3,brass);
    return;
  }
  if(type==='crate'){
    patch(7,36,90,104,5,'#ac8167','#e6bb92');
    for(const x of [10,87])patch(x,39,7,93,2,'#9f775b','#d9ad83');
    const brace=[[15,126],stage===2?[55,86]:[89,48]];
    tube(brace,'#cfa47b',7);for(const y of [37,130])patch(6,y,92,12,3,'#bb926d','#e7c99a');
    return;
  }
  if(type==='hydrant'){
    patch(34,60,36,78,8,'#b75f5c','#e09577');oval(52,61,19,17,'#d17b68','#795059',2);
    patch(30,134,44,9,3,'#aa615d','#e19b7f');patch(stage===2?34:23,83,stage===2?43:54,16,5,'#b26160','#e28b73');
    oval(52,92,11,12,'#bb7065','#804e53');oval(52,92,5,6,'#dd977c');
    cord([[41,53],[46,46,53,47]],'#f3b796',2.6);trim(39,120,65,'#efad96');
    return;
  }
  if(type==='postbox'){
    tube([[51,143],[52,67]],iron,8);patch(24,32,56,57,7,'#c59a55','#f5d294');
    patch(23,28,58,12,4,'#d6ac65','#f5d9a4');patch(31,45,41,8,3,iron,'#615965');
    patch(44,59,18,12,2,'#eed5a1','#f7e7c4','#9b784f');trim(29,80,76,'#f7d59f');
    return;
  }
  if(type==='bollard'){
    patch(42,32,21,110,8,iron,'#73918d');oval(52.5,32,11.5,12,'#678a81',iron,2);
    patch(41,46,23,8,3,'#d6bd87','#f8e4b1',iron);patch(39,137,27,6,2,iron,'#647d73');
    for(let y=64;y<130;y+=9)cord([[44,y],[48,y+2,52,y+1]],'#78928a',1.1);
    return;
  }
  patch(29,42,46,97,9,'#547c71','#97aa85');patch(26,127,51,10,4,'#547267','#8ca18b');
  for(const x of [36,43,50,57,64,71])cord([[x,55],[x+.5,117]],'#728c76',1.5);
  oval(52,47,22,7,'#344f50');
  const lx=stage===2?61:52;
  patch(lx-26,34,52,14,6,'#536e64','#99ac83');oval(lx,36,25,7,'#678873',iron,1.5);
  trim(32,120,72,'#bdc99d');
}
