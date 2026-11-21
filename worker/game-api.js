import {cleanRoadCoast,sampleRoadCoast} from '../public/road-coast.js';
import {armorySchema,openArmory,readArmory,privateAmmo} from './armory.js';
import {reportSchema,reportPlayer} from './social.js';
import {withJacket} from '../public/outfit-shop.js';
import {seatSchema,seatedRosterSQL,attachPassengers,requestSeat,continueReleasedSeat,inheritRoadPassenger} from './vehicle-seats.js';
import {abandonedFor,disconnectedFor,wreckFor,wreckExpired,replacementDelay} from '../public/vehicle-lifecycle.js';
import {parkingBay,parkingLease} from '../public/enfer-parking-lots.js';
import {hitSeverity, woundDuration, activeBleeding} from '../public/bleeding.js';
import {weaponCatalog} from '../public/weapon-catalog.js';
import {propMaxHealth, vehiclePropDamage} from '../public/prop-damage.js';
import {validFlightPath,sampleAutorotation,flightSampleMs} from '../public/autorotation.js';
import {airfields,isAircraft,flightCeiling} from '../public/airfield.js';
import {isVehicleType,vehicleSpec,isTrain} from '../public/vehicle-types.js';
import {railTrain,validatedRailPose,atRailStation,autonomousRail} from '../public/enfer-rail.js';
import {chassisDamage,partMask,incendiaryImpact,ignitionHealth,meleeWearFloor,vehicleBurnDelay,blastRadius,blastDamage} from '../public/vehicle-damage.js';
import {meleeMoves} from '../public/melee-moves.js';
import {cleanTrafficPacket} from '../public/traffic-sync.js';
import {normalizeAppearance} from '../public/kikalmo-schema.js';
import {encodeRoster} from '../public/roster-wire.js';
import {stateReferences,restoreStateFields} from '../public/state-wire.js';
import { decodeDropId, matchesPickup, decodeOfficerDrop, officerLootWindow } from '../public/drop-id.js';
import {partnerSchema,runPartners} from './partners.js';
import {careerSchema,runCareer} from './career.js';
import {prepareFire,readFireSession,rememberFirePose,recordFire} from './fire-netcode.js';
import {npcMaxHealth} from '../public/vitality.js';

