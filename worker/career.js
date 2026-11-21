import {districtEventsSchema,districtState,workDistrictEvent} from './district-events.js';
import {woolSchema,woolProgress,woolAction} from './lost-wool.js';
import {careerContracts,careerPlaces,careerRadius,careerGarage} from '../public/career-catalog.js';
import {outfitShop} from '../public/outfit-shop.js';
import {atShopCounter,retailGoods,foodRecovery,retailClerkId} from '../public/enfer-retail.js';
import {abandonedFor,replacementAt} from '../public/vehicle-lifecycle.js';
import {isAircraft} from '../public/airfield.js';
import {isVehicleType,vehicleSpec,isTrain} from '../public/vehicle-types.js';
import {dealership,deliveryRange} from '../public/vehicle-dealership.js';
import {atDriveBay,driveOrderWait} from '../public/mont-renaud.js';
import {cashTables} from './cash.js';
import {atTuningSite,tunable,tuningCatalog} from '../public/vehicle-tuning.js';

export const careerSchema=[
  woolSchema,...districtEventsSchema,...cashTables,
  `CREATE TABLE IF NOT EXISTS mc_careers (
    profile TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, cash INTEGER NOT NULL DEFAULT 45,
    reputation INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0,
    mission TEXT, car TEXT, mutation TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS mc_enterprises (profile TEXT PRIMARY KEY, bank INTEGER NOT NULL DEFAULT 0,
    licensed INTEGER NOT NULL DEFAULT 0, revenue INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS mc_outfits(profile TEXT PRIMARY KEY, armor INTEGER NOT NULL DEFAULT 0,
      layer TEXT,wearer TEXT,dyes TEXT NOT NULL DEFAULT '[]',dye TEXT)`,
  `CREATE TABLE IF NOT EXISTS mc_laps(profile TEXT PRIMARY KEY,best INTEGER,public INTEGER,alias TEXT)`,
  `CREATE TABLE IF NOT EXISTS mc_shop_bags(profile TEXT PRIMARY KEY,goods TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS mc_drive_orders(profile TEXT PRIMARY KEY,product TEXT NOT NULL,ready INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS mc_vehicle_licenses(profile TEXT NOT NULL,model TEXT NOT NULL,car TEXT NOT NULL,
    last_call INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(profile,model))`,
  `CREATE TABLE IF NOT EXISTS mc_vehicle_tuning(profile TEXT NOT NULL,model TEXT NOT NULL,parts INTEGER NOT NULL,
    PRIMARY KEY(profile,model))`,
  'CREATE INDEX IF NOT EXISTS mc_ranked_laps ON mc_laps(public,alias) WHERE public IS NOT NULL',
  `CREATE TABLE IF NOT EXISTS mc_career_sessions (
    room TEXT NOT NULL, id TEXT NOT NULL, profile TEXT NOT NULL, PRIMARY KEY(room,id))`,
  `CREATE TRIGGER IF NOT EXISTS mc_career_disconnect AFTER DELETE ON mc_members BEGIN
    DELETE FROM mc_career_sessions WHERE room=OLD.room AND id=OLD.id;
  END`
];
const profileId=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const maxPoseAge=25000;
const readCareer=`SELECT c.*,w.slot AS woolSlot,w.picked AS woolPicked,w.paid AS woolPaid,e.bank,e.licensed,e.revenue,l.best,l.public,o.armor,o.layer,o.wearer,o.dyes,o.dye,b.goods,
    (SELECT json_group_array(model) FROM mc_vehicle_licenses WHERE profile=c.profile) AS vehicleLicenses,
    (SELECT json_group_object(car,parts) FROM (SELECT v.car,t.parts FROM mc_vehicle_tuning t
      JOIN mc_vehicle_licenses v ON v.profile=t.profile AND v.model=t.model WHERE t.profile=c.profile
      UNION ALL SELECT c.car,t.parts FROM mc_vehicle_tuning t WHERE t.profile=c.profile AND t.model='garage' AND c.car IS NOT NULL)) AS tuning,
    (SELECT json_object('product',product,'readyAt',ready) FROM mc_drive_orders WHERE profile=c.profile) AS driveOrder,
    (SELECT json_object('ready',ready,'deadline',deadline) FROM mc_store_heists WHERE room='enfer:public' AND profile=c.profile) AS heist,
    (SELECT json_group_array(json_object('id',id,'x',x,'y',y,'amount',amount,'expires',expires)) FROM
      (SELECT * FROM mc_cash_drops WHERE room='enfer:public' AND claimed IS NULL ORDER BY expires DESC LIMIT 96)) AS cashDrops,
    (SELECT json_group_array(json_object('name',alias,'ms',public)) FROM
      (SELECT alias,public FROM mc_laps WHERE public IS NOT NULL ORDER BY public,alias,profile LIMIT 5)) AS leaders
    FROM mc_careers c JOIN mc_enterprises e ON c.profile=e.profile
    LEFT JOIN mc_lost_wool w ON w.profile=c.profile
    LEFT JOIN mc_laps l ON c.profile=l.profile LEFT JOIN mc_outfits o ON o.profile=c.profile
    LEFT JOIN mc_shop_bags b ON c.profile=b.profile WHERE c.profile=?`;
