// Run from the repository root with the same Node runtime and @napi-rs/canvas
// used by the rendering regression tests. This benchmark excludes 3D rendering.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,Path2D}=require(require.resolve('@napi-rs/canvas',{
  paths:[process.cwd(),process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)
}));
function timing(samples){
  const sorted=samples.slice().sort((a,b)=>a-b);
  const round=n=>Number(n.toFixed(2));
  return {
    medianMs:round(sorted[Math.floor(sorted.length*.5)]),
    p95Ms:round(sorted[Math.floor(sorted.length*.95)]),
    meanMs:round(sorted.reduce((sum,s)=>sum+s,0)/sorted.length)
  };
}
globalThis.location=new URL('https://maille.test/?monde=enfer');
globalThis.fetch=async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url)));
const start=performance.now();
const {SPAWN,paintMap}=await import('../public/paris-world.js');
const {createGame}=await import('../public/game.js');
const initializationMs=Math.round(performance.now()-start);
globalThis.Path2D=Path2D;
globalThis.document=Object.assign(new EventTarget(),{createElement:()=>createCanvas(1,1)});
globalThis.window=new EventTarget();
const minimap=createCanvas(180,140);
minimap.getBoundingClientRect=()=>({width:180,height:140});
const position={...SPAWN},mapTimes=[];
for(let i=0;i<200;i++){
  position.x+=.30;position.angle=i*.04;
  const clock=performance.now();
  paintMap(minimap,position,{dpr:1});
  // Force the native canvas to complete its queued paints.
  minimap.getContext('2d').getImageData(4,4,1,1);
  mapTimes.push(performance.now()-clock);
}
let frame,stamp=performance.now(),epoch=1800000000000,pedestrians=0,vehicles=0;
globalThis.requestAnimationFrame=cb=>{frame=cb;return 1;};
globalThis.cancelAnimationFrame=()=>{};
const game=createGame({
  canvas:new EventTarget(),
  net:{peers:()=>[],serverTime:()=>epoch,world:()=>({}),publish(){},emit(){}},
  buildView:()=>({available:true,mode:'benchmark',render(scene){
    for(const e of scene.entities){if(e.isCar)vehicles++;else if(!e.self)pedestrians++;}
  },aim:()=>0,effect(){},dispose(){}})
});
const simTimes=[];
for(let i=0;i<900;i++){
  stamp+=1000/60;epoch+=1000/60;
  const clock=performance.now();frame(stamp);
  if(i>=120)simTimes.push(performance.now()-clock);
}
console.log(JSON.stringify({initializationMs,minimap:timing(mapTimes),simulation:timing(simTimes),
  meanPedestrians:Number((pedestrians/901).toFixed(1)),meanVehicles:Number((vehicles/901).toFixed(1)),
  finalJsHeapMiB:Math.round(process.memoryUsage().heapUsed/1048576)},null,2));
game.destroy();
