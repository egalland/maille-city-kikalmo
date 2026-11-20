// Reports stay in the private moderation queue. Chat evidence comes from the
// accepted world event, never from text supplied by the reporting client.
export const reportSchema=[
  `CREATE TABLE IF NOT EXISTS mc_reports(
    room TEXT NOT NULL, reporter TEXT NOT NULL, subject TEXT NOT NULL, reason TEXT NOT NULL,
    subject_name TEXT NOT NULL, evidence TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY(room,reporter,subject,reason))`,
  'CREATE INDEX IF NOT EXISTS mc_reports_time ON mc_reports(at)'
];
export async function reportPlayer(db,b,room,now) {
  const reasons=['chat','comportement','triche'];
  if(!reasons.includes(b.reason)||typeof b.subject!=='string'||b.subject===b.id)return {ok:false};
  const stmt=(q,...v)=>db.prepare(q).bind(...v);
  const actor=await stmt('SELECT id FROM mc_members WHERE room=? AND id=? AND secret=? AND seen>?',room,b.id,b.token,now-25000).first();
  if(!actor)return {ok:false};
  const result=await db.batch([
    stmt("DELETE FROM mc_reports WHERE at<?",now-30*86400000),
    stmt(`INSERT OR IGNORE INTO mc_reports(room,reporter,subject,reason,subject_name,evidence,at)
      SELECT ?,?,?,?,m.name,COALESCE((SELECT json_group_array(json(obj)) FROM
        (SELECT json_object('text',json_extract(data,'$.text'),'time',at) obj FROM mc_events
         WHERE room=? AND player=? AND type='chat' AND at>? ORDER BY seq DESC LIMIT 5)),'[]'),?
      FROM mc_members m WHERE m.room=? AND m.id=? AND m.seen>?
      AND (SELECT count(*) FROM mc_reports WHERE room=? AND reporter=? AND at>?)<4`,
      room,b.id,b.subject,b.reason,room,b.subject,now-1800000,now,room,b.subject,now-25000,room,b.id,now-600000),
    stmt('SELECT at FROM mc_reports WHERE room=? AND reporter=? AND subject=? AND reason=?',room,b.id,b.subject,b.reason)
  ]);
  return {ok:!!result[2].results[0]};
}
