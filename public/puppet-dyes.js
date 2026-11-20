import {outfitShop} from './outfit-shop.js';
import {motionSeed} from './locomotion-pose.js';
import {yarnPalette} from './wool-art.js';

// A character carries the same animal, yarn and uniform in both views.
const furColors={
  fox:{fur:'#db8749',cream:'#fbe0ae',shade:'#97503d',inner:'#e8a18a'},
  cat:{fur:'#a69aab',cream:'#f2dbbd',shade:'#756278',inner:'#dba29a'},
  rabbit:{fur:'#d5bcac',cream:'#f4dfc2',shade:'#967f80',inner:'#d99b96'},
  bear:{fur:'#aa7857',cream:'#e9c69f',shade:'#795443',inner:'#ce9581'},
  raccoon:{fur:'#a4a3a4',cream:'#eee0c6',shade:'#625967',inner:'#c49899'}
};
const complexions=[
  ['#d8a47e','#c28e73'],['#8d5a43','#9e6c56'],['#bb805b','#ae725b'],
  ['#edbd97','#d89e86'],['#a36b57','#ab7461']
];
const foxShadows={lagon:'#9e5843',bruyere:'#765972',foret:'#795c48',braise:'#a96543'};
const crews={
  police:['cat','#344a70','#8fc5df'],medic:['rabbit','#f7edda','#258681'],
  firefighter:['bear','#8c4a45','#ffe17c'],swat:['raccoon','#414958','#829895']
};
const coats=['#93718e',yarnPalette.teal,yarnPalette.coral,'#b28a56','#66869b','#859a76','#837a98','#bf9657'];
const wildlife=['rabbit','bear','cat','raccoon'];
export function puppetAppearance(role,color,seed=0){
  const type=role==='player'?'fox':role==='ambulance'?'medic':role==='firetruck'?'firefighter':role;
  const pick=Number.isFinite(seed)?Math.abs(Math.trunc(seed)):motionSeed(seed)%65535;
  const crew=crews[type],animal=type==='fox'?'fox':type==='human'?'human':crew?.[0]||wildlife[pick%4];
  const fox=type==='fox'?foxSkin(color):null;
  const dye=(pick+(typeof color==='string'?motionSeed(color)%coats.length:0))%coats.length;
  const [skin,nose]=complexions[pick%complexions.length];
  const pelt=animal==='human'?{fur:skin,cream:'#e7aa8f',shade:'#674c45',inner:nose}:
    fox?{...furColors.fox,fur:fox.fur,cream:fox.cream,shade:foxShadows[fox.id]}:furColors[animal];
  return {type,pick,animal,skinId:fox?.id,pelt,service:!!crew,
    coat:crew?.[1]||(fox?.coat||coats[dye]),
    trim:crew?.[2]||(type==='fox'?yarnPalette.ochre:'#dbc59b')};
}

export const foxSkins=Object.freeze([
  {id:'lagon',label:'Lagon',coat:'#378784',fur:'#db8749',cream:'#fbe0ae'},
  {id:'bruyere',label:'Bruyère',coat:'#755c8f',fur:'#a47e98',cream:'#f3dbe1'},
  {id:'foret',label:'Forêt',coat:'#53734b',fur:'#a98059',cream:'#e8d2a5'},
  {id:'braise',label:'Braise',coat:'#994c44',fur:'#db9854',cream:'#ffe3b1'}
]);
export function foxSkin(value){
  const [id,dye]=String(value||'').split('~');
  const base=foxSkins.find(skin=>skin.id===id)||foxSkins[0];
  return Object.hasOwn(outfitShop.dyes,dye)?{...base,coat:outfitShop.dyes[dye].color}:base;
}
