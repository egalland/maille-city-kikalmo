import {auchanEntrance,auchanFront,auchanMain} from './auchan-layout.js';

export const frontageSigns=[
  {name:'BOULANGERIE',caption:'AU LEVAIN',color:'#7d423e',awning:'#ad5648'},
  {name:'ÉPICERIE',caption:'LES QUATRE SAISONS',color:'#315651',awning:'#57867a'},
  {name:'ÉCOLE',caption:'LES PETITES MAILLES',color:'#474a66',awning:'#747797'},
  {name:'CAFÉ',caption:'LE FIL D’OR',color:'#78583f',awning:'#aa8055'},
  {name:'LES HALLES',caption:'DES TISSERANDS',color:'#794455',awning:'#b25b70'},
  {name:'GARAGE',caption:'DES DEUX BORNES',color:'#22625e',awning:'#4b8d7c'},
  {name:'NAVETTES',caption:'BUREAU DE LIGNE',color:'#97662e',awning:'#bf9456'},
  {name:'ATELIER',caption:'COUR DES TEINTURIERS',color:'#4d5778',awning:'#747f9d'},
  {name:'POLICE',caption:'COMMISSARIAT DES LANTERNES',color:'#304559',awning:'#53697c'},
  {name:'BOULANGERIE',caption:'LE FOUR DES TISSERANDS',color:'#78453b',awning:'#b85d47',wares:'bread'},
  {name:'FLEURISTE',caption:'LES GLYCINES',color:'#476457',awning:'#718e73',wares:'flowers'},
  {name:'LIBRAIRIE',caption:'LES PAGES COUSUES',color:'#4e5278',awning:'#8a7499',wares:'books'},
  {name:'AUCHAN',caption:'MONT RENAUD',color:'#a5373e',awning:'#dc6663',wares:'groceries'},
  {name:'ACTION',caption:'MAISON ET LOISIRS',color:'#295886',awning:'#547bac',wares:'home'},
  {name:'KIABI',caption:'VÊTEMENTS ET ACCESSOIRES',color:'#334765',awning:'#8a9cbb',wares:'clothes'},
  {name:'INTERSPORT',caption:'SPORT ET PLEIN AIR',color:'#36567b',awning:'#c46059',wares:'sports'},
  {name:'LES FILATURES',caption:'BOUCLE DES MAILLES',color:'#265468',awning:'#699594'},
  {name:'LES AULNES',caption:'BOUCLE DES MAILLES',color:'#37615b',awning:'#7ea180'},
  {name:'LES PRÉS',caption:'BOUCLE DES MAILLES',color:'#6d5b40',awning:'#a38a67'},
  {name:'LES VERRIÈRES',caption:'BOUCLE DES MAILLES',color:'#385863',awning:'#7b9d9f'},
  {name:'AUCHAN DRIVE',caption:'RETRAIT DES COURSES',color:'#a72436',awning:'#e5c5b9'},
  {name:'AUCHAN',caption:'STATION-SERVICE',color:'#ae2b3d',awning:'#f1dbd0'},
  {name:'STOKOMANI',caption:'MAISON ET MODE',color:'#374978',awning:'#afbfdf'},
  {name:'CHAUSSEA',caption:'CHAUSSURES',color:'#45404b',awning:'#c0a8a2'},
  {name:'NORAUTO',caption:'CENTRE AUTO',color:'#253d75',awning:'#ebc765'},
  {name:'BUREAU VALLÉE',caption:'PAPETERIE',color:'#2f7066',awning:'#a8c99d'},
  {name:'SORTIE',caption:'← ALLÉE DE CIRCULATION',color:'#4f626b',awning:'#9fb7bb'},
  {name:'MONT RENAUD',caption:'AUCHAN · GALERIE · DRIVE',color:'#932d3a',awning:'#e1b7ae'},
  {name:'BRICOMARCHÉ',caption:'BRICOLAGE ET JARDIN',color:'#633037',awning:'#d9c8b3'},
  {name:'McDonald’s',caption:'RESTAURANT',color:'#24463a',awning:'#e5b93d',wares:'food'},
  {name:'BUFFALO GRILL',caption:'RESTAURANT',color:'#733930',awning:'#c84942',wares:'food'}
];
// Facades facing the public contract stops in the pilot district.
export const careerFronts=new Map([
  ['317661634',{style:4,edge:3}],['317660742',{style:5,edge:9}],
  ['317662711',{style:6,edge:3}],['317662614',{style:7,edge:4}],['317661252',{style:8,edge:1}]
]);
const featured=new Map([['317661403',0],['317660774',1],['317660755',2],['317661049',3]]);
const commercialStore=(id,building,name,style,edge,a,b,clockwise,fraction=.5)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],angle=Math.atan2(clockwise?-dx:dx,clockwise?dy:-dy);
  const door=[a[0]+dx*fraction,a[1]+dy*fraction,angle];
  return {id,building,name,style,edge,door,mall:true,x:door[0]-Math.cos(angle)*2,y:door[1]-Math.sin(angle)*2};
};
export const neighborhoodShops=[
  {id:'four-tisserands',name:'Boulangerie · Le Four des Tisserands',building:'317661398',edge:7,style:9,x:-25.85,y:-276.88},
  {id:'glycines',name:'Fleuriste · Les Glycines',building:'317662645',edge:9,style:10,x:138.96,y:-204.71},
  {id:'pages-cousues',name:'Librairie · Les Pages Cousues',building:'317662704',edge:6,style:11,x:55.54,y:-116.77},
  {id:'bobines',building:auchanMain,name:'Auchan · Mont Renaud',style:12,edge:auchanEntrance.edge,mall:true,
    door:[auchanFront.x,auchanFront.y,auchanFront.angle],x:auchanFront.point(0,-2)[0],y:auchanFront.point(0,-2)[1]},
  commercialStore('action-noyon','317656069','Action · Mont Renaud',13,0,[-1798.4,1075.1],[-1847.7,1053.9],true),
  commercialStore('kiabi-noyon','317656086','Kiabi · Mont Renaud',14,0,[-1526.5,1072.1],[-1519.9,1099.3],true),
  commercialStore('sport-noyon','2206464950','Intersport · Mont Renaud',15,3,[-1647.6,905.5],[-1611.5,907.8],true),
  commercialStore('mcdonalds','317656046','McDonald’s · Mont Renaud',29,1,[-1405.3,1128.8],[-1420.5,1139.9],true),
  commercialStore('buffalo-grill','317656114','Buffalo Grill · Mont Renaud',30,0,[-1467.8,1153.7],[-1486,1145.8],false),
  commercialStore('bricomarche','317656105','Bricomarché · Mont Renaud',28,1,[-1493.1,907.7],[-1556.3,902.6],false,.23),
  commercialStore('bureau-vallee','317656007','Bureau Vallée · Mont Renaud',25,3,[-1576.8,1236.7],[-1563.1,1242.5],true)
];
const satelliteFronts=[
  ['317656105',{style:28,edge:1}],
  ['317656053',{style:24,edge:0}],['317656007',{style:25,edge:0}]
];
export const namedFronts=new Map([...careerFronts,...satelliteFronts,...neighborhoodShops.map(shop=>[shop.building,shop])]);
export function frontageStyle(building){
  const venue=namedFronts.get(String(building.id));
  if(venue)return venue.style;
  if(featured.has(String(building.id)))return featured.get(String(building.id));
  if(building.kind!=='commercial')return null;
  const n=Math.abs(parseInt(building.id,10)||0);
  return [0,1,3][n%3];
}

export function paintFrontageSign(c,w,h,item){
  c.fillStyle=item.color;c.fillRect(0,0,w,h);
  c.strokeStyle='#ebc991';c.lineWidth=2;c.strokeRect(3,3,w-6,h-6);
  c.fillStyle='#fff1cb';c.textAlign='center';c.textBaseline='middle';
  if(['AUCHAN','AUCHAN DRIVE','ACTION','KIABI','INTERSPORT'].includes(item.name)){
    c.fillStyle='#fff6eb';c.font='900 29px sans-serif';c.fillText(item.name,w/2,25,w-18);
  }else{c.font='bold 24px serif';c.fillText(item.name,w/2,26,w-16);}
  c.font='600 12px sans-serif';c.fillText(item.caption,w/2,47,w-16);
}
