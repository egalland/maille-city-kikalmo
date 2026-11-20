import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
import {createCar} from '../public/puppets3d.js';
import {Box3,Vector3} from '../public/three.js';

test('concurrent seat requests are exclusive, proximity-checked, retry-safe and released on disconnect',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  const car={id:'cab-ride',type:'sedan',x:110,y:88,angle:0};
  const player=name=>({id:crypto.randomUUID(),token:crypto.randomUUID(),name,map:'enfer'});
  const [driver,a,b]=['Pilote','Mousse','Fil'].map(player);
  const call=async(who,method,body={})=>{
    const response=await handleApi(new Request('https://city.test/api/world/'+method,{
      method:'POST',body:JSON.stringify({...who,...body})
    }),{DB});
    assert.equal(response.status,200);return response.json();
  };
  const spot={x:110,y:90,health:100};
  const drive=speed=>({state:{...spot,x:110,y:88,vehicle:car,speed,health:100}});
  const board=(who,op='reserve')=>call(who,'sync',{events:[{type:'seat',op,data:{driver:driver.id,car:car.id}}]});
  const occupied=packet=>packet.players.filter(p=>p.passenger);
  await Promise.all([driver,a,b].map(who=>call(who,'join',{state:spot})));
  await call(driver,'sync',{...drive(0),events:[{op:'driver',type:'vehicle',data:{...car,occupied:true}}]});
  await call(a,'sync',{state:{...spot,x:120}});
  assert.deepEqual(occupied(await board(a,'tooFar')),[]);
  await call(a,'sync',{state:spot});
  await call(driver,'sync',drive(6));
  assert.deepEqual(occupied(await board(a,'tooFast')),[]);
  await call(driver,'sync',drive(0));
  await Promise.all([board(a),board(b)]);
  const seated=occupied(await call(driver,'sync'));
  assert.equal(seated.length,1);
  assert.deepEqual(seated[0].passenger,{driver:driver.id,car:car.id});
  const rider=seated[0].id===a.id?a:b,waiting=rider===a?b:a;
  await call(rider,'sync',{state:{...spot,x:9990,vehicle:{...car,id:'other'}}});
  const ride=occupied(await call(driver,'sync'));
  assert.equal(ride[0].x,110);assert.equal(ride[0].vehicle,null);
  await call(rider,'sync',{events:[{op:'exit',type:'seat',data:{leave:true}}]});
  assert.deepEqual(occupied(await board(rider)),[],'old claim cannot resurrect exited seat');
  await board(waiting,'newSeat');
  assert.equal(occupied(await call(driver,'sync'))[0].id,waiting.id);
  await call(driver,'leave');
  assert.deepEqual(occupied(await call(waiting,'sync')),[]);
});

test('car, compact, sedan, sports car, taxi and patrol share three-dimensional seated figures inside the glazing',()=>{
  for(const type of ['car','compact','sedan','sport','taxi','police']){
    const car=createCar(type),p={driver:true,self:true,passenger:true,driverSkin:'foret',passengerSkin:'bruyere'};
    car.update(p,.02,0);
    const objects=['Conducteur assis','Passager assis'].map(name=>car.group.getObjectByName(name));
    const bounds=objects.map(o=>new Box3().setFromObject(o,true));
    for(const [i,box] of bounds.entries()){
      assert.ok(objects[i].visible);
      const extent=box.getSize(new Vector3());assert.ok(extent.x>.2&&extent.y>.33&&extent.z>.21);
      assert.ok(box.min.y>.6&&box.max.y<1.75);
    }
    assert.ok(bounds[0].max.z<bounds[1].min.z);
    assert.notEqual(objects[0].children[0].geometry,objects[1].children[0].geometry);
    car.update({...p,passenger:false},.02,.1);
    assert.ok(!objects[1].visible);assert.ok(objects[0].visible);car.dispose();
  }
});
