// Reference points for arrivals, also used to name the surrounding areas.
export const enferPoint=(lon,lat)=>[(lon-3)*72300,(49.58-lat)*111230];
const places=[
  ['noyon','Parvis des Tisserands',2.999934,49.582548,/parvis notre dame/,[3.00064,49.58218],'Les Vieilles Mailles'],
  ['gare','Avenue de la Gare · La Filature',3.01116,49.57812,/avenue de la gare/,null,'La Filature'],
  ['pont-eveque','Le Port des Écheveaux',2.98515,49.56341,null,[2.98515,49.56320]],
  ['sempigny','Les Saules',2.99450,49.55850,/grande rue/],
  ['morlincourt','Les Briqueteries',3.035225,49.570207,/rue de la mairie/],
  ['pontoise','Le Bout-du-Pont',3.047439,49.553589,null],
  ['varesnes','La Basse Prairie',3.0604217,49.56658382,null],
  ['salency','Les Hauts de Lande',3.053515,49.586347,null],
  ['behericourt','L’Orée',3.06350,49.59670,null],
  ['trois-ponts','Passage des Trois Arches',2.99160,49.56164,/rue des 3 ponts/,[2.99211,49.56122],null,true],
  ['couarcy','Pont des Bobines',3.04222,49.55129,/rue de couarcy/]
];
export const enferStops=places.map(([key,name,lon,lat,road,targetLabel,,onRoad])=>{
  const [x,y]=enferPoint(lon,lat);
  return [key,name,x,y,road,targetLabel?enferPoint(...targetLabel):[x+24,y],onRoad];
});
const labels=places.slice(0,9).map(([key,name,lon,lat,,,district])=>{
  const [x,y]=enferPoint(lon,lat);
  return {x,y,name:district||name,r:key==='noyon'||key==='gare'?870:580};
});
export function enferDistrict(x,y){
  let nearest=null,distance=Infinity;
  for(const place of labels){
    const d=Math.hypot(x-place.x,y-place.y);
    if(d<place.r&&d<distance){nearest=place;distance=d;}
  }
  return nearest?.name||'Vallée des Aulnes';
}

const names=['des Aulnes','de la Canette','des Foulons','des Roseaux','des Ateliers','des Prés','du Cardage','des Lanternes','des Brumes','des Mouettes','de la Briqueterie','des Écluses','du Lavoir','des Drapiers','des Glycines','des Vanniers','du Gué','des Tisserands','des Chardons','des Ardoises','du Verger','des Noyers','de la Trame','du Passage'];
export function enferStreet(road){
  const source=(road.name||road.id).normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g,'');
  let hash=2166136261;
  for(const ch of source)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  const type=road.bridge?'Pont':road.kind==='path'?'Sentier':road.kind==='primary'?'Avenue':'Rue';
  return type+' '+names[(hash>>>0)%names.length];
}
