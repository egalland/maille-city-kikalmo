import {paintKnit} from './wool-art.js';

export const enferStyles=[
  {wall:'#a95345',roof:'#535460',stitch:'#d19a7e',shutter:'#627775',bay:3.25},
  {wall:'#aa624f',roof:'#7a4f49',stitch:'#d6a78b',shutter:'#586266',bay:3.4},
  {wall:'#d8c3a3',roof:'#635863',stitch:'#b19a80',shutter:'#795656',bay:3.8},
  {wall:'#927b6e',roof:'#555863',stitch:'#715d54',shutter:'#725154',bay:6.5},
  {wall:'#e1cfaf',roof:'#666075',stitch:'#b7a28e',shutter:'#836c8e',bay:4.6}
];
export function enferStyle(building){
  const kind=building.kind||'';
  if(/relig|église/i.test(kind)||String(building.id)==='317663579')return 4;
  if(/agricol|industri|annexe/i.test(kind)||building.h<3.8)return 3;
  let hash=0;for(const c of String(building.id))hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  return hash%3;
}

const walls=new Map();
export function enferWall(index,floors=1,entry=false){
  const key=[index,floors,entry].join(':');
  if(walls.has(key))return walls.get(key);
  const {wall,stitch,shutter}=enferStyles[index],canvas=document.createElement('canvas');
  canvas.width=96;canvas.height=96*floors;
  const c=canvas.getContext('2d');
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  for(let floor=0;floor<floors;floor++){
    const y=floor*96;
    rect(0,y,96,96,wall);
    if(index===3){
      for(let x=0;x<96;x+=12){rect(x,y,1.5,96,stitch);rect(x+2,y,1,96,'#b2937c');}
    }else{
      const height=index<2?3:13,width=index<2?8:37;
      for(let row=0;row<96;row+=height){
        rect(0,y+row,96,index<2?.78:1,stitch);
        for(let x=(row/height%2)*width/2;x<96;x+=width){
          rect(x,y+row,.85,height,stitch);
          if(index<2&&Math.round(x+row)%4===0)rect(x+2,y+row+2,width-3,height-3,index===0?'#b45e4e':'#9d5849');
        }
      }
    }
    if(index===4){
      c.beginPath();c.moveTo(32,y+76);c.lineTo(32,y+37);c.quadraticCurveTo(34,y+24,48,y+13);
      c.quadraticCurveTo(62,y+24,64,y+37);c.lineTo(64,y+76);c.closePath();
      c.fillStyle='#4e4c60';c.fill();c.strokeStyle='#b19a83';c.lineWidth=3;c.stroke();
      rect(39,y+43,18,16,'#8e697c');rect(46,y+27,3,47,'#b29b8d');rect(33,y+57,30,2,'#b29b8d');
    }else if(index===3){
      rect(23,y+25,50,69,'#63534e');rect(26,y+28,44,67,shutter);
      for(let x=30;x<70;x+=8)rect(x,y+30,1,65,'#54434a');
      rect(28,y+76,41,3,'#a48877');
    }else{
      // Jambs, shadowed returns and reflected sky also read in the distant wall tile.
      rect(25,y+15,46,62,'#6c5855');
      rect(24,y+14,48,4,'#d5b498');rect(25,y+18,3,57,'#e0c7a8');
      rect(68,y+18,3,57,'#b19a87');
      const sky=c.createLinearGradient(0,y+19,0,y+72);
      sky.addColorStop(0,'#728b98');sky.addColorStop(.49,'#506f79');sky.addColorStop(.50,'#465c5c');sky.addColorStop(1,'#394849');
      c.fillStyle=sky;c.fillRect(30,y+20,36,51);
      c.fillStyle='#c6b598';c.beginPath();c.moveTo(31,y+21);c.lineTo(38+index*2,y+21);
      c.quadraticCurveTo(38,y+43,32,y+52);c.lineTo(32,y+69);c.lineTo(31,y+69);c.fill();
      rect(47,y+19,2.5,54,'#cfbda4');rect(29,y+40,38,2.7,'#c4ae96');
      for(const x of [14,70]){
        rect(x,y+19,12,54,'#554e50');rect(x+1,y+19,10,52,shutter);
        for(let row=23;row<69;row+=6){rect(x+2,y+row,8,1.2,'#9d9f8d');rect(x+2,y+row+1.3,8,1,'#48595b');}
      }
      if(index<2){
        c.beginPath();c.ellipse(48,y+17,21,6.5,0,Math.PI,2*Math.PI);c.lineWidth=2.8;c.strokeStyle='#d3aa8e';c.stroke();
        rect(0,y+89,96,1.7,'#ba8f7c');
      }
      rect(23,y+73,50,4,'#ead3b5');rect(25,y+77,46,2,'#846e64');
    }
    if(entry&&index<3&&floor===floors-1){
      rect(13,y+10,70,71,wall);rect(34,y+27,28,65,'#c39c80');rect(37,y+29,22,64,shutter);
      rect(40,y+33,16,15,'#45565a');rect(46,y+34,2,14,'#cfaa8d');rect(40,y+57,16,23,stitch);
      rect(52,y+61,3,4,'#e7c29e');rect(30,y+88,37,6,'#a3968a');rect(28,y+94,41,2,'#685b58');
    }
    paintKnit(c,0,y,96,96,{step:5,opacity:.26,seed:7+index,light:'#fff2d7',dark:'#523b4b'});
  }
  walls.set(key,canvas);return canvas;
}


export function enferFacadeFloors(style,eaves,roof){
  if(style===4)return 1;
  return roof?.floors??Math.max(1,Math.min(10,Math.round(eaves/2.75)));
}

// Keep IGN footprints, including angled party walls and small extensions.
export function enferRoof(poly,height,style,residential=false){
  if(style===4||poly.length<3||height<2.6)return null;
  let along=null,largest=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    if(length>largest){largest=length;along=[dx/length,dy/length];}
  }
  if(!along||largest<2.8)return null;
  const cross=([x,y])=>-along[1]*x+along[0]*y,projected=poly.map(cross);
  const min=Math.min(...projected),max=Math.max(...projected),width=max-min;
  if(width<1.85||width>(style===3?24:18))return null;
  const middle=(max+min)*.5;
  let fall=Math.min(3.25,height*.35,width*.37),floors;
  if(residential&&style<3&&height>=3.8){
    // Reserve space for the attic while keeping doors and storeys at human scale.
    const minStorey=2.55,maxStorey=3.2,minRoof=Math.min(1.05,fall);
    const preferredFloors=Math.round((height-1.65)/2.85);
    const floorsBelowRoof=Math.floor((height-minRoof)/minStorey);
    floors=Math.min(10,Math.max(1,Math.min(preferredFloors,floorsBelowRoof)));
    const eaves=Math.max(floors*minStorey,Math.min(floors*maxStorey,height-fall));
    fall=Math.max(minRoof,Math.min(3.6,height-eaves));
  }
  const ridge=p=>cross(p)-middle;
  return {wall:height-fall,floors,ridge,top:p=>height-fall*Math.min(1,Math.abs(ridge(p))/(width*.5))};
}

export function roofPitch(points,ridge,side){
  const result=[];
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i],u=ridge(a)*side,v=ridge(b)*side;
    if((u<0)!==(v<0)){const t=u/(u-v);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    if(v>=0)result.push(b);
  }
  return result;
}
