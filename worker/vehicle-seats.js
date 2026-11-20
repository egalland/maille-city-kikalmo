import {sampleRoadCoast} from '../public/road-coast.js';
import {sampleAutorotation} from '../public/autorotation.js';

// A closed vehicle has one shared passenger seat. Only confirmed drivers can offer it.
export const seatSchema=[
  `CREATE TABLE IF NOT EXISTS mc_air_riders (
    room TEXT NOT NULL,rider TEXT NOT NULL,car TEXT NOT NULL,until INTEGER NOT NULL,
    PRIMARY KEY(room,rider),UNIQUE(room,car))`,
  `CREATE TRIGGER IF NOT EXISTS mc_air_riders_disconnect AFTER DELETE ON mc_members BEGIN
    DELETE FROM mc_air_riders WHERE room=OLD.room AND rider=OLD.id;
   END`,
  `CREATE TABLE IF NOT EXISTS mc_seats (
    room TEXT NOT NULL, rider TEXT NOT NULL, driver TEXT NOT NULL, car TEXT NOT NULL,
    PRIMARY KEY (room,rider), UNIQUE(room,car), UNIQUE(room,driver))`,
  `CREATE TRIGGER IF NOT EXISTS mc_seats_disconnect AFTER DELETE ON mc_members BEGIN
    DELETE FROM mc_seats WHERE room=OLD.room AND (rider=OLD.id OR driver=OLD.id);
   END`,
  `CREATE TRIGGER IF NOT EXISTS mc_seats_dismount AFTER UPDATE OF state ON mc_members BEGIN
    DELETE FROM mc_seats WHERE room=NEW.room AND driver=NEW.id AND
      (car IS NOT json_extract(NEW.state,'$.vehicle.id') OR json_extract(NEW.state,'$.health')=0);
    DELETE FROM mc_seats WHERE room=NEW.room AND rider=NEW.id AND
      (json_extract(NEW.state,'$.health')=0 OR json_extract(NEW.state,'$.vehicle.id') IS NOT NULL);
   END`,
  `CREATE TRIGGER IF NOT EXISTS mc_seats_owner AFTER UPDATE OF owner ON mc_items
   WHEN NEW.kind='vehicle' AND NEW.owner<>OLD.owner BEGIN
     DELETE FROM mc_seats WHERE room=NEW.room AND car=NEW.item;
   END`
];
export const seatedRosterSQL=`SELECT m.id,m.name,m.state,m.joined,m.seen,s.driver,s.car,o.dye,a.until AS flightUntil,v.data AS glidingCraft
  FROM mc_members m LEFT JOIN mc_seats s ON s.room=m.room AND s.rider=m.id
  LEFT JOIN mc_air_riders a ON a.room=m.room AND a.rider=m.id
  LEFT JOIN mc_items v ON v.room=a.room AND v.kind='vehicle' AND v.item=a.car AND v.owner=''
  LEFT JOIN mc_career_sessions cs ON cs.room=m.room AND cs.id=m.id
  LEFT JOIN mc_outfits o ON o.profile=cs.profile
  WHERE m.room=? AND m.seen>? ORDER BY m.joined,m.id`;

export function attachPassengers(players, rows){
  const drivers=new Map(players.filter(member=>member.vehicle).map(member=>[member.id,member]));
  for(let index=0;index<rows.length;index++){
    const seat=rows[index],driver=drivers.get(seat.driver);
    const rider=players[index];
    if(!driver||driver.vehicle.id!==seat.car){
      if(seat.flightUntil>Date.now()&&seat.glidingCraft){
        const craft=JSON.parse(seat.glidingCraft);
        if(craft.flightPath||craft.roadCoast){
          rider.passenger={driver:craft.roadCoast?'coasting':'autorotation',car:craft.id,coasting:true};
          Object.assign(rider,craft.roadCoast?sampleRoadCoast(craft,Date.now()):sampleAutorotation(craft,Date.now()),{vehicle:null});
          rider.updatedAt=Date.now();
        }
      }
      continue;
    }
    rider.passenger={driver:driver.id,car:seat.car};
    for(const field of ['x','y','angle','moving','speed','vx','vy','lift','verticalSpeed'])
      if(driver[field]!==undefined)rider[field]=driver[field];
    rider.updatedAt=Math.max(rider.updatedAt,driver.updatedAt);
  }
}

