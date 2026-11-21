import {friendSchema,readFriends} from './friends.js';

const maxGroup=6;
export const partnerSchema=[
  `CREATE TABLE IF NOT EXISTS mc_partner_invites(
    room TEXT NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,expires INTEGER NOT NULL,
    PRIMARY KEY(room,sender))`,
  'CREATE INDEX IF NOT EXISTS mc_partner_inbox ON mc_partner_invites(room,recipient,expires)',
  `CREATE TABLE IF NOT EXISTS mc_partners(
    room TEXT NOT NULL,first TEXT NOT NULL,second TEXT NOT NULL,
    PRIMARY KEY(room,first),UNIQUE(room,second))`,
  `CREATE TABLE IF NOT EXISTS mc_group_members(
    room TEXT NOT NULL,id TEXT NOT NULL,party TEXT NOT NULL,PRIMARY KEY(room,id))`,
  'CREATE INDEX IF NOT EXISTS mc_group_party ON mc_group_members(room,party)',
  `INSERT OR IGNORE INTO mc_group_members (room,id,party)
    SELECT room,first,first FROM mc_partners UNION ALL SELECT room,second,first FROM mc_partners`,
  'DELETE FROM mc_partners',
  `CREATE TRIGGER IF NOT EXISTS mc_group_member_left AFTER DELETE ON mc_members BEGIN
    DELETE FROM mc_group_members WHERE room=OLD.room AND id=OLD.id;
    DELETE FROM mc_partner_invites WHERE room=OLD.room AND (sender=OLD.id OR recipient=OLD.id);
  END`,
  `CREATE TRIGGER IF NOT EXISTS mc_group_prune_invites AFTER INSERT ON mc_group_members BEGIN
    DELETE FROM mc_partner_invites WHERE room=NEW.room AND recipient=NEW.id;
  END`,
  `CREATE TRIGGER IF NOT EXISTS mc_group_dissolve AFTER DELETE ON mc_group_members BEGIN
    DELETE FROM mc_group_members WHERE room=OLD.room AND party=OLD.party AND
      (SELECT count(*) FROM mc_group_members WHERE room=OLD.room AND party=OLD.party)=1;
  END`,
  ...friendSchema
];
const actions=new Set(['state','invite','accept','decline','cancel','leave']);

// Check group membership in the same database statement as the hit.
export const noPartnerHit=target=>`NOT EXISTS (SELECT 1 FROM mc_group_members a
  JOIN mc_group_members b ON a.room=b.room AND a.party=b.party
  WHERE a.room=? AND a.id=? AND b.id=${target})`;

