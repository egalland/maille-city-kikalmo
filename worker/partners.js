// A duo belongs to the live sessions in the same public world. Positions, chat
// and game simulation continue to use the global roster.
export const partnerSchema=[
  `CREATE TABLE IF NOT EXISTS mc_partner_invites(
    room TEXT NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,expires INTEGER NOT NULL,
    PRIMARY KEY(room,sender))`,
  'CREATE INDEX IF NOT EXISTS mc_partner_inbox ON mc_partner_invites(room,recipient,expires)',
  `CREATE TABLE IF NOT EXISTS mc_partners(
    room TEXT NOT NULL,first TEXT NOT NULL,second TEXT NOT NULL,
    PRIMARY KEY(room,first),UNIQUE(room,second))`,
  `CREATE TRIGGER IF NOT EXISTS mc_partner_member_left AFTER DELETE ON mc_members BEGIN
    DELETE FROM mc_partners WHERE room=OLD.room AND (first=OLD.id OR second=OLD.id);
    DELETE FROM mc_partner_invites WHERE room=OLD.room AND (sender=OLD.id OR recipient=OLD.id);
  END`,
  `CREATE TRIGGER IF NOT EXISTS mc_partner_invites_done AFTER INSERT ON mc_partners BEGIN
    DELETE FROM mc_partner_invites WHERE room=NEW.room AND
      (sender IN (NEW.first,NEW.second) OR recipient IN (NEW.first,NEW.second));
  END`
];
const actions=new Set(['state','invite','accept','decline','cancel','leave']);
// Check the live relationship in the same database statement that records the hit.
export const noPartnerHit=target=>`NOT EXISTS (SELECT 1 FROM mc_partners WHERE room=?
  AND ((first=? AND second=${target}) OR (second=? AND first=${target})))`;
export async function runPartners(db,b,room,now,gone){
  const {id,token,action,target}=b;
  if(!actions.has(action))return {ok:false,error:'Demande inconnue.'};
  const q=(sql,...args)=>db.prepare(sql).bind(...args);
  const self=q('SELECT 1 FROM mc_members WHERE room=? AND id=? AND secret=? AND seen>?',room,id,token,now-gone);
  if(!await self.first())return {ok:false,error:'Reconnecte-toi au monde pour former un duo.'};
  const ops=[];
  if(action!=='state')ops.push(q('DELETE FROM mc_partner_invites WHERE room=? AND expires<=?',room,now));
  // Stale peers may still exist until the next join performs world cleanup.
  if(action!=='state')ops.push(q(`DELETE FROM mc_partners WHERE room=? AND (first IN (?,?) OR second IN (?,?)) AND
    (SELECT count(*) FROM mc_members m WHERE m.room=mc_partners.room AND m.id IN (first,second) AND m.seen>?)<2`,room,id,target||'',id,target||'',now-gone));
  if(action==='invite'||action==='accept'){
    if(typeof target!=='string'||target===id||target.length!==36)return {ok:false,error:'Ce joueur est indisponible.'};
    // Both live sessions must be free at the instant the statement executes.
    const guard=`EXISTS(SELECT 1 FROM mc_members WHERE room=? AND id=? AND secret=? AND seen>?) AND
      EXISTS(SELECT 1 FROM mc_members WHERE room=? AND id=? AND seen>?) AND
      NOT EXISTS(SELECT 1 FROM mc_partners WHERE room=? AND (first IN (?,?) OR second IN (?,?)))`;
    const args=[room,id,token,now-gone,room,target,now-gone,room,id,target,id,target];
    if(action==='invite'){
      ops.push(q(`INSERT OR IGNORE INTO mc_partner_invites(room,sender,recipient,expires) SELECT ?,?,?,?
        WHERE ${guard} RETURNING sender`,room,id,target,now+60000,...args));
    }else{
      ops.push(q(`INSERT OR IGNORE INTO mc_partners(room,first,second) SELECT ?,?,?
        WHERE ${guard} AND EXISTS(SELECT 1 FROM mc_partner_invites WHERE room=? AND sender=? AND recipient=? AND expires>?)
        RETURNING first`,room,id,target,...args,room,target,id,now));
    }
  }else if(action==='leave'){
    ops.push(q('DELETE FROM mc_partners WHERE room=? AND (first=? OR second=?)',room,id,id));
  }else if(action==='decline'||action==='cancel'){
    const sent=action==='cancel';
    ops.push(q('DELETE FROM mc_partner_invites WHERE room=? AND sender=? AND recipient=?',room,sent?id:target||'',sent?target||'':id));
  }
  const mutateIndex=ops.length-1;
  ops.push(q(`SELECT CASE WHEN first=? THEN second ELSE first END AS id FROM mc_partners WHERE room=? AND (first=? OR second=?) AND
      (SELECT count(*) FROM mc_members m WHERE m.room=mc_partners.room AND m.id IN (first,second) AND m.seen>?)=2`,id,room,id,id,now-gone),
    q(`SELECT sender,recipient FROM mc_partner_invites i WHERE room=? AND (sender=? OR recipient=?) AND expires>? AND
      (SELECT count(*) FROM mc_members m WHERE m.room=i.room AND m.id IN (i.sender,i.recipient) AND m.seen>?)=2 ORDER BY expires`,room,id,id,now,now-gone));
  const result=await db.batch(ops),partner=result.at(-2).results[0]?.id||null,invites=result.at(-1).results;
  const state={partner,received:invites.filter(i=>i.recipient===id).map(i=>i.sender),sent:invites.find(i=>i.sender===id)?.recipient||null};
  if(['accept','invite'].includes(action)&&!result[mutateIndex].results.length&&partner!==target&&!(action==='invite'&&state.sent===target))
    return {ok:false,error:'Invitation indisponible. Vérifie que vous êtes tous les deux libres.',state};
  return {ok:true,state};
}
