// CPU rendering of a moving view in Les Saules, with the same town, traffic and
// near characters as the game. Report presented frames at a fixed viewport.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,Path2D}=require(require.resolve('@napi-rs/canvas',{paths:[process.cwd(),process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}));
globalThis.location=new URL('https://maille.test/?monde=enfer');
globalThis.fetch=async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url)));
globalThis.Path2D=Path2D;
globalThis.document={createElement:()=>createCanvas(1,1)};
const [{Scene,PerspectiveCamera},{createMeshRenderer},{createCity3D},{createCar,createPuppet},world,{terrainHeight}]=await Promise.all([
  import('../public/three.js'),import('../public/mesh-renderer.js'),import('../public/city3d.js'),import('../public/puppets3d.js'),import('../public/paris-world.js'),import('../public/terrain-height.js')
]);
const scene=new Scene(),canvas=createCanvas(1,1),renderer=createMeshRenderer(canvas,{adaptive:process.argv.includes('--adaptive')}),city=createCity3D(scene,{software:true});
const start=world.coreDestinations.find(p=>p.key==='sempigny');
const camera=new PerspectiveCamera(52,16/9,.12,6300),epoch=1811000000000;
renderer.setSize(1280,720);
const state={epoch,props:world.nearbyProps(start.x,start.y,320)};
for(let i=0;i<65;i++)city.update(start,i*.05,state);
const entities=world.routeAgents(start.x,start.y,110,epoch);
let models=0;
for(const e of [{...start,id:'self',type:'fox'},...entities.actors.slice(0,8),...entities.cars.slice(0,5)]){
  const vehicle=e.kind==='car'||e.routeId||e.parked;
  const item=(vehicle?createCar:createPuppet)(e.type,e.color,21+models);
  scene.add(item.group);item.group.position.set(e.x,terrainHeight(e.x,e.y),e.y);
  item.update({...e,moving:true},1/30,0);models++;
}
const times=[],idle=process.argv.includes('--idle');
for(let i=0;i<48;i++){
  const a=start.angle+(idle?0:Math.sin(i*.038)*.18),c=Math.cos(a),s=Math.sin(a);
  const h=terrainHeight(start.x,start.y);
  camera.position.set(start.x-c*5.25,h+2.18,start.y-s*5.25);camera.lookAt(start.x+c*4,h+1.2,start.y+s*4);
  const before=performance.now();renderer.render(scene,camera,true);const ms=performance.now()-before;
  if(i>=12)times.push(ms);
}
const sorted=times.sort((a,b)=>a-b);
console.log(JSON.stringify({district:start.label,entities:models,width:canvas.width,height:canvas.height,medianMs:+sorted[18].toFixed(1),p95Ms:+sorted[34].toFixed(1)}));
city.dispose();renderer.dispose();
