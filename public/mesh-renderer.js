// CPU depth buffer for the same 3D scene and camera when WebGL cannot start.
import {verticesPerBlock,triangleBlocks,blockVisible} from './software-geometry.js';
import {Color, Frustum, Matrix3, Matrix4, Sphere, Vector3, DoubleSide, BackSide} from './three.js';

const near=.12,far=380;
const srgb=Array.from({length:1025},(_,i)=>{
  const v=i/1024;
  return Math.round(255*(v<.00313?v*12.92:1.055*v**(1/2.4)-.055));
});
const channel=v=>srgb[Math.max(0,Math.min(1024,Math.round(v*1024)))];
const mix=(a,b,t)=>a+(b-a)*t;
const linear=Array.from({length:256},(_,i)=>i*i/65025);

// Prefilter repeated cloth and brick so a distant pixel represents a patch of
// fabric instead of sampling an arbitrary stitch as the camera moves.
function mipChain(texels,size){
  const levels=[{pixels:texels,size}];
  while(size>1){
    const half=size>>1,small=new Uint8ClampedArray(half*half*4);
    for(let y=0;y<half;y++)for(let x=0;x<half;x++){
      const source=(2*y*size+2*x)*4,target=(y*half+x)*4;
      for(let channel=0;channel<4;channel++){
        const i=source+channel;
        small[target+channel]=(texels[i]+texels[i+4]+texels[i+4*size]+texels[i+4*size+4])*.25;
      }
    }
    levels.push({pixels:small,size:half});
    texels=small;size=half;
  }
  return levels;
}

const shadeRows = new Map();
// Texture lighting changes once per face. Cache the 256 possible channel results.
function shadeRow(gain,addition){
  const a=Math.max(0,Math.min(128,Math.round(gain*64))),b=Math.max(0,Math.min(64,Math.round(addition*64)));
  const key=a*65+b;
  let row=shadeRows.get(key);
  if(!row){
    row=new Uint8Array(256);
    for(let i=0;i<256;i++)row[i]=channel((a*linear[i]+b)/64);
    shadeRows.set(key,row);
  }
  return row;
}

