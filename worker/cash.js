// World cash is awarded from accepted combat transitions or the store contract.
export const cashTables=[
  `CREATE TABLE IF NOT EXISTS mc_cash_drops (
    room TEXT NOT NULL,id TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,amount INTEGER NOT NULL,
    expires INTEGER NOT NULL,claimed TEXT,PRIMARY KEY(room,id))`,
  'CREATE INDEX IF NOT EXISTS mc_cash_expiry ON mc_cash_drops(room,expires)',
  `CREATE TABLE IF NOT EXISTS mc_store_heists (
    room TEXT PRIMARY KEY,profile TEXT NOT NULL,rider TEXT NOT NULL,
    ready INTEGER NOT NULL,deadline INTEGER NOT NULL,cooldown INTEGER NOT NULL)`
];
export const cashTriggers=[
  `CREATE TRIGGER IF NOT EXISTS mc_cash_npc AFTER INSERT ON mc_events
    WHEN NEW.room='enfer:public' AND NEW.type='npc' AND json_extract(NEW.data,'$.dead')=1
      AND json_extract(NEW.data,'$.damage')>0 AND json_extract(NEW.data,'$.healthAt')=NEW.at
      AND json_extract(NEW.data,'$.type') IN ('walker','human')
    BEGIN
      INSERT OR IGNORE INTO mc_cash_drops(room,id,x,y,amount,expires)
      SELECT NEW.room,'npc:'||json_extract(NEW.data,'$.id')||':'||NEW.at,
        json_extract(NEW.data,'$.x'),json_extract(NEW.data,'$.y'),7+NEW.seq%11,NEW.at+65000;
      INSERT OR IGNORE INTO mc_events(room,player,op,name,type,data,at)
      VALUES(NEW.room,NEW.player,'cash:'||NEW.seq,NEW.name,'cash','{}',NEW.at);
    END`,
  `CREATE TRIGGER IF NOT EXISTS mc_cash_player AFTER UPDATE OF state ON mc_members
    WHEN NEW.room='enfer:public' AND json_extract(NEW.state,'$.health')=0 AND coalesce(json_extract(OLD.state,'$.health'),100)>0
      AND EXISTS (SELECT 1 FROM mc_events WHERE room=NEW.room AND type='hit' AND player<>NEW.id
        AND at>NEW.seen-12000 AND json_extract(data,'$.target')=NEW.id)
    BEGIN
      INSERT OR IGNORE INTO mc_cash_drops(room,id,x,y,amount,expires)
      SELECT NEW.room,'player:'||NEW.id||':'||NEW.seen,json_extract(NEW.state,'$.x'),json_extract(NEW.state,'$.y'),
        min(35,c.cash/5),NEW.seen+65000
      FROM mc_career_sessions s JOIN mc_careers c ON s.profile=c.profile
      WHERE s.room=NEW.room AND s.id=NEW.id AND c.cash>=5;
      UPDATE mc_careers SET cash=cash-(SELECT amount FROM mc_cash_drops WHERE room=NEW.room AND id='player:'||NEW.id||':'||NEW.seen),
        revision=revision+1 WHERE profile=(SELECT profile FROM mc_career_sessions WHERE room=NEW.room AND id=NEW.id)
        AND changes()>0;
      INSERT OR IGNORE INTO mc_events(room,player,op,name,type,data,at)
      SELECT NEW.room,NEW.id,'cash:'||NEW.seen,NEW.name,'cash','{}',NEW.seen WHERE changes()>0;
    END`
];
