const uid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export const friendSchema=[
  `CREATE TABLE IF NOT EXISTS mc_friend_sessions(
    room TEXT NOT NULL,id TEXT NOT NULL,profile TEXT NOT NULL,PRIMARY KEY(room,id))`,
  'CREATE INDEX IF NOT EXISTS mc_friend_presence ON mc_friend_sessions(room,profile)',
  `CREATE TABLE IF NOT EXISTS mc_friends(
    first TEXT NOT NULL,second TEXT NOT NULL,sender TEXT NOT NULL,
    accepted INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL,PRIMARY KEY(first,second))`,
  'CREATE INDEX IF NOT EXISTS mc_friends_second ON mc_friends(second)',
  `CREATE TRIGGER IF NOT EXISTS mc_friend_session_left AFTER DELETE ON mc_members BEGIN
    DELETE FROM mc_friend_sessions WHERE room=OLD.room AND id=OLD.id;
  END`
];
const expiresAfter=7*86400000;
const actions=new Set(['friend-invite','friend-accept','friend-remove']);

async function profileKey(profile){
  const data=new TextEncoder().encode('maille-social-v1/'+profile.toLowerCase());
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  return Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
}

// The token is checked by the group endpoint. Session IDs are what the
// roster sees. Friendship itself follows the private browser profile.
export async function readFriends(db,{room,id,profile,action,target,now,live}){
  const mutates=actions.has(action);
  if(typeof profile!=='string'||!uid.test(profile))return mutates?{ok:false,error:'Profil indisponible.'}:{};
  const key=await profileKey(profile);
  const q=(sql,...args)=>db.prepare(sql).bind(...args);
  const ops=[q(`INSERT OR IGNORE INTO mc_friend_sessions (room,id,profile) SELECT room,id,?
    FROM mc_members WHERE room=? AND id=? AND seen>?`,key,room,id,live)];
  let change=-1;
  if(mutates){
    if(typeof target!=='string'||!uid.test(target)||target===id)return {ok:false,error:'Joueur indisponible.'};
    const other=await q(`SELECT s.profile FROM mc_friend_sessions s JOIN mc_members m
      ON m.room=s.room AND m.id=s.id WHERE s.room=? AND s.id=? AND m.seen>?`,room,target,live).first();
    if(!other||other.profile===key)return {ok:false,error:'Ce joueur ne peut pas recevoir la demande.'};
    const [first,second]=[key,other.profile].sort();
    const self='EXISTS (SELECT 1 FROM mc_friend_sessions WHERE room=? AND id=? AND profile=?)';
    change=ops.length;
    if(action==='friend-invite')ops.push(q(`INSERT INTO mc_friends (first,second,sender,expires)
      SELECT ?,?,?,? WHERE ${self} AND
      (SELECT count(*) FROM mc_friends WHERE sender=? AND (accepted=1 OR expires>?))<80
      ON CONFLICT(first,second) DO UPDATE SET sender=excluded.sender,expires=excluded.expires
      WHERE mc_friends.accepted=0 AND mc_friends.expires<=? RETURNING sender`,
    first,second,key,now+expiresAfter,room,id,key,key,now,now));
    if(action==='friend-accept')ops.push(q(`UPDATE mc_friends SET accepted=1
      WHERE first=? AND second=? AND sender<>? AND accepted=0 AND expires>? AND ${self} RETURNING sender`,
    first,second,key,now,room,id,key));
    if(action==='friend-remove')ops.push(q(`DELETE FROM mc_friends WHERE first=? AND second=? AND ${self} RETURNING sender`,
    first,second,room,id,key));
  }
  ops.push(q(`SELECT s.id,f.accepted,f.sender=? AS outgoing FROM mc_friends f
    JOIN mc_friend_sessions s ON s.room=? AND s.profile=CASE WHEN f.first=? THEN f.second ELSE f.first END
    JOIN mc_members m ON m.room=s.room AND m.id=s.id AND m.seen>?
    WHERE (f.first=? OR f.second=?) AND (f.accepted=1 OR f.expires>?)
    AND EXISTS (SELECT 1 FROM mc_friend_sessions WHERE room=? AND id=? AND profile=?) ORDER BY s.id`,
  key,room,key,live,key,key,now,room,id,key));
  const result=await db.batch(ops),rows=result.at(-1).results;
  const state={
    friends:rows.filter(f=>f.accepted).map(f=>f.id),
    friendReceived:rows.filter(f=>!f.accepted&&!f.outgoing).map(f=>f.id),
    friendSent:rows.filter(f=>!f.accepted&&f.outgoing).map(f=>f.id)
  };
  return change>=0&&!result[change].results.length?{ok:false,error:'Demande d’ami indisponible.',...state}:state;
}
