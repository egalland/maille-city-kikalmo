import {decoration} from './city3d.js';

// The emergency canvas view draws the same metre-scale profiles at eight view
// angles. Only visible combinations are baked; the camera reuses them afterwards.
const kinds=new Set(['bench','lamp','crate','hydrant','postbox','bin','bollard']);
const templates=new Map(), images=new Map(), tau=Math.PI*2;
const linearToByte=v=>Math.round(255*Math.min(1,v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055));
function faces(kind,stage){
  const key=kind+stage;
  if(templates.has(key))return templates.get(key);
  const batch=decoration(kind,0,stage),result=[];
  for(const {pos,colors} of batch.buffers.values())for(let i=0;i<pos.length;i+=9){
    const a=pos.slice(i,i+3),b=pos.slice(i+3,i+6),c=pos.slice(i+6,i+9);
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz);
    if(length<1e-8)continue;
    const light=.65+.42*Math.abs((nx*.53+ny*.78+nz*.33)/length);
    const rgb=colors.slice(i,i+3).map(channel=>linearToByte(channel*light));
    result.push({vertices:[a,b,c],rgb});
  }
  templates.set(key,result);return result;
}

export function furnitureSprite(kind,stage,heading){
  if(!kinds.has(kind))return null;
  const direction=(Math.round(heading*8/tau)%8+8)%8,key=kind+stage+'/'+direction;
  if(images.has(key))return images.get(key);
  const cs=Math.cos(direction*tau/8),sn=Math.sin(direction*tau/8);
  // World-space right, up and view depth of a slightly elevated view.
  const project=([x,y,z])=>{const depth=x*cs+z*sn;return [-x*sn+z*cs,y*.985+depth*.174,depth*.985-y*.174];};
  const polygons=faces(kind,stage).map(({vertices,rgb})=>({p:vertices.map(project),rgb}));
  let left=0,right=0,top=0,bottom=0;
  for(const {p} of polygons)for(const [x,y] of p){left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);}
  const scale=Math.min(150/(right-left),176/(top-bottom)),pad=2;
  const image=document.createElement('canvas');image.width=Math.ceil((right-left)*scale)+pad*2;image.height=Math.ceil((top-bottom)*scale)+pad*2;
  const ctx=image.getContext('2d'),ox=pad-left*scale,oy=pad+top*scale;
  const width=image.width,height=image.height,pixels=ctx.createImageData(width,height);
  const zbuffer=new Float32Array(width*height).fill(Infinity),bytes=pixels.data;
  // Depth per pixel keeps details such as a lock or bench arm in front of the
  // large panels behind them, even when their triangles overlap in projection.
  for(const {p,rgb} of polygons){
    const [[ax,ay,az],[bx,by,bz],[cx,cy,cz]]=p.map(([x,y,z])=>[ox+x*scale,oy-y*scale,z]);
    const area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    if(Math.abs(area)<.00001)continue;
    const xmin=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xmax=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
    const ymin=Math.max(0,Math.floor(Math.min(ay,by,cy))),ymax=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
    const dx1=(by-cy)/area,dx2=(cy-ay)/area;
    for(let y=ymin;y<=ymax;y++){
      const dy=y+.5-cy;
      let u=dx1*(xmin+.5-cx)+(cx-bx)*dy/area,v=dx2*(xmin+.5-cx)+(ax-cx)*dy/area;
      for(let x=xmin;x<=xmax;x++,u+=dx1,v+=dx2){
        const w=1-u-v;
        if(u<0||v<0||w<0)continue;
        const z=u*az+v*bz+w*cz,key=y*width+x;
        if(z>=zbuffer[key])continue;
        zbuffer[key]=z;const out=key*4;
        bytes[out]=rgb[0];bytes[out+1]=rgb[1];bytes[out+2]=rgb[2];bytes[out+3]=255;
      }
    }
  }
  ctx.putImageData(pixels,0,0);
  const sprite={image,left:-ox/scale,top:-oy/scale,width:image.width/scale,height:image.height/scale};
  if(images.size>=64)images.delete(images.keys().next().value);
  images.set(key,sprite);return sprite;
}
