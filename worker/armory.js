import {ammoCapacity} from '../public/ammunition.js';
import {weaponCatalog} from '../public/weapon-catalog.js';

const firearms=Object.values(weaponCatalog).filter(w=>Number.isFinite(w.mag));
const shotKind="json_extract(NEW.data,'$.kind')",pickupKind="json_extract(NEW.data,'$.weapon')";
const profile='(SELECT profile FROM mc_armory_sessions WHERE room=NEW.room AND id=NEW.player)';
const capacityCase='CASE '+pickupKind+' '+firearms.map(w=>"WHEN '"+w.id+"' THEN "+ammoCapacity(w.id)).join(' ')+' END';
const reloadTime='CASE '+shotKind+' '+firearms.map(w=>"WHEN '"+w.id+"' THEN "+Math.round(w.reload*1000)).join(' ')+' END';
export const armorySchema=[
  'CREATE TABLE IF NOT EXISTS mc_armory_sessions(room TEXT,id TEXT,profile TEXT NOT NULL,PRIMARY KEY(room,id))',
  'CREATE TABLE IF NOT EXISTS mc_armory(profile TEXT,weapon TEXT,total INTEGER NOT NULL,spent INTEGER NOT NULL DEFAULT 0,last INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(profile,weapon))',
  'CREATE TRIGGER IF NOT EXISTS mc_armory_disconnect AFTER DELETE ON mc_members BEGIN DELETE FROM mc_armory_sessions WHERE room=OLD.room AND id=OLD.id; END',
  // Only accepted canonical shots debit ammo. Replayed event IDs cannot fire the trigger twice.
  `CREATE TRIGGER IF NOT EXISTS mc_armory_spend AFTER INSERT ON mc_events WHEN NEW.type='shot' AND NEW.op LIKE 'fire:%' BEGIN
    UPDATE mc_armory SET total=max(0,total-1),spent=CASE WHEN json_extract(NEW.data,'$.firedAt')-last>=${reloadTime}
      THEN 1 ELSE spent+1 END,last=json_extract(NEW.data,'$.firedAt') WHERE profile=${profile} AND weapon=${shotKind};
    END`,
  `CREATE TRIGGER IF NOT EXISTS mc_armory_supply AFTER INSERT ON mc_events WHEN NEW.type='pickup' BEGIN
    INSERT INTO mc_armory(profile,weapon,total,spent) VALUES(${profile},${pickupKind},${capacityCase},0)
      ON CONFLICT(profile,weapon) DO UPDATE SET total=excluded.total,spent=0;
    UPDATE mc_armory SET total=min(36,total+12) WHERE profile=${profile} AND weapon='pistol' AND ${pickupKind}<>'pistol';
    END`
];
export const canFireSql=`EXISTS(SELECT 1 FROM mc_armory a JOIN mc_armory_sessions s ON a.profile=s.profile
  WHERE s.room=? AND s.id=? AND a.weapon=? AND a.total>0 AND ?-a.last>=?
    AND (a.spent<? OR ?-a.last>=?))`;
export function canFireArgs(room,id,weapon,at){
  return [room,id,weapon.id,at,Math.floor(weapon.interval*900),weapon.mag,at,Math.round(weapon.reload*1000)];
}
export function readArmory(q,room,id){
  return q('SELECT weapon,total FROM mc_armory a JOIN mc_armory_sessions s ON a.profile=s.profile WHERE s.room=? AND s.id=?',room,id);
}
export function privateAmmo(rows){return Object.fromEntries(rows.map(row=>[row.weapon,row.total]));}
export async function openArmory(q,room,id,token,secret){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('maille-armory-v1/'+secret));
  const hash=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
  return [
    q(`INSERT OR IGNORE INTO mc_armory_sessions(room,id,profile) SELECT room,id,? FROM mc_members WHERE room=? AND id=? AND secret=?`,hash,room,id,token),
    q(`INSERT OR IGNORE INTO mc_armory(profile,weapon,total) SELECT s.profile,'pistol',36 FROM mc_armory_sessions s
      JOIN mc_members m ON s.room=m.room AND s.id=m.id WHERE s.room=? AND s.id=? AND m.secret=?`,room,id,token),
    readArmory(q,room,id)
  ];
}
