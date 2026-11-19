export const frontageSigns=[
  {name:'BOULANGERIE',caption:'AU LEVAIN',color:'#7d423e',awning:'#ad5648'},
  {name:'ÉPICERIE',caption:'LES QUATRE SAISONS',color:'#315651',awning:'#57867a'},
  {name:'ÉCOLE',caption:'LES PETITES MAILLES',color:'#474a66',awning:'#747797'},
  {name:'CAFÉ',caption:'LE FIL D’OR',color:'#78583f',awning:'#aa8055'}
];
const featured=new Map([['317661403',0],['317660774',1],['317660755',2],['317661049',3]]);
export function frontageStyle(building){
  if(featured.has(String(building.id)))return featured.get(String(building.id));
  if(building.kind!=='commercial')return null;
  const n=Math.abs(parseInt(building.id,10)||0);
  return [0,1,3][n%3];
}
