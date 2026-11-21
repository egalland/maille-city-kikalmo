// The origins follow the surveyed hypermarket, the western Drive access, and
// the service-station canopy. Markings and paved connectors are game layouts.
export const marketParking=[
  {id:'mont-renaud-parking-principal',name:'Parking Auchan · allées de la galerie',x:-1658,y:1094,angle:1.97,rows:2,columns:16,colors:['#909aa1','#c29572']},
  {id:'mont-renaud-parking-nord',name:'Parking Auchan · entrée nord',x:-1659,y:996,angle:.32,rows:1,columns:9,colors:['#a7836b','#819b8d']},
  {id:'mont-renaud-parking-sud',name:'Parking des magasins · Mont Renaud',x:-1639,y:1265,angle:.19,rows:2,columns:12,colors:['#8d9da1','#a96c64']}
].map(lot=>({...lot,mall:true,width:lot.columns*3.3+1.8,depth:lot.rows===2?19:12}));

export function marketPoint(site,along,across){
  const c=Math.cos(site.angle),s=Math.sin(site.angle);
  return [site.x+c*along-s*across,site.y+s*along+c*across];
}
export const marketDrive={id:'mont-renaud-drive',name:'Auchan Drive · retrait des courses',x:-1853,y:1144,angle:.40,across:0,mall:true};
export const marketFuel={id:'mont-renaud-station',name:'Station-service Auchan',x:-1585,y:1095,angle:.39,mall:true};
export const marketServices=[marketDrive,marketFuel];
export const inMarketDistrict=(x,y)=>x>=-1890&&x<=-1470&&y>=975&&y<=1290;
export const marketForecourt=[[-1662.5,1078.2],[-1637.2,1018.4],[-1611.8,1029.4],[-1628,1079],[-1646,1102]];
export const marketSigns=[
  {id:'drive-entry-sign',x:-1872.9,y:1130.2,angle:1.93,style:20,span:3.3},
  {id:'drive-exit-sign',x:-1827.1,y:1152.2,angle:1.97,style:26,span:2.5},
  {id:'gallery-pylon',x:-1641.2,y:986.8,angle:.24,style:27,span:4.4},
  {id:'fuel-entry-sign',x:-1600.0,y:1092.7,angle:1.96,style:21,span:2.65}
];
export const driveBays=[-5.25,-1.75,1.75,5.25].map((across,i)=>{
  const [x,y]=marketPoint(marketDrive,0,across);
  return {id:i+1,x,y,angle:marketDrive.angle,across};
});
export const driveOrderWait=8000;
export function atDriveBay(p){
  if(!Number.isFinite(p?.angle)||!Number.isFinite(p?.speed)||Math.abs(p.speed)>.65||p.lift>.65)return null;
  const angle=marketDrive.angle,c=Math.cos(angle),s=Math.sin(angle);
  if(Math.cos(p.angle-angle)<.88)return null;
  return driveBays.find(bay=>{
    const dx=p.x-bay.x,dy=p.y-bay.y;
    return Math.abs(dx*c+dy*s)<2.20&&Math.abs(-dx*s+dy*c)<1.36;
  })||null;
}

