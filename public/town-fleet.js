import {freightPaint,createFreightRecipe} from './freight-bodies.js';
import {cabinFit} from './cabin-rider.js';
// Metre-scale patterns in the same coordinate system as the wheels and collision boxes.
import {fleetFabric as yarn} from './vehicle-fabric.js';
export const townFleetPaint=Object.freeze({estate:'#556f82',camper:'#719a83',flatbed:'#a05a46',...freightPaint});
const wool='#e7d2a6',umber='#655347',wood='#b28051';

function panel(parts,points,c,glass=false){parts.push({kind:'panel',points,c,glass});}
function hull(parts,stations,paint,opening){
  if(opening){
    stations=[...stations];
    for(const x of opening){
      const i=stations.findIndex(s=>s[0]>x);
      if(i<1||stations[i-1][0]===x)continue;
      const a=stations[i-1],b=stations[i],t=(x-a[0])/(b[0]-a[0]);
      stations.splice(i,0,a.map((v,k)=>k===0?x:v+(b[k]-v)*t));
    }
  }
  const rings=stations.map(([x,base,top,width])=>[
    [x,base,-width*.79],[x,base+.085,-width],[x,top-.072,-width],[x,top,-width*.89],
    [x,top,width*.89],[x,top-.072,width],[x,base+.085,width],[x,base,width*.79]
  ]);
  for(let i=1;i<rings.length;i++){
    const prev=rings[i-1],next=rings[i];
    for(let j=0;j<8;j++){
      if(j===3&&opening&&stations[i-1][0]>=opening[0]&&stations[i][0]<=opening[1])continue;
      const k=(j+1)%8;panel(parts,[prev[j],prev[k],next[k],next[j]],paint);
    }
  }
  panel(parts,rings[0].slice().reverse(),paint);panel(parts,rings.at(-1),paint);
}
// A real open interior. The fine pillars surround translucent glazing on all four sides.
function cabin(parts,art,{rear,front,sill,roof,z,inset,rearRake,frontRake,splits},paint){
  const bottom=(u,side)=>[rear+(front-rear)*u,sill,side*z];
  const upper=(u,side)=>[rear+rearRake+(front-frontRake-rear-rearRake)*u,roof,side*(z-inset)];
  const stations=[0,...splits,1];
  for(const s of [-1,1]){
    for(let i=1;i<stations.length;i++){
      const a=stations[i-1],b=stations[i];
      panel(parts,[bottom(a,s),bottom(b,s),upper(b,s),upper(a,s)],yarn.pane,true);
    }
    for(const u of stations)art.rod(parts,bottom(u,s),upper(u,s),u===0||u===1?.045:.031,paint);
    art.rod(parts,bottom(0,s),bottom(1,s),.025,wool);
    art.rod(parts,upper(0,s),upper(1,s),.029,yarn.binding);
  }
  art.box(parts,[(rear+front)/2,sill-.29,0],[front-rear,.070,z*1.74],yarn.welt);
  for(const u of [0,1]){
    const a=bottom(u,-1),b=bottom(u,1),c=upper(u,1),d=upper(u,-1);
    panel(parts,[a,d,c,b],yarn.frontPane,true);
    // A short embroidered reflection keeps the glass legible in the software view as well.
    const point=(across,height)=>a.map((v,k)=>(v*(1-across)+b[k]*across)*(1-height)+(d[k]*(1-across)+c[k]*across)*height);
    art.rod(parts,point(.68,.62),point(.78,.89),.011,yarn.gleam);
    art.rod(parts,point(.76,.72),point(.80,.83),.007,yarn.gleam);
  }
  hull(parts,[[rear+rearRake-.10,roof-.046,roof+.107,z-inset-.08],
    [rear+rearRake+.12,roof-.045,roof+.14,z-inset+.04],
    [front-frontRake-.10,roof-.045,roof+.14,z-inset+.04],
    [front-frontRake+.12,roof-.045,roof+.10,z-inset-.08]],wool);
}

