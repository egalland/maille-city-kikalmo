import {yarnPalette as dye} from './wool-art.js';
import {weaponCatalog} from './weapon-catalog.js';

// Felt cut-outs for the wheel, the embroidered map patch and the three-dimensional drops.
const ink=dye.ink,cream=dye.cream;
function stroke(c,path,color,width){
  c.beginPath();c.moveTo(path[0][0],path[0][1]);
  for(const p of path.slice(1)){if(p.length===4)c.quadraticCurveTo(...p);else if(p.length===6)c.bezierCurveTo(...p);else c.lineTo(...p);}
  c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function filled(c,path,color,edge=ink,width=3.1){
  c.beginPath();c.moveTo(path[0][0],path[0][1]);
  for(const p of path.slice(1)){if(p.length===4)c.quadraticCurveTo(...p);else if(p.length===6)c.bezierCurveTo(...p);else c.lineTo(...p);}
  c.closePath();c.fillStyle=color;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}
}
function oval(c,x,y,rx,ry,color,edge=ink,width=2.8,angle=0){
  c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=color;c.fill();
  if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}
}
function bars(c,x,y,n,dx,dy,col){
  for(let i=0;i<n;i++)stroke(c,[[x+i*dx,y+i*dy],[x+i*dx+3,y+i*dy+4]],col,1.75);
}
const pictures={
  fist(c){
    filled(c,[[24,40],[19,28,26,24],[31,22,35,28],[32,14,39,13],[46,11,49,21],
      [48,11,55,12],[62,11,65,23],[66,16,72,19],[80,23,79,33],[83,44,73,52],
      [65,58],[62,67],[37,70],[32,58],[21,51,19,46],[17,39,24,40]],'#ecd6ad',ink,3.4);
    stroke(c,[[25,40],[31,35,37,39],[42,44,48,43]],'#9e785f',2.7);
    for(const [x,y] of [[36,24],[49,20],[64,23]])stroke(c,[[x,y],[x+2,y+6,x+1,y+11]],'#b59677',2.5);
    filled(c,[[33,59],[64,55],[68,65],[64,70],[39,75],[34,73]],'#b16a58',ink,2.9);
    bars(c,40,63,5,4,-.7,cream);
  },
  yarn(c){
    const red='#b95760',light='#f0ac91',edge='#77454c';
    stroke(c,[[61,47],[72,61,80,56],[87,51,92,56]],ink,5.2);
    stroke(c,[[61,47],[72,61,80,56],[87,51,92,56]],red,3);
    oval(c,44,40,23,22,edge,ink,3.4);
    c.save();c.beginPath();c.ellipse(44,40,22,21,-.15,0,Math.PI*2);c.clip();
    for(let i=0;i<8;i++)stroke(c,[[13+i*5,14],[28+i*4,38,49+i*5,67]],i%2?red:light,3.7);
    for(let i=0;i<5;i++)stroke(c,[[19,53+i*4],[46,51+i*4,68,25+i*3]],i%2?red:light,3.6);
    c.restore();stroke(c,[[29,29],[33,24,39,23]],cream,2);
  },
};
export function drawWeapon(c,kind,x,y,w,h=w){
  const spec=weaponCatalog[kind];if(!spec)return false;
  const scale=Math.min(w/100,h/78);
  c.save();c.translate(x+(w-100*scale)*.5,y+(h-78*scale)*.5);c.scale(scale,scale);
  c.lineCap='round';c.lineJoin='round';
  if(kind==='fist')pictures.fist(c);else drawFirearm(c,spec);
  c.restore();return true;
}
export function drawYarnEmote(c){
  c.save();c.translate(-3,3);c.scale(.68,.68);pictures.yarn(c);c.restore();
}
function drawFirearm(c,spec){
  const kind=spec.profile,handgun=kind==='sidearm'||kind==='revolver',compact=kind==='compact';
  const shortBarrel=['boomerang','bubbles','button','chime','shuttle'].includes(spec.id);
  const origin=handgun?21:compact?26:30,fore=(handgun?70:compact?75:77)-(shortBarrel?5:0);
  const muzzle=(handgun?81:91)-(shortBarrel?8:0)+(spec.id==='spark'?3:0);
  const stock=spec.id==='spool'?14:9;
  const iron='#707f8c',edge='#9ba9b4',dark='#29323a',poly=(points,color)=>{
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();
  };
  if(!handgun)poly([[origin+2,36],[stock,43],[stock-1,55],[17,52],[32,44]],kind==='sniper'||kind==='double'?'#82634e':dark);
  poly([[origin,31],[fore,31],[fore+4,36],[fore,43],[origin-3,43]],iron);
  poly([[origin+1,38],[fore,38],[fore,44],[origin,46]],dark);
  poly([[origin+6,42],[origin+17,42],[origin+12,59],[origin+2,59]],'#394048');
  poly([[fore-4,32],[muzzle,32],[muzzle,37],[fore-4,37]],dark);
  c.fillStyle=edge;c.fillRect(origin,31,fore-origin,2);
  c.fillStyle=dark;c.fillRect(fore-4,27,4,5);
  if(kind==='revolver'){
    c.fillStyle='#4e5961';c.beginPath();c.ellipse(44,38,9,8,0,0,7);c.fill();
  }else if(kind==='assault'||compact)poly([[51,40],[60,42],[59,58],[50,56]],'#4e5961');
  else if(kind==='sniper'){c.fillStyle=dark;c.fillRect(42,23,27,6);c.fillRect(46,28,5,6);c.fillRect(60,28,5,6);}
  else if(kind==='launcher'){c.fillStyle='#545c60';c.fillRect(58,29,30,14);c.fillStyle=edge;c.fillRect(83,29,5,14);}
  else if(kind==='shotgun'||kind==='double'){c.fillStyle='#896a56';c.fillRect(58,36,16,7);if(kind==='double'){c.fillStyle=edge;c.fillRect(76,37,15,2);}}
  if(spec.id==='service'){c.fillStyle='#c0b7a2';c.fillRect(35,34,23,2);c.fillStyle=dark;c.fillRect(55,31,9,4);}
  if(spec.id==='marksman'){c.fillStyle='#525b66';c.fillRect(35,46,11,6);c.fillRect(55,20,16,8);c.fillRect(71,32,12,5);}
  if(spec.id==='rocket'){
    c.fillStyle='#778765';c.fillRect(42,28,40,13);
    c.fillStyle='#e1c18a';c.fillRect(72,28,4,13);c.fillRect(47,30,3,9);
    poly([[86,28],[94,31],[97,34],[94,37],[86,40]],edge);
  }
  c.strokeStyle='#46505b';c.lineWidth=2;c.beginPath();c.moveTo(origin+13,44);c.lineTo(origin+24,44);
  c.lineTo(origin+22,51);c.lineTo(origin+12,51);c.stroke();
}
