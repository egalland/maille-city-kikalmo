import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
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
  find(label){return this.textContent===label?this:this.childNodes.map(c=>c.find(label)).find(Boolean);}
}
test('career controls start and replay a delivery, validate arrivals, credit cash and recover progress after reloading',async t=>{
  const DB=localDatabase();t.after(()=>DB.close());
  const saved={},account=new Map(),fields=new Map();
  let tickUI,clock=Date.now(),requests=[],vehicle=null,pos=careerPlaces.market;
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
    return createCareerUI({game:{getPosition:()=>pos},net:{getTransferIdentity:()=>who,status:'online',serverTime:()=>clock},
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
  clock+=14000;pos=careerPlaces.quay;await sync();tickUI();await fields.get('careerAction').onclick();
  const expected=(45+careerContracts.delivery.reward)+' ₣';
  await settle(()=>fields.get('careerBalance').textContent===expected);
  assert.ok(notices.some(x=>x.includes('Contrat rempli')));
  await accept();assert.equal(fields.get('careerInstruction').textContent,'Charger les ballots');
  await call('leave',who);who=identity();vehicle=null;await join();
  fields.clear();ui=makeUI();tickUI();await settle(()=>requests.filter(x=>x==='state').length>=2&&fields.get('careerBalance').textContent===expected);
  assert.equal(fields.get('careerInstruction').textContent,'Charger les ballots');
  assert.ok(fields.get('careerDetail').textContent.includes('Halles'));
});