export function requestSeat(stmts,q,{room,id,name,op,now,aliveSince,driver,car,leave}){
  // Commands participate in the same ordered, retryable batch as vehicle ownership.
  const fresh="NOT EXISTS (SELECT 1 FROM mc_events WHERE room=? AND player=? AND op=?)";
  if(leave){
    stmts.push(q(`DELETE FROM mc_air_riders WHERE room=? AND rider=? AND ${fresh}`,room,id,room,id,op));
    stmts.push(q(`DELETE FROM mc_seats WHERE room=? AND rider=? AND ${fresh}`,room,id,room,id,op));
  }else{
    stmts.push(q(`DELETE FROM mc_seats WHERE room=? AND car=? AND
      (NOT EXISTS (SELECT 1 FROM mc_members WHERE room=mc_seats.room AND id=mc_seats.driver AND seen>?)
       OR NOT EXISTS (SELECT 1 FROM mc_members WHERE room=mc_seats.room AND id=mc_seats.rider AND seen>?))`,
      room,car,aliveSince,aliveSince));
    stmts.push(q(`INSERT OR IGNORE INTO mc_seats (room,rider,driver,car)
      SELECT r.room,r.id,d.id,v.item FROM mc_members r
      JOIN mc_members d ON r.room=d.room AND d.id=? AND d.id<>r.id
      JOIN mc_items v ON v.room=r.room AND v.owner=d.id AND v.kind='vehicle' AND v.item=?
      WHERE r.room=? AND r.id=? AND d.seen>? AND r.seen>?
        AND json_extract(d.state,'$.vehicle.id')=v.item
        AND json_extract(d.state,'$.vehicle.type') NOT IN ('scooter','motorbike','cargo')
        AND coalesce(json_extract(d.state,'$.health'),100)>0 AND coalesce(json_extract(r.state,'$.health'),100)>0
        AND coalesce(json_extract(r.state,'$.downUntil'),0)<=? AND coalesce(json_extract(r.state,'$.lift'),0)<0.8
        AND json_extract(r.state,'$.vehicle.id') IS NULL
        AND coalesce(json_extract(d.state,'$.lift'),0)<0.35
        AND abs(coalesce(json_extract(d.state,'$.speed'),0))<=2.5
        AND (json_extract(d.state,'$.x')-json_extract(r.state,'$.x'))*(json_extract(d.state,'$.x')-json_extract(r.state,'$.x'))
          + (json_extract(d.state,'$.y')-json_extract(r.state,'$.y'))*(json_extract(d.state,'$.y')-json_extract(r.state,'$.y'))<=36
        AND ${fresh}`,driver,car,room,id,aliveSince,aliveSince,now,room,id,op));
  }
  stmts.push(q(`INSERT OR IGNORE INTO mc_events(room,player,op,name,type,data,at) VALUES(?,?,?,?,'seat','{}',?)`,room,id,op,name,now));
}

// Copy the passenger into the unpiloted cabin before the pilot's on-foot pose
// releases the ordinary driver seat. Both changes commit in the same D1 batch.
export function continueReleasedSeat(q,{room,id,op,car,type,until}){
  return q(`INSERT OR REPLACE INTO mc_air_riders(room,rider,car,until)
    SELECT s.room,s.rider,s.car,? FROM mc_seats s
    JOIN mc_items i ON i.room=s.room AND i.item=s.car AND i.kind='vehicle' AND i.owner=s.driver
    WHERE s.room=? AND s.driver=? AND s.car=? AND json_extract(i.data,'$.type')=?
      AND NOT EXISTS (SELECT 1 FROM mc_events WHERE room=? AND player=? AND op=?)`,
    until,room,id,car,type,room,id,op);
}

// A passenger can remain in a stopped, driverless chassis. Hand the occupied
// seat to its next driver in the same transaction as the ownership change.
export function inheritRoadPassenger(stmts,q,{room,id,op,car,now}){
  stmts.push(q(`INSERT OR IGNORE INTO mc_seats(room,rider,driver,car)
    SELECT a.room,a.rider,?,a.car FROM mc_air_riders a
    JOIN mc_items v ON v.room=a.room AND v.item=a.car AND v.kind='vehicle' AND v.owner=?
    JOIN mc_events e ON e.seq=v.seq AND e.room=v.room AND e.player=? AND e.op=? AND e.at=?
    WHERE a.room=? AND a.car=? AND a.until>? AND a.rider<>?`,id,id,id,op,now,room,car,now,id));
  stmts.push(q(`DELETE FROM mc_air_riders WHERE room=? AND car=? AND EXISTS
    (SELECT 1 FROM mc_seats WHERE room=? AND driver=? AND car=? AND rider=mc_air_riders.rider)`,room,car,room,id,car));
}
