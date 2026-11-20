import {districtEventsSchema,districtState,workDistrictEvent} from './district-events.js';
import {woolSchema,woolProgress,woolAction} from './lost-wool.js';
import {careerContracts,careerPlaces,careerRadius,careerGarage} from '../public/career-catalog.js';
import {outfitShop} from '../public/outfit-shop.js';
import {abandonedFor,replacementAt} from '../public/vehicle-lifecycle.js';
import {isAircraft} from '../public/airfield.js';
import {isVehicleType,vehicleSpec} from '../public/vehicle-types.js';

export const careerSchema=[
  woolSchema,...districtEventsSchema,
  `CREATE TABLE IF NOT EXISTS mc_careers (
    profile TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, cash INTEGER NOT NULL DEFAULT 45,
    reputation INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0,
    mission TEXT, car TEXT, mutation TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS mc_enterprises (profile TEXT PRIMARY KEY, bank INTEGER NOT NULL DEFAULT 0,
    licensed INTEGER NOT NULL DEFAULT 0, revenue INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS mc_outfits(profile TEXT PRIMARY KEY, armor INTEGER NOT NULL DEFAULT 0,
      layer TEXT,wearer TEXT,dyes TEXT NOT NULL DEFAULT '[]',dye TEXT)`,
  `CREATE TABLE IF NOT EXISTS mc_laps(profile TEXT PRIMARY KEY,best INTEGER,public INTEGER,alias TEXT)`,
  'CREATE INDEX IF NOT EXISTS mc_ranked_laps ON mc_laps(public,alias) WHERE public IS NOT NULL',
  `CREATE TABLE IF NOT EXISTS mc_career_sessions (
    room TEXT NOT NULL, id TEXT NOT NULL, profile TEXT NOT NULL, PRIMARY KEY(room,id))`,
  `CREATE TRIGGER IF NOT EXISTS mc_career_disconnect AFTER DELETE ON mc_members BEGIN
    DELETE FROM mc_career_sessions WHERE room=OLD.room AND id=OLD.id;
  END`
];
const profileId=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const maxPoseAge=25000;
const readCareer=`SELECT c.*,w.slot AS woolSlot,w.picked AS woolPicked,w.paid AS woolPaid,e.bank,e.licensed,e.revenue,l.best,l.public,o.armor,o.layer,o.wearer,o.dyes,o.dye,
    (SELECT json_group_array(json_object('name',alias,'ms',public)) FROM
      (SELECT alias,public FROM mc_laps WHERE public IS NOT NULL ORDER BY public,alias,profile LIMIT 5)) AS leaders
    FROM mc_careers c JOIN mc_enterprises e ON c.profile=e.profile
    LEFT JOIN mc_lost_wool w ON w.profile=c.profile
    LEFT JOIN mc_laps l ON c.profile=l.profile LEFT JOIN mc_outfits o ON o.profile=c.profile WHERE c.profile=?`;
