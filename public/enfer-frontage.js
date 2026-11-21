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
  {name:'MONT RENAUD',caption:'AUCHAN · GALERIE · DRIVE',color:'#932d3a',awning:'#e1b7ae'}
];
// Facades facing the public contract stops in the pilot district.
export const careerFronts=new Map([
  ['317661634',{style:4,edge:3}],['317660742',{style:5,edge:9}],
  ['317662711',{style:6,edge:3}],['317662614',{style:7,edge:4}],['317661252',{style:8,edge:1}]
]);
const featured=new Map([['317661403',0],['317660774',1],['317660755',2],['317661049',3]]);
const commercialStore=(id,building,name,style,edge,a,b,clockwise)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],angle=Math.atan2(clockwise?-dx:dx,clockwise?dy:-dy);
  const door=[(a[0]+b[0])/2,(a[1]+b[1])/2,angle];
  return {id,building,name,style,edge,door,mall:true,x:door[0]-Math.cos(angle)*2,y:door[1]-Math.sin(angle)*2};
};
export const neighborhoodShops=[
  {id:'four-tisserands',name:'Boulangerie · Le Four des Tisserands',building:'317661398',edge:7,style:9,x:-25.85,y:-276.88},
  {id:'glycines',name:'Fleuriste · Les Glycines',building:'317662645',edge:9,style:10,x:138.96,y:-204.71},
  {id:'pages-cousues',name:'Librairie · Les Pages Cousues',building:'317662704',edge:6,style:11,x:55.54,y:-116.77},
  commercialStore('bobines','317656059','Auchan · Mont Renaud',12,34,[-1661.8,1077.8],[-1637.4,1019.2],true),
  commercialStore('action-noyon','317656053','Action · Mont Renaud',13,0,[-1527.8,1000],[-1523.3,1043.9],true),
  commercialStore('kiabi-noyon','317656086','Kiabi · Mont Renaud',14,0,[-1526.5,1072.1],[-1519.9,1099.3],true),
  commercialStore('sport-noyon','317656056','Intersport · Mont Renaud',15,0,[-1730.4,1193.6],[-1744.7,1227.7],false)
];
const satelliteFronts=[
  ['317656105',{style:22,edge:0}],['2206464950',{style:23,edge:0}],
  ['317656066',{style:24,edge:2}],['317656007',{style:25,edge:0}]
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
