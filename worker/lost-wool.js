import {lostWool,woolRadius,woolReward} from '../public/lost-wool.js';
export const woolSchema='CREATE TABLE IF NOT EXISTS mc_lost_wool(profile TEXT PRIMARY KEY,slot INTEGER NOT NULL,picked INTEGER NOT NULL,paid INTEGER NOT NULL DEFAULT 0)';
export function woolProgress(row){
  return Number.isSafeInteger(row.woolSlot)?{slot:row.woolSlot,paid:!!row.woolPaid}:null;
}
export function woolAction({row,actor,now,slot,collect}){
  const event=lostWool(now,woolProgress(row));
  if(slot!==event.slot||event.phase!==(collect?'find':'carrying'))return {error:'Cette pelote n’est plus disponible.'};
  if(actor.vehicle||actor.lift>.65||Math.hypot(actor.x-event.goal.x,actor.y-event.goal.y)>woolRadius)
    return {error:'Approche-toi du repère à pied.'};
  if(!collect&&now-row.woolPicked<1000*(Math.hypot(event.point.x-event.goal.x,event.point.y-event.goal.y)-woolRadius*2)/8)
    return {error:'Le trajet jusqu’aux Halles est trop court pour valider le retour.'};
  return {reward:collect?0:woolReward};
}
