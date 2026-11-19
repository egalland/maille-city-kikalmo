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
