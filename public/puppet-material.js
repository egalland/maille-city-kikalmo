import * as THREE from './three.js';
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
let knit;
// A seamless stockinette repeat. Each V is made from two strands with a twisted fibre ridge.
export function puppetKnit(){
  if(knit)return knit;
  const size=128,data=new Uint8Array(size*size*4);
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){
    const gy=py/16, row=Math.floor(gy), fy=gy-row;
    const gx=px/16+.055*Math.sin(gy*TAU),fx=gx-Math.floor(gx)-.5;
    const axis=.073+.31*fy;
    const dst=Math.abs(Math.abs(fx)-axis);
    const thread=Math.exp(-34*dst*dst),groove=Math.exp(-200*dst*dst);
    const coil=.5+.5*Math.cos(TAU*(fy*3.6+Math.abs(fx)*6.2+(fx<0?.12:0)));
    const tip=Math.min(1,Math.min(fy+.12,1.14-fy)*4.5);
    const n=(((px*733+py*1777)^(px*187+py*31))&7)-3;
    const v=Math.round(clamp(198+thread*(32+13*coil)*tip+groove*8+n,185,254));
    const i=(py*size+px)*4;data[i]=v;data[i+1]=v;data[i+2]=Math.min(255,v+1);data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.anisotropy=2;texture.needsUpdate=true;knit=texture;return texture;
}

let felt;
// Finer mottling for short-pile faces and hands. The broad stitch repeat of a
// knitted coat would otherwise read like large squares across the cheek.
export function puppetFelt(){
  if(felt)return felt;
  const side=64,bytes=new Uint8Array(side*side*4);
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const fiber=(Math.imul(x*127+y*197,2654435761)>>>26)/63;
    const undulation=Math.cos(TAU*(x*3+y)/side)*Math.sin(TAU*y*4/side);
    const value=Math.round(234+6*undulation+13*fiber);
    const i=(y*side+x)*4;bytes.set([value,value,value,255],i);
  }
  felt=new THREE.DataTexture(bytes,side,side,THREE.RGBAFormat);
  felt.wrapS=felt.wrapT=THREE.RepeatWrapping;
  felt.magFilter=THREE.LinearFilter;felt.minFilter=THREE.LinearMipmapLinearFilter;
  felt.colorSpace=THREE.SRGBColorSpace;felt.generateMipmaps=true;felt.needsUpdate=true;
  return felt;
}