export function createMeshRenderer(canvas,{adaptive=true}={}){
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
  const normalMatrix=new Matrix3();
  const viewSphere=new Sphere(),frustum=new Frustum(),eye=new Vector3(),normal=new Vector3(),vertex=new Vector3();
  const geometries=new WeakMap(),textures=new WeakMap(),sky=new Color();
  let background=null,cachedCity=null,revision=-1,shade=-1,backdrop=-1;
  const lastProjection=new Matrix4();
  let fog=[.2,.28,.3],quality=1,ambient=1,workScale=1,viewportWidth=0,viewportHeight=0;
  let expensive=0,headroom=0,focalPixels=1;
  function adjustBudget(elapsed,cacheHit){
    if(!adaptive)return;
    expensive=elapsed>37?expensive+1:Math.max(0,expensive-1);
    headroom=elapsed<21?headroom+1:0;
    // A cached street is inexpensive to redraw when the player looks around
    // at rest. Recover detail there, then shed it if moving frames get costly.
    const ceiling=cacheHit?1.40:1;
    let next=workScale;
    if(expensive>=5)next=Math.max(.63,workScale-.10);
    else if(headroom>=(cacheHit?18:85)&&workScale<ceiling)next=Math.min(ceiling,workScale+.08);
    if(next!==workScale){
      workScale=next;expensive=headroom=0;
    }
  }
  const renderer={software:true,shadowMap:{},setPixelRatio(ratio){quality=Math.min(1,ratio);},setSize,render,dispose};
  function renderScale(w,h){return Math.min(1,Math.min(.82,720/Math.max(w,h))*quality*workScale);}
  function setSize(w,h){
    viewportWidth=w;viewportHeight=h;
    const factor=renderScale(w,h);
    width=Math.max(1,Math.round(w*factor));height=Math.max(1,Math.round(h*factor));
    surface.width=width;surface.height=height;
    image=context.createImageData(width,height);
    pixels=new Uint32Array(image.data.buffer);depth=new Float32Array(width*height);
    frame=-Infinity;background=null;
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
    const sample={levels:mipChain(tex,size),size,version:map.version};textures.set(map,sample);return sample;
  }
  function render(scene,camera,force=false){
    if(!image)return false;
    const now=performance.now();
    if(!force&&now-frame<1000/23)return false;
    frame=now;
    const desiredWidth=Math.max(1,Math.round(renderScale(viewportWidth,viewportHeight)*viewportWidth));
    if(desiredWidth!==width){setSize(viewportWidth,viewportHeight);frame=now;}
    scene.updateMatrixWorld();camera.updateMatrixWorld();cameraEye.setFromMatrixPosition(camera.matrixWorld);
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    const fy=camera.projectionMatrix.elements[5]*height*.5;
    focalPixels=fy;
    const horizon=height*.5-fy*camera.matrixWorldInverse.elements[9]/Math.max(.25,camera.matrixWorldInverse.elements[10]);
    sky.copy(scene.fog?.color||scene.background||new Color('#c6c9ae'));
    ambient=scene.userData.ambientBrightness??1;
    // Retain the town's color AND depth when the observer stands still. Moving
    // citizens keep their normal depth test against doors, cars and façades.
    const city=scene.children.find(o=>o.userData.cpuStaticCity),level=Math.round(ambient*45);
    const skyKey=(channel(sky.r)<<16)|(channel(sky.g)<<8)|channel(sky.b);
    const same=city && cachedCity===city && revision===city.userData.cpuRevision &&
      shade===level && backdrop===skyKey && projection.equals(lastProjection);
    fog=[sky.r,sky.g,sky.b];
    const cacheHit=!!(same&&background);
    if(cacheHit){
      pixels.set(background.color);depth.set(background.depth);
    }else{
      depth.fill(0);
      for(let y=0;y<height;y++){
        const t=Math.max(0,Math.min(1,1-y/Math.max(1,horizon)));
        const r=channel(mix(fog[0],.27*ambient,t)),g=channel(mix(fog[1],.51*ambient,t)),b=channel(mix(fog[2],.64*ambient,t));
        pixels.fill(0xff000000|(b<<16)|(g<<8)|r,y*width,(y+1)*width);
      }
      if(city){
        visit(city);
        // The first still frame after coming to rest seeds the cache. Do not copy
        // full buffers while driving or rotating the camera.
        if(same){
          background={color:pixels.slice(),depth:depth.slice()};
        }else background=null;
        cachedCity=city;revision=city.userData.cpuRevision;shade=level;backdrop=skyKey;lastProjection.copy(projection);
      }
    }
    for(const child of scene.children)if(child!==city)visit(child);
    context.putImageData(image,0,0);
    adjustBudget(performance.now()-now,cacheHit);
    return true;
  }

  function visit(object,followed=false){
    if(!object.visible)return;
    followed=followed||object.userData.followedByCamera;
    if(object.isLOD){
      const distance=eye.setFromMatrixPosition(object.matrixWorld).distanceTo(eyeFromCamera());
      const levels=object.levels;
      const threshold=followed?18:7;
      const level=levels.length>1&&distance>Math.min(threshold,levels[1].distance)?levels[1]:levels[0];
      if(level){const visible=level.object.visible;level.object.visible=true;visit(level.object,followed);level.object.visible=visible;}
      return;
    }
    if(object.isMesh&&object.geometry.attributes.position&&(Array.isArray(object.material)||visibleMaterial(object.material))){
      if(object.isInstancedMesh){
        for(let i=0;i<object.count;i++){
          object.getMatrixAt(i,instance);
          model.multiplyMatrices(object.matrixWorld,instance);
          mesh(object,model);
        }
      }else mesh(object,object.matrixWorld);
    }
    for(const child of object.children)visit(child,followed);
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
    // The bounding sphere of a distant prop can be smaller than a single pixel.
    if(distance>viewSphere.radius && 2*focalPixels*viewSphere.radius<.8*(distance-viewSphere.radius))return;
    const p=geometry.attributes.position,uv=geometry.attributes.uv,col=geometry.attributes.color,normals=geometry.attributes.normal,index=geometry.index?.array;
    const positions=p.array,m=matrix.multiplyMatrices(projection,world).elements;
    if(normals)normalMatrix.getNormalMatrix(world);
    let cache=geometries.get(geometry);
    if(!cache){
      const blocks=!index&&!object.isSkinnedMesh&&!Array.isArray(material)&&p.count>=verticesPerBlock*2?triangleBlocks(positions):null;
      cache={projected:new Float32Array(p.count*3),codes:new Uint8Array(p.count),blocks,version:p.version};
      geometries.set(geometry,cache);
    }else if(cache.blocks&&cache.version!==p.version){
      cache.blocks=triangleBlocks(positions);cache.version=p.version;
    }
    const {projected,codes,blocks}=cache;
    function project(start,end){
      for(let j=start;j<end;j++){
        const i=j*3;
        if(object.isSkinnedMesh)object.getVertexPosition(j,vertex);
        const x=object.isSkinnedMesh?vertex.x:positions[i],y=object.isSkinnedMesh?vertex.y:positions[i+1],z=object.isSkinnedMesh?vertex.z:positions[i+2];
        const px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13],w=m[3]*x+m[7]*y+m[11]*z+m[15];
        projected[i]=px;projected[i+1]=py;projected[i+2]=w;
        codes[j]=(px < -w ? 1 : 0)|(px > w ? 2 : 0)|(py < -w ? 4 : 0)|(py > w ? 8 : 0)|(w<near?16:0)|(w>far?32:0);
      }
    }
    if(blocks){
      for(let i=0,first=0;i<blocks.length;i+=6,first+=verticesPerBlock){
        if(!blockVisible(blocks,i,m,near,far))continue;
        const end=Math.min(p.count,first+verticesPerBlock);
        project(first,end);draw(material,first,end-first);
      }
    }else{
      project(0,p.count);
      if(Array.isArray(material)){
        for(const group of geometry.groups)draw(material[group.materialIndex],group.start,group.count);
      }else draw(material,0,index?.length??p.count);
    }

    function draw(material,start,count){
      if(!visibleMaterial(material))return;
      const map=material.map;
      const resolution=map?.userData.cpuSize||(map?.image?.width>=96||material.alphaTest>.1?128:64);
      const tex=texture(map,resolution),base=material.color||{r:1,g:1,b:1};
      for(let i=start;i+2<start+count;i+=3){
        const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
        if(codes[a]&codes[b]&codes[c])continue;
        const ax=a*3,bx=b*3,cx=c*3,za=projected[ax+2],zb=projected[bx+2],zc=projected[cx+2];
        if(Math.max(za,zb,zc)<near||Math.min(za,zb,zc)>far)continue;
        let light=1;
        if(normals&&!material.isMeshBasicMaterial){
          normal.fromBufferAttribute(normals,a).applyNormalMatrix(normalMatrix);
          if(material.side===DoubleSide){
            const winding=(projected[bx]*za-projected[ax]*zb)*(projected[cx+1]*za-projected[ax+1]*zc)
              -(projected[bx+1]*za-projected[ax+1]*zb)*(projected[cx]*za-projected[ax]*zc);
            if(winding<0)normal.negate();
          }
          const sunlight=Math.max(0,normal.x*.39+normal.y*.71+normal.z*.58);
          light=(.61+.12*normal.y+.62*sunlight)*ambient;
          if(material.userData.streetLamp)light+=material.emissiveIntensity*.45;
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
    const ox=offset?.x||0,oy=offset?.y||0;
    const textured=tex && Math.abs(side)>120;
    const red=textured?shadeRow(rr,fr):null,green=textured?shadeRow(gg,fg):null,blue=textured?shadeRow(bb,fb):null;
    const contactShadow=material.userData.contactShadow;
    // Choose a mip from the triangle's projected area. Keep cutout coverage
    // intact for fences and costume accessories.
    let mip=0;
    if(tex&&material.alphaTest===0){
      const uvArea=Math.abs((bu-au)*(cv-av)-(bv-av)*(cu-au));
      const footprint=tex.size*tex.size*uvArea/Math.abs(side);
      if(footprint>2)mip=Math.min(tex.levels.length-1,Math.floor(.5*Math.log2(footprint)));
    }
    const level=tex?.levels[mip],size=level?.size,texels=level?.pixels;
    const alpha=contactShadow?1:Math.max(84,(material.alphaTest||0)*255);
    const dz=ux*(a-c)+vx*(d-c),du=ux*(a*au-c*cu)+vx*(d*bu-c*cu),dv=ux*(a*av-c*cv)+vx*(d*bv-c*cv);
    const ww=-ux-vx;
    // Clip each scanline once. In particular a diagonal yarn or a near-plane
    // clipped wall can otherwise scan a screen-sized box for just a few pixels.
    for(let y=y0;y<=y1;y++){
      const u=1+(x0+.5-ax)*ux+(y+.5-ay)*uy,v=(x0+.5-ax)*vx+(y+.5-ay)*vy,w=1-u-v;
      let lo=0,hi=x1-x0;
      if(ux>0)lo=Math.max(lo,Math.ceil(-u/ux));else if(ux<0)hi=Math.min(hi,Math.floor(-u/ux));else if(u<0)continue;
      if(vx>0)lo=Math.max(lo,Math.ceil(-v/vx));else if(vx<0)hi=Math.min(hi,Math.floor(-v/vx));else if(v<0)continue;
      if(ww>0)lo=Math.max(lo,Math.ceil(-w/ww));else if(ww<0)hi=Math.min(hi,Math.floor(-w/ww));else if(w<0)continue;
      if(hi<lo)continue;
      const ia=u*a,ib=v*d,ic=w*c;
      let z=ia+ib+ic+lo*dz,sz=ia*au+ib*bu+ic*cu+lo*du,tz=ia*av+ib*bv+ic*cv+lo*dv;
      const end=y*width+x0+hi;
      for(let at=y*width+x0+lo;at<=end;at++,z+=dz,sz+=du,tz+=dv){
        if(z+bias<=depth[at])continue;
        if(!tex){pixels[at]=flat;depth[at]=z+bias;continue;}
        const iz=1/z,s=sz*iz+ox,sampleY=tz*iz+oy,t=flip?1-sampleY:sampleY;
        const tx=wrap?Math.floor(s*size)&(size-1):Math.min(size-1,Math.max(0,Math.floor(s*size)));
        const ty=wrap?Math.floor(t*size)&(size-1):Math.min(size-1,Math.max(0,Math.floor(t*size)));
        const j=(ty*size+tx)*4;
        if(texels[j+3]<alpha)continue;
        if(contactShadow){
          const opacity=material.opacity*texels[j+3]/255,base=pixels[at];
          const sr=mix(base&255,red?red[texels[j]]:channel(rr*linear[texels[j]]+fr),opacity);
          const sg=mix((base>>>8)&255,green?green[texels[j+1]]:channel(gg*linear[texels[j+1]]+fg),opacity);
          const sb=mix((base>>>16)&255,blue?blue[texels[j+2]]:channel(bb*linear[texels[j+2]]+fb),opacity);
          pixels[at]=0xff000000|(sb<<16)|(sg<<8)|sr;
          continue;
        }
        pixels[at]=textured?0xff000000|(blue[texels[j+2]]<<16)|(green[texels[j+1]]<<8)|red[texels[j]]:
          0xff000000|(channel(bb*linear[texels[j+2]]+fb)<<16)|(channel(gg*linear[texels[j+1]]+fg)<<8)|channel(rr*linear[texels[j]]+fr);
        depth[at]=z+bias;
      }
    }
  }
  function dispose(){if(canvas!==surface)surface.remove();}
  return renderer;
}
