import {weaponCatalog} from './weapon-catalog.js';
export const ammoCapacity=id=>weaponCatalog[id].mag*3;
export function reloadMagazine(clip,reserve,capacity){
  const moved=Math.max(0,Math.min(reserve,capacity-clip));
  return {clip:clip+moved,reserve:reserve-moved};
}
let privateId;
export function browserProfile(){
  if(privateId)return privateId;
  const key='maillecity.career.profile.v1';
  try{
    const stored=localStorage.getItem(key);
    if(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(stored||''))return privateId=stored;
    privateId=crypto.randomUUID();localStorage.setItem(key,privateId);
  }catch{privateId??=crypto.randomUUID();}
  return privateId;
}