const parse=data=>data?JSON.parse(data):null;
function publicState(row,rider){
  const mission=parse(row.mission);
  return {version:3,parkingOwner:row.profile,goods:parse(row.goods)||{},driveOrder:parse(row.driveOrder),heist:parse(row.heist),cashDrops:parse(row.cashDrops)||[],vehicleLicenses:parse(row.vehicleLicenses)||[],tuning:parse(row.tuning)||{},wool:woolProgress(row),armor:row.armor||0,armorId:row.layer,wearable:row.wearer===rider,dyes:parse(row.dyes)||[],dye:row.dye,bestLapMs:row.best,publicLapMs:row.public,leaders:parse(row.leaders)||[],bank:row.bank,licensed:!!row.licensed,revenue:row.revenue,revision:row.revision,cash:row.cash,completed:row.completed,reputation:row.reputation,owned:!!row.car,
    mission:mission?{contract:mission.contract,stage:mission.stage,car:mission.car||null,started:mission.started,deadline:mission.deadline}:null};
}
async function hashProfile(profile){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('maille-career-v1/'+profile)));
  return Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
}
const near=(actor,place)=>(actor.lift||0)<1.5&&Math.hypot(actor.x-place.x,actor.y-place.y)<=careerRadius;
const allowed=new Set(['incident','woolPick','woolReturn','state','start','cancel','advance','repair','buy','collect','license','collectRent','deposit','withdraw','publishLap','hideLap','buyArmor','buyDye','equipDye','buyProduct','eatProduct','buyVehicleLicense','deliverVehicle','orderDrive','collectDrive','startHeist','finishHeist','collectCash']);
allowed.add('installTuning');
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
  const marker=crypto.randomUUID();
  let guard='',guardArgs=[];
  const effects=[];
  let mission=previous,cash=row.cash,rep=row.reputation,completed=row.completed,car=row.car,vehicle,repaired,notice,food;
  let bank=row.bank,licensed=row.licensed,revenue=row.revenue;
  const hasMutation='EXISTS (SELECT 1 FROM mc_careers WHERE profile=? AND mutation=?)';
  const worldEvent=(type,data)=>{
    const eventOp='career:'+marker+':'+type;
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
    if(!actor.vehicle?.id||!isVehicleType(actor.vehicle.type)||isAircraft(actor.vehicle.type)||isTrain(actor.vehicle.type))return false;
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
  }else if(b.action==='installTuning'){
    const part=tuningCatalog.get(b.upgrade),active=actor.vehicle;
    if(down||!part||!active||!tunable(active.type)||!atTuningSite(actor)||actor.lift>.3||
      Math.abs(actor.speed||active.speed||0)>.85)return fail('Arrête une voiture compatible dans un atelier.');
    const own=active.id===row.car?{model:'garage'}:await q(
      'SELECT model FROM mc_vehicle_licenses WHERE profile=? AND car=?',profile,active.id).first();
    if(!own)return fail('Seul ton véhicule peut être personnalisé.');
    const existing=await q('SELECT parts FROM mc_vehicle_tuning WHERE profile=? AND model=?',profile,own.model).first();
    if((existing?.parts||0)&part.bit)return fail('Cette pièce est déjà installée.');
    if(cash<part.price)return fail('Solde insuffisant.');
    guard+=` AND EXISTS (SELECT 1 FROM mc_members WHERE room=? AND id=? AND state=?)
      AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicle' AND item=? AND owner=?)`;
    guardArgs.push(room,b.id,member.state,room,active.id,b.id);
    cash-=part.price;
    effects.push(q(`INSERT INTO mc_vehicle_tuning(profile,model,parts) SELECT ?,?,? WHERE ${hasMutation}
      ON CONFLICT(profile,model) DO UPDATE SET parts=parts|excluded.parts`,profile,own.model,part.bit,profile,marker));
  }else if(b.action==='buyVehicleLicense'||b.action==='deliverVehicle'){
    const model=dealership.get(b.model);
    if(!model)return fail('Véhicule inconnu.');
    if(actor.vehicle||actor.railRider||actor.lift>.65||actor.motion==='swim')return fail('La livraison et les achats se font à pied.');
    const license=await q("SELECT car,last_call FROM mc_vehicle_licenses WHERE profile=? AND model=?",profile,model.id).first();
    if(b.action==='buyVehicleLicense'){
      if(!atTuningSite(actor))return fail('Rejoins une boutique de véhicules.');
      if(license)return fail('Tu possèdes déjà cette licence.');
      if(cash<model.price)return fail('Solde insuffisant pour cette licence.');
      cash-=model.price;
      effects.push(q(`INSERT INTO mc_vehicle_licenses(profile,model,car) SELECT ?,?,? WHERE ${hasMutation}`,
        profile,model.id,'licensed-'+crypto.randomUUID(),profile,marker));
    }else{
      if(!license)return fail('Achète la licence de ce véhicule.');
      if(now-license.last_call<25_000)return fail('La prochaine livraison est disponible après 25 secondes.');
      const pose=b.delivery;
      if(!pose||![pose.x,pose.y,pose.angle].every(Number.isFinite)||Math.hypot(actor.x-pose.x,actor.y-pose.y)>deliveryRange||
        Math.hypot(actor.x-pose.x,actor.y-pose.y)<3||Math.abs(pose.angle)>Math.PI+.01)return fail('Trouve un espace dégagé à proximité.');
      const existing=await q(`SELECT v.owner,v.data,v.at,v.seq,m.seen,m.state,w.data AS wear,t.at AS retired
        FROM mc_items v LEFT JOIN mc_members m ON m.room=v.room AND m.id=v.owner
        LEFT JOIN mc_items w ON w.room=v.room AND w.item=v.item AND w.kind='vehicleDamage'
        LEFT JOIN mc_items t ON t.room=v.room AND t.item=v.item AND t.kind='vehicleRetired'
        WHERE v.room=? AND v.kind='vehicle' AND v.item=?`,room,license.car).first();
      if(existing?.owner&&existing.seen>now-maxPoseAge&&parse(existing.state)?.vehicle?.id===license.car)return fail('Ce véhicule est déjà en circulation.');
      const latest=parse(existing?.data),wear=parse(existing?.wear);
      if(latest?.parkingSlot&&latest.expiresAt>now)return {ok:true,state:publicState(row,b.id),vehicle:latest,notice:'Ton véhicule est encore garé.'};
      if(replacementAt(wear)>now||existing?.retired>now)return fail('La dépanneuse récupère encore le véhicule.');
      const id='licensed-'+crypto.randomUUID();
      if(existing){
        guard+=" AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicle' AND item=? AND at=? AND seq=?)";
        guardArgs.push(room,license.car,existing.at,existing.seq);
        worldEvent('vehicleRetired',{id:license.car,until:now+60_000});
        effects.push(q(`UPDATE mc_items SET at=? WHERE room=? AND kind='vehicleRetired' AND item=? AND ${hasMutation}`,
          now+60_000,room,license.car,profile,marker));
        effects.push(q(`DELETE FROM mc_items WHERE room=? AND kind='vehicle' AND item=? AND ${hasMutation}`,
          room,license.car,profile,marker));
      }
      effects.push(q(`UPDATE mc_vehicle_licenses SET car=?,last_call=? WHERE profile=? AND model=? AND ${hasMutation}`,
        id,now,profile,model.id,profile,marker));
      const tuning=await q('SELECT parts FROM mc_vehicle_tuning WHERE profile=? AND model=?',profile,model.id).first();
      vehicle={id,type:model.id,x:pose.x,y:pose.y,angle:pose.angle,color:model.color,tune:tuning?.parts||0,occupied:false,owner:'',speed:0,moving:false,expiresAt:now+abandonedFor};
      worldEvent('vehicle',vehicle);
    }
  }else if(b.action==='orderDrive'||b.action==='collectDrive'){
    const order=parse(row.driveOrder),product=retailGoods.get(b.action==='orderDrive'?b.product:order?.product);
    const bag=parse(row.goods)||{};
    if(b.action==='orderDrive'){
      if(order)return fail('Retire d’abord ta commande en cours.');
      if(product?.store!=='bobines')return fail('Choisis un article du Drive Auchan.');
      if(cash<product.price)return fail('Solde insuffisant pour cette commande.');
      if((bag[product.id]||0)>=99)return fail('Ton sac est plein pour cet article.');
      cash-=product.price;
      effects.push(q(`INSERT INTO mc_drive_orders(profile,product,ready) SELECT ?,?,? WHERE ${hasMutation}`,
        profile,product.id,now+driveOrderWait,profile,marker));
    }else{
      if(!order||!product)return fail('Tu n’as aucune commande à retirer.');
      if(order.readyAt>now)return fail('La commande est encore en préparation.');
      if(!atDriveBay(actor)||!(await verifyCar()))return fail('Arrête-toi dans une piste du Drive, au volant.');
      if((bag[product.id]||0)>=99)return fail('Libère une place pour cet article dans ton sac.');
      bag[product.id]=(bag[product.id]||0)+1;
      effects.push(q(`INSERT INTO mc_shop_bags(profile,goods) SELECT ?,? WHERE ${hasMutation}
        ON CONFLICT(profile) DO UPDATE SET goods=excluded.goods`,profile,JSON.stringify(bag),profile,marker));
      effects.push(q(`DELETE FROM mc_drive_orders WHERE profile=? AND ${hasMutation}`,profile,profile,marker));
    }
  }else if(b.action==='startHeist'||b.action==='finishHeist'){
    if(down||atShopCounter(actor)?.id!=='bobines')return fail('Rejoins la caisse de Samantha à pied.');
    const clerk=await q("SELECT data FROM mc_items WHERE room=? AND kind='npc' AND item=?",room,retailClerkId('bobines',now)).first();
    if(parse(clerk?.data)?.health===0)return fail('La caisse est fermée pour le moment.');
    if(b.action==='startHeist'){
      guard+=` AND NOT EXISTS (SELECT 1 FROM mc_store_heists WHERE room=? AND cooldown>?)
        AND EXISTS (SELECT 1 FROM mc_members WHERE room=? AND id=? AND state=?)`;
      guardArgs.push(room,now,room,b.id,member.state);
      effects.push(q(`INSERT INTO mc_store_heists(room,profile,rider,ready,deadline,cooldown)
        SELECT ?,?,?,?,?,? WHERE ${hasMutation} ON CONFLICT(room) DO UPDATE SET profile=excluded.profile,
        rider=excluded.rider,ready=excluded.ready,deadline=excluded.deadline,cooldown=excluded.cooldown`,
      room,profile,b.id,now+6500,now+20000,now+180000,profile,marker));
    }else{
      guard+=` AND EXISTS (SELECT 1 FROM mc_store_heists WHERE room=? AND profile=? AND rider=? AND ready<=? AND deadline>=?)
        AND EXISTS (SELECT 1 FROM mc_members WHERE room=? AND id=? AND state=?)`;
      guardArgs.push(room,profile,b.id,now,now,room,b.id,member.state);
      cash+=145;
      effects.push(q(`UPDATE mc_store_heists SET deadline=0 WHERE room=? AND ${hasMutation}`,room,profile,marker));
    }
  }else if(b.action==='collectCash'){
    if(down||actor.vehicle||actor.railRider||actor.motion==='swim'||actor.lift>.4||typeof b.drop!=='string')
      return fail('Ramasse la liasse à pied.');
    const drop=await q('SELECT x,y,amount FROM mc_cash_drops WHERE room=? AND id=? AND claimed IS NULL AND expires>?',room,b.drop,now).first();
    if(!drop||Math.hypot(actor.x-drop.x,actor.y-drop.y)>2.9)return fail('La liasse est trop loin ou a déjà été ramassée.');
    guard+=` AND EXISTS (SELECT 1 FROM mc_cash_drops WHERE room=? AND id=? AND claimed IS NULL AND expires>?)
      AND EXISTS (SELECT 1 FROM mc_members WHERE room=? AND id=? AND state=?)`;
    guardArgs.push(room,b.drop,now,room,b.id,member.state);
    cash+=drop.amount;
    effects.push(q(`UPDATE mc_cash_drops SET claimed=? WHERE room=? AND id=? AND ${hasMutation}`,profile,room,b.drop,profile,marker),
      q(`INSERT OR IGNORE INTO mc_events(room,player,op,name,type,data,at)
        SELECT ?,?,?,?,'cash','{}',? WHERE ${hasMutation}`,room,b.id,'cash:'+marker,member.name,now,profile,marker));
  }else if(b.action==='buyProduct'||b.action==='eatProduct'){
    const product=retailGoods.get(b.product),bag=parse(row.goods)||{};
    if(!product)return fail('Article inconnu.');
    const count=bag[product.id]||0;
    if(b.action==='buyProduct'){
      if(atShopCounter(actor)?.id!==product.store)return fail('Présente-toi à pied devant la caisse de ce magasin.');
      const clerk=await q("SELECT data FROM mc_items WHERE room=? AND kind='npc' AND item=?",room,retailClerkId(product.store,now)).first();
      if(parse(clerk?.data)?.health===0)return fail('La caisse est fermée pour le moment.');
      if(cash<product.price)return fail('Solde insuffisant pour cet article.');
      if(count>=99)return fail('Ton sac contient déjà 99 exemplaires de cet article.');
      if(count===98&&parse(row.driveOrder)?.product===product.id)return fail('Garde de la place pour ta commande Drive.');
      cash-=product.price;bag[product.id]=count+1;
    }else{
      if(!foodRecovery[product.id]||!count)return fail('Tu n’as pas cet aliment dans ton sac.');
      if(actor.health>=100)return fail('Ta santé est déjà au maximum.');
      if(count===1)delete bag[product.id];else bag[product.id]=count-1;
      food=foodRecovery[product.id];
    }
    effects.push(q(`INSERT INTO mc_shop_bags(profile,goods) SELECT ?,? WHERE ${hasMutation}
      ON CONFLICT(profile) DO UPDATE SET goods=excluded.goods`,profile,JSON.stringify(bag),profile,marker));
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
      const tuning=await q("SELECT parts FROM mc_vehicle_tuning WHERE profile=? AND model='garage'",profile).first();
      vehicle={id:car,type:careerGarage.type,tune:tuning?.parts||0,x:garage.x+6*Math.cos(garage.angle),y:garage.y+6*Math.sin(garage.angle),
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
  return {ok:true,state,...(vehicle?{vehicle}:{}),...(repaired?{repaired}:{}),...(notice?{notice}:{}),...(food?{food}:{})};
}
