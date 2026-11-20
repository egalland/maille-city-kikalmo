// Equip a known server profile directly for combat fixtures. Pickup acceptance,
// contention and reward issuance are exercised separately through the public API.
import {ammoCapacity} from '../../public/ammunition.js';
export async function equipTestFirearm(db,player,weapon){
  await db.prepare(`INSERT INTO mc_armory(profile,weapon,total) SELECT profile,?,? FROM mc_armory_sessions WHERE id=?
    ON CONFLICT(profile,weapon) DO UPDATE SET total=excluded.total`).bind(weapon,ammoCapacity(weapon),player).run();
}
