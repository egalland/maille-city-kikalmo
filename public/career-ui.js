import {careerPlaces,careerContracts,careerGarage,careerRadius} from './career-catalog.js';
import {placeSymbols,setCareerGoal} from './career-navigation.js';
import {vehicleSpec} from './vehicle-types.js';
const money=n=>Number(n).toLocaleString('fr-FR')+' ₣';
const until=(timestamp,now)=>Math.max(0,Math.ceil((timestamp-now)/1000));
const clock=seconds=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
const reach=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const make=(tag,style,label)=>{
  const e=document.createElement(tag);e.className=style;
  if(label!=null)e.textContent=label;
  return e;
};
function control(label,fn,style='mc-secondary'){
  const e=make('button',style,label);e.type='button';e.onclick=fn;return e;
}
function persistentProfile(){
  const key='maillecity.career.profile.v1';
  try{
    const stored=localStorage.getItem(key);
    if(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(stored||''))return stored;
    const id=crypto.randomUUID();localStorage.setItem(key,id);return id;
  }catch{return crypto.randomUUID();}
}
export function createCareerUI({game,net,getState,notify,open,close,modalOpen}){
  const profile=persistentProfile();
  const badge=document.getElementById('careerBadge'),balance=document.getElementById('careerBalance');
  const overlay=document.getElementById('careerTarget'),instruction=document.getElementById('careerInstruction');
  const detail=document.getElementById('careerDetail'),action=document.getElementById('careerAction'),pin=document.getElementById('careerPin');
  badge.hidden=false;
  badge.onclick=open;
  let state=null,pending=false,lastRead=-Infinity,lastIssue='',manual=null,lastPanelKey='',panelBody=null,staged=null;
  let nextAction=null;
  const contract=()=>careerContracts[state?.mission?.contract];
  const stage=()=>contract()?.stages[state.mission.stage];
  const goal=()=>stage()?careerPlaces[stage().place]:typeof manual==='object'?manual:careerPlaces[manual];
  function nearby(){
    const self=game.getPosition();
    return Object.values(careerPlaces).find(p=>reach(p,self)<=careerRadius);
  }
  function guide(id){
    if(state?.mission){notify('Termine ou quitte le contrat en cours pour changer de destination.');return;}
    manual=id;close();update();
  }
  async function send(which,job){
    if(pending||net.status!=='online'){if(which!=='state')notify('La connexion au monde est nécessaire.');return;}
    const before=state;
    pending=true;lastRead=Date.now();update();
    const {id,token}=net.getTransferIdentity();
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
    try{
      const response=await fetch('/api/world/career',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
        body:JSON.stringify({map:'enfer',id,token,profile,action:which,revision:before?.revision,contract:job}),signal:abort.signal});
      const data=await response.json();
      if(data.state)state=data.state;
      if(!response.ok||!data.ok)throw Error(data.error||'Le registre est momentanément indisponible.');
      lastIssue='';
      if(data.notice&&!data.vehicle){notify(data.notice);return;}
      if(which==='start'){manual=null;close();notify(contract().title);}
      if(which==='advance'){
        if(!state.mission)notify('Contrat rempli · +'+money(state.cash-before.cash));
        else notify('Étape validée · '+stage().label);
      }
      if(which==='cancel')notify('Contrat quitté.');
      if(which==='repair')notify('Véhicule réparé au garage.');
      if(which==='buy'||which==='collect'){
        if(data.vehicle)manual={id:data.vehicle.id,x:data.vehicle.x,y:data.vehicle.y,name:'Ta citadine'};
        close();notify(data.notice||'Ta citadine est prête devant le garage.');
      }
      if(which==='state'&&before&&state.cash>before.cash)notify('Versement reçu · +'+money(state.cash-before.cash));
    }catch(err){
      lastIssue=err instanceof TypeError||err.name==='AbortError'?'Connexion au registre interrompue.':err.message;
      if(which!=='state')notify(lastIssue);
    }finally{clearTimeout(timer);pending=false;update();}
  }
  const act=()=>{if(nextAction&&!pending)nextAction();};
  action.onclick=act;
  function update(){
    const now=net.serverTime(),pos=game.getPosition(),life=getState(),s=stage(),point=goal(),place=nearby();
    setCareerGoal(point);
    const name=state?money(state.cash):'— ₣';
    if(balance.textContent!==name)balance.textContent=name;
    nextAction=null;
    const needsGarage=place?.id==='garage';
    overlay.hidden=!(point||needsGarage);
    if(point||needsGarage){
      const target=point||place,dist=reach(pos,target),at=dist<=careerRadius;
      const remaining=state?.mission?until(state.mission.deadline,now):null;
      instruction.textContent=s?s.label:target.name;
      detail.textContent=[s?target.name:'',dist>=1000?(dist/1000).toFixed(1).replace('.',',')+' km':Math.round(dist)+' m',remaining===null?'':clock(remaining)].filter(Boolean).join(' · ');
      let verb='';
      if(at&&s&&remaining>0){
        if(s.vehicle&&life.inVehicle&&!life.passenger&&contract().id!=='race'&&life.speed>14){
          detail.textContent+=' · Ralentis pour t’arrêter';
        }else if(!s.vehicle||life.inVehicle&&!life.passenger){verb='Valider';nextAction=()=>void send('advance');}
        else detail.textContent+=' · Prends le volant';
      }else if(at&&target.id==='garage'){verb='Garage';nextAction=()=>{staged='garage';open();};}
      else if(at&&!s){verb='Terminer';nextAction=()=>{manual=null;update();};}
      action.hidden=!verb;action.disabled=pending||life.lifeState==='down';action.textContent=verb+' (G)';
      const projected=dist<95&&game.projectPlace?.(target.x,target.y);
      pin.hidden=!projected||Boolean(modalOpen());
      if(projected&&!pin.hidden){
        pin.textContent=placeSymbols[target.id]||'V';pin.style.left=(projected.x*100)+'%';pin.style.top=(projected.y*100)+'%';
        pin.setAttribute('aria-label',target.name);
      }
    }else pin.hidden=true;
    if(panelBody?.isConnected)renderPanel(panelBody);
    if(!document.hidden&&net.status==='online'&&!pending){
      const interval=(!state||state.mission&&until(state.mission.deadline,now)===0)?4000:30000;
      if(Date.now()-lastRead>=interval)void send('state');
    }
  }
  function renderPanel(body){
    panelBody=body;
    const pos=game.getPosition(),here=reach(pos,careerPlaces.garage)<=careerRadius,car=getState();
    const key=JSON.stringify([state?.revision,state?.cash,state?.mission,nowOnline(),here,car.inVehicle,car.vehicleHealth,pending,lastIssue,staged]);
    if(key===lastPanelKey&&body.childNodes.length)return;
    lastPanelKey=key;
    const focused=body.contains(document.activeElement)?document.activeElement.textContent:null;
    const summary=make('div','career-account');
    summary.append(make('span','','Portefeuille'),make('strong','',state?money(state.cash):'—'));
    if(state)summary.append(make('small','',state.reputation+' de réputation'));
    const list=make('div','career-jobs');
    const job=contract();
    if(job){
      const current=make('article','career-active'),objective=stage();
      current.append(make('h3','',job.title),make('p','',objective.label+' · '+careerPlaces[objective.place].name));
      const progress=make('ol','career-steps');
      job.stages.forEach((step,i)=>{
        const row=make('li',i<state.mission.stage?'done':i===state.mission.stage?'current':'',step.label);
        if(i===state.mission.stage)row.setAttribute('aria-current','step');
        progress.append(row);
      });
      current.append(progress,control('Reprendre la mission',close,'mc-primary'),control('Quitter le contrat',()=>send('cancel'),'career-text'));
      if(job.id!=='race')current.append(make('p','career-coop','En duo, le passager qui accompagne toute la tournée reçoit une prime de 35 %.'));
      list.append(current);
    }else for(const job of Object.values(careerContracts)){
      const card=make('article','career-job'),heading=make('div','career-job-head'),copy=make('div','');
      const type={delivery:'Livraison',taxi:'Transport',race:'Course'}[job.id];
      copy.append(make('small','',type+' · '+job.difficulty),make('h3','',job.title));
      heading.append(copy,make('strong','career-reward','+'+money(job.reward)));
      const take=control('Accepter',()=>send('start',job.id),'mc-primary');
      take.disabled=!state||pending||!nowOnline();
      const foot=make('div','career-job-foot');foot.append(make('span','',job.stages.length+' étapes · '+clock(job.seconds)),take);
      card.append(heading,make('p','',job.description),foot);list.append(card);
    }
    const workshop=make('details','career-garage');
    workshop.open=staged==='garage';
    const title=make('summary','','Garage des Deux Bornes');
    workshop.ontoggle=()=>{if(workshop.isConnected)staged=workshop.open?'garage':null;};
    workshop.append(title);
    const info=make('p','',here?'Atelier et retrait de la citadine.':'Rejoins l’atelier pour réparer ou retirer un véhicule.');
    workshop.append(info);
    if(!here){
      const guideButton=control('Guider vers le garage',()=>guide('garage'));guideButton.disabled=!!job;workshop.append(guideButton);
    }else{
      const buy=control(state?.owned?'Sortir ma citadine':'Acheter la citadine · '+money(careerGarage.price),()=>send(state?.owned?'collect':'buy'),'mc-primary');
      buy.disabled=pending||!nowOnline()||!state||car.inVehicle||(!state.owned&&state.cash<careerGarage.price);
      const repair=control('Réparer · '+money(careerGarage.repair),()=>send('repair'));
      repair.disabled=pending||!nowOnline()||!state||!car.inVehicle||car.passenger||state.cash<careerGarage.repair||(car.vehicleHealth??100)>=100;
      workshop.append(buy,repair);
      if(car.inVehicle)workshop.append(make('small','','Pour retirer ta citadine, descends de ton véhicule.'));
      if(state&&!car.inVehicle)workshop.append(make('small','','Pour réparer, entre dans l’atelier au volant.'));
    }
    const footer=make('p','career-message',lastIssue||(!nowOnline()?'Le registre s’ouvre à la reconnexion.':''));
    footer.setAttribute('role','status');body.replaceChildren(summary,list,workshop,footer);
    if(manual&&!job)body.append(control('Arrêter le guidage',()=>{manual=null;lastPanelKey='';update();}));
    if(focused)Array.from(body.querySelectorAll('button,summary')).find(el=>el.textContent===focused)?.focus({preventScroll:true});
  }
  function nowOnline(){return net.status==='online';}
  function updateKey(event){
    if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||modalOpen()||event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    if(event.code!=='KeyG'||!nextAction||action.disabled)return;
    event.preventDefault();event.stopImmediatePropagation();act();
  }
  window.addEventListener('keydown',updateKey,true);
  document.addEventListener('maille:arrest',()=>{if(state?.mission&&!pending)void send('cancel');});
  setInterval(()=>{if(!document.hidden)update();},250);
  return {renderPanel,guide,openPanel(){lastPanelKey='';}};
}
