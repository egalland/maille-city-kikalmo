import {careerContracts,careerPlaces,careerRadius,careerGarage} from '../public/career-catalog.js';
import {abandonedFor,wreckFor} from '../public/vehicle-lifecycle.js';
import {isVehicleType,vehicleSpec} from '../public/vehicle-types.js';

export const careerSchema=[
  `CREATE TABLE IF NOT EXISTS mc_careers (
    profile TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, cash INTEGER NOT NULL DEFAULT 45,
    reputation INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0,
    mission TEXT, car TEXT, mutation TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS mc_career_sessions (
    room TEXT NOT NULL, id TEXT NOT NULL, profile TEXT NOT NULL, PRIMARY KEY(room,id))`,
  `CREATE TRIGGER IF NOT EXISTS mc_career_disconnect AFTER DELETE ON mc_members BEGIN
    DELETE FROM mc_career_sessions WHERE room=OLD.room AND id=OLD.id;
  END`
];
const profileId=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const maxPoseAge=25000;
const parse=data=>data?JSON.parse(data):null;
function publicState(row){
  const mission=parse(row.mission);
  return {version:1,revision:row.revision,cash:row.cash,completed:row.completed,reputation:row.reputation,owned:!!row.car,
    mission:mission?{contract:mission.contract,stage:mission.stage,started:mission.started,deadline:mission.deadline}:null};
}
async function hashProfile(profile){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('maille-career-v1/'+profile)));
  return Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
}
const near=(actor,place)=>Math.hypot(actor.x-place.x,actor.y-place.y)<=careerRadius;
const allowed=new Set(['state','start','cancel','advance','repair','buy','collect']);
export async function runCareer(db,b,room,now){
  if(room!=='enfer:public'||!profileId.test(b.profile)||!allowed.has(b.action))
    return {ok:false,error:'Demande de carrière invalide.'};
  const q=(sql,...values)=>db.prepare(sql).bind(...values);
  const profile=await hashProfile(b.profile),member=await q(
    'SELECT state,name FROM mc_members WHERE room=? AND id=? AND secret=? AND seen>?',room,b.id,b.token,now-maxPoseAge).first();
  if(!member)return {ok:false,error:'Reconnecte-toi au monde pour accéder aux contrats.'};
  const result=await db.batch([
    q('INSERT OR IGNORE INTO mc_careers(profile) VALUES(?)',profile),
    q(`INSERT INTO mc_career_sessions(room,id,profile) VALUES(?,?,?)
      ON CONFLICT(room,id) DO UPDATE SET profile=excluded.profile WHERE profile<>excluded.profile`,room,b.id,profile),
    q('SELECT * FROM mc_careers WHERE profile=?',profile)
  ]);
  const row=result[2].results[0],actor=parse(member.state)||{},previous=parse(row.mission);
  const fail=error=>({ok:false,error,state:publicState(row)});
  const down=actor.health===0||actor.downUntil>now;
  // Use one CAS plus a transaction marker for all dependent writes. A retry
  // or a second tab on the same profile can never spend or earn twice.
  const marker=crypto.randomUUID(),eventOp='career:'+marker;
  let guard='',guardArgs=[];
  const effects=[];
  let mission=previous,cash=row.cash,rep=row.reputation,completed=row.completed,car=row.car,vehicle,repaired,notice;
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
    if(!actor.vehicle?.id||!isVehicleType(actor.vehicle.type))return false;
    const driven=await q("SELECT owner FROM mc_items WHERE room=? AND kind='vehicle' AND item=?",room,actor.vehicle.id).first();
    if(driven?.owner!==b.id)return false;
    guard+=" AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicle' AND item=? AND owner=?)";
    guardArgs.push(room,actor.vehicle.id,b.id);
    return true;
  };
  if(previous&&(now>previous.deadline||down)){
    mission=null;notice=down?'Contrat interrompu lors de la mise hors combat.':'Délai dépassé. Le contrat est de nouveau disponible.';
  }else if(b.action==='state'){
    return {ok:true,state:publicState(row)};
  }else if(!Number.isSafeInteger(b.revision)||b.revision!==row.revision){
    return fail('La progression a changé. Les données ont été actualisées.');
  }else if(down||!Number.isFinite(actor.x+actor.y)){
    return fail('Patiente jusqu’au retour de ton personnage en ville.');
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
      const minimumMs=1000*Math.max(0,Math.hypot(place.x-from.x,place.y-from.y)-careerRadius*2)/(vehicleSpec(actor.vehicle.type).forward*1.25);
      if(now-previous.last<minimumMs)return fail('Ce point de passage a été atteint trop rapidement.');
    }
    const buddyArgs=[room,b.id,actor.vehicle.id,now-maxPoseAge,profile];
    if(previous.stage+1===c.stages.length){
      cash+=c.reward;rep++;completed++;mission=null;
      if(previous.buddy&&c.id!=='race')effects.push(q(`UPDATE mc_careers SET cash=cash+?,reputation=reputation+1,revision=revision+1
        WHERE profile=? AND profile=(${buddyQuery}) AND ${hasMutation}`,
        Math.round(c.reward*.35),previous.buddy,...buddyArgs,profile,marker));
    }else{
      const buddy=previous.stage===0&&c.id!=='race'?(await q(buddyQuery,...buddyArgs).first())?.profile:null;
      mission={...previous,stage:previous.stage+1,last:now,car:actor.vehicle.id,buddy:buddy||previous.buddy||null};
    }
  }else{
    const garage=careerPlaces.garage;
    if(!near(actor,garage))return fail('Rejoins le Garage des Deux Bornes.');
    if(b.action==='repair'){
      if(!(await verifyCar()))return fail('Présente le véhicule à réparer au garage.');
      if(Math.abs(actor.speed||0)>4)return fail('Arrête-toi devant le garage.');
      if(cash<careerGarage.repair)return fail('Solde insuffisant pour la réparation.');
      const wear=await q("SELECT seq,data FROM mc_items WHERE room=? AND kind='vehicleDamage' AND item=?",room,actor.vehicle.id).first();
      const damage=parse(wear?.data);
      if(!damage||damage.hp>=100)return fail('Ce véhicule est déjà en bon état.');
      if(damage.fireAt||damage.hp<=0)return fail('Le garage ne peut plus prendre en charge ce véhicule.');
      cash-=careerGarage.repair;repaired=actor.vehicle.id;
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
        const existing=await q(`SELECT v.data,v.owner,v.at,v.seq,m.seen,m.state,w.data AS wear
          FROM mc_items v LEFT JOIN mc_members m ON m.room=v.room AND m.id=v.owner
          LEFT JOIN mc_items w ON w.room=v.room AND w.item=v.item AND w.kind='vehicleDamage'
          WHERE v.room=? AND v.kind='vehicle' AND v.item=?`,room,car).first();
        if(existing){
          const parked=parse(existing.data),wear=parse(existing.wear),driver=parse(existing.state);
          if(existing.owner&&existing.seen>now-maxPoseAge&&driver?.vehicle?.id===car)return fail('La citadine est en circulation.');
          if(wear?.explodeAt&&wear.explodeAt+wreckFor>now)return fail('La dépanneuse récupère encore l’épave.');
          if(!wear?.explodeAt&&(parked.expiresAt||existing.at+abandonedFor)>now)
            return {ok:true,state:publicState(row),vehicle:parked,notice:'Ta citadine est déjà en ville.'};
          guard+=" AND EXISTS (SELECT 1 FROM mc_items WHERE room=? AND kind='vehicle' AND item=? AND at=? AND seq=?)";
          guardArgs.push(room,car,existing.at,existing.seq);
          if(wear?.explodeAt)car='garage-'+crypto.randomUUID();
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
    ...effects,q('SELECT * FROM mc_careers WHERE profile=?',profile)
  ]);
  const state=publicState(updated.at(-1).results[0]);
  if(!updated[0].results.length)return {ok:false,error:'La situation a changé. Réessaie.',state};
  if(notice&&b.action!=='state')return {ok:false,state,error:notice};
  return {ok:true,state,...(vehicle?{vehicle}:{}),...(repaired?{repaired}:{}),...(notice?{notice}:{})};
}
