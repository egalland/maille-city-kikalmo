const storageKey='maillecity.chat.muted.v1';
let muted=new Set();
try{const ids=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(ids))muted=new Set(ids.slice(-128));}catch{}
export const isMuted=id=>muted.has(id);
export function addSocialControls(entry,person,net,feedback){
  const controls=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent='Options';controls.className='mc-social';controls.append(summary);
  const body=document.createElement('div');
  const mute=document.createElement('button');mute.type='button';mute.className='mc-secondary';
  function refresh(){mute.textContent=muted.has(person.id)?'Réactiver son chat':'Masquer son chat';}
  mute.onclick=()=>{
    if(muted.has(person.id))muted.delete(person.id);
    else{muted.add(person.id);if(muted.size>128)muted.delete(muted.values().next().value);}
    try{localStorage.setItem(storageKey,JSON.stringify([...muted]));}catch{}
    for(const el of document.querySelectorAll('#chatLog [data-author]'))if(el.dataset.author===person.id)el.hidden=muted.has(person.id);
    refresh();
  };
  refresh();
  const reason=document.createElement('select');reason.className='mc-input';reason.setAttribute('aria-label','Motif du signalement');
  for(const [id,label] of [['chat','Chat abusif'],['comportement','Comportement en jeu'],['triche','Triche présumée']]){
    const option=document.createElement('option');option.value=id;option.textContent=label;reason.append(option);
  }
  const submit=document.createElement('button');submit.type='button';submit.className='mc-secondary';submit.textContent='Signaler';
  submit.onclick=async()=>{
    submit.disabled=true;
    try{
      const ok=await net.report(person.id,reason.value);
      feedback.textContent=ok?'Signalement enregistré.':'Le signalement a échoué. Vérifie que le joueur est encore en ligne.';
      if(ok)controls.open=false;
    }catch{feedback.textContent='Le service de signalement est momentanément indisponible.';}
    finally{submit.disabled=false;}
  };
  body.append(mute,reason,submit);controls.append(body);entry.append(controls);
}
