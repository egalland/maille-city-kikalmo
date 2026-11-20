import {neighborhoodShops,frontageSigns} from './enfer-frontage.js';
import {parkingLots,lotPoint} from './enfer-parking-lots.js';

const commercialLot=parkingLots.find(lot=>lot.id==='parking-galerie');
const commercialPoint=(x,y)=>lotPoint(commercialLot,x,y);
export const supermarketBuilding={
  id:'galerie-bobines',kind:'commercial',h:5.9,holes:[],observedHeight:true,
  poly:[commercialPoint(-10,8),commercialPoint(10,8),commercialPoint(10,20),commercialPoint(-10,20)]
};

const groceryDoor=commercialPoint(0,8);
const catalogs=[
  {door:[-27.2,-278.35,-2.3151217116],clerk:'Mina',coat:'#a55748',
    goods:[['baguette','Baguette au levain',4],['brioche','Brioche tressée',7],['tarte','Tarte aux pommes',11]]},
  {door:[140.15,-203.10,.9327103275],clerk:'Iris',coat:'#668c75',
    goods:[['girofle','Brin de giroflée',5],['bouquet','Bouquet des Glycines',12],['plante','Plante en pot',16]]},
  {door:[57,-115.4,.7520771675],clerk:'Émile',coat:'#84739f',
    goods:[['carnet','Carnet cousu',6],['roman','Roman de quartier',10],['atlas','Atlas des Vieilles Mailles',16]]},
  {door:[...groceryDoor,commercialLot.angle+Math.PI/2],clerk:'Sam',coat:'#417c72',
    goods:[['pommes','Filet de pommes',5],['jus','Jus de poire',4],['provisions','Panier de provisions',14],['chocolat','Tablette de chocolat',6]]}
];

export const shopHeadroom=2.75;
export const retailStores=neighborhoodShops.map((shop,index)=>{
  const {door:[x,y,angle],clerk,coat,goods}=catalogs[index],large=shop.building===supermarketBuilding.id;
  const c=Math.cos(angle),s=Math.sin(angle),point=(across,inside)=>[x+c*inside-s*across,y+s*inside+c*across];
  const bakery=shop.id==='four-tisserands',center=large?4.15:bakery?2.68:3.25,halfWidth=large?1.43:1.06;
  const booth={width:large?2.8:2.14,depth:.56,at:center,offset:0,h:1.02};
  const [buyerX,buyerY]=point(0,center-.9),[clerkX,clerkY]=point(0,center+(bakery?.72:.95));
  const furnishings=large?[
    ...[-6.5,-3.5,3.5,6.5].map(offset=>({at:6.6,offset,width:1.1,depth:4.8,h:1.46})),
    {at:10.55,offset:0,width:15.2,depth:.56,h:1.57}
  ]:bakery?[{at:2,offset:-1.62,width:.46,depth:1.70,h:1.42}]:
    [{at:center+2,offset:0,width:1.8,depth:.4,h:1.65}];
  return {...shop,large,point,angle,clerk,coat,goods,buyerX,buyerY,clerkX,clerkY,booth,furnishings,
    tint:frontageSigns[shop.style].color,halfWidth,
    display:[point(-halfWidth,0),point(halfWidth,0)]};
});
export const storeByBuilding=new Map(retailStores.map(store=>[store.building,store]));
export const retailGoods=new Map(retailStores.flatMap(store=>store.goods.map(([id,name,price])=>[id,{id,name,price,store:store.id}])));
export const foodRecovery={baguette:10,brioche:15,tarte:21,pommes:10,jus:8,provisions:30,chocolat:12};
export const retailClerks=retailStores.map(store=>({
  id:'clerk-'+store.id,type:'walker',name:store.clerk,x:store.clerkX,y:store.clerkY,
  angle:store.angle+Math.PI,color:store.coat,move:false,moving:false,speed:0
}));
export function atShopCounter(p){
  if(p.vehicle||p.passenger||p.airborne||p.swimming||p.motion==='swim'||(p.lift||0)>.35)return null;
  return retailStores.find(s=>Math.hypot(p.x-s.buyerX,p.y-s.buyerY)<=1.16)||null;
}
export function shopOpening(poly,store){
  const a=poly[store.edge],b=poly[(store.edge+1)%poly.length];
  const sign=store.display[0][0]*(b[0]-a[0])+store.display[0][1]*(b[1]-a[1])<
    store.display[1][0]*(b[0]-a[0])+store.display[1][1]*(b[1]-a[1]);
  return sign?store.display:store.display.slice().reverse();
}
export function shopFixture(store,{at,offset,width,depth}){
  return [
    store.point(offset+width/2,at-depth/2),store.point(offset-width/2,at-depth/2),
    store.point(offset-width/2,at+depth/2),store.point(offset+width/2,at+depth/2)
  ];
}
export function shopColliders(building,store){
  const [left,right]=shopOpening(building.poly,store),items=[];
  const add=(poly,h)=>items.push({id:store.id+'-solid-'+items.length,type:'building',poly,h});
  const wall=(a,b)=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],k=.11/Math.hypot(dx,dy);
    if(Number.isFinite(k))add([[a[0]-dy*k,a[1]+dx*k],[b[0]-dy*k,b[1]+dx*k],
      [b[0]+dy*k,b[1]-dx*k],[a[0]+dy*k,a[1]-dx*k]],building.h);
  };
  for(const poly of [building.poly,...building.holes]){
    poly.forEach((a,i)=>{
      const b=poly[(i+1)%poly.length];
      if(poly===building.poly&&i===store.edge){wall(a,left);wall(right,b);}
      else wall(a,b);
    });
  }
  for(const fixture of [store.booth,...store.furnishings])add(shopFixture(store,fixture),fixture.h);
  return [...items,{...building,type:'building',minHeight:shopHeadroom}];
}
