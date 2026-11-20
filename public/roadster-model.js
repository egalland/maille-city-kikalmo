import {saddles} from './saddle-rider.js';
import {fleetFabric} from './vehicle-fabric.js';

const {ink,thread:cream,brass,silver:iron,tyre:rubber}=fleetFabric;
const seat='#694b46';
export function roadsterRecipe(paint,{section,egg,disc,box,rod,makeWheel}){
  const chassis=section('carrosserie'),fork=section('guidon',[.69,0,0]),p=chassis.parts,f=fork.parts;
  // A triangulated open roadster frame and toothed, exposed V-twin.
  for(const s of [-1,1]){
    const z=s*.095;
    const back=[-.75,.34,z],saddle=[-.38,.75,z],engine=[-.075,.325,z],neck=[.39,.87,z];
    for(const [a,b] of [[back,saddle],[back,engine],[saddle,engine],[saddle,neck],[engine,neck]])rod(p,a,b,.032,ink);
    rod(p,[back[0],back[1],s*.114],[-.455,.653,s*.122],.034,iron);
    for(let n=0;n<5;n++)rod(p,[-.605+n*.027,.48+n*.030,s*.126],[-.58+n*.027,.492+n*.03,s*.135],.022,cream);
    rod(p,[-.17,.385,s*.095],[-.245,.405,s*.227],.023,iron);
    box(p,[-.23,.399,s*.215],[.100,.025,.054],rubber);
    rod(p,[.055,.477,s*.115],[.20,.318,s*.151],.036,brass);
    rod(p,[.20,.318,s*.151],[-.53,.31,s*.172],.032,iron);
    rod(p,[-.53,.31,s*.175],[-.94,.398,s*.188],.062,iron);
    disc(p,[-.06,.397,s*.142],.123,.041,s===1?iron:brass);
  }
  for(const [x,dir] of [[-.20,-1],[.08,1]]){
    rod(p,[-.056,.419,0],[x,.655,0],.111,'#635b61');
    for(let n=0;n<4;n++)box(p,[x-dir*(3-n)*.016,.549+n*.027,0],[.193,.014,.283],n%2?iron:ink);
  }
  egg(p,[.136,.832,0],[.296,.164,.190],paint);
  egg(p,[.134,.852,0],[.245,.093,.198],cream);
  egg(p,[.126,.859,0],[.240,.11,.202],paint);
  egg(p,[.10,.987,0],[.048,.019,.05],brass);
  egg(p,[-.325,.771,0],[.25,.069,.149],cream);
  egg(p,[-.33,.796,0],[.25,.055,.155],seat);
  for(let i=0;i<5;i++)rod(p,[-.47+i*.062,.836,-.100],[-.47+i*.062,.836,.100],.006,cream);
  egg(p,[-.77,.696,0],[.30,.050,.115],paint);
  egg(p,[-.997,.654,0],[.050,.040,.066],fleetFabric.stop);
  for(const side of [-1,1]){
    rod(f,[.052,.346,side*.098],[-.29,.88,side*.102],.036,iron);
    rod(f,[-.169,.681,side*.10],[-.35,.967,side*.106],.041,paint);
    rod(f,[-.342,.968,side*.106],[-.467,1.055,side*.307],.022,iron);
    rod(f,[-.467,1.055,side*.307],[-.50,1.055,side*.409],.026,seat);
    rod(f,[-.456,1.049,side*.284],[-.378,1.195,side*.345],.012,iron);
    egg(f,[-.380,1.210,side*.346],[.028,.042,.052],iron);
    egg(f,[-.237,.838,side*.154],[.035,.033,.036],brass);
  }
  egg(f,[.026,.685,0],[.305,.061,.115],paint);
  egg(f,[-.225,.943,0],[.129,.119,.129],ink);
  egg(f,[-.120,.949,0],[.070,.097,.106],brass);
  egg(f,[-.081,.949,0],[.044,.080,.089],fleetFabric.lamp);
  return {chassis,fork,mount:saddles.motorbike,wheels:[makeWheel(-.745,0,.35,.133,false,true),makeWheel(.756,0,.345,.120,true,true)]};
}
