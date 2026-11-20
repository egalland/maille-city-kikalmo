// Local coordinates in metres. x/y is the midpoint of the public-facing front,
// and angle points inward. Identifiers are the component footprints in the IGN archive.
function site(key,name,x,y,angle,ids,plinth,approach){
  return {key,name,x,y,angle,ids:ids.split(' '),plinth,approach};
}
export const heritageSites=[
  site('cathedrale','Cathédrale des Tisserands',5.9,-253.15,.509,'317663579 317663576 317661666 317663577 317663578 317662830 317662828 317662829 317661633 317663502 317661574',7.7,[-12.91,-273]),
  site('hotel-ville','Hôtel de ville des Vieilles Mailles',40.7,-59,.979,'317663580 317662693 317662694 317662695 317663581 317662690 317662692',8.0,[35.5,-63.98]),
  site('eglise-pont','Église du Bout-du-Pont',3407.25,2918.25,-.56,'318658635',4.3,[3400.86,2919.19]),
  site('mairie-pont','Mairie du Bout-du-Pont',3436.05,2933.85,-.785,'318658602 318658605',3.6,[3426.95,2943.43]),
  site('eglise-briques','Église des Briqueteries',2372.25,1126.9,-.381,'318441528',5.3,[2368.32,1136.15]),
  site('mairie-briques','Mairie-école des Briqueteries',2410.25,1104.6,-1.882,'318441641 318441643 318441459 318441461 318441463 2206376233',3.5,[2417.7,1116.9]),
  site('eglise-saules','Église des Saules',-296.8,2367.4,.129,'317656718 317656717',4.2,[-301.54,2352.03])
];
export const heritageByFootprint=new Map(heritageSites.flatMap(s=>s.ids.map(id=>[id,s])));

// The porch and portal carvings sit on the surveyed frontage. Inset only the
// shared low wall behind that frontage, otherwise near-coincident archive edges
// can hide the jambs and glass.
export function heritagePlinthHeight(site,id){
  return id==='317661574'?4.88:id==='317663502'?2.3:id==='317661633'?4.8:site.plinth;
}
export function heritagePlinth(site,building){
  const height=heritagePlinthHeight(site,String(building.id));
  if(!['hotel-ville','mairie-pont','mairie-briques'].includes(site.key))return {poly:building.poly,height};
  const c=Math.cos(site.angle),s=Math.sin(site.angle);
  const poly=building.poly.map(([x,y])=>{
    const u=(x-site.x)*c+(y-site.y)*s,v=-(x-site.x)*s+(y-site.y)*c;
    if(Math.abs(u)>.46||Math.abs(v)>15)return [x,y];
    return [x+(.48-u)*c,y+(.48-u)*s];
  });
  return {poly,height};
}
