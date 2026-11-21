import {auchanFront} from './auchan-layout.js';

// Mont Renaud in surveyed metres, east and south. The forecourts follow the IGN
// aerial photograph and the Drive frontage mapped at OSM node 14353287171.
const bayWidth=2.8,bayDepth=5.3,aisle=7.2,margin=.35;
export const marketParking=[
  {id:'mont-renaud-parking-principal',name:'Parking Auchan · allée est',x:-1618.3,y:1156.1,columns:16,colors:['#909aa1','#c29572']},
  {id:'mont-renaud-parking-est-centre',name:'Parking Auchan · allée centrale',x:-1625.6,y:1188.4,columns:12,colors:['#949fa4','#a96c64']},
  {id:'mont-renaud-parking-est-sud',name:'Parking Auchan · allée sud-est',x:-1637.7,y:1218.4,columns:11,colors:['#b7aa91','#859e93']},
  {id:'mont-renaud-parking-nord',name:'Parking Auchan · devant la galerie',x:-1667.5,y:1114.5,columns:7,colors:['#a7836b','#819b8d']},
  {id:'mont-renaud-parking-sud',name:'Parking Auchan · accès sud et Drive',x:-1716.2,y:1253.2,columns:11,colors:['#8d9da1','#a96c64']},
  {id:'mont-renaud-parking-porche',name:'Parking Auchan · devant le porche',x:-1670.8,y:1155.0,columns:7,colors:['#607f9c','#a75c59']}
].map(lot=>({...lot,angle:.39,rows:2,mall:true,bayWidth,bayDepth,aisle,margin,
  width:lot.columns*bayWidth+2*margin,depth:aisle+2*(bayDepth+margin)}));

export function marketPoint(site,along,across){
  const c=Math.cos(site.angle),s=Math.sin(site.angle);
  return [site.x+c*along-s*across,site.y+s*along+c*across];
}
export const marketDrive={id:'mont-renaud-drive',name:'Auchan Drive · accès sud-ouest',x:-1805.5,y:1232.7,angle:.39,mall:true};
export const marketFuel={id:'mont-renaud-station',name:'Station-service Auchan',x:-1585.6,y:1094.9,angle:1.96,mall:true};
export const marketServices=[marketDrive,marketFuel];
export const inMarketDistrict=(x,y)=>x>=-1890&&x<=-1470&&y>=975&&y<=1305;
export const marketForecourt=[[-1662.5,1078.2],[-1637.2,1018.4],[-1611.8,1029.4],[-1628,1079],[-1646,1102]];
export const marketGalleryCrossing=[[-1657.5,1135.3],[-1641.5,1141.7]];
export const marketLotsGround=[
  {x:-1675,y:1144,poly:[[-1709,1161],[-1702,1142],[-1683,1099],[-1664,1086],[-1648,1107],[-1647,1140],
    [-1645,1164],[-1655,1191],[-1665,1206],[-1684,1194],[-1706,1174]]},
  {x:marketDrive.x,y:marketDrive.y,poly:[[-30,4],[-25,-4],[-18,-8.7],[17,-8.7],[30,-2],[47,2],[49,17],[-17,17],[-28,13]].map(p=>marketPoint(marketDrive,...p))},
  {x:-1620,y:1183,poly:[[-1626,1106],[-1614,1105],[-1606,1122],[-1576,1135],[-1571,1144],[-1614,1242],[-1622,1247],[-1662,1230],[-1647,1202],[-1644,1182],[-1648,1131]]},
  {x:-1717,y:1251,poly:[[-1725,1212],[-1667,1232],[-1681,1281],[-1733,1287],[-1753,1274],[-1746,1252],[-1734,1226]]}
];

const drivePoint=(a,b)=>marketPoint(marketDrive,a,b);
const fuelPoint=(a,b)=>marketPoint(marketFuel,a,b);
function marketSign(id,point,angle,style,span){
  return {id,x:point[0],y:point[1],angle,style,span};
}
export const marketSigns=[
  marketSign('drive-entry-sign',[-1748,1255],1.96,20,3.3),
  marketSign('drive-exit-sign',drivePoint(15,-8.5),1.96,26,2.5),
  marketSign('gallery-pylon',[-1641.2,986.8],.24,27,4.4),
  marketSign('fuel-entry-sign',[-1590.9,1074.2],.39,21,2.65)
];
export const driveBays=[-5.7,-1.9,1.9,5.7].map((across,i)=>{
  const [x,y]=drivePoint(0,across);
  return {id:i+1,x,y,angle:marketDrive.angle,across};
});
export const driveOrderWait=8000;
export function atDriveBay(p){
  if(!Number.isFinite(p?.angle)||!Number.isFinite(p?.speed)||Math.abs(p.speed)>.65||p.lift>.65)return null;
  const angle=marketDrive.angle,c=Math.cos(angle),s=Math.sin(angle);
  if(Math.cos(p.angle-angle)<.88)return null;
  return driveBays.find(bay=>{
    const dx=p.x-bay.x,dy=p.y-bay.y;
    return Math.abs(dx*c+dy*s)<2.20&&Math.abs(-dx*s+dy*c)<1.42;
  })||null;
}

export const marketPaving=[];
function strip(id,a,b,width,kind='road'){
  marketPaving.push({id,a,b,width,kind,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2});
}
function lane(id,points,width){
  for(let i=1;i<points.length;i++)strip(id+'-'+i,points[i-1],points[i],width);
}
// The queue runs along the outside of the south car park before turning back
// into the pickup bays. The exit reconnects on the gallery side of the queue.
export const driveApproach=[[-1750.4,1258.3],...[[44,14],[24,14],[-15,14],[-22,13],[-26,10],[-27,6],[-25,2],[-20,0],[-15,0]].map(p=>drivePoint(...p))];
export const driveExit=[[15,0],[24,1.5],[32,3.7],[43,5.1],[53,5.4]].map(p=>drivePoint(...p))
  .concat([[-1749.4,1251.4]]);