// The Worker owns these tables. They are initialized once per D1 binding and isolate.
const schemaReady = new WeakMap();
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS mc_members (
    room TEXT NOT NULL, id TEXT NOT NULL, secret TEXT NOT NULL, name TEXT NOT NULL,
    state TEXT NOT NULL, joined INTEGER NOT NULL, seen INTEGER NOT NULL,
    PRIMARY KEY (room,id))`,
  'CREATE INDEX IF NOT EXISTS mc_members_seen ON mc_members (seen)',
  ...careerSchema,
  ...partnerSchema,
  `CREATE TABLE IF NOT EXISTS mc_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, player TEXT NOT NULL,
    op TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL,
    at INTEGER NOT NULL, UNIQUE (room,player,op))`,
  'CREATE INDEX IF NOT EXISTS mc_events_room ON mc_events (room,seq)',
  'CREATE INDEX IF NOT EXISTS mc_chat_history ON mc_events (room,seq) WHERE type=\'chat\'',
  'CREATE INDEX IF NOT EXISTS mc_events_age ON mc_events (at)',
  "CREATE INDEX IF NOT EXISTS mc_fire_cadence ON mc_events (room,player,at) WHERE type='shot'",
  `CREATE TABLE IF NOT EXISTS mc_fire_poses (
    room TEXT NOT NULL, player TEXT NOT NULL, slot INTEGER NOT NULL, at INTEGER NOT NULL,
    x REAL NOT NULL,y REAL NOT NULL,lift REAL NOT NULL,vx REAL NOT NULL,vy REAL NOT NULL,car TEXT NOT NULL,
    PRIMARY KEY (room,player,slot))`,
  'CREATE INDEX IF NOT EXISTS mc_fire_pose_age ON mc_fire_poses (at)',
  `CREATE TABLE IF NOT EXISTS mc_items (
    room TEXT NOT NULL, kind TEXT NOT NULL, item TEXT NOT NULL,
    seq INTEGER NOT NULL, owner TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (room,kind,item))`,
  'CREATE INDEX IF NOT EXISTS mc_items_age ON mc_items (at)',
  `CREATE TABLE IF NOT EXISTS mc_pickup_claims (
    room TEXT NOT NULL, player TEXT NOT NULL, op TEXT NOT NULL, item TEXT NOT NULL,
    ok INTEGER NOT NULL, available INTEGER NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (room,player,op))`,
  'CREATE INDEX IF NOT EXISTS mc_pickup_item ON mc_pickup_claims (room,item,available DESC) WHERE ok=1',
  'CREATE INDEX IF NOT EXISTS mc_pickup_active ON mc_pickup_claims (room,available) WHERE ok=1',
  'CREATE INDEX IF NOT EXISTS mc_pickup_age ON mc_pickup_claims (at)',
  // Older tabs can still send their last driving pose after the tow. Release the shared
  // seat on retirement and keep repeated heartbeats from advertising the removed car.
  `CREATE TRIGGER IF NOT EXISTS mc_tow_driver AFTER UPDATE OF kind ON mc_items
    WHEN NEW.kind='vehicleRetired' BEGIN
      UPDATE mc_members SET state=json_set(state,'$.vehicle',null,'$.speed',0,'$.lift',0,'$.moving',json('false'))
      WHERE room=NEW.room AND json_extract(state,'$.vehicle.id')=NEW.item;
    END`,
  ...['INSERT','UPDATE OF state'].map((action,i)=>`CREATE TRIGGER IF NOT EXISTS mc_towed_pose_${i}
    AFTER ${action} ON mc_members WHEN json_extract(NEW.state,'$.vehicle.id') IS NOT NULL AND EXISTS (
      SELECT 1 FROM mc_items WHERE room=NEW.room AND kind='vehicleRetired'
      AND item=json_extract(NEW.state,'$.vehicle.id') AND at>NEW.seen)
    BEGIN UPDATE mc_members SET state=json_set(state,'$.vehicle',null,'$.speed',0,'$.lift',0,'$.moving',json('false'))
      WHERE room=NEW.room AND id=NEW.id; END`),
  ...armorySchema,
  ...reportSchema,
  ...seatSchema
];
// Keep the public Paris records in place. Earlier named games remain isolated in storage.
const worldKeys={paris:'paris:public',enfer:'enfer:public'};
const GONE = 25_000;
const MAX_BATCH = 20;
const EVENT_RETENTION = 86_400_000;
const ITEM_RETENTION = 7 * EVENT_RETENTION;
const PICKUP_COOLDOWN = 60_000;
const PICKUP_REQUEST_AGE = 30_000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const KEY = /^[\w:-]{1,68}$/;
const ITEM_TYPES = new Set(['propDamage','destroy','vehicle','vehicleDamage','npc']);
const EVENTS = new Set(['vehicleShunt','propDamage','destroy','vehicle','vehicleDamage','npc','emote','horn','shot','melee','alert','hit','chat']);
const MEMBERS_SQL = seatedRosterSQL;
function ready(db) {
  if (!schemaReady.has(db)) {
    const promise = db.batch(SCHEMA.map(q => db.prepare(q))).catch(error => {
      schemaReady.delete(db);
      throw error;
    });
    schemaReady.set(db,promise);
  }
  return schemaReady.get(db);
}
function json(value, status=200) {
  return new Response(JSON.stringify(value), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
const clean = (s, n) => typeof s === 'string' ? [...s.replace(/[\u0000-\u001f\u007f]/g,' ').trim()].slice(0,n).join('') : '';
const num = (x, fallback=0, min=-1e5, max=1e5) => typeof x === 'number' && Number.isFinite(x) ? Math.min(max,Math.max(min,x)) : fallback;
const dict = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
function key(x) {
  return typeof x === 'string' && KEY.test(x) && !['__proto__','constructor','prototype'].includes(x) ? x : '';
}
function pose(source) {
  const copy={};
  for (const k of ['x','y','angle','vx','vy','walk','speed','health','wanted']) {
    if (typeof source[k]==='number') copy[k]=num(source[k]);
  }
  for (const k of ['type','kind','weapon','color','skin','variant','role','symbol']) {
    if (typeof source[k]==='string') copy[k]=clean(source[k],40);
  }
  for (const k of ['moving','sprinting','shooting','dead','siren']) {
    if (typeof source[k]==='boolean') copy[k]=source[k];
  }
  return copy;
}
function vitalityFields(source,now,longRecovery=false) {
  const result={};
  if(Number.isFinite(source.health))result.health=num(source.health,100,0,100);
  if(Number.isFinite(source.downUntil))result.downUntil=num(source.downUntil,0,0,now+(longRecovery&&source.health===0?30000:8000));
  const wound=activeBleeding(source.bleeding,now);
  if(wound && source.health>0 && !(source.downUntil>now))result.bleeding=wound;
  if(Number.isFinite(source.healthAt))result.healthAt=num(source.healthAt,now,0,now+1000);
  const rag=source.ragdoll;
  if(rag && Number.isFinite(rag.at) && Number.isFinite(rag.until) && rag.at>=now-9000 && rag.until>now-1000){
    const at=num(rag.at,now,now-9000,now+500);
    result.ragdoll={at,until:num(rag.until,at,at,Math.min(at+8000,now+8000)),angle:num(rag.angle,0,-Math.PI*2,Math.PI*2),
      force:num(rag.force,.5,0,1),seed:Math.trunc(num(rag.seed,0,0,65535))};
  }
  return result;
}
const locomotionModes=new Set(['idle','crouch','walk','run','jump','fall','land','vault','climb','swim','dismount']);
function movementFields(s,now,previous){
  if(!Number.isFinite(s.lift))return {};
  if(isAircraft(s.vehicle?.type))return {lift:num(s.lift,0,0,flightCeiling),motion:s.lift>0?'carAir':'idle',verticalSpeed:num(s.verticalSpeed,0,-8,8)};
  const falling=!s.vehicle&&(s.motion==='fall'||s.motion==='jump');
  const aircraftFallUntil=falling&&(isAircraft(previous?.vehicle?.type)&&previous.lift>.16?now+6000:previous?.aircraftFallUntil)||0;
  const inFlight=aircraftFallUntil>now;
  const lift=num(s.lift,0,0,inFlight?flightCeiling+3:64);
  if(s.vehicle)return s.motion==='carAir'&&lift>0
    ?{lift:Math.min(lift,12),motion:'carAir',verticalSpeed:num(s.verticalSpeed,0,-30,12)}
    :{lift:0,motion:'idle'};
  if(s.downUntil>now||s.health===0)return {lift,motion:'idle'};
  return {lift,...(inFlight?{aircraftFallUntil}:{}),verticalSpeed:num(s.verticalSpeed,0,-50,20),motion:locomotionModes.has(s.motion)?s.motion:'idle',
    motionPhase:num(s.motionPhase,0,0,1),stride:num(s.stride,0,0,1),slope:num(s.slope,0,-1,1),turn:num(s.turn,0,-1,1)};
}
const isMeleeKind=kind=>typeof kind==='string'&&Object.hasOwn(meleeMoves,kind);
const recentSwing=(at,now)=>Number.isSafeInteger(at)&&at>=now-4000&&at<=now+350;
function recoilState(raw,now){
  if(!raw||!Number.isFinite(raw.at)||raw.at<now-4000||raw.at>now+350||!Number.isFinite(raw.angle))return {};
  return {recoil:{at:Math.round(raw.at),angle:num(raw.angle,0,-7,7),force:num(raw.force,0,0,1)}};
}
function meleeState(s,now){
  if(s.vehicle||s.downUntil>now||s.health===0)return {};
  const swing=s.melee;
  const fields=recoilState(s.recoil,now);
  if(isMeleeKind(swing?.kind)&&recentSwing(swing.started,now)&&now-swing.started<=meleeMoves[swing.kind].duration*1000)
    fields.melee={kind:swing.kind,started:swing.started,...(Number.isFinite(swing.angle)?{angle:num(swing.angle,0,-7,7)}:{})};
  return fields;
}
function impactFields(type,d,now){
  const kind=type==='hit'?d.kind:d.swingKind;
  if(!isMeleeKind(kind)||!recentSwing(d.swingAt,now))return null;
  const fields={cause:'melee',swingAt:d.swingAt,[type==='hit'?'kind':'swingKind']:kind};
  if(type!=='destroy')Object.assign(fields,{damage:meleeMoves[kind].damage,force:meleeMoves[kind].force});
  return fields;
}
function playerState(raw,now,room,previous) {
  const s=dict(raw), result={...pose(s),...vitalityFields(s,now,room===worldKeys.enfer),...movementFields(s,now,previous),...meleeState(s,now)};
  const appearance=normalizeAppearance(s.appearance);if(appearance)result.appearance=appearance;
  if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return {};
  if(room===worldKeys.enfer&&!s.vehicle&&railTrain(s.railRider)&&validatedRailPose(s.railRider,result))
    result.railRider=s.railRider;
  const traffic=cleanTrafficPacket(s.traffic,now);if(traffic)result.traffic=traffic;
  if (s.vehicle && key(s.vehicle.id)){
    result.vehicle={...pose(s.vehicle),id:key(s.vehicle.id)};
    if(isTrain(result.vehicle.type)||railTrain(result.vehicle.id)){
      const train=room===worldKeys.enfer&&isTrain(result.vehicle.type)&&validatedRailPose(result.vehicle.id,result.vehicle);
      if(!train){delete result.vehicle;return result;}
      Object.assign(result.vehicle,train);
      Object.assign(result,{x:train.x,y:train.y,angle:train.angle,speed:train.speed,lift:.18});
    }
    if(isAircraft(result.vehicle.type))Object.assign(result.vehicle,{lift:result.lift||0,
      bank:num(s.vehicle.bank,0,-.25,.25),carPitch:num(s.vehicle.carPitch,0,-.2,.2)});
    for(const k of ['brake','headlamps','fare'])if(typeof s.vehicle[k]==='boolean')result.vehicle[k]=s.vehicle[k];
  }
  else result.vehicle=null;
  return result;
}
function eventData(type,raw,now) {
  const d=dict(raw), result=pose(d);
  switch(type) {
    case 'chat': return clean(d.text,240) ? {text:clean(d.text,240)} : null;
    case 'horn': return {};
    case 'emote': return clean(d.symbol,24) ? {symbol:clean(d.symbol,24)} : null;
    case 'destroy': {
      if(!key(d.id)||/^g.+-[dg]-\d+$/.test(d.id)||d.id.startsWith('terrace-'))return null;
      if(d.cause!=='melee')return {id:d.id};
      const hit=impactFields(type,d,now);
      return hit&&Number.isFinite(result.x)&&Number.isFinite(result.y)?{...hit,id:d.id,x:result.x,y:result.y}:null;
    }
    case 'propDamage': {
      if(!key(d.id)||!propMaxHealth(d.type)||!key(d.impactId)||!Number.isFinite(d.x)||!Number.isFinite(d.y)||
          !(d.damage>0)||!Number.isFinite(d.damage))return null;
      const prop={id:d.id,type:d.type,x:result.x,y:result.y,impactId:d.impactId,
        ...(Number.isFinite(d.angle)?{angle:num(d.angle,0,-7,7)}:{})};
      if(d.cause==='melee'){
        const swing=impactFields(type,d,now);
        return swing?{...prop,...swing}:null;
      }
      if(d.cause==='weapon' && Object.hasOwn(weaponCatalog,d.weapon) && d.weapon!=='fist'){
        const damage=Math.min(weaponCatalog[d.weapon].damage,Math.round(d.damage));
        return damage>0?{...prop,cause:'weapon',weapon:d.weapon,damage}:null;
      }
      if(d.cause==='traffic' && Number.isFinite(d.speed))
        return {...prop,cause:'traffic',speed:num(d.speed,0,0,70),damage:Math.round(num(d.damage,0,0,150))};
      return null;
    }
    case 'melee':
      return isMeleeKind(d.kind)&&recentSwing(d.started,now)&&Number.isFinite(d.x)&&Number.isFinite(d.y)?
        {kind:d.kind,started:d.started,x:result.x,y:result.y,angle:num(d.angle,0,-7,7),lift:num(d.lift,0,0,64)}:null;
    case 'vehicleShunt': {
      if(!key(d.id)||!isVehicleType(d.type)||![d.x,d.y,d.vx,d.vy,d.spin].every(Number.isFinite))return null;
      return {id:d.id,type:d.type,x:result.x,y:result.y,vx:num(d.vx,0,-37,37),vy:num(d.vy,0,-37,37),spin:num(d.spin,0,-2.7,2.7)};
    }
    case 'vehicle': {
      if(!key(d.id))return null;
      const occupied=!!d.occupied;
      const out={...result,id:d.id,occupied,...(!occupied&&d.shifted?{shifted:true}:{}),...(!occupied?{expiresAt:now+abandonedFor}:{})};
      if(isTrain(out.type)||railTrain(out.id)){
        const track=isTrain(out.type)&&validatedRailPose(out.id,out);
        if(!track||d.eject||d.shifted||d.roadCoast||occupied&&!atRailStation(track.d))return null;
        return {...out,...track,...(occupied?{speed:0,moving:false}:{railAt:now,expiresAt:now+604_800_000})};
      }
      if(!occupied&&isAircraft(out.type)&&validFlightPath(d.flightPath,out.type)){
        out.flightPath=d.flightPath;out.lift=d.flightPath[0][1];
        out.flightAt=num(d.flightAt,now,now-1800,now);out.expiresAt=out.flightAt+(out.flightPath.length-1)*flightSampleMs+abandonedFor;
      }
      if(!occupied&&isVehicleType(out.type)&&!isAircraft(out.type)&&d.roadCoast){
        const coast=cleanRoadCoast(d.roadCoast,out.type,now);
        if(!coast)return null;
        out.roadCoast=coast;out.expiresAt=coast.until+abandonedFor;
      }
      if(!occupied&&!d.shifted&&!d.roadCoast&&typeof d.parkingOwner==='string'&&/^[a-f0-9]{64}$/.test(d.parkingOwner)){
        const bay=parkingBay(out,out.type);
        if(bay?.id===d.parkingSlot){
          out.parkingSlot=bay.id;out.parkingOwner=d.parkingOwner;out.expiresAt=now+parkingLease;
        }
      }
      if(occupied&&d.eject&&Number.isFinite(d.eject.x+d.eject.y+d.eject.angle)&&Math.hypot(d.eject.x-result.x,d.eject.y-result.y)<=5)
        out.eject={x:d.eject.x,y:d.eject.y,angle:num(d.eject.angle,0,-7,7),at:now};
      return out;
    }
    case 'npc': {
      if (!key(d.id)) return null;
      if (d.cause!=='melee' && d.kind && Number.isFinite(d.started)) {
        return {...result,id:d.id,started:num(d.started,now,now-120_000,now+2000),level:num(d.level,1,0,5)};
      }
      const state={...result,...vitalityFields(d,now),id:d.id,stunnedUntil:num(d.stunnedUntil,0,0,now+8000)};
      if(isVehicleType(d.vehicleType))state.vehicleType=d.vehicleType;
      if(Number.isFinite(d.threatX+d.threatY)){state.threatX=num(d.threatX);state.threatY=num(d.threatY);}
      if(d.cause==='weapon'||d.cause==='melee')delete state.ragdoll;
      if(d.cause==='melee'){
        const hit=impactFields(type,d,now),{recoil}=recoilState(d.recoil,now);
        if(!hit||!recoil||!Number.isFinite(d.x)||!Number.isFinite(d.y)||!Number.isFinite(d.recoil.fromX)||
            !Number.isFinite(d.recoil.fromY)||Math.hypot(d.recoil.fromX-d.x,d.recoil.fromY-d.y)>1.5)return null;
        delete state.kind;
        return {...state,...hit,recoil:{...recoil,force:hit.force,fromX:d.recoil.fromX,fromY:d.recoil.fromY}};
      }
      delete state.bleeding;
      return {...state,...(['weapon','traffic'].includes(d.cause)?{cause:d.cause}:{}),...(Number.isFinite(d.damage)&&d.damage>0?{damage:num(d.damage,1,1,100)}:{})};
    }
    case 'shot': {
      const out={...result,length:num(d.length,80,0,400)};
      if(Number.isFinite(d.lift))out.lift=num(d.lift,0,0,64);
      const near=r=>Number.isFinite(r?.x)&&Number.isFinite(r?.y)&&Math.hypot(r.x-result.x,r.y-result.y)<=100;
      if(Array.isArray(d.rays))out.rays=d.rays.slice(0,13).filter(near).map(r=>({x:r.x,y:r.y,angle:num(r.angle,0,-8,8),length:num(r.length,0,0,100)}));
      if(near(d.impact))out.impact={x:d.impact.x,y:d.impact.y,radius:num(d.impact.radius,1,0,12)};
      return out;
    }
    case 'alert': return {...result,level:num(d.level,1,0,5)};
    case 'hit': {
      if(d.cause==='melee'){
        const hit=impactFields(type,d,now);
        return hit&&UUID.test(d.target)?{...hit,target:d.target,angle:num(d.angle,0,-7,7)}:null;
      }
      return UUID.test(d.target) ? {target:d.target,damage:num(d.damage,1,1,100),
      ...(Number.isFinite(d.angle)?{angle:num(d.angle,0,-7,7)}:{}),...(Number.isFinite(d.force)?{force:num(d.force,0,0,1)}:{}),
      ...(['weapon','traffic'].includes(d.cause)?{cause:d.cause}:{}),
      ...(d.cause==='weapon'&&Object.hasOwn(weaponCatalog,d.weapon)?{weapon:d.weapon}:{})} : null;
    }
    default: return null;
  }
}
function roster(rows,viewerId) {
  const players=rows.map(r=>({...JSON.parse(r.state),id:r.id,name:r.name,joinedAt:r.joined,updatedAt:r.seen}));
  for(const [i,p] of players.entries())if(p.type==='fox'&&p.color)p.color=withJacket(p.color.split('~')[0],rows[i].dye);
  attachPassengers(players,rows);
  const viewer=players.find(r=>r.id===viewerId);
  for(const r of players)if(r.id===viewerId||!viewer||Math.hypot(r.x-viewer.x,r.y-viewer.y)>290)delete r.traffic;
  return players;
}
function rosterPacket(rows,id,request){
  const players=roster(rows,id);
  return request.protocol===2?encodeRoster(players,request.rosterBase):{players};
}
function visibleCombatEvent(e,viewer){
  if(e.type!=='shot'&&e.type!=='melee')return true;
  if(![e.data.x,e.data.y,viewer.x,viewer.y].every(Number.isFinite))return true;
  return Math.hypot(e.data.x-viewer.x,e.data.y-viewer.y)<=225;
}
function events(rows) {
  return rows.map(r=>({seq:r.seq,player:r.player,name:r.name,type:r.type,data:JSON.parse(r.data),at:r.at}));
}
function shared(rows,now) {
  const world={destroyed:[],vehicles:{},npcs:{},pickups:{},propHealth:{},vehicleDamage:{},retiredVehicles:{}};
  const broken=new Set();
  for (const r of rows) {
    if (r.kind==='destroy') broken.add(r.item);
    if(r.kind==='propDamage'){
      const item=JSON.parse(r.data);world.propHealth[r.item]=item;
      if(item.health===0)broken.add(r.item);
    }
    if(r.kind==='vehicle'){
      const vehicle=JSON.parse(r.data);
      if(r.owner&&r.driverSeen>now-GONE&&(r.driverCar===r.item||r.at>now-6500))
        world.vehicles[r.item]={...vehicle,owner:r.owner,lastSeen:r.at};
      else{
        if(isTrain(vehicle.type)){
          world.vehicles[r.item]={...vehicle,railAt:r.owner?r.at:vehicle.railAt??r.at,occupied:false,owner:'',expiresAt:r.at+604_800_000};
          continue;
        }
        const expiresAt=r.owner?r.at+disconnectedFor:vehicle.expiresAt||r.at+abandonedFor;
        const home=!vehicle.flightPath&&isAircraft(vehicle.type)&&vehicle.lift>.35?airfields.find(site=>site.type===vehicle.type):null;
        if(expiresAt>now)world.vehicles[r.item]={...vehicle,...(home?{x:home.x,y:home.y,angle:home.angle,lift:0,bank:0,carPitch:0}:{}),occupied:false,owner:'',expiresAt};
      }
    }
    if(r.kind==='vehicleDamage'){
      const wear=JSON.parse(r.data);
      if(!wreckExpired(wear,now))world.vehicleDamage[r.item]=wear;
    }
    if(r.kind==='vehicleRetired'&&r.at>now)world.retiredVehicles[r.item]=r.at;
    if (r.kind==='npc') world.npcs[r.item]=JSON.parse(r.data);
  }
  world.destroyed=[...broken];
  return world;
}
// Retire both the parked pose and the damage row atomically. Keep only the ID and its
// replacement deadline so new browsers also leave the deterministic spawn empty.
const sweptVehicles=new WeakMap();
async function sweepVehicles(db,room,now,joining){
  const sweep=sweptVehicles.get(db)||{};
  if(!joining&&sweep[room]>now-3000&&sweep[room]<=now)return;
  const end="coalesce(nullif(json_extract(data,'$.explodeAt'),0),json_extract(data,'$.disabledAt'),0)";
  await db.batch([
    db.prepare(`DELETE FROM mc_items WHERE room=? AND kind='vehicle' AND item IN
      (SELECT item FROM mc_items WHERE room=? AND kind='vehicleDamage' AND ${end} BETWEEN 1 AND ?)`).bind(room,room,now-wreckFor),
    db.prepare(`UPDATE mc_items SET kind='vehicleRetired',at=${end}+?,data='{}',owner=''
      WHERE room=? AND kind='vehicleDamage' AND ${end} BETWEEN 1 AND ?`).bind(wreckFor+replacementDelay,room,now-wreckFor),
    db.prepare("DELETE FROM mc_items WHERE room=? AND kind='vehicleRetired' AND at<=?").bind(room,now)
  ]);
  sweep[room]=now;sweptVehicles.set(db,sweep);
}
async function join(db,b,now,room) {
  const {id,token}=b, name=clean(b.name,24)||'Kikalmo';
  const q=(sql,...args)=>db.prepare(sql).bind(...args);
  const results=await db.batch([
    q('DELETE FROM mc_members WHERE seen<?',now-GONE),
    q('DELETE FROM mc_events WHERE at<?',now-EVENT_RETENTION),
    q('DELETE FROM mc_items WHERE at<?',now-ITEM_RETENTION),
    q(`INSERT INTO mc_members (room,id,secret,name,state,joined,seen)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT (room,id) DO UPDATE SET seen=excluded.seen,name=excluded.name,
       state=CASE WHEN excluded.state='{}' THEN mc_members.state ELSE excluded.state END
       WHERE mc_members.secret=excluded.secret`,
       room,id,token,name,JSON.stringify(playerState(b.state,now,room)),now,now),
    q('SELECT 1 AS ok FROM mc_members WHERE room=? AND id=? AND secret=?',room,id,token),
    q(MEMBERS_SQL,room,now-GONE),
    q('SELECT seq,player,name,type,data,at FROM mc_events WHERE room=? AND type=\'chat\' ORDER BY seq DESC LIMIT 30',room),
    q('SELECT COALESCE(MAX(seq),0) AS last FROM mc_events WHERE room=?',room),
    q(`SELECT i.kind,i.item,i.data,i.owner,i.at,m.seen AS driverSeen,json_extract(m.state,'$.vehicle.id') AS driverCar FROM mc_items i
      LEFT JOIN mc_members m ON i.room=m.room AND i.owner=m.id WHERE i.room=?`,room),
    q('SELECT item,available FROM mc_pickup_claims WHERE room=? AND ok=1 AND available>?',room,now),
    q('DELETE FROM mc_pickup_claims WHERE at<?',now-EVENT_RETENTION),
    q('DELETE FROM mc_fire_poses WHERE at<?',now-5000),
    ...await openArmory(q,room,id,token,UUID.test(b.ammoKey)?b.ammoKey:token)
  ]);
  if (!results[4].results.length) return json({error:'session'},403);
  const world=shared(results[8].results,now);
  for(const pickup of results[9].results)world.pickups[pickup.item]=pickup.available;
  return json({now,ammo:privateAmmo(results.at(-1).results),...(b.protocol===2?{stateRefs:stateReferences(playerState(b.state,now,room))}:{}),...rosterPacket(results[5].results,id,{protocol:b.protocol}),history:events(results[6].results.reverse()),
    cursor:results[7].results[0].last,world});
}
const airbornePickup=new Set(['jump','fall','climb','vault','swim']);
function recordPickup(stmts,q,{room,id,token,name,op,item,weapon,state,now}){
  const p=decodeDropId(item),officer=decodeOfficerDrop(item);
  if(!matchesPickup(item,weapon,room===worldKeys.enfer))return false;
  const match=/^pick-([0-9a-z]{7,11})-([0-9a-z]{1,10})$/.exec(op);
  if(!match)return false;
  const issued=parseInt(match[1],36);
  const fresh=issued>=now-PICKUP_REQUEST_AGE&&issued<=now+2500;
  if(!fresh)return true; // An expired operation can only read its original receipt.
  const close=Number.isFinite(state.x)&&Number.isFinite(state.y)&&!state.vehicle&&state.health!==0&&!(state.downUntil>now)&&(state.lift||0)<=.8&&!airbornePickup.has(state.motion)&&(officer||Math.hypot(state.x-p.x,state.y-p.y)<=4);
  // Reads, receipt and winner event share one D1 batch transaction. Another player
  // can enter only after it commits and will see the winning availability timestamp.
  const lootGuard=officer?`AND EXISTS (
    SELECT 1 FROM mc_items WHERE room=? AND kind='npc' AND item=?
      AND json_extract(data,'$.health')=0 AND json_extract(data,'$.healthAt')=?
      AND json_extract(data,'$.healthAt')>?
      AND json_extract(data,'$.type')=?
      AND (json_extract(data,'$.x')-?)*(json_extract(data,'$.x')-?)+
          (json_extract(data,'$.y')-?)*(json_extract(data,'$.y')-?)<=16
  )`:'';
  const lootArgs=officer?[room,officer.npc,officer.stamp,now-officerLootWindow,
    weapon==='smg'?'police':'swat',state.x??0,state.x??0,state.y??0,state.y??0]:[];
  stmts.push(q(`WITH receipt AS (
    SELECT COALESCE((SELECT available FROM mc_pickup_claims
      WHERE room=? AND item=? AND ok=1 ORDER BY available DESC LIMIT 1),0) AS previous,
      (? ${lootGuard}) AS allowed
  ) INSERT OR IGNORE INTO mc_pickup_claims (room,player,op,item,ok,available,at)
    SELECT ?,?,?,?, (previous<=? AND allowed),
      CASE WHEN previous>? THEN previous WHEN allowed THEN ? ELSE 0 END, ? FROM receipt
    WHERE EXISTS (SELECT 1 FROM mc_members WHERE room=? AND id=? AND secret=? AND seen>?)`,
    room,item,close?1:0,...lootArgs,room,id,op,item,now,now,now+PICKUP_COOLDOWN,now,room,id,token,now-GONE));
  stmts.push(q(`INSERT OR IGNORE INTO mc_events (room,player,op,name,type,data,at)
    SELECT room,player,op,?,'pickup',json_object('id',item,'weapon',?,'availableAt',available),at
    FROM mc_pickup_claims WHERE room=? AND player=? AND op=? AND item=? AND ok=1 AND at=?`,
    name,weapon,room,id,op,item,now));
  return true;
}
// The preceding item and its replacement are in one D1 batch, including concurrent hits and retries.
function propDamageStatement(q,{room,id,op,name,data,now},guard){
  return q(`WITH prior AS (
    SELECT (SELECT data FROM mc_items WHERE room=? AND kind='propDamage' AND item=?) AS old,
      ? AS src, ? AS maximum, ? AS requested),
    item AS (SELECT *,coalesce(json_extract(old,'$.health'),maximum) AS hp FROM prior)
    INSERT OR IGNORE INTO mc_events (room,player,op,name,type,data,at)
    SELECT ?,?,?,?,'propDamage',json_set(src,'$.health',max(0,hp-requested),'$.maxHealth',maximum,
      '$.damage',min(hp,requested),'$.x',coalesce(json_extract(old,'$.x'),json_extract(src,'$.x')),
      '$.y',coalesce(json_extract(old,'$.y'),json_extract(src,'$.y'))),? FROM item
    ${guard.clause||'WHERE 1'} AND hp>0 AND (old IS NULL OR json_extract(old,'$.type')=json_extract(src,'$.type'))
      AND NOT EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='destroy' AND item=?)`,
    room,data.id,JSON.stringify(data),propMaxHealth(data.type),data.damage,room,id,op,name,now,...guard.args,room,data.id);
}

function npcHitStatement(q,{room,id,op,name,data,now},guard) {
  // Read the previous wound before applying a new hit. Elapsed ticks are relative to its start,
  // so two hits in the same second and snapshots with fractional HP settle the loss exactly once.
  return q(`WITH input(src,stamp,severity,maximum) AS (VALUES (?,?,?,?)),
    previous AS (SELECT (SELECT data FROM mc_items WHERE room=? AND kind='npc' AND item=?) AS old,* FROM input),
    stats AS (SELECT *, coalesce(json_extract(old,'$.health'),maximum) AS hp,
      coalesce(json_extract(old,'$.type'),json_extract(src,'$.type'),'') IN ('police','swat') AS officer,
      coalesce(json_extract(old,'$.healthAt'),stamp) AS last_hit,
      coalesce(json_extract(old,'$.downUntil'),0) AS down_at,
      coalesce(json_extract(old,'$.bleeding.at'),stamp) AS start_at,
      coalesce(json_extract(old,'$.bleeding.until'),0) AS end_at FROM previous),
    ticks AS (SELECT *, max(0,cast((min(stamp,end_at)-start_at)/1000 AS integer))-
      max(0,cast((min(last_hit,end_at)-start_at)/1000 AS integer)) AS lost,
      max(severity,CASE WHEN end_at>stamp THEN coalesce(json_extract(old,'$.bleeding.severity'),0) ELSE 0 END) AS level FROM stats),
    remaining AS (SELECT *,
      CASE WHEN down_at>stamp OR (officer AND hp=0) THEN 0
        WHEN down_at>0 AND hp=0 THEN min(maximum,65+max(0,stamp-down_at-10000)*0.004)
        ELSE min(maximum,max(min(hp,1),hp-lost)+max(0,stamp-last_hit-10000)*0.004) END AS current_hp FROM ticks),
    result AS (SELECT *, max(0,current_hp-json_extract(src,'$.damage')) AS next_hp,
      CASE WHEN severity>0 THEN json_object('at',stamp,'until',stamp+CASE level WHEN 1 THEN ? WHEN 2 THEN ? ELSE ? END,'severity',level)
        WHEN end_at>stamp THEN json_extract(old,'$.bleeding') END AS wound FROM remaining)
    INSERT OR IGNORE INTO mc_events (room,player,op,name,type,data,at)
      SELECT ?,?,?,?,'npc',
        CASE WHEN down_at>stamp OR (officer AND hp=0) THEN json_remove(json_set(old,'$.damage',0),'$.bleeding')
        WHEN next_hp<=0 THEN json_set(json_remove(src,'$.bleeding'),'$.health',0,'$.healthAt',stamp,'$.downUntil',stamp+6500,'$.stunnedUntil',stamp+6500,
          '$.dead',json(CASE WHEN officer THEN 'true' ELSE 'false' END),
          '$.ragdoll',json_object('at',stamp,'until',stamp+6500,'angle',coalesce(json_extract(src,'$.ragdoll.angle'),json_extract(src,'$.angle'),0),
          'force',coalesce(json_extract(src,'$.ragdoll.force'),0.8),'seed',coalesce(json_extract(src,'$.ragdoll.seed'),stamp%65536)))
        ELSE json_set(src,'$.health',next_hp,'$.healthAt',stamp,'$.downUntil',0,'$.bleeding',json(wound)) END,stamp FROM result ${guard.clause}`,
      JSON.stringify(data),now,hitSeverity(data.cause,data.damage,data.weapon),npcMaxHealth(data.type),room,data.id,
      woundDuration(1),woundDuration(2),woundDuration(3),room,id,op,name,...guard.args);
}
// A start and its single contact get stable operation IDs even across network retries.
const swingOp=started=>'swing-'+started.toString(36);
function vehicleImpact(raw,actor,previous){
  const {id,type,cause,weapon,speed,x,y,angle,part:impactPart,blast,range,swingAt,swingKind}=dict(raw);
  const part=cause==='weapon'&&typeof impactPart==='string'&&Object.hasOwn(partMask,impactPart)?impactPart:'body';
  if(!key(id)||!isVehicleType(type)||![x,y,actor.x,actor.y].every(Number.isFinite))return null;
  const distance=Math.hypot(x-actor.x,y-actor.y);
  if(cause==='blast'){
    if(!key(blast)||id===blast||!Number.isFinite(range)||range<0||range>blastRadius||distance>145)return null;
    const damage=blastDamage(range,65);
    return damage?{id,type,cause,blast,x:num(x),y:num(y),angle:num(angle,0,-7,7),part,damage}:null;
  }
  if(cause==='weapon'){
    if(!Object.hasOwn(weaponCatalog,weapon)||distance>weaponCatalog[weapon].range+12)return null;
  }else if(cause==='melee'){
    if(!Object.hasOwn(meleeMoves,swingKind)||!Number.isSafeInteger(swingAt)||actor.vehicle||
      distance>vehicleSpec(type).halfLength+meleeMoves[swingKind].reach+1.1)return null;
  }else if(cause!=='crash'||distance>15||!(actor.vehicle||previous.vehicle))return null;
  const damage=chassisDamage(type,{cause,speed,weapon,part,swingKind});
  return damage?{id,type,cause,x:num(x),y:num(y),angle:num(angle,0,-7,7),part,damage,...(cause==='melee'?{swingAt,swingKind}:{}),...(cause==='crash'?{speed:num(speed,0,0,85)}:{})}:null;
}
function vehicleDamageStatement(q,{room,id,op,name,data,now},guard){
  const ignite=`(coalesce(json_extract(old,'$.fireAt'),0)>0 OR (next_hp<=${ignitionHealth} AND ignition=1))`;
  const blastGuard=data.cause==='blast'?` AND EXISTS (
      SELECT 1 FROM mc_items source
      LEFT JOIN mc_items pos ON pos.room=source.room AND pos.kind='vehicle' AND pos.item=source.item
      WHERE source.room=? AND source.kind='vehicleDamage' AND source.item=?
        AND json_extract(source.data,'$.explodeAt') BETWEEN ? AND ?
        AND abs(?-coalesce(json_extract(pos.data,'$.x'),json_extract(source.data,'$.x')))<=?
        AND abs(?-coalesce(json_extract(pos.data,'$.y'),json_extract(source.data,'$.y')))<=?
    ) AND NOT EXISTS (
      SELECT 1 FROM mc_events WHERE room=? AND type='vehicleDamage' AND at>=?
        AND json_extract(data,'$.blast')=? AND json_extract(data,'$.id')=?
    )`:'';
  const blastArgs=data.cause==='blast'?[room,data.blast,now-4200,now+250,data.x,blastRadius+3,data.y,blastRadius+3,room,now-5800,data.blast,data.id]:[];
  return q(`WITH prior AS (
    SELECT (SELECT data FROM mc_items WHERE room=? AND kind='vehicleDamage' AND item=?) AS old
  ), stats AS (SELECT old,coalesce(json_extract(old,'$.hp'),100) AS hp FROM prior), item AS (
    SELECT old,hp,max(min(?,hp),hp-?) AS next_hp,? AS ignition FROM stats
  ) INSERT OR IGNORE INTO mc_events (room,player,op,name,type,data,at)
  SELECT ?,?,?,?,'vehicleDamage',json_set(?,'$.hp',next_hp,'$.damage',hp-next_hp,
    '$.parts',coalesce(json_extract(old,'$.parts'),0)|?,'$.repairedAt',coalesce(json_extract(old,'$.repairedAt'),0),
    '$.disabledAt',CASE WHEN next_hp=0 AND NOT ${ignite} THEN ? ELSE 0 END,
    '$.fireAt',CASE WHEN ${ignite} THEN coalesce(nullif(json_extract(old,'$.fireAt'),0),?) ELSE 0 END,
    '$.fireHp',CASE WHEN ${ignite} THEN coalesce(nullif(json_extract(old,'$.fireHp'),0),max(1,next_hp)) ELSE 0 END,
    '$.explodeAt',CASE WHEN ${ignite} THEN
      coalesce(nullif(json_extract(old,'$.explodeAt'),0),coalesce(nullif(json_extract(old,'$.fireAt'),0),?)+?) ELSE 0 END),?
  FROM item ${guard.clause||'WHERE 1'} AND hp>next_hp
    AND coalesce(nullif(json_extract(old,'$.explodeAt'),0),?+1)>?
    AND NOT EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicleRetired' AND item=? AND at>?)`+blastGuard,
    room,data.id,data.cause==='melee'?meleeWearFloor:0,data.damage,Number(incendiaryImpact(data)),room,id,op,name,JSON.stringify(data),
    partMask[data.part]||0,now,now,now,vehicleBurnDelay,now,...guard.args,now,now,room,data.id,now,...blastArgs);
}
function contactGuard(type,data,actor,room,id,now){
  const kind=data.swingKind||data.kind,range=meleeMoves[kind].reach+.5+1.75;
  if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y)||actor.vehicle||actor.health===0||actor.downUntil>now)return null;
  let clause="WHERE EXISTS (SELECT 1 FROM mc_events WHERE room=? AND player=? AND op=? AND type='melee' AND json_extract(data,'$.kind')=?)";
  const args=[room,id,swingOp(data.swingAt),kind];
  if(type==='hit'){
    if(data.target===id)return null;
    // Both characters move between snapshots. The short margin covers that interval.
    clause+=` AND EXISTS (SELECT 1 FROM (
      SELECT json_extract(state,'$.x')-? AS dx,json_extract(state,'$.y')-? AS dy,
        coalesce(json_extract(state,'$.lift'),0) AS lift FROM mc_members
      WHERE room=? AND id=? AND seen>? AND json_extract(state,'$.vehicle.id') IS NULL
      AND coalesce(json_extract(state,'$.health'),100)>0 AND coalesce(json_extract(state,'$.downUntil'),0)<=?
    ) WHERE dx*dx+dy*dy<=? AND abs(lift-?)<=2.15)`;
    args.push(actor.x,actor.y,room,data.target,now-GONE,now,range*range,actor.lift||0);
  }else{
    const x=data.recoil?.fromX??data.x,y=data.recoil?.fromY??data.y;
    const radius=type==='vehicleDamage'?vehicleSpec(data.type).halfLength:0;
    if(Math.hypot(actor.x-x,actor.y-y)>range+radius)return null;
  }
  return {clause,args};
}
async function sync(db,b,now,room) {
  const {id,token}=b;
  const q=(sql,...args)=>db.prepare(sql).bind(...args);
  const inputs=Array.isArray(b.events)?b.events.slice(0,MAX_BATCH):[];
  const firePackets=new Map();
  for(const input of inputs){
    if(input?.type!=='fire'||!key(input.op))continue;
    const packet=prepareFire(input.data,now,target=>typeof target==='string'&&UUID.test(target));
    if(packet)firePackets.set(input,packet);
  }
  const {member,priorState,tracks:fireHistories}=await readFireSession(db,q,{
    room,id,token,now,aliveSince:now-GONE,packets:firePackets,submitted:b.state
  });
  if (!member) return json({error:'rejoin'},401);
  const name=clean(b.name,24)||member.name;
  const rawState=playerState(b.protocol===2?restoreStateFields(b.state,b.keepState,priorState):b.state,now,room,priorState);
  const gliding=member.glidingCraft&&JSON.parse(member.glidingCraft);
  if(member.seatedDriver||gliding?.flightPath||gliding?.roadCoast){
    if(!Number.isFinite(rawState.x))Object.assign(rawState,priorState);
    const driver=member.seatedDriver?JSON.parse(member.seatedDriver):gliding.roadCoast?sampleRoadCoast(gliding,now):sampleAutorotation(gliding,now);
    for(const field of ['x','y','angle','vx','vy','speed','moving','lift','verticalSpeed'])
      if(driver[field]!==undefined)rawState[field]=driver[field];
    if((isAircraft(driver.vehicle?.type)||gliding?.flightPath)&&driver.lift>.16)rawState.aircraftFallUntil=now+6000;
    rawState.vehicle=null;
  }
  const state=Number.isFinite(rawState.x) ? JSON.stringify(rawState) : member.state;
  const actor=Number.isFinite(rawState.x)?rawState:priorState;
  const stmts=[];
  for(const input of inputs){
    const data=input?.data;
    if(input?.type!=='vehicle'||!key(input.op)||!key(data?.id)||data.occupied!==false)continue;
    const release=eventData('vehicle',data,now);
    if(release?.flightPath||release?.roadCoast){
      const until=release.roadCoast?release.expiresAt:release.flightAt+(release.flightPath.length-1)*flightSampleMs;
      stmts.push(continueReleasedSeat(q,{room,id,op:input.op,car:data.id,type:release.type,until}));
    }
  }
  if (now-member.seen>3500 || state!==member.state || name!==member.name) {
    if(Number.isFinite(rawState.x))rememberFirePose(stmts,q,room,id,priorState,member.seen,rawState);
    stmts.push(q('UPDATE mc_members SET seen=?,state=?,name=? WHERE room=? AND id=? AND secret=?',now,state,name,room,id,token));
    if (rawState.vehicle) {
      // Keep a last known parking spot for a driver who loses their connection.
      const {id:carId,...car}=rawState.vehicle;
      stmts.push(q(`UPDATE mc_items SET data=json_patch(data,?),at=? WHERE room=? AND kind='vehicle'
        AND item=? AND owner=? AND at<?`,JSON.stringify(car),now,room,carId,id,now-1000));
    }
  }
  const glideEnds="json_extract(data,'$.flightAt')+(json_array_length(data,'$.flightPath')-1)*"+flightSampleMs;
  const releaseEnds="coalesce(json_extract(data,'$.roadCoast.until'),"+glideEnds+",0)";
  const claims=new Set(),pickupOps=new Map(), propOps=new Map();
  for (const input of inputs) {
    const {type}=dict(input);
    let {op}=dict(input);
    if((member.seatedDriver||gliding?.flightPath||gliding?.roadCoast)&&['vehicle','vehicleShunt','pickup','fire','melee','hit','shot','propDamage','destroy'].includes(type))continue;
    if(type==='seat'&&key(op)){
      const seat=dict(input.data),leave=seat.leave===true;
      if(leave||(UUID.test(seat.driver)&&key(seat.car)))requestSeat(stmts,q,{room,id,name,op,now,aliveSince:now-GONE,driver:seat.driver,car:seat.car,leave});
      continue;
    }
    if(type==='fire'){
      const packet=firePackets.get(input);
      if(packet)recordFire(stmts,q,room,id,name,packet,fireHistories,actor,now);
      continue;
    }
    if(type==='pickup'&&key(op)){
      const {id:item,weapon}=dict(input.data);
      if(key(item)&&recordPickup(stmts,q,{room,id,token,name,op,item,weapon,now,state:actor}))
        pickupOps.set(op,item);
      continue;
    }
    if (!EVENTS.has(type) || !key(op)) continue;
    if(/^(?:(?:pick|swing|contact)-|break:|fire:)/.test(op))continue;
    const data=type==='vehicleDamage'?vehicleImpact(input.data,actor,priorState):eventData(type,input.data,now);
    if (!data) continue;
    let guard={clause:'',args:[]};
    if(type==='melee'){
      if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y)||actor.vehicle||actor.health===0||actor.downUntil>now||
          Math.hypot(actor.x-data.x,actor.y-data.y)>5)continue;
      op=swingOp(data.started);
    }else if(data.cause==='melee'){
      guard=contactGuard(type,data,actor,room,id,now);
      if(!guard)continue;
      op='contact-'+data.swingAt.toString(36);
    }
    if(data.cause==='weapon'&&['propDamage','npc','vehicleDamage'].includes(type)&&(room===worldKeys.enfer||input.data?.shotId)){
      const shotId=input.data?.shotId,kind=input.data?.weapon;
      if(!key(shotId)||!Object.hasOwn(weaponCatalog,kind)||kind==='fist'||!Number.isFinite(data.x+data.y))continue;
      if(Math.hypot(data.x-actor.x,data.y-actor.y)>weaponCatalog[kind].range+15)continue;
      if(type==='npc'){data.weapon=kind;data.damage=Math.min(data.damage||0,weaponCatalog[kind].damage);}
      data.shotId=shotId;
      guard={clause:`WHERE EXISTS (SELECT 1 FROM mc_events WHERE room=? AND player=? AND op=? AND type='shot' AND at>=?
        AND json_extract(data,'$.kind')=?) AND NOT EXISTS (SELECT 1 FROM mc_events WHERE room=? AND player=? AND type=? AND at>=?
        AND json_extract(data,'$.shotId')=? AND json_extract(data,'$.id')=?)`,args:[room,id,'fire:'+shotId,now-2600,kind,room,id,type,now-2600,shotId,data.id]};
    }
    if(type==='propDamage'){
      if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y))continue;
      const distance=Math.hypot(actor.x-data.x,actor.y-data.y);
      if(data.cause==='traffic'){
        if(!actor.vehicle||distance>16)continue;
        const spec=vehicleSpec(actor.vehicle.type);
        data.damage=Math.min(data.damage,vehiclePropDamage(Math.min(data.speed,Math.max(spec.forward,spec.reverse)),spec.halfLength));
        if(data.damage<=0)continue;
      }
      if(data.cause==='weapon' && distance>weaponCatalog[data.weapon].range+20)continue;
      propOps.set(op,data.impactId);
    }
    if(type==='vehicleShunt'){
      const source=actor.vehicle||priorState.vehicle;
      if(!source||source.id===data.id||!Number.isFinite(actor.x+actor.y)||Math.hypot(actor.x-data.x,actor.y-data.y)>16)continue;
      data.source=source.id;
      guard={clause:`WHERE NOT EXISTS (SELECT 1 FROM mc_events WHERE room=? AND player=? AND type='vehicleShunt'
        AND at>? AND json_extract(data,'$.id')=?) AND NOT EXISTS (SELECT 1 FROM mc_items
        WHERE room=? AND kind='vehicle' AND item=? AND json_extract(data,'$.parkingSlot') IS NOT NULL
        AND json_extract(data,'$.expiresAt')>?)`,args:[room,id,now-320,data.id,room,data.id,now]};
    }
    if(type==='horn'){
      if(!actor.vehicle||!Number.isFinite(actor.x+actor.y))continue;
      data.x=actor.x;data.y=actor.y;op='horn-'+Math.floor(now/800);
    }
    const requiresCar=type==='vehicle';
    if((type==='vehicleShunt'||type==='vehicleDamage')&&(isTrain(data.type)||railTrain(data.id)))continue;
    if(requiresCar&&isTrain(data.type)&&(room!==worldKeys.enfer||!Number.isFinite(actor.x+actor.y)||
      Math.hypot(actor.x-data.x,actor.y-data.y)>23))continue;
    if(requiresCar&&isTrain(data.type)&&data.occupied){
      const row=await q("SELECT data,at FROM mc_items WHERE room=? AND kind='vehicle' AND item=?",room,data.id).first();
      const record=row?JSON.parse(row.data):null;
      const pose=autonomousRail(railTrain(data.id),now,record?{...record,railAt:record.railAt??row.at}:null);
      if(!pose.doors||Math.hypot(pose.x-data.x,pose.y-data.y)>6)continue;
      Object.assign(data,{x:pose.x,y:pose.y,angle:pose.angle,d:pose.d,direction:pose.direction});
    }
    if(requiresCar&&data.eject&&(!Number.isFinite(actor.x+actor.y)||actor.health===0||actor.vehicle||
      Math.hypot(actor.x-data.x,actor.y-data.y)>6.8))continue;
    if (requiresCar) {
      if(data.parkingSlot&&(room!=='enfer:public'||!Number.isFinite(actor.x+actor.y)||
        Math.hypot(actor.x-data.x,actor.y-data.y)>7||Math.abs(actor.speed||0)>1.8))continue;
      data.owner=data.occupied ? id : '';
      if (data.occupied) claims.add(data.id);
    }
    const payload=JSON.stringify(data);
    const accept=`INSERT OR IGNORE INTO mc_events (room,player,op,name,type,data,at) SELECT ?,?,?,?,?,?,?`;
    const values=[room,id,op,name,type,payload,now];
    if (requiresCar) {
      const flightGuard=` AND NOT EXISTS (SELECT 1 FROM mc_items WHERE room=? AND item=? AND kind='vehicle' AND ${releaseEnds}>?)`+
        ((data.flightPath||data.roadCoast||isTrain(data.type)&&!data.occupied)?" AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND item=? AND kind='vehicle' AND owner=?)":"");
      const flightArgs=[room,data.id,now,...((data.flightPath||data.roadCoast||isTrain(data.type)&&!data.occupied)?[room,data.id,id]:[])];
      const profile='(SELECT profile FROM mc_career_sessions WHERE room=? AND id=?)';
      const reservationGuard=` AND NOT EXISTS (SELECT 1 FROM mc_items WHERE room=? AND item=? AND kind='vehicle'
        AND json_extract(data,'$.expiresAt')>? AND json_extract(data,'$.parkingOwner') IS NOT NULL
        AND (?=0 OR json_extract(data,'$.parkingOwner') IS NOT ${profile}))`;
      const parkGuard=data.parkingSlot?` AND ?=${profile}
        AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicle' AND item=? AND owner=?)
        AND NOT EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicle' AND item<>?
          AND json_extract(data,'$.parkingSlot')=? AND json_extract(data,'$.expiresAt')>?)`:'';
      const parkArgs=data.parkingSlot?[data.parkingOwner,room,id,room,data.id,id,room,data.id,data.parkingSlot,now]:[];
      stmts.push(q(accept+` WHERE NOT EXISTS (
        SELECT 1 FROM mc_items i JOIN mc_members m ON m.room=i.room AND m.id=i.owner
        WHERE i.room=? AND i.kind='vehicle' AND i.item=? AND i.owner<>? AND m.seen>?
          AND (json_extract(m.state,'$.vehicle.id')=i.item OR i.at>?)) ${flightGuard} ${reservationGuard} ${parkGuard}
        AND NOT EXISTS (SELECT 1 FROM mc_items WHERE room=? AND item=? AND
          ((kind='vehicleRetired' AND at>?) OR (kind='vehicleDamage' AND
            ((? AND (json_extract(data,'$.hp')<=0 OR json_extract(data,'$.fireAt')>0)) OR
            coalesce(nullif(json_extract(data,'$.explodeAt'),0),json_extract(data,'$.disabledAt'),0) BETWEEN 1 AND ?))))`,
        ...values,room,data.id,id,now-GONE,now-6500,...flightArgs,room,data.id,now,Number(data.occupied),room,id,
        ...parkArgs,room,data.id,now,Number(data.occupied),now-wreckFor));
    } else if(type==='chat'){
      stmts.push(q(accept+" WHERE (SELECT count(*) FROM mc_events WHERE room=? AND player=? AND type='chat' AND at>?)<6",...values,room,id,now-5000));
    } else if(type==='vehicleDamage'){
      stmts.push(vehicleDamageStatement(q,{room,id,op,name,data,now},guard));
    } else if(type==='propDamage'){
      stmts.push(propDamageStatement(q,{room,id,op,name,data,now},guard));
      // Older open tabs understand the final break, but only the durability transaction can produce it.
      stmts.push(q(`INSERT OR IGNORE INTO mc_events (room,player,op,name,type,data,at)
        SELECT room,player,'break:'||op,name,'destroy',json_object('id',json_extract(data,'$.id')),at
        FROM mc_events WHERE room=? AND player=? AND op=? AND type='propDamage' AND json_extract(data,'$.health')=0`,room,id,op));
    } else if(type==='destroy'){
      stmts.push(q(accept+' '+(guard.clause||'WHERE 1')+
        " AND NOT EXISTS (SELECT 1 FROM mc_items WHERE room=? AND item=? AND kind='propDamage')",
        ...values,...guard.args,room,data.id));
    } else if(type==='npc' && data.damage>0) {
      stmts.push(npcHitStatement(q,{room,id,op,name,data,now},guard));
    } else stmts.push(q(accept+' '+guard.clause,...values,...guard.args));
    if (ITEM_TYPES.has(type)) {
      // Use the stored payload and sequence. Retrying an older operation cannot rewind a car.
      stmts.push(q(`INSERT INTO mc_items (room,kind,item,seq,owner,data,at)
        SELECT room,type,json_extract(data,'$.id'),seq,CASE WHEN type='vehicle' THEN json_extract(data,'$.owner') ELSE '' END,data,at
        FROM mc_events WHERE room=? AND player=? AND op=? AND type=? AND at=?
        ON CONFLICT (room,kind,item) DO UPDATE SET
        seq=excluded.seq,owner=excluded.owner,data=excluded.data,at=excluded.at
        WHERE excluded.seq>mc_items.seq`,room,id,op,type,now));
      if(type==='vehicle'&&data.occupied)inheritRoadPassenger(stmts,q,{room,id,op,car:data.id,now});
    }
  }
  const membersIndex=stmts.length;
  stmts.push(q(MEMBERS_SQL,room,now-GONE));
  const cursor=num(b.cursor,0,0,Number.MAX_SAFE_INTEGER);
  stmts.push(q('SELECT seq,player,name,type,data,at FROM mc_events WHERE room=? AND seq>? ORDER BY seq LIMIT 160',room,cursor));
  if (claims.size) {
    stmts.push(q(`SELECT item AS id,CASE WHEN ${releaseEnds}>? THEN CASE WHEN json_extract(data,'$.roadCoast') IS NULL THEN 'autorotation' ELSE 'coasting' END ELSE owner END AS owner FROM mc_items WHERE room=? AND kind='vehicle' AND item IN (${[...claims].map(()=>'?').join(',')})`,now,room,...claims));
  }
  const pickupIndex=stmts.length;
  if(pickupOps.size)stmts.push(q(`SELECT op,item,ok,available FROM mc_pickup_claims WHERE room=? AND player=?
    AND op IN (${[...pickupOps].map(()=>'?').join(',')})`,room,id,...pickupOps.keys()));
  const propIndex=stmts.length;
  if(propOps.size)stmts.push(q(`SELECT op,json_extract(data,'$.impactId') AS impact FROM mc_events
    WHERE room=? AND player=? AND type='propDamage' AND op IN (${[...propOps].map(()=>'?').join(',')})`,room,id,...propOps.keys()));
  if(b.ammoSync===true)stmts.push(readArmory(q,room,id));
  const result=await db.batch(stmts);
  const propAccepted=propOps.size?result[propIndex].results.filter(r=>propOps.get(r.op)===r.impact).map(r=>r.impact):[];
  const feed=events(result[membersIndex+1].results);
  const claimOwners=claims.size?new Map(result[membersIndex+2].results.map(c=>[c.id,c.owner])):new Map();
  const denied=[...claims].filter(car=>claimOwners.get(car)!==id).map(car=>({id:car,owner:claimOwners.get(car)||''}));
  const pickupResults=pickupOps.size?result[pickupIndex].results.filter(r=>pickupOps.get(r.op)===r.item)
    .map(r=>({op:r.op,id:r.item,ok:r.ok===1,availableAt:r.available})):undefined;
  // Always advance beyond scanned effects, including an entirely distant page. Hits, chat,
  // ownership and durable world changes keep their original global ordering.
  const delivered=b.protocol===2?feed.filter(event=>visibleCombatEvent(event,actor)):feed;
  return json({now,...(b.ammoSync===true?{ammo:privateAmmo(result.at(-1).results)}:{}),...(b.protocol===2?{stateRefs:stateReferences(actor)}:{}),...rosterPacket(result[membersIndex].results,id,b),events:delivered,denied,pickupResults,propAccepted,
    ...(b.protocol===2&&feed.length===160?{more:true}:{}),cursor:feed.at(-1)?.seq??cursor});
}
export async function handleApi(request, env) {
  const pathname=new URL(request.url).pathname;
  const match=/^\/api(?:\/(world|paris))?\/(join|sync|leave|career|report|partners)$/.exec(pathname);
  if(!match)return json({error:'route'},404);
  const [,generation,operation]=match;
  if(!generation)return json({error:'update_required'},410);
  if (request.method!=='POST') return json({error:'method'},405);
  const raw=await request.text();
  if (raw.length>32_000) return json({error:'length'},413);
  let b;
  try {b=JSON.parse(raw);} catch {return json({error:'json'},400);}
  if (!b || typeof b!=='object' || Array.isArray(b)) return json({error:'session'},400);
  if(generation==='paris' && b.room!==undefined && b.room!=='public')return json({error:'update_required'},410);
  const map=b.map??'paris';
  if(typeof map!=='string'||!Object.hasOwn(worldKeys,map)||(generation==='paris'&&map!=='paris'))return json({error:'world'},400);
  const room=worldKeys[map];
  if (!UUID.test(b.id) || !UUID.test(b.token)) return json({error:'session'},400);
  if (!env.DB) return json({error:'storage'},503);
  await ready(env.DB);
  if(['join','sync','career'].includes(operation))await sweepVehicles(env.DB,room,Date.now(),operation==='join');
  if(operation==='partners')return json(await runPartners(env.DB,b,room,Date.now(),GONE));
  if(operation==='report')return json(await reportPlayer(env.DB,b,room,Date.now()));
  if (operation==='career') return json(await runCareer(env.DB,b,room,Date.now()));
  if (operation==='join') return join(env.DB,b,Date.now(),room);
  if (operation==='leave') {
    const release=b.roadRelease;
    if(release?.type==='vehicle'&&release.data?.occupied===false&&key(release.op)&&eventData('vehicle',release.data,Date.now())?.roadCoast){
      await sync(env.DB,{id:b.id,token:b.token,events:[release]},Date.now(),room);
    }
    await env.DB.prepare('DELETE FROM mc_members WHERE room=? AND id=? AND secret=?').bind(room,b.id,b.token).run();
    return json({left:true});
  }
  return sync(env.DB,b,Date.now(),room);
}