const parse=data=>data?JSON.parse(data):null;
function publicState(row,rider){
  const mission=parse(row.mission);
  return {version:3,wool:woolProgress(row),armor:row.armor||0,armorId:row.layer,wearable:row.wearer===rider,dyes:parse(row.dyes)||[],dye:row.dye,bestLapMs:row.best,publicLapMs:row.public,leaders:parse(row.leaders)||[],bank:row.bank,licensed:!!row.licensed,revenue:row.revenue,revision:row.revision,cash:row.cash,completed:row.completed,reputation:row.reputation,owned:!!row.car,
    mission:mission?{contract:mission.contract,stage:mission.stage,car:mission.car||null,started:mission.started,deadline:mission.deadline}:null};
}
async function hashProfile(profile){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('maille-career-v1/'+profile)));
  return Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
}
const near=(actor,place)=>(actor.lift||0)<1.5&&Math.hypot(actor.x-place.x,actor.y-place.y)<=careerRadius;
const allowed=new Set(['incident','woolPick','woolReturn','state','start','cancel','advance','repair','buy','collect','license','collectRent','deposit','withdraw','publishLap','hideLap','buyArmor','buyDye','equipDye']);
export async function runCareer(db,b,room,now){
  if(room!=='enfer:public'||!profileId.test(b.profile)||!allowed.has(b.action))
    return {ok:false,error:'Demande de carrière invalide.'};
  const q=(sql,...values)=>db.prepare(sql).bind(...values);
  const profile=await hashProfile(b.profile),member=await q(
    'SELECT state,name FROM mc_members WHERE room=? AND id=? AND secret=? AND seen>?',room,b.id,b.token,now-maxPoseAge).first();
  if(!member)return {ok:false,error:'Reconnecte-toi au monde pour accéder aux contrats.'};
  const result=await db.batch([
    q('INSERT OR IGNORE INTO mc_careers(profile) VALUES(?)',profile),
    q('INSERT OR IGNORE INTO mc_enterprises(profile) VALUES(?)',profile),
    q('INSERT OR IGNORE INTO mc_outfits(profile) VALUES(?)',profile),
    q(`UPDATE mc_outfits SET wearer=? WHERE profile=? AND armor>0 AND wearer<>? AND NOT EXISTS
      (SELECT 1 FROM mc_members WHERE room=? AND id=mc_outfits.wearer AND seen>?)`,
      b.id,profile,b.id,room,now-maxPoseAge),
    ...(profileId.test(b.wear?.id)&&Number.isInteger(b.wear.remaining)&&b.wear.remaining>=0&&b.wear.remaining<outfitShop.armorMax?[
      q('UPDATE mc_outfits SET armor=min(armor,?) WHERE profile=? AND layer=? AND wearer=?',b.wear.remaining,profile,b.wear.id,b.id)
    ]:[]),
    q(`INSERT INTO mc_career_sessions(room,id,profile) VALUES(?,?,?)
      ON CONFLICT(room,id) DO UPDATE SET profile=excluded.profile WHERE profile<>excluded.profile`,room,b.id,profile),
    q(readCareer,profile)
  ]);
  const row=result.at(-1).results[0],actor=parse(member.state)||{},previous=parse(row.mission);
  if(b.action==='incident'){
    const outcome=await workDistrictEvent(db,b,room,now,profile);
    const current=outcome.ok?await q(readCareer,profile).first():row;
    return {...outcome,state:publicState(current,b.id)};
  }
  const fail=error=>({ok:false,error,state:publicState(row,b.id)});
  const down=actor.health===0||actor.downUntil>now;
  // Use one CAS plus a transaction marker for all dependent writes. A retry
  // or a second tab on the same profile can never spend or earn twice.
  const marker=crypto.randomUUID(),eventOp='career:'+marker;
  let guard='',guardArgs=[];
  const effects=[];
  let mission=previous,cash=row.cash,rep=row.reputation,completed=row.completed,car=row.car,vehicle,repaired,notice;
  let bank=row.bank,licensed=row.licensed,revenue=row.revenue;
  const hasMutation='EXISTS (SELECT 1 FROM mc_careers WHERE profile=? AND mutation=?)';
  const worldEvent=(type,data)=>{
    effects.push(q(`INSERT INTO mc_events(room,player,op,name,type,data,at) SELECT ?,?,?,?,?,?,? WHERE ${hasMutation}`,
      room,b.id,eventOp,member.name,type,JSON.stringify(data),now,profile,marker));
    effects.push(q(`INSERT INTO mc_items(room,kind,item,seq,owner,data,at)
      SELECT room,type,?,seq,'',data,at FROM mc_events WHERE room=? AND player=? AND op=?
      ON CONFLICT(room,kind,item) DO UPDATE SET seq=excluded.seq,owner='',data=excluded.data,at=excluded.at
      WHERE excluded.seq>mc_items.seq`,data.id,room,b.id,eventOp));
  };
  const buddyQuery=`SELECT cs.profile FROM mc_seats s
    JOIN mc_career_sessions cs ON cs.room=s.room AND cs.id=s.rider
    JOIN mc_members m ON m.room=s.room AND m.id=s.rider
    WHERE s.room=? AND s.driver=? AND s.car=? AND m.seen>? AND cs.profile<>?`;
  const verifyCar=async()=>{
    if(!actor.vehicle?.id||!isVehicleType(actor.vehicle.type)||isAircraft(actor.vehicle.type))return false;
    const driven=await q("SELECT owner FROM mc_items WHERE room=? AND kind='vehicle' AND item=?",room,actor.vehicle.id).first();
    if(driven?.owner!==b.id)return false;
    guard+=" AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicle' AND item=? AND owner=?)";
    guardArgs.push(room,actor.vehicle.id,b.id);
    return true;
  };
  if(previous&&(now>previous.deadline||down)){
    mission=null;notice=down?'Contrat interrompu lors de la mise hors combat.':'Délai dépassé. Le contrat est de nouveau disponible.';
  }else if(b.action==='state'){
    return {ok:true,state:publicState(row,b.id),incident:await districtState(db,now,profile)};
  }else if(!Number.isSafeInteger(b.revision)||b.revision!==row.revision){
    return fail('La progression a changé. Les données ont été actualisées.');
  }else if(down||!Number.isFinite(actor.x+actor.y)){
    return fail('Patiente jusqu’au retour de ton personnage en ville.');
  }else if(b.action==='woolPick'||b.action==='woolReturn'){
    const collect=b.action==='woolPick';
    const outcome=woolAction({row,actor,now,slot:b.slot,collect});
    if(outcome.error)return fail(outcome.error);
    guard+=' AND NOT EXISTS (SELECT 1 FROM mc_seats WHERE room=? AND rider=?) AND EXISTS (SELECT 1 FROM mc_members WHERE room=? AND id=? AND state=?)';
    guardArgs.push(room,b.id,room,b.id,member.state);
    if(collect){
      effects.push(q(`INSERT INTO mc_lost_wool(profile,slot,picked,paid)
        SELECT ?,?,?,0 WHERE ${hasMutation} ON CONFLICT(profile) DO UPDATE SET
        slot=excluded.slot,picked=excluded.picked,paid=0`,profile,b.slot,now,profile,marker));
    }else{
      cash+=outcome.reward;
      effects.push(q(`UPDATE mc_lost_wool SET paid=1 WHERE profile=? AND slot=? AND ${hasMutation}`,profile,b.slot,profile,marker));
    }
  }else if(['buyArmor','buyDye','equipDye'].includes(b.action)){
    if(!near(actor,careerPlaces.market))return fail('Rejoins la mercerie aux Halles des Tisserands.');
    if(b.action==='buyArmor'){
      if(row.armor>0)return fail('Ton gilet est encore utilisable.');
      if(cash<outfitShop.armorPrice)return fail('Solde insuffisant pour ce gilet.');
      cash-=outfitShop.armorPrice;
      effects.push(q(`UPDATE mc_outfits SET armor=?,layer=?,wearer=? WHERE profile=? AND ${hasMutation}`,
        outfitShop.armorMax,crypto.randomUUID(),b.id,profile,profile,marker));
    }else{
      const dyes=parse(row.dyes)||[],dye=b.dye??null;
      if(dye!==null&&!Object.hasOwn(outfitShop.dyes,dye))return fail('Teinture inconnue.');
      if(b.action==='buyDye'){
        if(!dye||dyes.includes(dye))return fail('Choisis une nouvelle teinture.');
        if(cash<outfitShop.dyes[dye].price)return fail('Solde insuffisant pour cette teinture.');
        cash-=outfitShop.dyes[dye].price;dyes.push(dye);
      }else if(dye!==null&&!dyes.includes(dye))return fail('Cette teinture ne figure pas dans ta garde-robe.');
      effects.push(q(`UPDATE mc_outfits SET dyes=?,dye=? WHERE profile=? AND ${hasMutation}`,JSON.stringify(dyes),dye,profile,profile,marker));
    }
  }else if(b.action==='publishLap'||b.action==='hideLap'){
    if(!row.best)return fail('Termine d’abord un tour chronométré.');
    const visible=b.action==='publishLap';
    effects.push(q(`UPDATE mc_laps SET public=?,alias=? WHERE profile=? AND ${hasMutation}`,
      visible?row.best:null,visible?member.name:null,profile,profile,marker));
  }else if(b.action==='start'){
    if(previous)return fail('Un contrat est déjà en cours.');
    if(!Object.hasOwn(careerContracts,b.contract))return fail('Contrat inconnu.');
    const c=careerContracts[b.contract];
    mission={contract:c.id,stage:0,started:now,deadline:now+c.seconds*1000,last:now};
  }else if(b.action==='cancel'){
    if(!previous)return fail('Aucun contrat en cours.');
    mission=null;
  }else if(b.action==='advance'){
    if(!previous)return fail('Accepte d’abord un contrat.');
    const c=careerContracts[previous.contract],step=c.stages[previous.stage],place=careerPlaces[step.place];
    if(!near(actor,place))return fail('Rejoins le repère de la mission.');
    if(step.vehicle&&!(await verifyCar()))return fail('Prends le volant d’un véhicule pour cette étape.');
    if(previous.car&&previous.car!==actor.vehicle.id)return fail('Reprends le véhicule de ce contrat.');
    if(c.id==='taxi'&&vehicleSpec(actor.vehicle.type).openSeat)return fail('Le client attend un véhicule fermé.');
    if(c.id!=='race'&&Math.abs(actor.speed||0)>4)return fail('Arrête le véhicule près du repère.');
    if(previous.stage>0){
      const from=careerPlaces[c.stages[previous.stage-1].place];
      const metres=c.roadMetres?.[previous.stage]??Math.hypot(place.x-from.x,place.y-from.y);
      const minimumMs=1000*Math.max(0,metres-careerRadius*2)/(vehicleSpec(actor.vehicle.type).forward*1.25);
      if(now-previous.last<minimumMs)return fail('Ce point de passage a été atteint trop rapidement.');
    }
    const buddyArgs=[room,b.id,actor.vehicle.id,now-maxPoseAge,profile];
    const buddy=c.id!=='race'?(await q(buddyQuery,...buddyArgs).first())?.profile:null;
    if(c.cooperative){
      if(!buddy||previous.stage>0&&buddy!==previous.buddy)return fail('Le même coéquipier doit être assis dans ton véhicule à chaque arrêt.');
      guard+=' AND ?=('+buddyQuery+')';guardArgs.push(buddy,...buddyArgs);
    }
    if(previous.stage+1===c.stages.length){
      cash+=c.reward;rep++;completed++;mission=null;
      if(c.id==='race'&&previous.lapStart){
        const lapMs=now-previous.lapStart;
        effects.push(q(`INSERT INTO mc_laps(profile,best) SELECT ?,? WHERE ${hasMutation}
          ON CONFLICT(profile) DO UPDATE SET best=min(mc_laps.best,excluded.best)`,profile,lapMs,profile,marker));
      }
      if(licensed)revenue=Math.min(careerGarage.rentCap,revenue+careerGarage.rentPerContract);
      if(previous.buddy&&c.id!=='race')effects.push(q(`UPDATE mc_careers SET cash=cash+?,reputation=reputation+1,completed=completed+?,revision=revision+1
        WHERE profile=? AND profile=(${buddyQuery}) AND ${hasMutation}`,
        Math.round(c.reward*.35),c.cooperative?1:0,previous.buddy,...buddyArgs,profile,marker));
    }else{
      mission={...previous,stage:previous.stage+1,last:now,car:actor.vehicle.id,buddy:previous.stage===0?(buddy||null):previous.buddy};
      if(c.id==='race'&&previous.stage===0){mission.lapStart=now;mission.deadline=now+c.seconds*1000;}
    }
  }else if(b.action==='deposit'||b.action==='withdraw'){
    if(![careerPlaces.market,careerPlaces.garage,careerPlaces.police].some(p=>near(actor,p)))return fail('Rejoins un guichet aux Halles, au garage ou au commissariat.');
    if(!Number.isSafeInteger(b.amount)||b.amount<1||b.amount>1_000_000)return fail('Choisis un montant entier entre 1 et 1 000 000 ₣.');
    const deposit=b.action==='deposit';
    if((deposit?cash:bank)<b.amount)return fail('Le solde disponible est insuffisant.');
    const transfer=deposit?b.amount:-b.amount;
    cash-=transfer;bank+=transfer;
  }else{
    const garage=careerPlaces.garage;
    if(!near(actor,garage))return fail('Rejoins le Garage des Deux Bornes.');
    if(b.action==='license'){
      if(licensed)return fail('Tu possèdes déjà la concession du garage.');
      if(cash<careerGarage.licensePrice)return fail('Ton argent en poche ne suffit pas pour acheter la concession.');
      cash-=careerGarage.licensePrice;licensed=1;
    }else if(b.action==='collectRent'){
      if(!licensed||revenue<=0)return fail('Le garage n’a aucune recette à verser.');
      cash+=revenue;revenue=0;
    }else if(b.action==='repair'){
      const price=licensed?careerGarage.memberRepair:careerGarage.repair;
      if(!(await verifyCar()))return fail('Présente le véhicule à réparer au garage.');
      if(Math.abs(actor.speed||0)>4)return fail('Arrête-toi devant le garage.');
      if(cash<price)return fail('Solde insuffisant pour la réparation.');
      const wear=await q("SELECT seq,data FROM mc_items WHERE room=? AND kind='vehicleDamage' AND item=?",room,actor.vehicle.id).first();
      const damage=parse(wear?.data);
      if(!damage||damage.hp>=100)return fail('Ce véhicule est déjà en bon état.');
      if(damage.fireAt||damage.hp<=0)return fail('Le garage ne peut plus prendre en charge ce véhicule.');
      cash-=price;repaired=actor.vehicle.id;
      guard+=" AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicleDamage' AND item=? AND seq=?)";
      guardArgs.push(room,repaired,wear.seq);
      worldEvent('vehicleDamage',{id:repaired,type:actor.vehicle.type,x:actor.x,y:actor.y,hp:100,parts:0,damage:0,
        fireAt:0,explodeAt:0,repairedAt:now,cause:'repair'});
    }else{
      if(actor.vehicle)return fail('Descends du véhicule pour retirer une voiture.');
      if(b.action==='buy'){
        if(car)return fail('Ta citadine est déjà disponible au garage.');
        if(cash<careerGarage.price)return fail('Solde insuffisant pour acheter la citadine.');
        cash-=careerGarage.price;car='garage-'+crypto.randomUUID();
      }else if(!car)return fail('Tu ne possèdes pas encore de citadine.');
      if(b.action==='collect'){
        const retired=await q("SELECT at FROM mc_items WHERE room=? AND kind='vehicleRetired' AND item=? AND at>?",room,car,now).first();
        if(retired)return fail('Ta citadine de remplacement est en préparation.');
        const existing=await q(`SELECT v.data,v.owner,v.at,v.seq,m.seen,m.state,w.data AS wear
          FROM mc_items v LEFT JOIN mc_members m ON m.room=v.room AND m.id=v.owner
          LEFT JOIN mc_items w ON w.room=v.room AND w.item=v.item AND w.kind='vehicleDamage'
          WHERE v.room=? AND v.kind='vehicle' AND v.item=?`,room,car).first();
        if(existing){
          const parked=parse(existing.data),wear=parse(existing.wear),driver=parse(existing.state);
          if(existing.owner&&existing.seen>now-maxPoseAge&&driver?.vehicle?.id===car)return fail('La citadine est en circulation.');
          if(replacementAt(wear)>now)return fail('La dépanneuse récupère encore l’épave.');
          if(!replacementAt(wear)&&(parked.expiresAt||existing.at+abandonedFor)>now)
            return {ok:true,state:publicState(row,b.id),vehicle:parked,notice:'Ta citadine est déjà en ville.'};
          guard+=" AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicle' AND item=? AND at=? AND seq=?)";
          guardArgs.push(room,car,existing.at,existing.seq);
          if(replacementAt(wear))car='garage-'+crypto.randomUUID();
        }
      }
      vehicle={id:car,type:careerGarage.type,x:garage.x+6*Math.cos(garage.angle),y:garage.y+6*Math.sin(garage.angle),
        angle:garage.angle,color:'#61a59b',occupied:false,owner:'',speed:0,moving:false,expiresAt:now+abandonedFor};
      worldEvent('vehicle',vehicle);
    }
  }
  const updated=await db.batch([
    q(`UPDATE mc_careers SET revision=revision+1,cash=?,reputation=?,completed=?,mission=?,car=?,mutation=?
      WHERE profile=? AND revision=? AND EXISTS(SELECT 1 FROM mc_members WHERE room=? AND id=? AND secret=? AND seen>?)${guard}
      RETURNING revision`,cash,rep,completed,mission?JSON.stringify(mission):null,car,marker,profile,row.revision,room,b.id,b.token,now-maxPoseAge,...guardArgs),
    q(`UPDATE mc_enterprises SET bank=?,licensed=?,revenue=? WHERE profile=? AND ${hasMutation}`,bank,licensed,revenue,profile,profile,marker),
    ...effects,q(readCareer,profile)
  ]);
  const state=publicState(updated.at(-1).results[0],b.id);
  if(!updated[0].results.length)return {ok:false,error:'La situation a changé. Réessaie.',state};
  if(notice&&b.action!=='state')return {ok:false,state,error:notice};
  return {ok:true,state,...(vehicle?{vehicle}:{}),...(repaired?{repaired}:{}),...(notice?{notice}:{})};
}