export async function runPartners(db,b,room,now,gone){
  const {id,token,action,target}=b,live=now-gone;
  const friendAction=['friend-invite','friend-accept','friend-remove'].includes(action);
  if(!actions.has(action)&&!friendAction)return {ok:false,error:'Demande inconnue.'};
  const q=(sql,...args)=>db.prepare(sql).bind(...args);
  const self=await q('SELECT 1 FROM mc_members WHERE room=? AND id=? AND secret=? AND seen>?',room,id,token,live).first();
  if(!self)return {ok:false,error:'Reconnecte-toi au monde pour gérer ton groupe.'};
  if(['invite','accept','decline','cancel'].includes(action)&&(typeof target!=='string'||target===id||target.length!==36))
    return {ok:false,error:'Ce joueur est indisponible.'};

  const ops=[];
  if(action!=='state'&&!friendAction){
    ops.push(q(`DELETE FROM mc_group_members AS g WHERE room=? AND NOT EXISTS
      (SELECT 1 FROM mc_members m WHERE m.room=g.room AND m.id=g.id AND m.seen>?)`,room,live));
    ops.push(q('DELETE FROM mc_partner_invites WHERE room=? AND expires<=?',room,now));
  }
  let mutation=-1;
  if(action==='invite'||action==='accept'){
    const sender=action==='invite'?id:target,recipient=action==='invite'?target:id;
    // The captain is implicit: any member can invite. Recheck seats and
    // membership when the invitation is accepted, inside the write batch.
    const eligible=`WITH args(room,sender,recipient,live,now,fallback) AS (VALUES (?,?,?,?,?,?)),
      eligible AS MATERIALIZED (
        SELECT args.*,coalesce(g.party,fallback) AS party FROM args
        JOIN mc_members s ON s.room=args.room AND s.id=args.sender AND s.seen>args.live
        JOIN mc_members r ON r.room=args.room AND r.id=args.recipient AND r.seen>args.live
        LEFT JOIN mc_group_members g ON g.room=args.room AND g.id=args.sender
        WHERE NOT EXISTS (SELECT 1 FROM mc_group_members m WHERE m.room=args.room AND m.id=args.recipient)
        AND (SELECT count(*) FROM mc_group_members m WHERE m.room=args.room AND m.party=g.party)<${maxGroup}
      )`;
    mutation=ops.length;
    if(action==='invite'){
      ops.push(q(eligible+` INSERT OR IGNORE INTO mc_partner_invites
        SELECT room,sender,recipient,now+60000 FROM eligible RETURNING sender`,room,sender,recipient,live,now,''));
    }else{
      ops.push(q(eligible+`, accepted AS MATERIALIZED (
        SELECT e.* FROM eligible e JOIN mc_partner_invites i
        ON i.room=e.room AND i.sender=e.sender AND i.recipient=e.recipient AND i.expires>e.now
      )
      INSERT OR IGNORE INTO mc_group_members (room,id,party)
      SELECT room,sender,party FROM accepted UNION ALL SELECT room,recipient,party FROM accepted RETURNING id`,
      room,sender,recipient,live,now,crypto.randomUUID()));
    }
  }else if(action==='leave'){
    ops.push(q('DELETE FROM mc_group_members WHERE room=? AND id=?',room,id),
      q('DELETE FROM mc_partner_invites WHERE room=? AND sender=?',room,id));
  }else if(action==='decline'||action==='cancel'){
    const sent=action==='cancel';
    ops.push(q('DELETE FROM mc_partner_invites WHERE room=? AND sender=? AND recipient=?',room,sent?id:target,sent?target:id));
  }
  ops.push(q(`SELECT g.id FROM mc_group_members self
    JOIN mc_group_members g ON g.room=self.room AND g.party=self.party AND g.id<>self.id
    JOIN mc_members m ON m.room=g.room AND m.id=g.id AND m.seen>?
    WHERE self.room=? AND self.id=? ORDER BY g.id`,live,room,id),
    q(`SELECT i.sender,i.recipient FROM mc_partner_invites i
      JOIN mc_members s ON s.room=i.room AND s.id=i.sender AND s.seen>?
      JOIN mc_members r ON r.room=i.room AND r.id=i.recipient AND r.seen>?
      WHERE i.room=? AND (i.sender=? OR i.recipient=?) AND i.expires>? ORDER BY i.expires`,live,live,room,id,id,now));
  const result=await db.batch(ops),members=result.at(-2).results.map(row=>row.id),invites=result.at(-1).results;
  const state={members,maxGroup,partner:members[0]||null,
    received:invites.filter(i=>i.recipient===id).map(i=>i.sender),sent:invites.find(i=>i.sender===id)?.recipient||null};
  const {ok:friendOK,error:friendError,...friends}=await readFriends(db,{room,id,profile:b.profile,action,target,now,live});
  Object.assign(state,friends);
  if(friendOK===false)return {ok:false,error:friendError,state};
  if(mutation>=0&&!result[mutation].results.length&&!(action==='invite'&&state.sent===target))
    return {ok:false,error:'Invitation indisponible. Le groupe peut être complet ou le joueur déjà en groupe.',state};
  return {ok:true,state};
}
