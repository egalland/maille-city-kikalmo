import test from 'node:test';
import assert from 'node:assert/strict';
import {triangleBlocks,verticesPerBlock,blockVisible} from '../public/software-geometry.js';
import {createMeshRenderer} from '../public/mesh-renderer.js';
import {shotStrokeMesh} from '../public/game-render.js';
import {buildShotEffect,muzzleFlash} from '../public/weapon-effects.js';
import {BoxGeometry,DataTexture,Group,Mesh,MeshBasicMaterial,PerspectiveCamera,PlaneGeometry,RepeatWrapping,Scene} from '../public/three.js';

test('the compatible 3D renderer shows the barrel flash and tracer',()=>{
  let lit=0;
  const canvas={getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData(frame){
      lit=0;
      for(let i=0;i<frame.data.length;i+=4)if(frame.data[i]>235&&frame.data[i+2]<205)lit++;
    }
  })};
  const renderer=createMeshRenderer(canvas,{adaptive:false});
  const scene=new Scene(),camera=new PerspectiveCamera(42,2,.1,30);
  camera.position.set(1.5,1.25,4);camera.lookAt(1.5,1,0);
  const tracer=shotStrokeMesh(buildShotEffect('pistol',0,0,0,3,0,true),0);
  const flash=shotStrokeMesh(muzzleFlash('pistol',0,0,0),0);
  renderer.setSize(396,198);
  renderer.render(scene,camera,true);const background=lit;
  scene.add(tracer);renderer.render(scene,camera,true);const trail=lit;
  scene.add(flash);renderer.render(scene,camera,true);
  assert.ok(trail>background+25&&lit>trail+8);
  for(const mesh of [tracer,flash]){mesh.geometry.dispose();mesh.material.dispose();}
  renderer.dispose();
});

test('triangle blocks cull offscreen runs while retaining partly visible and near-clipped faces',()=>{
  const positions=new Float32Array(3*(verticesPerBlock+3));
  for(let i=0;i<verticesPerBlock;i++)positions.set([23+i%2,6,-3],i*3);
  positions.set([-10,1,-4,0,1,-4,0,0,1],verticesPerBlock*3);
  const boxes=triangleBlocks(positions);
  const camera=new PerspectiveCamera(60,1,.12,380);
  assert.equal(boxes.length,12);
  assert.equal(blockVisible(boxes,0,camera.projectionMatrix.elements,.12,380),false);
  assert.equal(blockVisible(boxes,6,camera.projectionMatrix.elements,.12,380),true);
});

test('stationary camera retains street depth behind moving citizens and updates removed objects',()=>{
  let center;
  const canvas={getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData(frame){
      const i=(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))*4;
      center=Array.from(frame.data.slice(i,i+3));
    }
  })};
  const renderer=createMeshRenderer(canvas,{adaptive:false});
  const scene=new Scene(),camera=new PerspectiveCamera(50,1,.12,380);
  const street=new Group();street.userData.cpuStaticCity=true;street.userData.cpuRevision=0;
  const geometry=new BoxGeometry(2,2,2);
  const wall=new Mesh(geometry,new MeshBasicMaterial({color:0x35ff00}));
  const citizen=new Mesh(geometry,new MeshBasicMaterial({color:0xff0000}));
  wall.position.z=-5;street.add(wall);scene.add(street,citizen);citizen.position.z=-7;
  renderer.setSize(96,96);
  const draw=()=>{renderer.render(scene,camera,true);return center;};
  const initial=draw();
  assert.ok(initial[1]>240&&initial[0]<100);
  draw(); // Seed static color and depth.
  assert.deepEqual(draw(),initial);
  citizen.position.z=-3;assert.deepEqual(draw(),[255,0,0]);
  citizen.position.z=-7;assert.deepEqual(draw(),initial);
  street.remove(wall);street.userData.cpuRevision++;
  assert.deepEqual(draw(),[255,0,0]);
  renderer.dispose();
});


test('software street textures average distant stitches and contact shadows blend with the ground',()=>{
  let rendered;
  const canvas={getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData:image=>{rendered=image.data;}
  })};
  const view=createMeshRenderer(canvas,{adaptive:false}),scene=new Scene(),camera=new PerspectiveCamera(45,1,.12,100);
  const checker=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const i=4*(y*64+x),tone=((x+y)%2)*255;
    checker.set([tone,tone,tone,255],i);
  }
  const weave=new DataTexture(checker,64,64);weave.wrapS=weave.wrapT=RepeatWrapping;
  const plane=new PlaneGeometry(3,3),uv=plane.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*128,uv.getY(i)*128);
  const wall=new Mesh(plane,new MeshBasicMaterial({map:weave}));
  wall.position.z=-4;scene.add(wall);view.setSize(120,120);
  function sample(){
    view.render(scene,camera,true);
    return rendered[4*(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2)+2)];
  }
  const grey=sample();
  assert.ok(grey>90&&grey<165,`distant checker resolves to grey: ${grey}`);
  const map=new DataTexture(new Uint8Array([0,0,0,128]),1,1);
  const material=new MeshBasicMaterial({map,transparent:true,depthWrite:false});
  material.userData.contactShadow=true;
  const shadow=new Mesh(new PlaneGeometry(2,2),material);shadow.position.z=-3;scene.add(shadow);
  assert.ok(Math.abs(sample()-grey/2)<3,'half-opacity contact shadow leaves the pavement visible');
  const walker=new Mesh(new PlaneGeometry(1,1),new MeshBasicMaterial({color:0xffffff}));
  walker.position.z=-3.25;scene.add(walker);
  assert.equal(sample(),255,'shadow never becomes an opaque depth occluder');
  view.dispose();weave.dispose();map.dispose();
});
