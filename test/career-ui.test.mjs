import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import {incidentDepot,incidentObjectives,incidentPeriod,incidentKinds} from '../public/district-events.js';
import {createCareerUI} from '../public/career-ui.js';
import {careerPlaces,careerContracts} from '../public/career-catalog.js';
import {localDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../worker/game-api.js';

class Element {
  constructor(tag){this.tag=tag;this.childNodes=[];this.textContent='';this.style={};this.dataset={};}
  append(...els){this.childNodes.push(...els);}
  setAttribute(key,value){this[key]=value;}
  replaceChildren(...els){this.childNodes=els;}
  contains(el){return this===el||this.childNodes.some(c=>c.contains(el));}
  reportValidity(){return true;}
  find(label){return this.textContent===label?this:this.childNodes.map(c=>c.find(label)).find(Boolean);}
}
test('career controls start and replay a delivery, validate arrivals, credit cash and recover progress after reloading',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  const saved={},account=new Map(),fields=new Map();
  let sceneIncident,wakeEvent,tickUI,clock=Date.now(),requests=[],vehicle=null,pos=careerPlaces.market;
  const replace=(key,value)=>{
    saved[key]=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  };
  t.after(()=>{for(const [key,d] of Object.entries(saved))if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];});
  replace('document',{hidden:false,activeElement:null,createElement:tag=>new Element(tag),addEventListener(){},
    getElementById:id=>{if(!fields.has(id))fields.set(id,new Element(id));return fields.get(id);}});
  replace('window',{addEventListener(){}});
  replace('localStorage',{getItem:k=>account.get(k),setItem:(k,v)=>account.set(k,v)});
  replace('setInterval',fn=>{tickUI=fn;});
  t.mock.method(Date,'now',()=>clock);
  const call=(path,data)=>handleApi(new Request('https://city.test/api/world/'+path,{method:'POST',body:JSON.stringify(data)}),{DB});
  replace('fetch',async(url,init)=>{
    const body=JSON.parse(init.body);requests.push(body.action);
    return call(url.split('/').at(-1),body);
  });
  const identity=()=>({id:crypto.randomUUID(),token:crypto.randomUUID(),map:'enfer'});
  let who=identity(),sheet=new Element('sheet'),open=false,notices=[];
  const pose=()=>({x:pos.x,y:pos.y,speed:0,angle:0,health:100,vehicle});
  const sync=(events=[])=>call('sync',{...who,state:pose(),events});
  const join=()=>call('join',{...who,state:pose()});
  function makeUI(){
    return createCareerUI({game:{getPosition:()=>pos,setDistrictIncident(value){sceneIncident=value;}},net:{onEvent(fn){wakeEvent=fn;},getTransferIdentity:()=>who,status:'online',serverTime:()=>clock},
      getState:()=>({inVehicle:!!vehicle}),notify:text=>notices.push(text),
      modalOpen:()=>open,open:()=>{sheet.isConnected=open=true;ui.renderPanel(sheet);},
      close:()=>{sheet.isConnected=open=false;}});
  }
  async function settle(predicate){
    for(let i=0;i<100&&!predicate();i++)await wait(3);
    assert.ok(predicate(),notices.join(' / '));
  }
  let ui=makeUI();
  await join();tickUI();await settle(()=>fields.get('careerBalance').textContent==='45 ₣');
  const accept=()=>{fields.get('careerBadge').onclick();assert.ok(open);const button=sheet.find('Accepter');assert.equal(button.disabled,false);return button.onclick();};
  await accept();
  assert.equal(fields.get('careerInstruction').textContent,'Charger les ballots');
  assert.ok(fields.get('careerDetail').textContent.includes('Prends le volant'));
  assert.equal(fields.get('careerAction').hidden,true);
  vehicle={id:'ui-delivery',type:'van'};
  await sync([{type:'vehicle',op:'get-in',data:{...vehicle,x:pos.x,y:pos.y,occupied:true}}]);
  tickUI();assert.equal(fields.get('careerAction').hidden,false);
  await fields.get('careerAction').onclick();
  await settle(()=>fields.get('careerInstruction').textContent==='Livrer les ballots');
  assert.ok(fields.get('careerAction').hidden);
  clock+=14000;pos=careerPlaces.quay;await sync();tickUI();
  // A district event can expire during the drive. Wait until the refreshed
  // HUD enables the action, just as the browser button does.
  await settle(()=>!fields.get('careerAction').disabled);
  await fields.get('careerAction').onclick();
  const expected=(45+careerContracts.delivery.reward)+' ₣';
  await settle(()=>fields.get('careerBalance').textContent===expected);
  assert.ok(notices.some(x=>x.includes('Contrat rempli')));
  await accept();assert.equal(fields.get('careerInstruction').textContent,'Charger les ballots');
  await call('leave',who);who=identity();vehicle=null;await join();
  fields.clear();ui=makeUI();tickUI();await settle(()=>requests.filter(x=>x==='state').length>=2&&fields.get('careerBalance').textContent===expected);
  assert.equal(fields.get('careerInstruction').textContent,'Charger les ballots');
  assert.ok(fields.get('careerDetail').textContent.includes('Halles'));

  fields.get('careerBadge').onclick();sheet.find('Banque').onclick();
  assert.ok(sheet.find('Les guichets sont aux Halles, au garage et au commissariat.'));
  pos=careerPlaces.market;await sync();tickUI();
  await sheet.find('Déposer').onclick();
  assert.equal(fields.get('careerBalance').textContent,(45+careerContracts.delivery.reward-25)+' ₣');
  await sheet.find('Retirer').onclick();
  assert.equal(fields.get('careerBalance').textContent,expected);
  sheet.find('Boutique').onclick();
  const vest=sheet.find('Équiper un gilet · 55 ₣');
  assert.equal(vest.disabled,false);await vest.onclick();
  assert.equal(fields.get('careerArmor').textContent,'Protection · 40');
  assert.equal(fields.get('careerBalance').textContent,(45+careerContracts.delivery.reward-55)+' ₣');
  sheet.find('Contrats').onclick();
  await sheet.find('Quitter le contrat').onclick();
  const {lostWool,woolCounter,woolReward}=await import('../public/lost-wool.js');
  clock=(Math.floor(clock/720000)+1)*720000+1500;
  pos=lostWool(clock).point;await join();tickUI();
  await settle(()=>sheet.find('Chercher à pied')&&!fields.get('careerAction').disabled);
  sheet.find('Chercher à pied').onclick();tickUI();
  assert.equal(fields.get('careerAction').textContent,'Ramasser (G)');
  await fields.get('careerAction').onclick();
  assert.equal(fields.get('careerInstruction').textContent,'Rapporter la pelote');
  clock+=60000;pos=woolCounter;await join();tickUI();
  await settle(()=>!fields.get('careerAction').disabled);
  assert.equal(fields.get('careerAction').textContent,'Remettre (G)');
  await fields.get('careerAction').onclick();
  assert.equal(fields.get('careerBalance').textContent,(45+careerContracts.delivery.reward-55+woolReward)+' ₣');
  // A world incident selected on the server reaches the ordinary contract journal,
  // HUD action and scene props. A second player's update arrives over the world feed.
  clock=(Math.floor(clock/incidentPeriod)+1)*incidentPeriod+1000;
  await join();tickUI();
  await settle(()=>sceneIncident?.slot===Math.floor(clock/incidentPeriod));
  const incident=sceneIncident,spec=incidentKinds[incident.kind],first=incidentObjectives(incident,clock)[0];
  const originalCash=parseInt(fields.get('careerBalance').textContent);
  fields.get('careerBadge').onclick();assert.ok(sheet.find(spec.title));
  sheet.find('Suivre l’événement').onclick();assert.equal(open,false);
  pos=first.point;await sync();tickUI();
  assert.equal(fields.get('careerAction').textContent,first.verb+' (G)');
  await fields.get('careerAction').onclick();
  if(incident.kind==='parcels'){
    pos=incidentDepot;clock+=20000;await join();tickUI();
    assert.equal(fields.get('careerAction').textContent,'Livrer le ballot (G)');
    await fields.get('careerAction').onclick();
  }
  assert.equal(fields.get('careerBalance').textContent,(originalCash+spec.pay)+' ₣');
  assert.equal(sceneIncident.tasks.filter(t=>t.done).length,1);
  const next=incidentObjectives(sceneIncident,clock)[0];
  const other={...identity(),profile:crypto.randomUUID()};
  await call('join',{...other,state:{...next.point,health:100}});
  await call('career',{...other,action:'state'});
  const otherAction=await (await call('career',{...other,action:'incident',slot:incident.slot,task:next.task,operation:'work'})).json();
  assert.ok(otherAction.ok);
  const feed=await (await call('sync',{...who,state:pose(),cursor:0})).json();
  wakeEvent(feed.events.find(e=>e.player===other.id&&e.type==='districtUpdate'));
  clock+=1250;tickUI();
  await settle(()=>sceneIncident.tasks[next.task].done||sceneIncident.tasks[next.task].heldUntil>clock);

});
