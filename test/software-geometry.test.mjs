import test from 'node:test';
import assert from 'node:assert/strict';
import {triangleBlocks,verticesPerBlock,blockVisible} from '../public/software-geometry.js';
import {createMeshRenderer} from '../public/mesh-renderer.js';
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,PerspectiveCamera,Scene} from '../public/three.js';

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
