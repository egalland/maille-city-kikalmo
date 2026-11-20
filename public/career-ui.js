import {incidentKinds,incidentObjectives,incidentRadius} from './district-events.js';
import {lostWool,woolReward,woolRadius} from './lost-wool.js';
import {browserProfile} from './ammunition.js';
import {careerPlaces,careerContracts,careerGarage,careerRadius} from './career-catalog.js';
import {outfitShop} from './outfit-shop.js';
import {placeSymbols,setCareerGoal} from './career-navigation.js';
const money=n=>Number(n).toLocaleString('fr-FR')+' ₣';
const until=(timestamp,now)=>Math.max(0,Math.ceil((timestamp-now)/1000));
const clock=seconds=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
const lapTime=ms=>clock(Math.floor(ms/1000))+','+String(Math.floor((ms%1000)/10)).padStart(2,'0');
const reach=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const make=(tag,style,label)=>{
  const e=document.createElement(tag);e.className=style;
  if(label!=null)e.textContent=label;
  return e;
};
function control(label,fn,style='mc-secondary'){
  const e=make('button',style,label);e.type='button';e.onclick=fn;return e;
}
export function createCareerUI({game,net,getState,notify,open,close,modalOpen}){
  const profile=browserProfile();
  const protection=document.getElementById('careerArmor');
  const badge=document.getElementById('careerBadge'),balance=document.getElementById('careerBalance');
  const overlay=document.getElementById('careerTarget'),instruction=document.getElementById('careerInstruction');
  const detail=document.getElementById('careerDetail'),action=document.getElementById('careerAction'),pin=document.getElementById('careerPin');
  badge.hidden=false;
  badge.onclick=open;
  let state=null,pending=false,lastRead=-Infinity,lastIssue='',manual=null,lastPanelKey='',panelBody=null,staged=null;
  let nextAction=null,transferAmount=25,incident=null,incidentReadDue=0;
  net.onEvent?.(e=>{if(e.type==='districtUpdate')incidentReadDue=0;});
  function eventObjective(){
    if(state?.mission||manual&&manual!=='district-event')return null;
    const pos=game.getPosition();
    const targets=incidentObjectives(incident,net.serverTime()).sort((a,b)=>reach(a.point,pos)-reach(b.point,pos));
    return targets[0]&&(manual==='district-event'||reach(targets[0].point,pos)<incidentRadius+.7)?targets[0]:null;
  }
  const contract=()=>careerContracts[state?.mission?.contract];
  const stage=()=>contract()?.stages[state.mission.stage];
  const wool=()=>lostWool(net.serverTime(),state?.wool);
  const showWool=()=>{
    const e=wool();
    if(!state||state.mission||!['find','carrying'].includes(e.phase))return false;
    return manual==='wool'||!manual&&(e.phase==='carrying'||reach(game.getPosition(),e.point)<5);
  };
  const goal=()=>eventObjective()?.point??(showWool()?wool().goal:stage()?careerPlaces[stage().place]:typeof manual==='object'?manual:careerPlaces[manual]);
  function nearby(){
    const self=game.getPosition();
    return Object.values(careerPlaces).find(p=>reach(p,self)<=careerRadius);
  }
  function guide(id){
    if(state?.mission){notify('Termine ou quitte le contrat en cours pour changer de destination.');return;}
    manual=id;close();update();
  }
  async function send(which,{contract:job,amount,dye,slot,task,operation}={}){
    if(pending||net.status!=='online'){if(which!=='state')notify('La connexion au monde est nécessaire.');return;}
    const before=state;
    pending=true;lastRead=Date.now();
    if(which==='state'||which==='incident')incidentReadDue=Infinity;
    update();
    const {id,token}=net.getTransferIdentity();
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
    try{
      const response=await fetch('/api/world/career',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
        body:JSON.stringify({map:'enfer',id,token,profile,action:which,revision:before?.revision,contract:job,amount,dye,slot,task,operation,wear:game.getArmorWear?.()}),signal:abort.signal});
      const data=await response.json();
      if(data.incident){
        const incoming=data.incident,newDraw=incident?.slot!==incoming.slot;
        incident=incoming;
        const now=net.serverTime();
        const expiry=[incoming.ends,incoming.next,...incoming.tasks.map(t=>t.heldUntil)].filter(t=>t>now);
        incidentReadDue=Math.min(incidentReadDue,...expiry);
        if(newDraw&&incoming.ends>now&&!incoming.tasks.every(t=>t.done))
          notify('Événement de quartier · '+incidentKinds[incoming.kind].title+' · Missions');
        if(incoming.tasks.every(t=>t.done)&&manual==='district-event')manual=null;
      }
      if(data.state){
        state=data.state;
        game.setCareerOutfit?.(state);
        game.setFarePassenger?.(state.mission?.contract==='taxi'&&state.mission.stage>0?state.mission.car:null);
      }
      if(!response.ok||!data.ok)throw Error(data.error||'Le registre est momentanément indisponible.');
      lastIssue='';
      if(data.notice&&!data.vehicle){notify(data.notice);return;}
      if(which==='woolPick'){manual='wool';notify('Pelote ramassée · Rapporte-la à la mercerie.');}
      if(which==='woolReturn'){manual=null;notify('Pelote rendue · +'+money(woolReward));}
      if(which==='start'){manual=null;close();notify(contract().title);}
      if(which==='advance'){
        if(!state.mission)notify('Contrat rempli · +'+money(state.cash-before.cash));
        else notify('Étape validée · '+stage().label);
      }
      if(which==='cancel')notify('Contrat quitté.');
      if(which==='buyArmor')notify('Protection équipée.');
      if(which==='buyDye'||which==='equipDye')notify('Tenue mise à jour.');
      if(which==='publishLap')notify('Ton chrono est publié.');
      if(which==='hideLap')notify('Ton chrono a été retiré.');
      if(which==='license')notify('La licence de ton atelier est active.');
      if(which==='collectRent')notify('Recettes encaissées · +'+money(state.cash-before.cash));
      if(which==='deposit'||which==='withdraw')notify('Virement effectué · '+money(amount));
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
  const act=()=>{if(nextAction&&!pending)return nextAction();};
  action.onclick=act;
  function update(){
    const now=net.serverTime(),pos=game.getPosition(),life=getState(),s=stage(),point=goal(),place=nearby();
    const ev=wool(),eventGoal=showWool(),localEvent=eventObjective();
    game.setDistrictIncident?.(incident?.ends>now?incident:null);
    if(manual==='district-event'&&incident?.ends<=now)manual=null;
    game.setLostWool?.(state&&ev.phase==='find'?ev.point:null);
    if(manual==='wool'&&!eventGoal)manual=null;
    setCareerGoal(point);
    const name=state?money(state.cash):'— ₣';
    if(balance.textContent!==name)balance.textContent=name;
    const armor=life.armor??state?.armor??0;
    protection.hidden=armor<=0;
    if(armor>0){
      const text='Protection · '+armor;
      if(protection.textContent!==text)protection.textContent=text;
    }
    nextAction=null;
    const service=['market','garage','police'].includes(place?.id);
    overlay.hidden=!(point||service);
    if(point||service){
      const target=point||place,dist=reach(pos,target),at=dist<=careerRadius;
      const remaining=state?.mission?until(state.mission.deadline,now):null;
      instruction.textContent=s?s.label:target.name;
      detail.textContent=[s?target.name:'',dist>=1000?(dist/1000).toFixed(1).replace('.',',')+' km':Math.round(dist)+' m',remaining===null?'':clock(remaining)].filter(Boolean).join(' · ');
      let verb='';
      if(localEvent){
        const publicJob=incidentKinds[incident.kind];
        instruction.textContent=localEvent.verb;
        detail.textContent=target.name+' · '+Math.round(dist)+' m · '+incident.tasks.filter(t=>t.done).length+'/3 · '+clock(until(incident.ends,now));
        if(dist<=incidentRadius){
          if(life.inVehicle)detail.textContent+=' · Descends du véhicule';
          else{verb=localEvent.verb;nextAction=()=>send('incident',{slot:incident.slot,task:localEvent.task,operation:localEvent.operation});}
        }
        if(!verb&&dist>incidentRadius)instruction.textContent=publicJob.title;
      }else if(eventGoal){
        const collect=ev.phase==='find';
        instruction.textContent=collect?'Retrouver la pelote':'Rapporter la pelote';
        detail.textContent=target.name+' · '+Math.round(dist)+' m · '+clock(until(ev.ends,now));
        if(dist<=woolRadius){
          if(life.inVehicle)detail.textContent+=' · Descends du véhicule';
          else{verb=collect?'Ramasser':'Remettre';nextAction=()=>send(collect?'woolPick':'woolReturn',{slot:ev.slot});}
        }
      }else if(at&&s&&remaining>0){
        if(s.vehicle&&life.inVehicle&&!life.passenger&&contract().id!=='race'&&life.speed>14){
          detail.textContent+=' · Ralentis pour t’arrêter';
        }else if(!s.vehicle||life.inVehicle&&!life.passenger){verb='Valider';nextAction=()=>send('advance');}
        else detail.textContent+=' · Prends le volant';
      }else if(at&&target.id==='garage'){verb='Garage';nextAction=()=>{staged='garage';open();};}
      else if(at&&target.id==='market'){verb='Boutique';nextAction=()=>{staged='shop';open();};}
      else if(at&&service&&target.id===place.id){verb='Banque';nextAction=()=>{staged='bank';open();};}
      else if(at&&!s){verb='Terminer';nextAction=()=>{manual=null;update();};}
      action.hidden=!verb;action.disabled=pending||life.lifeState==='down';action.textContent=verb+' (G)';
      const projected=dist<95&&game.projectPlace?.(target.x,target.y);
      pin.hidden=!projected||Boolean(modalOpen());
      if(projected&&!pin.hidden){
        pin.textContent=localEvent?'!':eventGoal?'●':placeSymbols[target.id]||'V';pin.style.left=(projected.x*100)+'%';pin.style.top=(projected.y*100)+'%';
        pin.setAttribute('aria-label',target.name);
      }
    }else pin.hidden=true;
    if(panelBody?.isConnected)renderPanel(panelBody);
    if(!document.hidden&&net.status==='online'&&!pending){
      const interval=game.getArmorWear?.()?900:(!state||state.mission&&(until(state.mission.deadline,now)===0||life.lifeState==='down'))?4000:30000;
      if(Date.now()-lastRead>=interval||now>=incidentReadDue&&Date.now()-lastRead>=900)void send('state');
    }
  }
  function renderPanel(body){
    panelBody=body;
    const pos=game.getPosition(),here=reach(pos,careerPlaces.garage)<=careerRadius,car=getState();
    const inBank=['garage','market','police'].includes(nearby()?.id);
    const market=nearby()?.id==='market';
    const key=JSON.stringify([incident,incident?.ends>net.serverTime(),wool().phase,wool().slot,market,inBank,car.armor,state?.leaders,state?.revision,state?.cash,state?.mission,nowOnline(),here,car.inVehicle,car.vehicleHealth,pending,lastIssue,staged]);
    if(key===lastPanelKey&&body.childNodes.length)return;
    lastPanelKey=key;
    body.dataset.transferFocus=document.activeElement?.id==='career-amount'?'1':'0';
    const focused=body.contains(document.activeElement)?document.activeElement.textContent:null;
    const summary=make('div','career-account');
    summary.append(make('span','','Portefeuille'),make('strong','',state?money(state.cash):'—'));
    if(state)summary.append(make('small','',state.reputation+' de réputation'));
    const tabs=make('div','career-tabs');
    tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Rubrique');
    for(const [id,title] of [[null,'Contrats'],['garage','Atelier'],['bank','Banque'],['shop','Boutique']]){
      const tab=control(title,()=>{staged=id;renderPanel(body);},'career-tab');
      tab.setAttribute('aria-pressed',String(staged===id));tabs.append(tab);
    }
    const job=contract();
    function jobsPage(){
      const list=make('div','career-jobs');
      if(incident&&incident.ends>net.serverTime()&&!job){
        const spec=incidentKinds[incident.kind],complete=incident.tasks.filter(t=>t.done).length;
        const card=make('article','career-job career-public-event'),head=make('div','career-job-head'),title=make('div','');
        title.append(make('small','','Événement de ville · Monde partagé'),make('h3','',spec.title));
        head.append(title,make('strong','career-reward','+'+money(spec.pay)+' / étape'));
        const foot=make('div','career-job-foot');
        foot.append(make('span','',complete+' / 3 '+spec.unit));
        if(complete<3){
          const follow=control('Suivre l’événement',()=>guide('district-event'),'mc-primary');
          foot.append(follow);
        }
        card.append(head,make('p','',complete===3?'Le quartier a terminé cet événement.':spec.description),foot);
        list.append(card);
      }
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
        const type={delivery:'Livraison',taxi:'Transport',race:'Course',relay:'Coopération'}[job.id];
        copy.append(make('small','',type+' · '+job.difficulty),make('h3','',job.title));
        heading.append(copy,make('strong','career-reward','+'+money(job.reward)));
        const take=control(job.cooperative?'Accepter en duo':'Accepter',()=>send('start',{contract:job.id}),'mc-primary');
        take.disabled=!state||pending||!nowOnline();
        const foot=make('div','career-job-foot');foot.append(make('span','',job.stages.length+' étapes · '+clock(job.seconds)),take);
        card.append(heading,make('p','',job.description),foot);
        if(job.id==='race'){
          const ranking=make('details','career-ranking');
          ranking.append(make('summary','','Chronos du quartier'));
          if(state?.leaders?.length){
            const scores=make('ol','');
            for(const lap of state.leaders)scores.append(make('li','',lap.name+' · '+lapTime(lap.ms)));
            ranking.append(scores);
          }else ranking.append(make('p','','Aucun chrono publié.'));
          if(state?.bestLapMs){
            ranking.append(make('p','','Ton record · '+lapTime(state.bestLapMs)));
            if(!state.publicLapMs||state.bestLapMs<state.publicLapMs){
              const share=control('Publier mon chrono',()=>send('publishLap'));share.disabled=pending;ranking.append(share);
            }
            if(state.publicLapMs){const hide=control('Retirer mon chrono',()=>send('hideLap'));hide.disabled=pending;ranking.append(hide);}
          }
          ranking.open=Boolean(body.querySelector?.('.career-ranking')?.open);
          card.append(ranking);
        }
        list.append(card);
      }
      const event=wool();
      if(!job&&state&&['find','carrying'].includes(event.phase)){
        const card=make('article','career-job'),head=make('div','career-job-head');
        head.append(make('h3','','La pelote égarée'),make('strong','career-reward','+'+money(woolReward)));
        const track=control(event.phase==='carrying'?'Rejoindre la mercerie':'Chercher à pied',()=>guide('wool'));
        card.append(head,make('p','',event.phase==='carrying'?'La mercerie des Halles attend ta trouvaille.':
          'Une pelote est tombée près de '+event.point.name+'. Retrouve-la avant la fin de la collecte.'),track);
        list.append(card);
      }
      return list;
    }
    function garagePage(){
      const workshop=make('section','career-garage');
      const title=make('h3','','Garage des Deux Bornes');
      workshop.append(title);
      const info=make('p','',here?'Atelier et retrait de la citadine.':'Rejoins l’atelier pour réparer ou retirer un véhicule.');
      workshop.append(info);
      if(!here){
        const guideButton=control('Guider vers le garage',()=>guide('garage'));guideButton.disabled=!!job;workshop.append(guideButton);
      }else{
        const buy=control(state?.owned?'Sortir ma citadine':'Acheter la citadine · '+money(careerGarage.price),()=>send(state?.owned?'collect':'buy'),'mc-primary');
        buy.disabled=pending||!nowOnline()||!state||car.inVehicle||(!state.owned&&state.cash<careerGarage.price);
        const price=state?.licensed?careerGarage.memberRepair:careerGarage.repair;
        const repair=control('Réparer · '+money(price),()=>send('repair'));
        repair.disabled=pending||!nowOnline()||!state||!car.inVehicle||car.passenger||state.cash<price||(car.vehicleHealth??100)>=100||(car.vehicleHealth??100)<=32;
        workshop.append(buy,repair);
        if(car.inVehicle)workshop.append(make('small','','Pour retirer ta citadine, descends de ton véhicule.'));
        if(state&&!car.inVehicle)workshop.append(make('small','','Pour réparer, entre dans l’atelier au volant.'));
      }
      const license=make('section','career-property');
      license.append(make('h4','',state?.licensed?'Ton atelier':'Licence d’atelier'));
      if(state?.licensed){
        license.append(make('p','','Recettes à encaisser · '+money(state.revenue)));
        const collect=control('Encaisser les recettes',()=>send('collectRent'));
        collect.disabled=!here||pending||!state.revenue||!nowOnline();license.append(collect);
      }else{
        license.append(make('p','','Réparations à '+money(careerGarage.memberRepair)+' et '+money(careerGarage.rentPerContract)+' de recettes par contrat réalisé, jusqu’à '+money(careerGarage.rentCap)+' en caisse.'));
        const acquire=control('Acheter la licence · '+money(careerGarage.licensePrice),()=>send('license'));
        acquire.disabled=!here||!state||state.cash<careerGarage.licensePrice||pending||!nowOnline();license.append(acquire);
      }
      workshop.append(license);
      return workshop;
    }
    function bankPage(){
      const bank=make('section','career-garage');
      bank.append(make('h3','','Compte courant'),make('p','career-bank-balance',state?money(state.bank):'—'));
      if(inBank){
        const label=make('label','career-transfer-label','Montant du transfert (₣)');
        const field=make('input','mc-input');field.type='number';field.min='1';field.max='1000000';field.step='1';
        field.inputMode='numeric';field.value=String(transferAmount);label.htmlFor='career-amount';field.id='career-amount';
        const debit=(action)=>{if(field.reportValidity())return send(action,{amount:Number(field.value)});};
        const deposit=control('Déposer',()=>debit('deposit'),'mc-primary'),withdraw=control('Retirer',()=>debit('withdraw'));
        const updateButtons=()=>{
          const amount=Number(field.value);
          const unavailable=!state||pending||!nowOnline()||!Number.isSafeInteger(amount)||amount<1;
          deposit.disabled=unavailable||amount>state?.cash;withdraw.disabled=unavailable||amount>state?.bank;
        };
        field.oninput=()=>{transferAmount=field.value;updateButtons();};updateButtons();
        bank.append(label,field,deposit,withdraw);
      }else{
        bank.append(make('p','','Les guichets sont aux Halles, au garage et au commissariat.'));
        const nearest=['market','garage','police'].map(id=>careerPlaces[id]).sort((a,b)=>reach(pos,a)-reach(pos,b))[0];
        const go=control('Guider vers le guichet · '+nearest.name,()=>guide(nearest.id));go.disabled=!!job;bank.append(go);
      }
      return bank;
    }
    function shopPage(){
      const shop=make('section','career-garage');
      shop.append(make('h3','','Mercerie des Halles'));
      if(!market){
        shop.append(make('p','','Les achats se font au comptoir des Halles des Tisserands.'));
        const route=control('Guider vers les Halles',()=>guide('market'));route.disabled=!!job;shop.append(route);
      }
      const armor=make('section','career-property');
      armor.append(make('h4','','Gilet de laine renforcée'),make('p','','Protection · '+(car.armor??state?.armor??0)+' / '+outfitShop.armorMax));
      const vest=control('Équiper un gilet · '+money(outfitShop.armorPrice),()=>send('buyArmor'));
      vest.disabled=!state||pending||!nowOnline()||!market||state.cash<outfitShop.armorPrice||(state.armor||0)>0;
      armor.append(vest);shop.append(armor);
      const dyes=make('section','career-property');dyes.append(make('h4','','Teintures'));
      for(const [id,spec] of Object.entries(outfitShop.dyes)){
        const owned=state?.dyes?.includes(id),worn=state?.dye===id;
        const row=make('div','career-dye'),swatch=make('span','career-dye-swatch');
        swatch.style.backgroundColor=spec.color;
        const buy=control(worn?'Équipée':owned?'Équiper':money(spec.price),()=>send(owned?'equipDye':'buyDye',{dye:id}));
        buy.disabled=!state||pending||!nowOnline()||!market||worn||!owned&&state.cash<spec.price;
        buy.setAttribute('aria-label',(worn?'Équipée · ':owned?'Équiper ':'Acheter ')+spec.label);
        row.append(swatch,make('span','',spec.label),buy);dyes.append(row);
      }
      if(state?.dye){
        const reset=control('Reprendre la couleur d’origine',()=>send('equipDye',{dye:null}));
        reset.disabled=pending||!nowOnline()||!market;dyes.append(reset);
      }
      shop.append(dyes);return shop;
    }
    const footer=make('p','career-message',lastIssue||(!nowOnline()?'Le registre s’ouvre à la reconnexion.':''));
    footer.setAttribute('role','status');body.replaceChildren(summary,tabs,({bank:bankPage,garage:garagePage,shop:shopPage}[staged]||jobsPage)(),footer);
    if(staged==='bank'&&document.activeElement===document.body&&body.dataset.transferFocus==='1'){body.querySelector('#career-amount')?.focus({preventScroll:true});}
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
