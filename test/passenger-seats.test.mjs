import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';
import {createCar,createPuppet} from '../public/puppets3d.js';
import {cabinOccupant} from '../public/cabin-rider.js';
import {motionSeed} from '../public/locomotion-pose.js';
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

test('the seated driver and passenger wear their complete walking models at world scale inside each cab',()=>{
  const options={driver:true,peer:true,id:'peer-41',driverSkin:'foret~indigo',passenger:true,passengerId:'peer-57',passengerSkin:'bruyere'};
  const walking=[options.id,options.passengerId].map((id,i)=>createPuppet('fox',i?options.passengerSkin:options.driverSkin,motionSeed(id)%65535));
  for(const type of ['car','compact','sedan','sport','taxi','police','bus','van','swat','ambulance','firetruck','estate','flatbed','camper','pickup','helicopter','airship']){
    const car=createCar(type);car.update(options,.02,0);car.group.updateMatrixWorld(true);
    const actors=['Conducteur assis','Passager assis'].map(name=>car.group.getObjectByName(name));
    for(const [i,actor] of actors.entries()){
      assert.ok(actor.visible,type);
      const fit=actor.parent.userData.cabinFit,head=actor.getObjectByName('head');
      for(const part of ['torso','cape','head','eyes','earL','armL','elbowL','legR','kneeR','tail']){
        const seated=actor.getObjectByName(part),walkingPart=walking[i].group.getObjectByName(part);
        assert.deepEqual(seated.children.filter(n=>n.isMesh).map(n=>n.geometry.uuid),walkingPart.children.filter(n=>n.isMesh).map(n=>n.geometry.uuid),type+' '+part);
      }
      const size=head.getWorldScale(new Vector3());
      assert.ok(Math.abs(size.x-1)<.005&&Math.abs(size.y-1)<.005&&Math.abs(size.z-1)<.005,type+' world scale');
      const skull=new Box3().setFromObject(head,true),roof=actor.parent.localToWorld(new Vector3(fit.x,fit.roof,0));
      assert.ok(skull.max.y<roof.y+.014,type+' roof clearance');
      const foot=new Box3().setFromObject(actor.getObjectByName('kneeL'),true);
      assert.ok(foot.min.y>0&&foot.min.y<skull.min.y-.32,type+' feet inside cab');
      assert.ok(i?skull.min.z>-.012:skull.max.z<.012,type+' separate seats');
    }
    const d=actors[0],f=d.parent.userData.cabinFit;
    function hand(side){
      const n=d.getObjectByName(side<0?'elbowL':'elbowR');
      return n.localToWorld(new Vector3(.061,-.166,side*.011));
    }
    const wheel=d.parent.localToWorld(new Vector3(...f.wheel)),left=hand(-1);
    assert.ok(Math.abs(left.distanceTo(wheel)-f.radius)<.003,type+' grip the rim');
    car.update({...options,passenger:false,steer:1},.02,.1);car.group.updateMatrixWorld(true);
    assert.ok(!actors[1].visible);assert.ok(d.visible&&left.distanceTo(hand(-1))>.05,type+' steer');
    car.dispose();
  }
  for(const model of walking)model.dispose();
});

test('seats keep the NPC appearance through ejection, simplify at distance and empty on exit',()=>{
  const pose={id:'route-13',driver:true},car=createCar('car');
  const walking=createPuppet('human',undefined,motionSeed('exit-route-13')%65535);
  assert.equal(cabinOccupant({...pose,siren:true},0,'police').role,'police');
  car.update(pose);const named=()=>car.group.getObjectByName('Conducteur assis');
  const geometry=node=>node.children.filter(n=>n.isMesh).map(n=>n.geometry.uuid);
  assert.deepEqual(geometry(named().getObjectByName('head')),geometry(walking.group.getObjectByName('head')));
  car.update({...pose,cabinDistance:30});assert.ok(named().visible&&named().children.length<=4&&!named().getObjectByName('head'));
  car.update({...pose,cabinDistance:70});assert.equal(named().visible,false);
  car.update({...pose,cabinDistance:8});assert.ok(named().getObjectByName('head'));
  car.update({...pose,driver:false});assert.equal(named().visible,false);
  car.dispose();walking.dispose();
});

test('a cab renders the actual customer and passenger together, animates its door and switches lights by range and deceleration',async()=>{
  const {automaticLights,doorOpening}=await import('../public/vehicle-signals.js');
  const {cityClimate}=await import('../public/city-climate.js');
  assert.ok(automaticLights(cityClimate(0)));
  assert.equal(automaticLights({rain:0,lamps:.1}),false);
  const cab=createCar('taxi');
  const update=(args,dt=.025)=>cab.update({driver:true,passenger:true,passengerSkin:'bruyere',self:true,headlamps:true,speed:9,...args},dt,5);
  const part=name=>cab.group.getObjectByName(name);
  update({fare:true,doorOpen:doorOpening(1000,1400,1)});
  assert.ok(part('Portière ouverte').rotation.y>.7);
  assert.ok(part('Client du taxi').visible&&part('Passager assis').visible&&part('Conducteur assis').visible);
  assert.ok(part('Feux de croisement').visible);
  assert.ok(!part('Feux stop').visible);
  update({fare:false,doorOpen:doorOpening(1000,2100,1),speed:7});
  assert.ok(part('Feux stop').visible&&!part('Portière ouverte').visible&&!part('Client du taxi').visible);
  update({signalDetail:false});assert.ok(!part('Feux stop').visible&&!part('Feux de croisement').visible);
  update({wrecked:true});assert.ok(!part('Feux de croisement').visible);
  cab.dispose();
});
