import {isMuted} from './social-controls.js';
const blank=()=>({partner:null,received:[],sent:null});
let tracked=null;
export function teammate(){
  return tracked?.()||null;
}
export function createPartners(net,{map,changed,notify}){
  let state=blank(),signature='',busy=false,lastPoll=-Infinity,revision=0;
  const name=id=>net.players().find(p=>p.id===id)?.name||'Joueur';
  tracked=()=>state.partner&&net.players().find(p=>p.id===state.partner);
  function apply(next){
    const key=JSON.stringify(next);
    if(key===signature)return;
    const incoming=next.received.find(id=>!state.received.includes(id)&&!isMuted(id));
    if(incoming)notify(name(incoming)+' t’invite en duo · Joueurs');
    if(next.partner&&next.partner!==state.partner)notify('En duo avec '+name(next.partner)+' · Tir allié bloqué');
    state=next;signature=key;revision++;changed();
  }
  async function command(action,target){
    if(busy||net.status!=='online')return false;
    busy=true;lastPoll=Date.now();
    try{
      const {id,token}=net.getTransferIdentity();
      const response=await fetch('/api/world/partners',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        signal:AbortSignal.timeout(6500),body:JSON.stringify({id,token,map,action,target})});
      const reply=await response.json();
      if(net.status!=='online')return false;
      if(reply.state)apply(reply.state);
      if(!reply.ok&&action!=='state')notify(reply.error||'Le duo est indisponible.');
      return reply.ok;
    }catch{if(action!=='state')notify('Le monde partagé est momentanément indisponible.');return false;}
    finally{busy=false;}
  }
  function poll(interval){
    if(document.hidden||busy)return;
    if(net.status!=='online'||net.players().length<2){if(signature!==JSON.stringify(blank()))apply(blank());return;}
    if(Date.now()-lastPoll>=interval)void command('state');
  }
  setInterval(()=>poll(6500),2200);
  return {
    get revision(){return revision;},poll:()=>poll(2200),
    render(entry,person,showMap){
      if(isMuted(person.id)&&state.partner!==person.id)return;
      const tools=document.createElement('div');tools.className='mc-duo-actions';
      function button(label,click){const b=document.createElement('button');b.type='button';b.className='mc-secondary';b.textContent=label;b.onclick=click;tools.append(b);}
      if(state.partner===person.id){
        button('Localiser mon équipier',showMap);button('Quitter le duo',()=>command('leave'));
        const note=document.createElement('small');note.textContent='Tir allié bloqué';tools.append(note);
      }else if(state.partner)return;
      else if(state.received.includes(person.id)){
        button('Accepter le duo',()=>command('accept',person.id));button('Décliner',()=>command('decline',person.id));
      }else if(state.sent===person.id)button('Annuler l’invitation',()=>command('cancel',person.id));
      else if(!state.sent)button('Inviter en duo',()=>command('invite',person.id));
      if(tools.childNodes.length)entry.append(tools);
    }
  };
}
