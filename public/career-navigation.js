import {heritageSites} from './enfer-heritage.js';
import {airfields} from './airfield.js';
import {careerPlaces} from './career-catalog.js';
import {makeCareerRouter} from './career-route.js';
import {parkingLots} from './enfer-parking-lots.js';
import {neighborhoodShops} from './enfer-frontage.js';
import {railStations} from './enfer-rail.js';
import {marketServices} from './mont-renaud.js';
import {tuningSites} from './vehicle-tuning.js';
// Give directions to the public-facing pavement. A point at the centre of a
// building could put the last leg of the route inside its collision polygon.
export const heritageWaypoints=heritageSites.filter(site=>site.approach).map(site=>({
  id:'heritage/'+site.key,name:site.name,x:site.approach[0],y:site.approach[1],
  symbol:site.key.startsWith('mairie')||site.key==='hotel-ville'?'⌂':'✝'
}));
const neighborhoodPins=new Map([...parkingLots.map(p=>[p.id,'P']),...neighborhoodShops.map(p=>[p.id,'C']),...railStations.map(p=>[p.id,'T']),
  ...marketServices.map((p,i)=>[p.id,i?'S':'D'])]);
export const placeSymbols={...Object.fromEntries(heritageWaypoints.map(p=>[p.id,p.symbol])),...Object.fromEntries(neighborhoodPins),market:'M',garage:'G',station:'S',quay:'Q',police:'P',helipad:'H',mooring:'A'};
for(const site of tuningSites)placeSymbols[site.id]='G';
let goal=null,route=[],districtRouter=null,cityRouter=null,origin=null;
const inDistrict=(x,y,margin)=>Math.abs(x-careerPlaces.market.x)<=margin&&Math.abs(y-careerPlaces.market.y)<=margin;
function itinerary(streets,player,target){
  if(inDistrict(player.x,player.y,760)&&inDistrict(target.x,target.y,760)){
    if(!districtRouter){
      const local=streets.filter(r=>r.path.some(([x,y])=>inDistrict(x,y,1400)));
      districtRouter=makeCareerRouter(local);
    }
    const nearby=districtRouter(player,target);
    if(nearby.length)return nearby;
  }
  cityRouter??=makeCareerRouter(streets);
  return cityRouter(player,target);
}
export function setCareerGoal(place){
  if(goal?.id===place?.id)return;
  goal=place;route=[];origin=null;
}
export function careerGoal(){return goal;}
export function paintCareerNavigation(c,player,streets,{px,py,w,h,full,overview}){
  if(goal&&(!origin||Math.hypot(player.x-origin.x,player.y-origin.y)>18)){
    route=itinerary(streets,player,goal);
    origin={x:player.x,y:player.y};
  }
  c.save();
  if(goal&&route.length){
    c.beginPath();c.moveTo(px(player.x),py(player.y));
    for(const p of route)c.lineTo(px(p.x),py(p.y));
    c.lineTo(px(goal.x),py(goal.y));
    c.lineJoin='round';c.lineCap='round';
    c.lineWidth=full?4:5;c.strokeStyle='#46392f';c.stroke();
    c.lineWidth=full?2.2:3;c.strokeStyle='#ffca65';c.stroke();
  }
  const localPlaces=overview?[]:[...Object.values(careerPlaces),...airfields];
  // At region scale the churches and town halls in the same village coincide.
  if(!full||Math.abs(px(100)-px(0))>=24)localPlaces.push(...heritageWaypoints);
  if(!full||Math.abs(px(100)-px(0))>=20)localPlaces.push(...marketServices,...parkingLots,...neighborhoodShops,...railStations,...tuningSites.slice(1));
  const pins=goal?[...localPlaces.filter(p=>p.id!==goal.id),goal]:localPlaces;
  for(const p of pins){
    const active=p.id===goal?.id,r=active?8:6.5;
    let x=px(p.x),y=py(p.y);
    if(!full&&active){x=Math.max(r+2,Math.min(w-r-2,x));y=Math.max(r+2,Math.min(h-r-2,y));}
    if(x<0||x>w||y<0||y>h)continue;
    c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=active?'#ffd583':'#253f41';c.fill();
    c.strokeStyle=active?'#48372c':neighborhoodPins.get(p.id)==='P'?'#a0d6ef':'#ecd8a9';c.lineWidth=1.4;c.stroke();
    c.font='bold '+(r+2)+'px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle=active?'#372e2a':'#fff1cf';
    c.fillText(placeSymbols[p.id]||'•',x,y+.4);
  }
  c.restore();
}
