import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {Box3,Vector3} from '../public/three.js';
import {createCar} from '../public/puppets3d.js';
import {drawCanvasCar} from '../public/canvas-puppets.js';
import {vehicleDoorways,vehicleSpec} from '../public/vehicle-types.js';
import {vehiclePart} from '../public/vehicle-damage.js';
import {handleApi} from '../worker/game-api.js';
import {localDatabase} from '../scripts/local-db.mjs';

const closedFleet=['estate','camper','flatbed','gt','supercar','tipper','boxtruck'];
test('the town fleet and both sports cars carry the driver behind destructible glazing on steerable chassis',()=>{
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
  assert.equal(contours.size,closedFleet.length);
  assert.ok(vehicleSpec('estate').steering>vehicleSpec('camper').steering);
  assert.ok(vehicleSpec('flatbed').mass>2*vehicleSpec('estate').mass);
});

test('both seated foxes fit below the roof lining while steering each low coupe',()=>{
  for(const type of ['gt','supercar']){
    const car=createCar(type),roof=new Box3().setFromObject(car.group,true).max.y-.11;
    try{
      for(const steer of [-1,0,1]){
        car.update({id:'here',driver:true,self:true,driverSkin:'lagon',passenger:true,passengerSkin:'bruyere',steer},.03,1);
        car.group.updateMatrixWorld(true);
        for(const seat of ['Conducteur assis','Passager assis']){
          const head=car.group.getObjectByName(seat).getObjectByName('head');
          assert.ok(new Box3().setFromObject(head,true).max.y<roof,type+' '+seat+' clears the roof');
        }
      }
    }finally{car.dispose();}
  }
});

test('end-on and side impacts follow the engine and cabin of each sports car',()=>{
  for(const [type,motor,seat] of [['gt',1,-.25],['supercar',-1,.15]]){
    const spec=vehicleSpec(type),car={type,x:7,y:5,angle:Math.PI/2};
    const hit=(length,side,height)=>vehiclePart(car,{x:car.x-side*spec.halfWidth,y:car.y+length*spec.halfLength},height);
    assert.equal(hit(motor,0,.53),'engine');
    assert.equal(hit(-motor,0,.53),'body');
    assert.equal(hit(.66*motor,1,.54),'engine');
    assert.equal(hit(seat,1,.79),'glass');
    assert.equal(hit(motor,0,.82),'glass');
    assert.equal(hit(.65,1,.23),'frontRight');
  }
});

test('freight cab glazing, tyres, powertrain and seats are separate from a solid load',()=>{
  for(const [type,axles] of [['boxtruck',[2.65,-2.09]],['tipper',[2.18,-.85,-2.05]]]){
    const spec=vehicleSpec(type),car={type,x:3,y:-5,angle:-1.4},c=Math.cos(car.angle),s=Math.sin(car.angle);
    const hit=(along,side,up)=>vehiclePart(car,{x:car.x+c*along-s*side,y:car.y+s*along+c*side},up/spec.height);
    assert.ok(spec.mass>7000&&spec.eyeHeight>1.8&&spec.eyeHeight<2.35);
    assert.ok(vehicleDoorways(car,.65).every(d=>Math.abs((d.x-car.x)*c+(d.y-car.y)*s-spec.seatOffset)<.001));
    for(const side of [-1,1]){
      assert.equal(hit(spec.seatOffset,side*spec.halfWidth,1.98),'glass');
      assert.equal(hit(-.6,side*spec.halfWidth,1.98),'body');
      for(const x of axles)assert.equal(hit(x,side*spec.halfWidth,.47),(x>0?'front':'rear')+(side>0?'Right':'Left'));
    }
    assert.equal(hit(spec.halfLength,0,1.10),'engine');
    assert.equal(hit(-spec.halfLength,0,1.10),'body');
  }
});

test('freight paint shares geometry while isolated damage, steering and lighter distant bodies follow the player',()=>{
  for(const type of ['boxtruck','tipper']){
    const a=createCar(type),b=createCar(type),cab=a.group.getObjectByName('carrosserie'),other=b.group.getObjectByName('carrosserie');
    assert.equal(cab.children[0].geometry,other.children[0].geometry);
    const wheel=a.group.getObjectByName('direction');
    const triangles=(g)=>g.children.reduce((n,m)=>n+(m.isMesh?m.geometry.getAttribute('position').count/3:0),0);
    const detailed=triangles(cab);
    a.update({driver:true,parts:1},.016,1);
    assert.ok(!cab.children.find(m=>m.material?.transparent).visible);
    assert.ok(other.children.find(m=>m.material?.transparent).visible);
    a.update({driver:true,signalDetail:false,parts:1,occupantDistance:75},.016,2);
    const far=a.group.getObjectByName('Silhouette poids lourd');
    assert.ok(far.visible&&!wheel.visible&&triangles(far)<detailed*.26);
    assert.ok(!far.children.find(m=>m.material?.transparent).visible);
    a.update({signalDetail:true},.016,3);
    assert.ok(!far.visible&&wheel.visible&&cab.children.find(m=>m.material?.transparent).visible);
    let disposed=0;
    cab.children[0].geometry.addEventListener('dispose',()=>disposed++);
    a.dispose();assert.equal(disposed,0);
    b.update({driver:true,steer:1},.07,4);assert.ok(other.getObjectByName('Conducteur assis').visible);
    b.dispose();assert.equal(disposed,1);
  }
});

test('four new civilian vehicle types can be found parked on Enfer, entered through a clear doorway, and observed in moving traffic',async t=>{
  globalThis.location=new URL('https://maille.test/');t.after(()=>delete globalThis.location);
  t.mock.method(globalThis,'fetch',async()=>new Response(await readFile(new URL('../public/map-enfer.gz',import.meta.url))));
  const {parkedCars,destinations,routeAgents,contactAt}=await import('../public/paris-world.js');
  const traffic=new Set();
  for(const stop of destinations)for(const time of [0,24,48]){
    for(const car of routeAgents(stop.x,stop.y,300,1780000121000+time*1000).cars)if(car.moving)traffic.add(car.type);
  }
  for(const type of ['gt','supercar']){
    assert.ok(traffic.has(type),type+' appears in moving traffic');
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
