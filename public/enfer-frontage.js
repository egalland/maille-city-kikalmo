export const frontageSigns=[
  {name:'BOULANGERIE',caption:'AU LEVAIN',color:'#7d423e',awning:'#ad5648'},
  {name:'ÉPICERIE',caption:'LES QUATRE SAISONS',color:'#315651',awning:'#57867a'},
  {name:'ÉCOLE',caption:'LES PETITES MAILLES',color:'#474a66',awning:'#747797'},
  {name:'CAFÉ',caption:'LE FIL D’OR',color:'#78583f',awning:'#aa8055'},
  {name:'LES HALLES',caption:'DES TISSERANDS',color:'#794455',awning:'#b25b70'},
  {name:'GARAGE',caption:'DES DEUX BORNES',color:'#22625e',awning:'#4b8d7c'},
  {name:'NAVETTES',caption:'BUREAU DE LIGNE',color:'#97662e',awning:'#bf9456'},
  {name:'ATELIER',caption:'COUR DES TEINTURIERS',color:'#4d5778',awning:'#747f9d'},
  {name:'POLICE',caption:'COMMISSARIAT DES LANTERNES',color:'#304559',awning:'#53697c'}
];
// Facades facing the public contract stops in the pilot district.
export const careerFronts=new Map([
  ['317661634',{style:4,edge:3}],['317660742',{style:5,edge:9}],
  ['317662711',{style:6,edge:3}],['317662614',{style:7,edge:4}],['317661252',{style:8,edge:1}]
]);
const featured=new Map([['317661403',0],['317660774',1],['317660755',2],['317661049',3]]);
export function frontageStyle(building){
  const venue=careerFronts.get(String(building.id));
  if(venue)return venue.style;
  if(featured.has(String(building.id)))return featured.get(String(building.id));
  if(building.kind!=='commercial')return null;
  const n=Math.abs(parseInt(building.id,10)||0);
  return [0,1,3][n%3];
}
