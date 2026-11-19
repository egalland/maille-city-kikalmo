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
const skin=['#d8a47e','#8d5a43','#bb805b','#edbd97','#a36b57'];
const crews={
  police:['cat','#3e596e','#bac9c3'],medic:['rabbit','#ece0bc','#568f85'],
  firefighter:['bear','#874c50','#e8bd68'],swat:['raccoon','#414958','#829895']
};
const coats=['#93718e',yarnPalette.teal,yarnPalette.coral,'#b28a56','#66869b','#859a76','#837a98','#bf9657'];
const wildlife=['rabbit','bear','cat','raccoon'];
export function puppetAppearance(role,color,seed=0){
  const type=role==='player'?'fox':role==='ambulance'?'medic':role==='firetruck'?'firefighter':role;
  const pick=Number.isFinite(seed)?Math.abs(Math.trunc(seed)):motionSeed(seed)%65535;
  const crew=crews[type],animal=type==='fox'?'fox':type==='human'?'human':crew?.[0]||wildlife[pick%4];
  const fox=type==='fox'?foxSkin(color):null;
  const dye=(pick+(typeof color==='string'?motionSeed(color)%coats.length:0))%coats.length;
  return {type,pick,animal,skinId:fox?.id,pelt:animal==='human'?{fur:skin[pick%skin.length],cream:'#e7aa8f',shade:'#674c45',inner:'#cb8d75'}:fox?{...furColors.fox,fur:fox.fur,cream:fox.cream}:furColors[animal],service:!!crew,
    coat:crew?.[1]||(fox?.coat||coats[dye]),
    trim:crew?.[2]||(type==='fox'?yarnPalette.ochre:'#dbc59b')};
}

export const foxSkins=Object.freeze([
  {id:'lagon',label:'Lagon',coat:'#378784',fur:'#db8749',cream:'#fbe0ae'},
  {id:'bruyere',label:'Bruyère',coat:'#755c8f',fur:'#a47e98',cream:'#f3dbe1'},
  {id:'foret',label:'Forêt',coat:'#53734b',fur:'#a98059',cream:'#e8d2a5'},
  {id:'braise',label:'Braise',coat:'#994c44',fur:'#db9854',cream:'#ffe3b1'}
]);
export const foxSkin=id=>foxSkins.find(skin=>skin.id===id)||foxSkins[0];
