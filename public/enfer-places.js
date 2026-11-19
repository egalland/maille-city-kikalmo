// Reference points for arrivals, also used to name the surrounding areas.
export const enferPoint=(lon,lat)=>[(lon-3)*72300,(49.58-lat)*111230];
const places=[
  ['noyon','Parvis Notre-Dame',2.999934,49.582548,/parvis notre dame/,[3.00064,49.58218],'Noyon · Centre'],
  ['gare','Gare de Noyon',3.01116,49.57812,/avenue de la gare/,null,'Noyon · Gare'],
  ['pont-eveque','Pont-l’Évêque',2.98515,49.56341,null],
  ['sempigny','Sempigny',2.99450,49.55850,/grande rue/],
  ['morlincourt','Morlincourt',3.035225,49.570207,/rue de la mairie/],
  ['pontoise','Pontoise-lès-Noyon',3.047439,49.553589,null],
  ['varesnes','Varesnes',3.0604217,49.56658382,null],
  ['salency','Salency',3.053515,49.586347,null],
  ['behericourt','Béhéricourt',3.06350,49.59670,null]
];
export const enferStops=places.map(([key,name,lon,lat,road,targetLabel])=>{
  const [x,y]=enferPoint(lon,lat);
  return [key,name,x,y,road,targetLabel?enferPoint(...targetLabel):[x+24,y]];
});
const labels=places.map(([key,name,lon,lat,,,district])=>{
  const [x,y]=enferPoint(lon,lat);
  return {x,y,name:district||name,r:key==='noyon'||key==='gare'?870:580};
});
export function enferDistrict(x,y){
  let nearest=null,distance=Infinity;
  for(const place of labels){
    const d=Math.hypot(x-place.x,y-place.y);
    if(d<place.r&&d<distance){nearest=place;distance=d;}
  }
  return nearest?.name||'Vallée de l’Oise';
}
