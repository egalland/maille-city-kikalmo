// Gameplay units are metres and seconds. IDs remain stable for existing inventories.
const arsenal={
  pistol:['Pistolet','Pistolet semi-automatique','sidearm'],smg:['Mitraillette','Tir automatique de près','compact'],
  shotgun:['Fusil à pompe','Très puissant à courte distance','shotgun'],yarn:['Revolver','Coup par coup','revolver'],
  ribbonbow:['Carabine','Tir précis à longue portée','rifle'],pompom:['Lance-grenades','Explosion à l’impact','launcher'],
  confetti:['Fusil de chasse','Sept plombs à courte portée','double'],boomerang:['Pistolet à ricochet','Un ricochet à proximité','sidearm'],
  bubbles:['Pistolet-mitrailleur','Tir groupé à courte portée','compact'],spool:['Carabine à ricochets','Ricochets à courte distance','rifle'],
  star:['Fusil d’assaut','Rafale de trois tirs','assault'],chime:['Canon à dispersion','Gerbe très large','launcher'],
  needle:['Fusil de précision','Tir à très longue portée','sniper'],shuttle:['Carabine tactique','Double tir','assault'],
  button:['Fusil à canon court','Cinq plombs','shotgun'],spark:['Carabine à rebonds','Jusqu’à deux ricochets','compact'],
  service:['Pistolet de service','Semi-automatique, chargeur de 15','sidearm'],
  marksman:['Fusil semi-automatique à lunette','Tir de précision coup par coup','sniper'],
  rocket:['Lance-roquettes','Un tir, explosion à l’impact','launcher']
};
const meleePalette=Object.freeze({accent:'#f7c08d',thread:'#be856c',cloth:'#523f4c',trim:'#ffeac3'});
const firearmPalette=Object.freeze({accent:'#a1acb3',thread:'#747f88',cloth:'#323943',trim:'#d9a88b'});
const defineWeapon=(id,mag,interval,range,damage,reload,frequency)=>{
  const [name,hint,profile]=arsenal[id]||['Poings','Corps à corps','melee'];
  const melee=id==='fist';
  return Object.freeze({id,name,hint,profile,mag,interval,range,damage,reload,effect:melee?'fist':id==='rocket'?'rocket':'shot',frequency,
    palette:melee?meleePalette:firearmPalette,starter:melee||id==='pistol',noise:!melee});
};
const entries=[
  defineWeapon('fist',Infinity,.42,2.25,12,0,146),
  defineWeapon('pistol',12,.28,62,17,1,136),
  defineWeapon('smg',28,.14,44,10,1.4,154),
  defineWeapon('shotgun',5,.72,22,16,1.55,96),
  defineWeapon('yarn',6,.52,40,13,1.15,118),
  defineWeapon('ribbonbow',4,.83,78,28,1.1,112),
  defineWeapon('pompom',3,.87,32,21,1.64,83),
  defineWeapon('confetti',3,.94,16,13,1.5,102),
  defineWeapon('boomerang',2,1.03,36,19,1.32,143),
  defineWeapon('bubbles',16,.31,25,8,1.04,162),
  defineWeapon('spool',4,.82,28,16,1.45,123),
  defineWeapon('star',7,.53,49,13,1.17,139),
  defineWeapon('chime',4,.84,10,15,1.22,88),
  defineWeapon('needle',5,.7,94,25,1.42,114),
  defineWeapon('shuttle',12,.35,53,14,1.38,132),
  defineWeapon('button',7,.61,29,12,1.51,106),
  defineWeapon('spark',9,.45,38,16,1.55,153),
  defineWeapon('service',15,.24,61,20,1.14,148),
  defineWeapon('marksman',10,.49,89,27,1.58,106),
  defineWeapon('rocket',1,1.32,82,78,2.7,69)
];
export const weaponCatalog=Object.freeze(Object.fromEntries(entries.map(w=>[w.id,w])));
export const weaponList=Object.freeze(entries);
export const starterWeapons=Object.freeze(entries.filter(w=>w.starter).map(w=>w.id));
export const findableWeaponIds=Object.freeze(entries.filter(w=>!w.starter).map(w=>w.id));

export function weaponDamageAt(id,metres){
  const weapon=weaponCatalog[id],d=Math.max(0,metres||0);
  const unit=(a,b)=>Math.max(0,Math.min(1,(d-a)/(b-a)));
  let factor=1;
  if(['shotgun','double'].includes(weapon.profile)){
    factor=1+1.8*(1-unit(4,11))-.78*unit(11,weapon.range);
  }else if(weapon.profile==='sniper'){
    factor=1+.65*unit(16,55);
  }else if(weapon.profile==='compact'){
    factor=1+.24*(1-unit(4,12))-.58*unit(13,weapon.range);
  }
  return Math.max(1,Math.round(weapon.damage*factor));
}

// Number keys and the wheel follow the same slots as the player's bag grows.
export function inventoryWeapons(owned=starterWeapons){
  return weaponList.filter(item=>item.starter||owned?.includes(item.id));
}
