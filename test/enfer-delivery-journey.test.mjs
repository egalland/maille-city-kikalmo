import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
import {careerPlaces} from '../public/career-catalog.js';
import {makeCareerRouter} from '../public/career-route.js';
import {vehicleSpec,vehicleDoorways} from '../public/vehicle-types.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

// Only the display and the transport are substituted. Every pose comes from player
// inputs and collisions. Requests and world events go through the deployed API handler.
test('walk, board, deliver, crash, repair and start a new job on the continuous pilot streets',async t=>{
  globalThis.location=new URL('https://maille.test/?monde=enfer');
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {createGame}=await import('../public/game.js');
  const {contactAt}=await import('../public/paris-world.js');
  const {streets}=await import('../public/paris-data.js');
  const route=makeCareerRouter(streets),DB=localDatabase();
  let frame,hud,scene,published,receive,now=1782250000000,stamp=performance.now();
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  globalThis.requestAnimationFrame=cb=>(frame=cb,1);globalThis.cancelAnimationFrame=()=>{};
  t.mock.method(Date,'now',()=>now);
  const id=crypto.randomUUID(),session={id,token:crypto.randomUUID(),profile:crypto.randomUUID(),map:'enfer',name:'Essai'};
  let world={pickups:{}},events=[],cursor=0,op=0,career;
  const net={id,status:'online',world:()=>world,peers:()=>[],onEvent(fn){receive=fn;},
    publish:p=>published=p,emit(type,data){events.push({type,data,op:String(++op)});return true;},serverTime:()=>now};
  async function post(path,extra={}){
    const response=await handleApi(new Request('https://maille.test/api/world/'+path,
      {method:'POST',body:JSON.stringify({...session,...extra})}),{DB});
    const result=await response.json();
    assert.ok(response.ok&&result.ok!==false,result.error||path);return result;
  }
  async function sync(join=false){
    const body=await post(join?'join':'sync',{state:published,events:events.splice(0),cursor});
    if(body.world)world=body.world;
    for(const event of body.events||[])if(event.seq>cursor)receive(event);
    cursor=body.cursor||cursor;
  }
  async function command(action,extra={}){
    const result=await post('career',{action,revision:career?.revision,...extra});
    career=result.state;return result;
  }
  const canvas=Object.assign(new EventTarget(),{focus(){},setPointerCapture(){}});
  const game=createGame({canvas,net,minimap:null,onState:s=>hud=s,
    buildView:()=>({available:true,mode:'canvas',aim:()=>0,effect(){},render:s=>scene=s,dispose(){}})});
  t.after(()=>{
    game.destroy();DB.close();
    for(const key of ['location','window','document','requestAnimationFrame','cancelAnimationFrame'])delete globalThis[key];
  });
  function step(){stamp+=50;now+=50;frame(stamp);}
  step();await sync(true);
  const start=game.getPosition();
  const parked=scene.entities.filter(e=>e.isCar&&!e.moving&&!e.occupied).sort((a,b)=>distance(a,start)-distance(b,start))[0];
  const door=vehicleDoorways(parked,.7).sort((a,b)=>distance(a,start)-distance(b,start))[0];
  for(let i=0;i<170&&(!hud.nearVehicle||i<8);i++){
    const angle=Math.atan2(door.y-scene.p.y,door.x-scene.p.x)-scene.yaw;
    game.setMove(Math.sin(angle),-Math.cos(angle));step();
  }
  assert.ok(distance(start,scene.p)>.6);
  game.setMove(0,0);game.action('vehicle');
  for(let i=0;i<40;i++){step();if(i%3===0)await sync();}
  await sync();assert.equal(published.vehicle.id,parked.id);
  const car=published.vehicle,spec=vehicleSpec(car.type);

  async function driveTo(target){
    const path=route(game.getPosition(),target);
    assert.ok(path.length>2);
    let index=1;
    for(let tick=0;tick<4200;tick++){
      const pos=game.getPosition(),speed=published.speed||0,look=clamp(Math.abs(speed)*.48+2.4,3.3,6);
      while(index<path.length-1&&distance(pos,path[index])<look)index++;
      if(index>1&&index<path.length-1){
        const a=path[index-1],b=path[index],dx=b.x-a.x,dy=b.y-a.y,len=distance(a,b);
        if((pos.x-a.x)*dx+(pos.y-a.y)*dy>len*len&&distance(pos,b)<12)index++;
      }
      const next=path[index],aim=Math.atan2(next.y-pos.y,next.x-pos.x)-pos.angle;
      const delta=Math.atan2(Math.sin(aim),Math.cos(aim));
      const desired=Math.abs(delta)>1?2.2:Math.abs(delta)>.45?3.1:6.4;
      game.setDrive(clamp(delta*2.4,-1,1),clamp((desired-speed)*.45+.1,-.5,1));step();
      if(tick%10===0)await sync();
      if(distance(scene.p,target)<10){
        game.setDrive(0,-1);
        for(let n=0;n<35&&published.speed>1.6;n++){step();if(n%3===0)await sync();}
        game.setDrive(0,0);for(let n=0;n<10;n++)step();await sync();return;
      }
    }
    assert.fail('Arrivée impossible à '+target.name);
  }

  await command('state');const openingCash=career.cash;
  await command('start',{contract:'delivery'});await command('advance');assert.equal(career.mission.stage,1);
  await driveTo(careerPlaces.quay);await command('advance');assert.equal(career.cash,openingCash+85);
  await driveTo(careerPlaces.garage);
  if(hud.vehicleHealth===100){
    const g=game.getPosition();let obstacle;
    for(let d=6;d<21&&!obstacle;d+=.6)for(let i=0;i<32;i++){
      const offset=i%2?Math.ceil(i/2):-i/2,angle=g.angle+offset*Math.PI/16;
      const q={x:g.x+d*Math.cos(angle),y:g.y+d*Math.sin(angle)};
      if(distance(q,careerPlaces.garage)<13&&contactAt(q.x,q.y,{angle,halfLength:spec.halfLength,halfWidth:spec.halfWidth,bodyHeight:spec.height})){
        obstacle=q;break;
      }
    }
    assert.ok(obstacle);
    for(let i=0;i<350&&hud.vehicleHealth===100;i++){
      const pos=game.getPosition(),aim=Math.atan2(obstacle.y-pos.y,obstacle.x-pos.x)-pos.angle;
      game.setDrive(clamp(Math.atan2(Math.sin(aim),Math.cos(aim))*2,-1,1),1);step();
      if(i%3===0)await sync();
    }
  }
  game.setDrive(0,0);for(let i=0;i<15;i++){step();if(i%5===0)await sync();}
  assert.ok(hud.vehicleHealth<100&&hud.vehicleHealth>32);
  await sync();await command('repair');await sync();for(let n=0;n<10;n++)step();
  assert.equal(hud.vehicleHealth,100);assert.equal(career.cash,openingCash+85-30);assert.equal(career.completed,1);
  await command('start',{contract:'taxi'});assert.equal(career.mission.contract,'taxi');
});