function frontRear(parts,{box,egg,rod},half,wide,frontLight,rearLight,commercial=false){
  for(const side of [-1,1]){
    for(const sign of [-1,1]){
      const hue=sign>0?yarn.lamp:yarn.stop,at=sign*(half-.12);
      egg(parts,[at,sign>0?frontLight:rearLight,side*wide*.71],[.066,.087,.13],yarn.ink);
      egg(parts,[at+sign*.048,sign>0?frontLight:rearLight,side*wide*.71],[.056,.068,.105],hue);
    }
  }
  for(const sign of [-1,1]){
    box(parts,[sign*(half-.06),.44,0],[.12,.115,wide*1.73],yarn.silver);
    box(parts,[sign*(half+.006),.47,0],[.023,.14,.36],wool);
  }
  box(parts,[half-.139,frontLight-.013,0],[.07,.18,.55],yarn.ink);
  for(let k=-2;k<=2;k++)rod(parts,[half-.098,frontLight-.062,k*.10],[half-.098,frontLight+.045,k*.10],.013,commercial?yarn.silver:yarn.brass);
}
function upholstery(parts,art,mount,type){
  const {x,y,spacing,wheel,radius}=cabinFit(type,mount),scale=1;
  for(const s of [-1,1]){
    const z=s*spacing;
    art.egg(parts,[x-.18,y+.18*scale,z],[.083,.21*scale,.20*scale],umber);
    art.egg(parts,[x-.22,y+.40*scale,z],[.067,.075,.13*scale],umber);
    art.box(parts,[x,y-.065,z],[.38,.09,.37],umber);
  }
  art.box(parts,[x+.38*scale,y+.36,0],[.18,.17,spacing*3.65],yarn.ink);
  for(let i=0;i<12;i++){
    const rim=t=>[wheel[0]-.32*radius*Math.sin(t),wheel[1]+.948*radius*Math.sin(t),wheel[2]+radius*Math.cos(t)];
    art.rod(parts,rim(i*Math.PI/6),rim((i+1)*Math.PI/6),.018,yarn.ink);
  }
}
function doors(parts,art,from,to,sill,halfZ,paint){
  for(const side of [-1,1]){
    const z=side*halfZ;
    for(const x of [from,to])art.rod(parts,[x,.57,z],[x,sill,z],.011,yarn.welt);
    art.rod(parts,[from+.09,sill-.115,z+side*.012],[from+.28,sill-.115,z+side*.012],.022,yarn.silver);
    art.rod(parts,[to-.17,sill-.015,z],[to-.14,sill+.09,z+side*.105],.025,paint);
    art.egg(parts,[to-.14,sill+.10,z+side*.12],[.089,.067,.040],yarn.binding);
  }
}
function estate(parts,art,paint){
  hull(parts,[[-2.22,.44,.88,.72],[-2.08,.34,1.02,.87],[-1.67,.32,1.06,.915],
    [.79,.32,1.06,.915],[1.63,.35,.98,.89],[2.20,.45,.84,.75]],paint,[-1.96,.92]);
  cabin(parts,art,{rear:-1.96,front:.92,sill:1.03,roof:1.54,z:.83,inset:.11,rearRake:.21,frontRake:.46,splits:[.30,.56]},paint);
  doors(parts,art,-.41,.80,1.00,.918,paint);
  art.box(parts,[-1.50,.832,0],[.77,.070,1.38],umber);
  art.egg(parts,[-.87,1.03,0],[.097,.23,.63],umber);
  for(const side of [-1,1]){
    const z=side*.92;
    art.rod(parts,[-1.28,1.01,z],[-1.24,.72,z],.013,yarn.welt);
    art.rod(parts,[-1.24,.72,z],[-1.09,.55,z],.013,yarn.welt);
    art.rod(parts,[-1.08,.55,z],[.79,.55,z],.014,yarn.welt);
    art.rod(parts,[-1.15,.918,z],[-.96,.918,z],.022,yarn.silver);
  }
  for(const s of [-1,1]){
    art.rod(parts,[-2.00,.78,s*.91],[1.7,.78,s*.902],.024,yarn.brass);
    for(const x of [-1.53,-.08]){
      art.rod(parts,[x,1.66,s*.53],[x,1.747,s*.54],.024,yarn.ink);
      art.rod(parts,[x,1.747,-.56],[x,1.747,.56],.022,yarn.silver);
    }
    art.rod(parts,[-1.66,1.76,s*.54],[.10,1.76,s*.54],.022,yarn.silver);
    for(let x=-1.82;x<1.55;x+=.34)art.rod(parts,[x,.805,s*.912],[x+.09,.805,s*.912],.010,wool);
  }
  return {seats3D:{x:.07,y:.997,spacing:.36,scale:.92},axles:[-1.39,1.41],track:.79,r:.335,
    half:2.29,wide:.92,frontY:.79,rearY:.83};
}
function camper(parts,art,paint){
  hull(parts,[[-2.24,.48,1.02,.77],[-2.13,.35,1.17,.932],[-1.81,.32,1.18,.954],
    [1.65,.32,1.18,.954],[2.02,.39,1.12,.934],[2.24,.47,.94,.73]],paint,[-2.08,2.1]);
  cabin(parts,art,{rear:-2.08,front:2.10,sill:1.15,roof:1.92,z:.883,inset:.09,rearRake:.12,frontRake:.33,splits:[.29,.51,.68]},wool);
  doors(parts,art,.60,1.97,1.13,.935,paint);
  art.box(parts,[-1.62,1.02,0],[.46,.19,1.34],'#ae785f');
  art.box(parts,[-1.77,1.23,0],[.14,.37,1.34],'#ae785f');
  for(const s of [-1,1]){
    const z=.956*s;
    panel(parts,[[-1.86,.975,z],[1.68,.975,z],[1.68,1.145,z],[-1.86,1.145,z]],wool);
    // The nose has a woven chevron continuing the belt below the windows.
    panel(parts,[[2.095,1.112,s*.859],[2.255,.928,s*.68],[2.252,.793,0],[2.245,.966,0]],wool);
    for(let j=0;j<5;j++)art.rod(parts,[-1.92+j*.095,.66,z],[-1.89+j*.095,.80,z],.015,yarn.welt);
  }
  // Folding canvas bellows below the pop-top. Three contrasting cords give the roof its pleated profile.
  hull(parts,[[-1.65,2.035,2.20,.55],[-1.52,2.035,2.26,.65],[.58,2.035,2.22,.65],[.74,2.035,2.19,.54]],'#ad765a');
  for(const s of [-1,1]){
    for(let i=0;i<2;i++)art.rod(parts,[-1.48,2.08+i*.060,s*.652],[.54,2.08+i*.050,s*.652],.013,wool);
    art.rod(parts,[-2.02,1.09,s*.942],[1.95,1.09,s*.943],.034,wool);
    for(const x of [-1.91,-.98,-.75,.02]){
      const direction=x===-1.91||x===-.75?1:-1;
      panel(parts,[[x,1.22,s*.85],[x+.14*direction,1.47,s*.85],[x+.27*direction,1.86,s*.82],[x,1.86,s*.82]],'#ccaa78');
      art.rod(parts,[x+.023*direction,1.49,s*.866],[x+.14*direction,1.49,s*.866],.012,yarn.ink);
    }
  }
  art.rod(parts,[1.79,1.91,0],[2.09,1.15,0],.025,wool);
  return {seats3D:{x:1.32,y:1.23,spacing:.39,scale:.98},axles:[-1.37,1.43],track:.84,r:.36,
    half:2.33,wide:.96,frontY:.81,rearY:.86};
}
function flatbed(parts,art,paint){
  const {box,rod,egg}=art;
  hull(parts,[[-2.69,.52,.74,.56],[-2.47,.43,.76,.84],[2.38,.43,.76,.84],[2.62,.51,.76,.64]],yarn.ink);
  hull(parts,[[.25,.55,1.29,.80],[.41,.47,1.34,.99],[2.28,.48,1.34,.99],[2.69,.63,1.19,.81]],paint,[.34,2.58]);
  cabin(parts,art,{rear:.34,front:2.58,sill:1.32,roof:2.04,z:.916,inset:.09,rearRake:.035,frontRake:.32,splits:[.30]},paint);
  doors(parts,art,.50,2.33,1.31,.962,paint);
  box(parts,[2.695,.92,0],[.056,.36,.87],yarn.ink);
  for(let i=0;i<4;i++)box(parts,[2.728,.81+i*.072,0],[.024,.025,.81],yarn.silver);
  for(const s of [-1,1]){
    box(parts,[1.33,.46,s*.994],[.93,.09,.14],yarn.ink);
    for(const x of [1.03,1.61])rod(parts,[x,.51,s*.92],[x,.43,s*1.01],.035,yarn.silver);
  }
  for(let i=0;i<7;i++)box(parts,[-1.25,.84,(i-3)*.272],[2.80,.145,.259],i%2?wood:'#c79366');
  for(const side of [-1,1]){
    box(parts,[-1.23,.80,side*.977],[2.98,.17,.105],paint);
    for(const x of [-2.47,-1.55,-.55,-.03])box(parts,[x,1.02,side*.975],[.072,.44,.065],yarn.silver);
    rod(parts,[-2.48,1.12,side*.977],[-.03,1.12,side*.977],.024,yarn.silver);
  }
  // Two oversized lengthwise wool drums, cradled and lashed to the load bed.
  for(const [x,r,c] of [[-1.96,.474,'#678f88'],[-.70,.544,'#bd8065']]){
    const y=.915+r,length=1.19;
    for(const side of [-1,1]){
      box(parts,[x+side*r*.74,1.005,0],[.16,.18,1.3],umber);
      for(const z of [-.43,.43])rod(parts,[x+side*(r+.13),.919,z],[x+side*r*.72,y+r*.72,z],.021,yarn.brass);
      parts.push({kind:'disc',p:[x,y,side*(length/2+.035)],r:r+.045,width:.076,c:wood});
      parts.push({kind:'disc',p:[x,y,side*(length/2+.087)],r:r*.22,width:.038,c:yarn.ink});
    }
    parts.push({kind:'disc',p:[x,y,0],r,width:length,c});
    for(let i=0;i<7;i++)parts.push({kind:'disc',p:[x,y,(i-3)*.154],r:r+.009,width:.036,c:i%2?c:yarn.binding});
  }
  for(const x of [-2.60,-1.0,-.15])egg(parts,[x,.734,.992],[.054,.026,.012],yarn.lamp);
  return {seats3D:{x:1.50,y:1.405,spacing:.40,scale:1.02},axles:[-1.63,1.82],track:.896,r:.435,
    half:2.75,wide:1.01,frontY:1.04,rearY:.77};
}
const patterns={estate,camper,flatbed};
export function createTownCarRecipe(type,paint,art){
  if(Object.hasOwn(freightPaint,type))return createFreightRecipe(type,paint,{...art,hull,cabin,upholstery});
  const chassis=art.section('carrosserie');
  const shape=patterns[type](chassis.parts,art,paint);
  upholstery(chassis.parts,art,shape.seats3D,type);
  frontRear(chassis.parts,art,shape.half,shape.wide,shape.frontY,shape.rearY,type==='flatbed');
  const wheels=shape.axles.flatMap(x=>[-1,1].map(side=>art.makeWheel(x,side*shape.track,shape.r,.19,x>0,false)));
  return {chassis,wheels,seats3D:shape.seats3D};
}
