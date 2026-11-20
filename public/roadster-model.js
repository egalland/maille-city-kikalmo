import {saddles} from './saddle-rider.js';
import {pressedShell,mudguard} from './coachwork.js';
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
  // The steel tank has a narrow knee pocket at the back and broad shoulders
  // over the frame. The saddle drops towards the rider at the front.
  pressedShell(p,[[-.185,.784,.846,.068],[-.107,.741,.932,.118],
    [.042,.714,.998,.196],[.194,.738,1.024,.212],[.311,.779,.993,.174],[.396,.826,.913,.077]],paint);
  for(const side of [-1,1]){
    const stripe=[[-.083,.829,.134],[.041,.889,.198],[.195,.931,.209],[.305,.911,.174]];
    for(let i=1;i<stripe.length;i++){
      const [a,b]=[stripe[i-1],stripe[i]].map(([x,y,z])=>[x,y,side*(z+.004)]);
      rod(p,a,b,.009,cream);
    }
    const badge=[[-.23,.71,side*.104],[-.094,.735,side*.139],[-.035,.706,side*.15],[-.20,.558,side*.112]];
    p.push({kind:'panel',points:side>0?badge.slice().reverse():badge,c:ink});
  }
  pressedShell(p,[[.070,1.002,1.022,.026],[.088,1.009,1.037,.044],[.130,1.011,1.037,.043],[.146,1.005,1.021,.028]],iron);
  const saddle=[[-.64,.778,.832,.071],[-.57,.762,.859,.143],[-.43,.745,.859,.152],
    [-.31,.739,.825,.146],[-.21,.753,.816,.118],[-.127,.784,.824,.076]];
  pressedShell(p,saddle,seat,'yarn');
  for(const side of [-1,1]){
    for(let i=1;i<saddle.length;i++){
      const at=([x,lo,hi,w])=>[x,lo+(hi-lo)*.65,side*w];
      rod(p,at(saddle[i-1]),at(saddle[i]),.007,cream);
    }
  }
  mudguard(p,-.745,.35,.375,.106,157,63,paint);
  pressedShell(p,[[-1.073,.507,.548,.048],[-1.058,.504,.565,.061],[-1.018,.510,.564,.061]],fleetFabric.stop);
  for(const side of [-1,1]){
    rod(f,[.052,.346,side*.098],[-.29,.88,side*.102],.036,iron);
    rod(f,[-.169,.681,side*.10],[-.35,.967,side*.106],.041,paint);
    rod(f,[-.342,.968,side*.106],[-.467,1.055,side*.307],.022,iron);
    rod(f,[-.467,1.055,side*.307],[-.50,1.055,side*.409],.026,seat);
    rod(f,[-.456,1.049,side*.284],[-.378,1.195,side*.345],.012,iron);
    egg(f,[-.380,1.210,side*.346],[.028,.042,.052],iron);
    egg(f,[-.237,.838,side*.154],[.035,.033,.036],brass);
  }
  mudguard(f,.066,.345,.376,.091,143,39,paint);
  pressedShell(f,[[-.367,.91,1.005,.045],[-.307,.863,1.032,.098],
    [-.211,.843,1.055,.12],[-.133,.853,1.042,.117]],ink);
  pressedShell(f,[[-.137,.859,1.037,.114],[-.120,.862,1.034,.111],
    [-.100,.874,1.023,.098]],iron);
  pressedShell(f,[[-.102,.873,1.023,.099],[-.086,.880,1.015,.093],
    [-.073,.901,.996,.074]],fleetFabric.lamp,'glow');
  return {chassis,fork,mount:saddles.motorbike,wheels:[makeWheel(-.745,0,.35,.133,false,true),makeWheel(.756,0,.345,.120,true,true)]};
}
