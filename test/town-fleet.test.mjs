import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {Box3,Vector3} from '../public/three.js';
import {createCar} from '../public/puppets3d.js';
import {drawCanvasCar} from '../public/canvas-puppets.js';
import {vehicleDoorways,vehicleSpec} from '../public/vehicle-types.js';
import {handleApi} from '../worker/game-api.js';
import {localDatabase} from '../scripts/local-db.mjs';

const closedFleet=['estate','camper','flatbed'];
test('the estate, pop-top camper and spool carrier carry the actual driver and have steerable wheels and destructible glazing',()=>{
  const contours=new Set();
  for(const type of closedFleet){
    const car=createCar(type),spec=vehicleSpec(type),physical=new Box3().setFromObject(car.group,true).getSize(new Vector3());
    assert.ok(Math.abs(physical.x-2*spec.halfLength)<.1);
    assert.ok(Math.abs(physical.z-2*spec.halfWidth)<.28);
    assert.ok(Math.abs(physical.y-spec.height)<.061);
    const chassis=car.group.getObjectByName('carrosserie'),front=car.group.getObjectByName('direction');
    assert.equal(chassis.userData.seats3D.x,spec.seatOffset);
    const pane=chassis.children.find(mesh=>mesh.material?.transparent);
    car.update({driver:true,passenger:true,passengerSkin:'bruyere',self:true,steer:.8,speed:9},.08,1);
    assert.ok(front.rotation.y<-.05&&Math.abs(front.children[0].rotation.z)>1);
    const driver=car.group.getObjectByName('Conducteur assis'),rider=car.group.getObjectByName('Passager assis');
    assert.ok(driver.visible&&rider.visible&&rider.position.z>driver.position.z&&pane.visible);
    car.update({parts:1,driver:false},.016,2);assert.ok(!driver.visible&&!rider.visible&&!pane.visible);
    car.update({parts:0},.016,3);assert.ok(pane.visible);
    const lines=[],c={beginPath(){},closePath(){},stroke(){},fill(){},save(){},restore(){},translate(){},scale(){},
      moveTo(...p){lines.push(p);},lineTo(...p){lines.push(p);},ellipse(...p){lines.push(p);}};
    drawCanvasCar(c,{id:type,type,driver:true,passenger:true},0,0,88,1,1.01);
    assert.ok(lines.length>50&&lines.flat().every(Number.isFinite));contours.add(JSON.stringify(lines));
    car.dispose();
  }
  assert.equal(contours.size,3);
  assert.ok(vehicleSpec('estate').steering>vehicleSpec('camper').steering);
  assert.ok(vehicleSpec('flatbed').mass>2*vehicleSpec('estate').mass);
});

test('four new civilian vehicle types can be found parked on Enfer, entered through a clear doorway, and observed in moving traffic',async t=>{
  globalThis.location=new URL('https://maille.test/');t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {parkedCars,destinations,routeAgents,contactAt}=await import('../public/paris-world.js');
  const traffic=new Set();
  for(const stop of destinations)for(const time of [0,24,48]){
    for(const car of routeAgents(stop.x,stop.y,300,1780000121000+time*1000).cars)traffic.add(car.type);
  }
  for(const [place,type] of [['gare','estate'],['morlincourt','flatbed'],['salency','camper'],['trois-ponts','motorbike']]){
    const car=parkedCars.find(v=>v.id==='car-'+place);
    assert.equal(car?.type,type);assert.ok(traffic.has(type));
    assert.ok(vehicleDoorways(car,.75).some(p=>!contactAt(p.x,p.y,{radius:.43})),type+' has an accessible doorway');
  }
});

test('a second client sees the new body type and can use closed cabins while the roadster has just its rider',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  const session=name=>({id:crypto.randomUUID(),token:crypto.randomUUID(),name,map:'enfer'});
  const driver=session('A'),passenger=session('B'),spot={x:2,y:3,health:100};
  const request=async(who,action,body)=>{
    const response=await handleApi(new Request('https://world.test/api/world/'+action,{method:'POST',body:JSON.stringify({...who,...body})}),{DB});
    assert.equal(response.status,200);return response.json();
  };
  await Promise.all([driver,passenger].map(s=>request(s,'join',{state:spot})));
  for(const type of [...closedFleet,'motorbike']){
    const car={type,id:'fleet-'+type,x:2,y:3,angle:0};
    await request(driver,'sync',{state:{...spot,speed:0,vehicle:car},events:[{op:'own-'+type,type:'vehicle',data:{...car,occupied:true}}]});
    const seen=await request(passenger,'sync',{state:spot,events:[{op:'seat-'+type,type:'seat',data:{driver:driver.id,car:car.id}}]});
    assert.equal(seen.players.find(p=>p.id===driver.id)?.vehicle?.type,type);
    const claims=(await request(driver,'sync',{})).players.filter(p=>p.passenger);
    assert.equal(claims.length,Number(type!=='motorbike'));
    await request(passenger,'sync',{events:[{op:'leave-'+type,type:'seat',data:{leave:true}}]});
    await request(driver,'sync',{state:spot,events:[{op:'park-'+type,type:'vehicle',data:{...car,occupied:false}}]});
  }
});
