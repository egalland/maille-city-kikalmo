import {incidentKinds,incidentPeriod,incidentRadius,incidentStop,incidentDepot} from '../public/district-events.js';
export const districtEventsSchema=[
  'CREATE TABLE IF NOT EXISTS mc_district_events(slot INTEGER PRIMARY KEY,kind TEXT NOT NULL,layout INTEGER NOT NULL,duration INTEGER NOT NULL)',
  `CREATE TABLE IF NOT EXISTS mc_district_tasks(slot INTEGER NOT NULL,idx INTEGER NOT NULL,done INTEGER NOT NULL DEFAULT 0,
    holder TEXT,held INTEGER NOT NULL DEFAULT 0,lease INTEGER NOT NULL DEFAULT 0,marker TEXT,
    PRIMARY KEY(slot,idx))`
];
const kinds=Object.keys(incidentKinds),freshFor=25000,carryLease=180000;
function draw(max){
  return crypto.getRandomValues(new Uint32Array(1))[0]%max;
}
async function readEvent(q,db,now,profile){
  const slot=Math.floor(now/incidentPeriod);
  let row=await q('SELECT * FROM mc_district_events WHERE slot=?',slot).first();
  if(!row){
    const previous=await q('SELECT kind FROM mc_district_events WHERE slot=?',slot-1).first();
    const pool=kinds.filter(kind=>kind!==previous?.kind);
    // Competing isolates may draw different proposals. The first committed row
    // fixes the draw for every session, including sessions opened after a restart.
    const batch=await db.batch([
      q('INSERT OR IGNORE INTO mc_district_events VALUES (?,?,?,?)',slot,pool[draw(pool.length)],draw(6),incidentPeriod-45000-draw(75000)),
      q('INSERT OR IGNORE INTO mc_district_tasks(slot,idx) VALUES (?,0),(?,1),(?,2)',slot,slot,slot),
      q('DELETE FROM mc_district_tasks WHERE slot<?',slot-2),q('DELETE FROM mc_district_events WHERE slot<?',slot-2),
      q('SELECT * FROM mc_district_events WHERE slot=?',slot)
    ]);
    row=batch.at(-1).results[0];
  }
  const tasks=await db.batch([q(`SELECT idx AS 'index',done,lease,holder=? AS mine FROM mc_district_tasks WHERE slot=? ORDER BY idx`,profile,slot)]);
  return {slot,kind:row.kind,layout:row.layout,ends:slot*incidentPeriod+row.duration,next:(slot+1)*incidentPeriod,
    tasks:tasks[0].results.map(t=>({index:t.index,done:!!t.done,heldUntil:t.lease>now?t.lease:0,mine:!!t.mine&&t.lease>now}))};
}
export async function districtState(db,now,profile){
  return readEvent((sql,...values)=>db.prepare(sql).bind(...values),db,now,profile);
}
export async function workDistrictEvent(db,request,room,now,profile){
  const q=(sql,...values)=>db.prepare(sql).bind(...values),event=await readEvent(q,db,now,profile);
  const {slot,task,operation}=request;
  if(slot!==event.slot||event.ends<=now||!Number.isInteger(task)||task<0||task>2||!['deliver','work'].includes(operation))
    return {ok:false,incident:event,error:'Ce point de l’événement n’est plus ouvert.'};
  const parcels=event.kind==='parcels',deliver=operation==='deliver';
  if(deliver&&!parcels)return {ok:false,incident:event,error:'Ce poste ne réceptionne pas de ballot.'};
  const source=incidentStop(event,task),target=deliver?incidentDepot:source;
  // Recheck the authoritative session pose, seat and task in the same write.
  const actor=`EXISTS (SELECT 1 FROM mc_members m JOIN mc_career_sessions cs ON cs.room=m.room AND cs.id=m.id
    WHERE m.room=? AND m.id=? AND m.secret=? AND m.seen>? AND cs.profile=?
    AND coalesce(json_extract(m.state,'$.health'),100)>0 AND coalesce(json_extract(m.state,'$.downUntil'),0)<=?
    AND json_extract(m.state,'$.vehicle.id') IS NULL AND coalesce(json_extract(m.state,'$.lift'),0)<0.8
    AND (json_extract(m.state,'$.x')-?)*(json_extract(m.state,'$.x')-?)+(json_extract(m.state,'$.y')-?)*(json_extract(m.state,'$.y')-?)<=?
    AND NOT EXISTS(SELECT 1 FROM mc_seats WHERE room=m.room AND rider=m.id))`;
  const eligibility=[room,request.id,request.token,now-freshFor,profile,now,target.x,target.x,target.y,target.y,incidentRadius**2];
  const marker=crypto.randomUUID(),pickup=parcels&&!deliver;
  const guard=deliver?'holder=? AND lease>? AND held<=?':`lease<=? AND NOT EXISTS
    (SELECT 1 FROM mc_district_tasks WHERE slot=? AND holder=? AND lease>?)`;
  const travel=Math.hypot(source.x-incidentDepot.x,source.y-incidentDepot.y);
  const args=deliver?[profile,now,now-Math.floor((travel-2*incidentRadius)/45*1000)]:[now,slot,profile,now];
  const sequence=event.kind==='relay'?' AND NOT EXISTS(SELECT 1 FROM mc_district_tasks WHERE slot=? AND idx<? AND done=0)':'';
  const results=await db.batch([
    q(`UPDATE mc_district_tasks SET marker=?,done=?,holder=?,held=?,lease=?
       WHERE slot=? AND idx=? AND done=0 AND ${guard}${sequence} AND ${actor} RETURNING idx`,marker,pickup?0:1,pickup?profile:null,pickup?now:0,
      pickup?Math.min(now+carryLease,event.ends):0,slot,task,...args,...(sequence?[slot,task]:[]),...eligibility),
    q(`UPDATE mc_careers SET cash=cash+?,revision=revision+1 WHERE profile=? AND EXISTS
      (SELECT 1 FROM mc_district_tasks WHERE slot=? AND idx=? AND marker=? AND done=1)`,incidentKinds[event.kind].pay,profile,slot,task,marker),
    q(`INSERT INTO mc_events(room,player,op,name,type,data,at) SELECT ?,?,?,'Ville','districtUpdate',?,? WHERE EXISTS
      (SELECT 1 FROM mc_district_tasks WHERE slot=? AND idx=? AND marker=?)`,room,request.id,'incident:'+marker,JSON.stringify({slot}),now,slot,task,marker)
  ]);
  const incident=await readEvent(q,db,now,profile);
  if(!results[0].results.length)return {ok:false,incident,error:'Rejoins le poste à pied. Si quelqu’un vient de passer, suis le nouveau repère.'};
  return {ok:true,incident,notice:pickup?'Ballot en main · Apporte-le au comptoir des Halles.':
    (incident.tasks.every(t=>t.done)?'Événement terminé':'Contribution validée')+' · +'+incidentKinds[event.kind].pay+' ₣'};
}