export const marketPaving=[];
function strip(id,a,b,width,kind='road'){
  marketPaving.push({id,a,b,width,kind,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2});
}
function lanes(site,paths,kind){
  for(const [i,[a,b,width]] of paths.entries())
    strip(site.id+'-'+i,marketPoint(site,...a),marketPoint(site,...b),width,kind);
}
lanes(marketDrive,[
  [[-26,-9],[-16,0],7], [[-16,0],[15,0],15.6], [[15,0],[26,-11],7]
]);
lanes(marketFuel,[
  [[-13,5],[-11,0],6], [[-11,0],[11,0],12.8], [[11,0],[15,7],7]
]);
for(const lot of marketParking){
  const end=lot.width/2;
  lanes(lot,[[[-end-5,0],[-end+2,0],6.6],[[end-2,0],[end+6,0],6.6]]);
}
strip('parking-galerie-entree',[-1640,1060],[-1655,1078],7);
strip('parking-galerie-sortie',[-1665,1106],[-1649,1129],7);
strip('parking-nord-entree',[-1644,1001],[-1635,975.7],6.5);
strip('parking-sud-entree',[-1629,1267],[-1618,1244],7);
strip('galerie-marche',[-1633.7,1020.3],[-1658,1078.9],5.3,'walk');
strip('galerie-traversee',[-1656,1062],[-1644,1067],3,'crosswalk');
strip('galerie-porche',[-1647,1047.7],[-1637.4,1051.6],3.4,'walk');
for(const bay of driveBays){
  const local=(a,b)=>marketPoint(marketDrive,a,bay.across+b);
  for(const side of [-1,1])strip('baie-'+bay.id+'-'+side,local(-4.1,side*1.46),local(4.1,side*1.46),.12,'paint');
  strip('baie-arret-'+bay.id,local(3.2,-1.37),local(3.2,1.37),.21,'paint');
  strip('piste-fleche-'+bay.id,local(-11.7,0),local(-9.3,0),.14,'paint');
  for(const side of [-1,1])strip('piste-pointe-'+bay.id+'-'+side,local(-10.1,side*.44),local(-9.3,0),.14,'paint');
}

const hedge=(id,a,b,h=1.08)=>['mont-renaud-haie-'+id,'hedge',Math.round(h*10),[...a,...b].map(x=>Math.round(x*10))];
export const marketHedges=[
  hedge('drive-sud',marketPoint(marketDrive,-19,9),marketPoint(marketDrive,19,9),1.42),
  hedge('drive-entree',marketPoint(marketDrive,-25,2),marketPoint(marketDrive,-18,6.5),1.05),
  hedge('drive-sortie',marketPoint(marketDrive,18,6.5),marketPoint(marketDrive,26,2),1.05),
  hedge('galerie-nord',[-1646,1005],[-1638,1008]),
  hedge('parvis-nord',[-1625.0,1031],[-1628.3,1038.8],.84),
  hedge('parvis-sud',[-1632.9,1054],[-1636.2,1062.0],.91),
  hedge('station-est',marketPoint(marketFuel,-7,-8.1),marketPoint(marketFuel,10,-8.1),.95),
  hedge('station-sud',marketPoint(marketFuel,-8,8.1),marketPoint(marketFuel,6,8.1),.98)
];
for(const lot of marketParking){
  const [ends,edge]=[lot.width/2-3,lot.depth/2+.8];
  for(const side of (lot.rows===2?[-1,1]:[-1])){
    for(const [i,[lo,hi]] of [[-ends,-4.5],[4.5,ends]].entries()){
      marketHedges.push(hedge(lot.id+side+i,marketPoint(lot,lo,side*edge),marketPoint(lot,hi,side*edge),.94));
    }
  }
}

export const facilityShelters=[
  {site:marketDrive,style:20,height:3.65,width:10,depth:15,posts:[[-3.8,-7.6],[-3.8,7.6],[3.8,-7.6],[3.8,7.6]],equipment:[]},
  {site:marketFuel,style:21,height:4.45,width:24,depth:9.4,posts:[[-9.5,-3.85],[-9.5,3.85],[9.5,-3.85],[9.5,3.85]],
    equipment:[[-6,0],[0,0],[6,0]]}
];
export const facilitySolids=facilityShelters.flatMap(({site,posts,equipment,height,width,depth})=>[...posts,...equipment].map(([u,v],i)=>{
  const radius=i<posts.length?.22:.52,poly=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>marketPoint(site,u+a*radius,v+b*radius));
  return {id:site.id+'-solid-'+i,type:'building',poly,h:i<posts.length?height:1.55};
}).concat({id:site.id+'-roof',type:'building',h:height+.36,minHeight:height,
  poly:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>marketPoint(site,u*width/2,v*depth/2))}));
