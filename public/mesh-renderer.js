// CPU depth buffer for the same 3D scene and camera when WebGL cannot start.
import {Color, Frustum, Matrix4, Sphere, Vector3, DoubleSide, BackSide} from './three.js';

const near=.12,far=380;
const srgb=Array.from({length:1025},(_,i)=>{
  const v=i/1024;
  return Math.round(255*(v<.00313?v*12.92:1.055*v**(1/2.4)-.055));
});
const channel=v=>srgb[Math.max(0,Math.min(1024,Math.round(v*1024)))];
const mix=(a,b,t)=>a+(b-a)*t;
const linear=Array.from({length:256},(_,i)=>i*i/65025);

export function createMeshRenderer(canvas){
  let surface=canvas,context=surface.getContext('2d',{alpha:false});
  if(!context){
    surface=document.createElement('canvas');
    surface.setAttribute('aria-hidden','true');
    surface.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    canvas.after(surface);
    context=surface.getContext('2d',{alpha:false});
  }
  if(!context){if(surface!==canvas)surface.remove();throw Error('Canvas 2D indisponible');}
  let width=0,height=0,image,pixels,depth,frame=-Infinity;
  const projection=new Matrix4(),matrix=new Matrix4(),model=new Matrix4(),instance=new Matrix4();
  const viewSphere=new Sphere(),frustum=new Frustum(),eye=new Vector3(),normal=new Vector3(),vertex=new Vector3();
  const geometries=new WeakMap(),textures=new WeakMap(),sky=new Color();
  let fog=[.2,.28,.3],quality=1;
  const renderer={software:true,shadowMap:{},setPixelRatio(ratio){quality=Math.min(1,ratio);},setSize,render,dispose};
  function setSize(w,h){
    const factor=Math.min(.72,630/Math.max(w,h))*quality;
    width=Math.max(1,Math.round(w*factor));height=Math.max(1,Math.round(h*factor));
    surface.width=width;surface.height=height;
    image=context.createImageData(width,height);
    pixels=new Uint32Array(image.data.buffer);depth=new Float32Array(width*height);
    frame=-Infinity;
  }

  function texture(map,size=64){
    if(!map?.image?.width)return null;
    const cached=textures.get(map);
    if(cached?.version===map.version)return cached;
    const source=map.image;
    let tex;
    if(map.isDataTexture){
      const {width,height,data}=source;
      if(data?.length!==width*height*4)return null;
      tex=new Uint8ClampedArray(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const index=(Math.floor(y*height/size)*width+Math.floor(x*width/size))*4;
        tex.set(data.subarray(index,index+4),(y*size+x)*4);
      }
    }else{
      const sample=document.createElement('canvas');
      sample.width=size;sample.height=size;
      const ctx=sample.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(source,0,0,size,size);
      tex=ctx.getImageData(0,0,size,size).data;
    }
    const sample={pixels:tex,size,version:map.version};textures.set(map,sample);return sample;
  }
  function render(scene,camera,force=false){
    if(!image)return;
    const now=performance.now();
    if(!force&&now-frame<1000/23)return;
    frame=now;
    scene.updateMatrixWorld();camera.updateMatrixWorld();cameraEye.setFromMatrixPosition(camera.matrixWorld);
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    const fy=camera.projectionMatrix.elements[5]*height*.5;
    const horizon=height*.5-fy*camera.matrixWorldInverse.elements[9]/Math.max(.25,camera.matrixWorldInverse.elements[10]);
    sky.copy(scene.fog?.color||scene.background||new Color('#c6c9ae'));
    fog=[sky.r,sky.g,sky.b];depth.fill(0);
    for(let y=0;y<height;y++){
      const t=Math.max(0,Math.min(1,1-y/Math.max(1,horizon)));
      const r=channel(mix(fog[0],.27,t)),g=channel(mix(fog[1],.51,t)),b=channel(mix(fog[2],.64,t));
      pixels.fill(0xff000000|(b<<16)|(g<<8)|r,y*width,(y+1)*width);
    }
    visit(scene);
    context.putImageData(image,0,0);
  }

  function visit(object){
    if(!object.visible)return;
    if(object.isLOD){
      const distance=eye.setFromMatrixPosition(object.matrixWorld).distanceTo(eyeFromCamera());
      const levels=object.levels;
      const level=levels.length>1&&distance>Math.min(6,levels[1].distance)?levels[1]:levels[0];
      if(level){const visible=level.object.visible;level.object.visible=true;visit(level.object);level.object.visible=visible;}
      return;
    }
    if(object.isMesh&&object.geometry.attributes.position){
      if(object.isInstancedMesh){
        for(let i=0;i<object.count;i++){
          object.getMatrixAt(i,instance);
          model.multiplyMatrices(object.matrixWorld,instance);
          mesh(object,model);
        }
      }else mesh(object,object.matrixWorld);
    }
    for(const child of object.children)visit(child);
  }
  const cameraEye=new Vector3();
  function eyeFromCamera(){return cameraEye;}
  function visibleMaterial(material){return material?.visible&&material.side!==BackSide&&(!material.transparent||material.opacity>=.48);}
  function mesh(object,world){
    const {geometry,material}=object;
    if(!Array.isArray(material)&&!visibleMaterial(material))return;
    if(!geometry.boundingSphere)geometry.computeBoundingSphere();
    viewSphere.copy(geometry.boundingSphere).applyMatrix4(world);
    if(!frustum.intersectsSphere(viewSphere))return;
    const vp=projection.elements,{x,y,z}=viewSphere.center;
    const distance=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
    if(distance-viewSphere.radius>far||distance+viewSphere.radius<near)return;
    const p=geometry.attributes.position,uv=geometry.attributes.uv,col=geometry.attributes.color,normals=geometry.attributes.normal,index=geometry.index?.array;
    let projected=geometries.get(geometry);
    if(!projected){projected=new Float32Array(p.count*3);geometries.set(geometry,projected);}
    const m=matrix.multiplyMatrices(projection,world).elements,positions=p.array;
    for(let i=0;i<positions.length;i+=3){
      if(object.isSkinnedMesh)object.getVertexPosition(i/3,vertex);
      const x=object.isSkinnedMesh?vertex.x:positions[i],y=object.isSkinnedMesh?vertex.y:positions[i+1],z=object.isSkinnedMesh?vertex.z:positions[i+2];
      projected[i]=m[0]*x+m[4]*y+m[8]*z+m[12];
      projected[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];
      projected[i+2]=m[3]*x+m[7]*y+m[11]*z+m[15];
    }
    if(Array.isArray(material)){
      for(const group of geometry.groups)draw(material[group.materialIndex],group.start,group.count);
    }else draw(material,0,index?.length??p.count);

    function draw(material,start,count){
      if(!visibleMaterial(material))return;
      const tex=texture(material.map,material.map?.userData.cpuSize||(material.alphaTest>.1?128:64)),base=material.color||{r:1,g:1,b:1};
      for(let i=start;i+2<start+count;i+=3){
        const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
        const ax=a*3,bx=b*3,cx=c*3,za=projected[ax+2],zb=projected[bx+2],zc=projected[cx+2];
        if(Math.max(za,zb,zc)<near||Math.min(za,zb,zc)>far)continue;
        let light=1;
        if(normals&&!material.isMeshBasicMaterial){
          normal.fromBufferAttribute(normals,a).transformDirection(world);
          const n=normal.x*.42+normal.y*.78+normal.z*.46;
          light=.62+.51*(material.side===DoubleSide?Math.abs(n):Math.max(0,n));
        }
        const tinted=col&&material.vertexColors;
        const r=base.r*(tinted?col.getX(a):1)*light,g=base.g*(tinted?col.getY(a):1)*light,k=base.b*(tinted?col.getZ(a):1)*light;
        if(Math.min(za,zb,zc)>=near){
          triangle(projected[ax],projected[ax+1],za,uv?.getX(a),uv?.getY(a),projected[bx],projected[bx+1],zb,uv?.getX(b),uv?.getY(b),
            projected[cx],projected[cx+1],zc,uv?.getX(c),uv?.getY(c),r,g,k,tex,material);
        }else{
          const vertices=[a,b,c].map(j=>[projected[j*3],projected[j*3+1],projected[j*3+2],uv?.getX(j)||0,uv?.getY(j)||0]),clipped=[];
          for(let j=0;j<3;j++){
            const u=vertices[(j+2)%3],v=vertices[j];
            if((u[2]<near)!==(v[2]<near)){const t=(near-u[2])/(v[2]-u[2]);clipped.push(u.map((x,k)=>mix(x,v[k],t)));}
            if(v[2]>=near)clipped.push(v);
          }
          for(let j=2;j<clipped.length;j++)triangle(...clipped[0],...clipped[j-1],...clipped[j],r,g,k,tex,material);
        }
      }
    }
  }

  function triangle(ax,ay,az,au=0,av=0,bx,by,bz,bu=0,bv=0,cx,cy,cz,cu=0,cv=0,r,g,b,tex,material){
    const a=1/az,d=1/bz,c=1/cz;
    ax=(ax*a+1)*width*.5;bx=(bx*d+1)*width*.5;cx=(cx*c+1)*width*.5;
    ay=(1-ay*a)*height*.5;by=(1-by*d)*height*.5;cy=(1-cy*c)*height*.5;
    const side=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    if(Math.abs(side)<.45||side>0&&material.side!==DoubleSide)return;
    const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(width-1,Math.floor(Math.max(ax,bx,cx)-.5));
    const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(height-1,Math.floor(Math.max(ay,by,cy)-.5));
    if(x1<x0||y1<y0)return;
    const ux=(by-cy)/side,uy=(cx-bx)/side,vx=(cy-ay)/side,vy=(ax-cx)/side;
    const bias=material.polygonOffset?Math.max(0,-material.polygonOffsetFactor)*.00004:0;
    const haze=Math.min(.79,Math.max(0,(Math.min(az,bz,cz)-28)/365));
    const bright=1-haze,rr=r*bright,gg=g*bright,bb=b*bright,fr=fog[0]*haze,fg=fog[1]*haze,fb=fog[2]*haze;
    const flat=0xff000000|(channel(bb+fb)<<16)|(channel(gg+fg)<<8)|channel(rr+fr);
    const offset=material.map?.offset,wrap=material.map?.wrapS!==1001,flip=material.map?.flipY;
    const alpha=Math.max(84,(material.alphaTest||0)*255),size=tex?.size,texels=tex?.pixels;
    for(let y=y0;y<=y1;y++){
      let u=1+(x0+.5-ax)*ux+(y+.5-ay)*uy,v=(x0+.5-ax)*vx+(y+.5-ay)*vy;
      for(let x=x0,at=y*width+x0;x<=x1;x++,at++,u+=ux,v+=vx){
        const w=1-u-v;
        if(Math.min(u,v,w)<0)continue;
        const ia=u*a,ib=v*d,ic=w*c,z=ia+ib+ic;
        if(z+bias<=depth[at])continue;
        if(!tex){pixels[at]=flat;depth[at]=z+bias;continue;}
        const s=(ia*au+ib*bu+ic*cu)/z+(offset?.x||0),sampleY=(ia*av+ib*bv+ic*cv)/z+(offset?.y||0),t=flip?1-sampleY:sampleY;
        const tx=wrap?Math.floor(s*size)&(size-1):Math.min(size-1,Math.max(0,Math.floor(s*size)));
        const ty=wrap?Math.floor(t*size)&(size-1):Math.min(size-1,Math.max(0,Math.floor(t*size)));
        const j=(ty*size+tx)*4;
        if(texels[j+3]<alpha)continue;
        pixels[at]=0xff000000|(channel(bb*linear[texels[j+2]]+fb)<<16)|(channel(gg*linear[texels[j+1]]+fg)<<8)|channel(rr*linear[texels[j]]+fr);
        depth[at]=z+bias;
      }
    }
  }
  function dispose(){if(canvas!==surface)surface.remove();}
  return renderer;
}
