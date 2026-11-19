import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {readMapArchive} from '../public/map-archive.js';
import {rendererFallback} from '../public/renderer-fallback.js';

const map={metadata:{world:'enfer'},buildings:[],streets:[],water:[],green:[]};
const valid=()=>new Response(gzipSync(JSON.stringify(map)));

test('a corrupted offline map is replaced by a validated network copy',async()=>{
  const calls=[];
  const storage={open:async()=>({
    match:async()=>new Response('bad gzip'),
    delete:async()=>calls.push('delete'),
    put:async()=>calls.push('put')
  })};
  const fetcher=async(url,init)=>{calls.push([url,init.cache]);return valid();};
  assert.deepEqual(await readMapArchive('enfer',{storage,fetcher}),map);
  assert.deepEqual(calls,['delete',['/map-enfer.gz?rev=20261119b','reload'],'put']);
});

test('Enfer loads with built-in HTTP decompression when DecompressionStream is unavailable',async t=>{
  const original=globalThis.DecompressionStream;
  t.after(()=>{globalThis.DecompressionStream=original;});
  globalThis.DecompressionStream=undefined;
  const fetcher=async url=>{
    assert.match(url,/^\/map-enfer\.json\?/);
    return Response.json(map);
  };
  assert.deepEqual(await readMapArchive('enfer',{storage:{},fetcher}),map);
});

test('a WebGL frame failure draws immediately with the compatible renderer',()=>{
  const calls=[];
  const primary={available:true,mode:'webgl',render(){throw new Error('GPU');},dispose(){calls.push('dispose');}};
  const software={available:true,mode:'canvas',render:state=>calls.push(state),aim:()=>1};
  const view=rendererFallback(()=>primary,()=>software);
  view.render({p:{x:12,y:6}},.02,0);
  assert.deepEqual(calls,['dispose',{p:{x:12,y:6},snap:true}]);
  assert.equal(view.mode,'canvas');
  assert.equal(view.aim(),1);
});

test('the CPU renderer gives the closer 3D mesh priority and renders data textures',async()=>{
  const {createMeshRenderer}=await import('../public/mesh-renderer.js');
  const {BoxGeometry,DataTexture,Mesh,MeshBasicMaterial,PerspectiveCamera,Scene}=await import('../public/three.js');
  const pixels=new Uint8ClampedArray(2*2*4);
  const canvas={getContext:()=>({
    createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),
    putImageData(image){
      const center=(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))*4;
      pixels.set(image.data.subarray(center,center+4));
    }
  })};
  const scene=new Scene(),camera=new PerspectiveCamera(50,1,.12,50);
  const geo=new BoxGeometry(2,2,2);
  const red=new DataTexture(new Uint8Array([255,0,0,255]),1,1);
  const close=new Mesh(geo,new MeshBasicMaterial({map:red}));
  const distant=new Mesh(geo,new MeshBasicMaterial({color:0x00ff00}));
  close.position.z=-4;distant.position.z=-7;
  scene.add(close,distant);
  const renderer=createMeshRenderer(canvas);renderer.setSize(64,64);renderer.render(scene,camera,true);
  assert.deepEqual([...pixels.slice(0,4)],[255,0,0,255]);
  close.position.x=5;renderer.render(scene,camera,true);
  assert.deepEqual([...pixels.slice(0,4)],[0,255,0,255]);
});

test('human pedestrians can animate without animal ears',async()=>{
  const {createPuppet}=await import('../public/puppets3d.js');
  const puppet=createPuppet('human');
  assert.doesNotThrow(()=>puppet.update({speed:2,moving:true},1/60,1));
});
