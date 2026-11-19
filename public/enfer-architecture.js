import {paintKnit} from './wool-art.js';

export const enferStyles=[
  {wall:'#dfc7a3',roof:'#5b5d67',stitch:'#ae9276',shutter:'#566b67',bay:3.8},
  {wall:'#b67a69',roof:'#874d48',stitch:'#eed1b1',shutter:'#536064',bay:3.4},
  {wall:'#d7bb95',roof:'#76555b',stitch:'#af8e72',shutter:'#775556',bay:4.2},
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
export function enferWall(index,floors=1){
  const key=index+':'+floors;
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
      const height=index===1?8:13,width=index===1?25:40;
      for(let row=0;row<96;row+=height){
        rect(0,y+row,96,1.4,stitch);
        for(let x=(row/height%2)*width/2;x<96;x+=width)rect(x,y+row,1.3,height,stitch);
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
      rect(28,y+24,40,50,'#e1c5a5');rect(34,y+29,28,39,'#43575c');
      rect(21,y+29,12,39,shutter);rect(63,y+29,12,39,shutter);
      for(let row=33;row<67;row+=6){rect(22,y+row,10,1,'#ad9c8b');rect(64,y+row,10,1,'#ad9c8b');}
      rect(47,y+29,3,39,'#bca68e');rect(35,y+46,27,3,'#bca68e');rect(26,y+69,44,5,'#ebd2b0');
    }
    paintKnit(c,0,y,96,96,{step:5,opacity:.26,seed:7+index,light:'#fff2d7',dark:'#523b4b'});
  }
  walls.set(key,canvas);return canvas;
}
