import {browserProfile} from './ammunition.js';
import {isMuted} from './social-controls.js';

const blank=()=>({members:[],maxGroup:6,received:[],sent:null,friends:[],friendReceived:[],friendSent:[]});
let current=null;
export const socialMarkers=()=>current?.markers()||[];
export const isGroupMember=id=>current?.inGroup(id)??false;

export function createPartners(net,{map,changed,notify}){
  let state=blank(),signature='',request=null,lastPoll=-Infinity,revision=0;
  const name=id=>net.players().find(p=>p.id===id)?.name||'Joueur';
  const rank=id=>state.members.includes(id)?2:state.friends.includes(id)?1:0;
  current={
    inGroup:id=>state.members.includes(id),
    markers:()=>net.players().filter(p=>rank(p.id)).map(p=>({...p,relation:rank(p.id)===2?'group':'friend'}))
  };
  function apply(reply){
    const next={...blank(),...reply};
    if(!reply.members&&reply.partner)next.members=[reply.partner];
    const key=JSON.stringify(next);
    if(key===signature)return;
    const incoming=next.received.find(id=>!state.received.includes(id)&&!isMuted(id));
    const friend=next.friendReceived.find(id=>!state.friendReceived.includes(id)&&!isMuted(id));
    if(incoming)notify(name(incoming)+' t’invite dans son groupe · Joueurs');
    else if(friend)notify(name(friend)+' veut devenir ton ami · Joueurs');
    else if(next.members.length>state.members.length)notify('Groupe · '+(next.members.length+1)+' joueurs · Tir allié bloqué');
    state=next;signature=key;revision++;changed();
  }
  async function send(action,target){
    if(net.status!=='online')return;
    lastPoll=Date.now();
    const {id,token}=net.getTransferIdentity();
    try{
      const response=await fetch('/api/world/partners',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        signal:AbortSignal.timeout(6500),body:JSON.stringify({id,token,profile:browserProfile(),map,action,target})});
      const reply=await response.json();
      if(net.status!=='online'||net.id!==id)return;
      if(reply.state)apply(reply.state);
      if(!reply.ok&&action!=='state')notify(reply.error||'Action indisponible.');
    }catch{if(action!=='state')notify('Le monde partagé est momentanément indisponible.');}
  }
  async function command(action,target){
    if(request){
      if(action==='state')return;
      await request;
      if(request)return;
    }
    request=send(action,target).finally(()=>{request=null;});
    return request;
  }
  function poll(interval){
    if(document.hidden||request)return;
    if(net.status!=='online'){
      if(signature!==JSON.stringify(blank()))apply(blank());
      return;
    }
    if(Date.now()-lastPoll>=interval)void command('state');
  }
  setInterval(()=>poll(5000),1800);
  return {
    get revision(){return revision;},rank,poll:()=>poll(2200),
    render(entry,person,showMap){
      const id=person.id,relation=rank(id);
      const tools=document.createElement('div');tools.className='mc-duo-actions';
      function button(label,click){
        const b=document.createElement('button');b.type='button';b.className='mc-secondary';b.textContent=label;b.onclick=click;tools.append(b);
      }
      function note(label){const el=document.createElement('small');el.textContent=label;tools.append(el);}
      if(id===net.id){
        if(state.members.length){
          note('Groupe · '+(state.members.length+1)+' / '+state.maxGroup+' · Tir allié bloqué');
          button('Quitter le groupe',()=>command('leave'));
        }
      }else{
        if(relation){
          note(relation===2?'Membre du groupe':'Ami');
          button('Localiser',()=>showMap(id));
        }
        if(!isMuted(id)){
          if(state.received.includes(id)&&!state.members.length){
            button('Rejoindre le groupe',()=>command('accept',id));button('Décliner',()=>command('decline',id));
          }else if(state.sent===id)button('Annuler l’invitation',()=>command('cancel',id));
          else if(relation!==2&&!state.sent&&state.members.length+1<state.maxGroup)
            button('Inviter dans le groupe',()=>command('invite',id));
        }
        if(state.friends.includes(id))button('Retirer des amis',()=>command('friend-remove',id));
        else if(!isMuted(id)){
          if(state.friendReceived.includes(id)){
            button('Accepter comme ami',()=>command('friend-accept',id));button('Refuser la demande',()=>command('friend-remove',id));
          }else if(state.friendSent.includes(id))button('Annuler la demande d’ami',()=>command('friend-remove',id));
          else button('Ajouter aux amis',()=>command('friend-invite',id));
        }
      }
      if(tools.childNodes.length)entry.append(tools);
    }
  };
}
