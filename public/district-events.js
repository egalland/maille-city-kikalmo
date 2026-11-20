// Surveyed pavements of Enfer, in the same XY coordinate system as the street map.
const post=(id,name,x,y)=>({id,name,x,y});
export const incidentPosts=[
  post('incident-garage','Rue des Glycines',-74.31,-168.38),
  post('incident-station','Rue des Prés',46.73,-106.79),
  post('incident-quay','Rue des Tisserands',154.25,-171.42)
];
export const incidentDepot=post('incident-depot','Comptoir des Halles',2.13,-285.04);
export const incidentRadius=3;
export const incidentPeriod=12*60000;
export const incidentKinds={
  lights:{title:'Les lanternes en panne',description:'Trois lanternes se sont éteintes. Remets leurs boîtiers en service dans l’ordre que tu veux.',verb:'Rallumer',unit:'lanternes rallumées',pay:14},
  parcels:{title:'Les ballots renversés',description:'Une charrette a perdu son chargement. Ramasse un ballot à pied et rapporte-le aux Halles. Chacun peut en porter un.',verb:'Prendre le ballot',unit:'ballots rendus',pay:22},
  relay:{title:'L’estafette des teinturiers',description:'Fais passer la sacoche par trois postes dans l’ordre annoncé. Un autre joueur peut reprendre le relais au poste suivant.',verb:'Faire passer la sacoche',unit:'postes relayés',pay:16}
};
export function incidentStop(event,index){
  const offset=event.layout%3,step=event.layout<3?1:2;
  return incidentPosts[(offset+step*index)%3];
}
export function incidentObjectives(event,now){
  if(!event||event.ends<=now)return [];
  const tasks=event.tasks.map(task=>task.heldUntil&&task.heldUntil<=now?{...task,heldUntil:0,mine:false}:task);
  const carrying=tasks.find(t=>t.mine&&t.heldUntil);
  if(carrying)return [{task:carrying.index,point:incidentDepot,verb:'Livrer le ballot',operation:'deliver'}];
  const available=tasks.filter(t=>!t.done&&!t.heldUntil);
  const upcoming=event.kind==='relay'?available.slice(0,1):available;
  return upcoming.map(t=>({task:t.index,point:incidentStop(event,t.index),verb:incidentKinds[event.kind].verb,operation:'work'}));
}