lane('drive-file',driveApproach,6.6);
lane('drive-depart',driveExit,7);
strip('drive-pistes',drivePoint(-18,0),drivePoint(20,0),16.8);

export const fuelApproach=[[-1597.4,1076.5],[-1591.0,1068.8],fuelPoint(-17,0),fuelPoint(-13,0)];
export const fuelExit=[fuelPoint(13,0),[-1594.2,1118.2],[-1602,1119.1],[-1609.3,1115.5]];
export const fuelLanes=[-8.1,-2.7,2.7,8.1].map(offset=>[[-15,0],[-9,offset],[-5,offset],[5,offset],[9,offset],[15,0]].map(p=>fuelPoint(...p)));
lane('station-entree',fuelApproach,6.6);
lane('station-sortie',fuelExit,6.6);
strip('station-parvis',fuelPoint(-14,0),fuelPoint(14,0),23.6);
for(const [i,points] of fuelLanes.entries()){
  for(const end of [0,1]){
    const q=end?points[3]:points[2],angle=marketFuel.angle;
    const line=(u,v)=>marketPoint({x:q[0],y:q[1],angle},u,v);
    for(const side of [-1,1])strip('station-guide-'+i+'-'+end+'-'+side,line(-3,side*1.9),line(2,side*1.9),.1,'paint');
  }
}
const lotConnections=[
  [[-1650,1150],[-1577.8,1160.7]],
  [[-1646.5,1180.5],[-1590.2,1188.8]],
  [[-1660.2,1217.0],[-1607.0,1227.6]],
  [[-1679,1110],[-1640.6,1113.4]],
  [[-1746.2,1247.3],[-1690,1242]],
  [[-1692,1150],[-1648.8,1159.5]]
];
for(const [i,lot] of marketParking.entries()){
  const end=lot.width/2;
  for(const side of [-1,1]){
    const from=marketPoint(lot,side*(end-2),0),to=marketPoint(lot,side*(end+4),0);
    lane(lot.id+'-acces-'+side,[from,to,lotConnections[i][side>0?1:0]],aisle);
  }
}
strip('galerie-marche',[-1633.7,1020.3],[-1658,1078.9],5.3,'walk');
strip('galerie-trottoir',[-1661,1119],marketGalleryCrossing[0],2.5,'walk');
strip('auchan-parvis',auchanFront.point(0,-6),[-1686,1147],3.4,'walk');
strip('auchan-trottoir',[-1686,1147],[-1666,1143.2],3.4,'walk');
strip('auchan-trottoir-parking',[-1666,1143.2],marketGalleryCrossing[0],3.4,'walk');
strip('galerie-traversee',...marketGalleryCrossing,3,'crosswalk');
strip('galerie-trottoir-parking',marketGalleryCrossing[1],[-1631,1146],2.5,'walk');
strip('galerie-porche',[-1647,1047.7],[-1637.4,1051.6],3.4,'walk');
for(const bay of driveBays){
  const local=(a,b)=>marketPoint(marketDrive,a,bay.across+b);
  for(const side of [-1,1])strip('baie-'+bay.id+'-'+side,local(-4.1,side*1.72),local(4.1,side*1.72),.12,'paint');
  strip('baie-arret-'+bay.id,local(3.2,-1.37),local(3.2,1.37),.21,'paint');
  strip('piste-fleche-'+bay.id,local(-11.7,0),local(-9.3,0),.14,'paint');
  for(const side of [-1,1])strip('piste-pointe-'+bay.id+'-'+side,local(-10.1,side*.44),local(-9.3,0),.14,'paint');
}

const hedge=(id,a,b,h=1.08)=>['mont-renaud-haie-'+id,'hedge',Math.round(h*10),[...a,...b].map(x=>Math.round(x*10))];
export const marketHedges=[
  hedge('drive-separateur',drivePoint(-11,9),drivePoint(14,9),.87),
  hedge('drive-sud',drivePoint(-15,18.2),drivePoint(27,18.2),1.22),
  hedge('galerie-nord',[-1646,1005],[-1638,1008]),
  hedge('parvis-nord',[-1625.0,1031],[-1628.3,1038.8],.84),
  hedge('parvis-sud',[-1632.9,1054],[-1636.2,1062.0],.91),
  hedge('station-lisiere',fuelPoint(-9,-13.1),fuelPoint(9,-13.1),.95)
];

export const facilityShelters=[
  {site:marketDrive,style:20,height:3.85,width:10,depth:16.3,posts:[[-3.8,-8.0],[-3.8,8.0],[3.8,-8.0],[3.8,8.0]],equipment:[]},
  {site:marketFuel,style:21,height:4.45,width:6.3,depth:24,
    posts:[[-2.4,-5.4],[2.4,-5.4],[-2.4,5.4],[2.4,5.4]],equipment:[[0,-5.4],[0,0],[0,5.4]]}
];
export const facilitySolids=facilityShelters.flatMap(({site,posts,equipment,height,width,depth})=>[...posts,...equipment].map(([u,v],i)=>{
  const radius=i<posts.length?.22:.52,poly=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>marketPoint(site,u+a*radius,v+b*radius));
  return {id:site.id+'-solid-'+i,type:'building',poly,h:i<posts.length?height:1.55};
}).concat({id:site.id+'-roof',type:'building',h:height+.36,minHeight:height,
  poly:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>marketPoint(site,u*width/2,v*depth/2))}));
