// One repeating square metre of stylised brick, timber boards or twisted wire.
import {paintKnit} from './wool-art.js';

const swatches=new Map();
export function enclosureTextile(kind){
  if(swatches.has(kind))return swatches.get(kind);
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=96;
  const ctx=canvas.getContext('2d');
  if(kind==='mesh'){
    ctx.lineCap='round';
    for(const [color,width,shift] of [['#4b5d55',3.2,0],['#b4beb0',1.25,-.55]]){
      ctx.lineWidth=width;ctx.strokeStyle=color;
      ctx.beginPath();
      for(let x=-96;x<=192;x+=24)for(const s of [-1,1]){
        ctx.moveTo(x+shift,0);ctx.lineTo(x+s*96+shift,96);
      }
      ctx.stroke();
    }
  }else if(kind==='board'){
    ctx.fillStyle='#65594c';ctx.fillRect(0,0,96,96);
    ['#e3cbac','#e4d0b6','#ccb598','#dfc2a1','#e1cbb1','#c6ae92'].forEach((tint,i)=>{
      const x=i*16;ctx.fillStyle=tint;ctx.fillRect(x+1,0,14,96);
      ctx.strokeStyle='#9f8c76';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x+5,0);ctx.bezierCurveTo(x+2,26,x+10,52,x+5,96);ctx.stroke();
      ctx.fillStyle='#777a6f';for(const y of [11,83])ctx.fillRect(x+6,y,2,2);
    });
    paintKnit(ctx,0,0,96,96,{step:5,opacity:.30,seed:124});
  }else{
    ctx.fillStyle='#f1dbc3';ctx.fillRect(0,0,96,96);
    for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
      const x=col*24+(row%2)*12,y=row*12;
      ctx.fillStyle=['#d6b9a5','#dbc3b3','#e6c9b6','#d1b29f'][(row*5+col+6)%4];
      ctx.fillRect(x+1,y+1,22,10);
      ctx.fillStyle='#ecd7c4';ctx.fillRect(x+2,y+1,20,1);
    }
    paintKnit(ctx,0,0,96,96,{step:4,opacity:.25,seed:29});
  }
  swatches.set(kind,canvas);return canvas;
}

const strips=new Map();
export function enclosureStrip(kind){
  if(strips.has(kind))return strips.get(kind);
  const tile=enclosureTextile(kind),strip=document.createElement('canvas');
  strip.width=tile.width*16;strip.height=tile.height*4;
  const ctx=strip.getContext('2d');
  ctx.fillStyle=ctx.createPattern(tile,'repeat');ctx.fillRect(0,0,strip.width,strip.height);
  strips.set(kind,strip);return strip;
}
