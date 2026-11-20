// Metre-scale sewing patterns. Both renderers assemble the same open shells around a live seated rig.
import {fleetFabric as yarn} from './vehicle-fabric.js';

export const sportingPaint=Object.freeze({gt:'#8d4b59',supercar:'#43958e'});
const petrol='#304c50', leather='#995f49', lining='#34333e', gold='#e7be78', linen='#efdbad';

function shell(parts,rings,c){parts.push({kind:'shell',rings,c,surface:'yarn'});}
function disc(parts,p,r,width,c){parts.push({kind:'disc',p,r,width,c});}
function panel(parts,points,c,normal,glass=false){
  const [a,b,d]=points,bx=b[0]-a[0],by=b[1]-a[1],bz=b[2]-a[2],dx=d[0]-a[0],dy=d[1]-a[1],dz=d[2]-a[2];
  const forward=(by*dz-bz*dy)*normal[0]+(bz*dx-bx*dz)*normal[1]+(bx*dy-by*dx)*normal[2];
  parts.push({kind:'panel',points:forward<0?points.slice().reverse():points,c,glass});
}
function interpolate(rows,x){
  const i=rows.findIndex(row=>row[0]>=x);
  if(i<=0)return i===0?rows[0]:rows.at(-1);
  const a=rows[i-1],b=rows[i],blend=(x-a[0])/(b[0]-a[0]);
  return a.map((v,k)=>v+(b[k]-v)*blend);
}
function flank(parts,rows,axles,radius,paint){
  const xs=new Set(rows.map(row=>row[0])),well=radius+.06;
  for(const axle of axles)for(let i=0;i<=10;i++)xs.add(axle-well*Math.cos(i*Math.PI/10));
  for(const side of [-1,1]){
    const rings=[...xs].sort((a,b)=>a-b).map(x=>{
      const [,floor,belt,w]=interpolate(rows,x);
      const d=Math.min(...axles.map(axle=>Math.abs(x-axle)));
      const sill=d<=well+.000001?Math.max(floor,radius+Math.sqrt(Math.max(0,well*well-d*d))):floor;
      const shoulder=Math.max(belt,sill+.09),bulge=(sill-floor)*.07;
      const profile=[
        [floor-.035,w*.62],[sill-.020,w-.095],[sill,w-.032],[sill+.034,w+bulge],
        [sill*.42+shoulder*.58,w+bulge*.42],[shoulder-.050,w-.025],
        [shoulder,w-.097],[belt+.005,w*.73],[belt-.060,w*.65],[floor+.07,w*.62]
      ];
      const ring=profile.map(([y,z])=>[x,y,side*z]);
      return side===1?ring.reverse():ring;
    });
    shell(parts,rings,paint);
  }
}
// Stitched body panels terminate at the glass line, leaving the cockpit open down to the carpet.
function deck(parts,stations,c){
  const rings=stations.map(([x,bottom,top,w])=>[
    [x,bottom,-w*.88],[x,top-.049,-w],[x,top-.016,-w*.80],[x,top,-w*.28],
    [x,top,w*.28],[x,top-.016,w*.80],[x,top-.049,w],[x,bottom,w*.88]
  ]);
  shell(parts,rings,c);
}
function cabin(parts,art,body,rows,roofColor,trim){
  const [rear,front]=rows;
  const corner=(row,upper,s)=>[row[upper?3:0],row[upper?4:1],s*row[upper?5:2]];
  for(const [row,facing] of [[rear,-1],[front,1]]){
    const a=corner(row,false,-1),b=corner(row,false,1),c=corner(row,true,1),d=corner(row,true,-1);
    panel(parts,[a,b,c,d],yarn.frontPane,[facing,.5,0],true);
    art.rod(parts,a,b,.019,trim);
    for(const s of [-1,1])art.rod(parts,corner(row,false,s),corner(row,true,s),front===row?.035:.046,body);
  }
  for(const s of [-1,1]){
    const a=corner(rear,false,s),b=corner(front,false,s),c=corner(front,true,s),d=corner(rear,true,s);
    panel(parts,[a,b,c,d],yarn.pane,[0,0,s],true);
    art.rod(parts,a,b,.022,trim);art.rod(parts,d,c,.022,trim);
  }
  deck(parts,[[rear[3]-.06,rear[4]-.025,rear[4]+.032,rear[5]-.04],
    [rear[3]+.14,rear[4]-.021,rear[4]+.085,rear[5]+.018],
    [front[3]-.12,front[4]-.020,front[4]+.066,front[5]+.016],
    [front[3]+.055,front[4]-.021,front[4]+.028,front[5]-.033]],roofColor);
}
function cockpit(parts,art,mount,trim,light){
  const {x,hipY,spacing,wheel,wheelRadius}=mount;
  art.box(parts,[x+.10,hipY-.15,0],[1.43,.070,1.38],lining);
  for(const s of [-1,1]){
    const z=s*spacing;
    art.egg(parts,[x+.07,hipY-.09,z],[.30,.082,.228],trim);
    art.rod(parts,[x-.10,hipY-.04,z],[x-.25,hipY+.32,z],.163,trim);
    art.egg(parts,[x-.25,hipY+.37,z],[.079,.10,.151],trim);
    for(const edge of [-1,1])art.rod(parts,[x+.19,hipY-.015,z+edge*.17],[x-.22,hipY+.26,z+edge*.15],.019,light);
  }
  art.box(parts,[wheel[0]+.215,wheel[1]-.10,0],[.25,.16,1.34],lining);
  art.box(parts,[x+.17,hipY-.03,0],[.61,.135,.14],trim);
  art.rod(parts,[x+.30,hipY,0],[x+.26,hipY+.16,0],.021,yarn.silver);
  art.egg(parts,[x+.26,hipY+.16,0],[.035,.03,.031],light);
  const [cx,cy,cz]=wheel;
  const point=a=>[cx+.044*Math.sin(a),cy+wheelRadius*Math.sin(a),cz+wheelRadius*Math.cos(a)];
  for(let i=0;i<12;i++)art.rod(parts,point(i*Math.PI/6),point((i+1)*Math.PI/6),.016,lining);
  for(const t of [0,Math.PI,Math.PI*1.5])art.rod(parts,wheel,point(t),.014,yarn.silver);
  art.rod(parts,wheel,[cx+.22,cy-.11,cz],.032,lining);
}
function wheels(art,axles,r,track,width,racing){
  return axles.flatMap(x=>[-1,1].map(s=>{
    const wheel=art.section('roue',[x,r,track*s]),p=wheel.parts,z=s*width/2;
    wheel.r=r;wheel.front=x>0;
    disc(p,[0,0,0],r,width,yarn.tyre);
    disc(p,[0,0,z],r*.79,.013,racing?yarn.silver:linen);
    disc(p,[0,0,z+s*.012],r*.70,.012,racing?lining:petrol);
    disc(p,[0,0,z+s*.020],r*.53,.014,racing?'#756d72':'#c3aea0');
    const face=z+s*.035;
    const vertex=(a,d)=>[Math.cos(a)*r*d,Math.sin(a)*r*d,face];
    const blades=racing?6:9;
    for(let i=0;i<blades;i++){
      const a=i*Math.PI*2/blades;
      panel(p,[vertex(a-.22,.24),vertex(a+.09,.26),vertex(a+.30,.72),vertex(a+.12,.72)],racing?yarn.silver:linen,[0,0,s]);
      if(racing)panel(p,[vertex(a+.09,.41),vertex(a+.22,.44),vertex(a+.63,.70),vertex(a+.49,.70)],yarn.silver,[0,0,s]);
    }
    disc(p,[0,0,face+s*.006],r*.23,.016,racing?'#cc6957':gold);
    disc(p,[0,0,face+s*.017],r*.105,.014,lining);
    return wheel;
  }));
}

function meridienne(parts,art,paint){
  const axles=[-1.45,1.45],r=.355;
  flank(parts,[[-2.34,.39,.68,.69],[-2.21,.31,.81,.83],[-1.84,.28,.88,.91],[-1.42,.27,.89,.948],
    [-.87,.26,.82,.911],[.15,.27,.805,.882],[.85,.27,.835,.9],[1.41,.28,.87,.939],[1.99,.32,.79,.854],[2.34,.39,.64,.70]],axles,r,paint);
  deck(parts,[[-2.34,.39,.675,.69],[-2.16,.40,.84,.78],[-1.88,.53,.925,.78],[-1.64,.55,.936,.77]],paint);
  deck(parts,[[.47,.43,.863,.80],[.83,.42,.906,.79],[1.37,.39,.914,.78],[1.94,.39,.822,.76],[2.34,.389,.650,.70]],paint);
  cabin(parts,art,paint,[[-1.65,.908,.778,-.978,1.367,.641],[.48,.861,.794,-.19,1.366,.628]],paint,linen);
  for(const s of [-1,1]){
    // A small fixed rear quarter window sits behind the bright B-pillar.
    art.rod(parts,[-.86,.866,s*.793],[-.86,1.359,s*.651],.023,linen);
    art.rod(parts,[-.86,.789,s*.905],[-.84,.46,s*.915],.012,lining);
    art.rod(parts,[-.84,.46,s*.915],[-.68,.393,s*.921],.012,lining);
    art.rod(parts,[-.68,.393,s*.921],[.55,.393,s*.918],.012,lining);
    art.rod(parts,[.55,.393,s*.918],[.58,.786,s*.906],.012,lining);
    art.rod(parts,[-.71,.716,s*.916],[-.53,.719,s*.916],.023,linen);
    art.rod(parts,[.33,.858,s*.813],[.34,.945,s*.934],.023,yarn.silver);
    art.egg(parts,[.34,.945,s*.949],[.096,.057,.050],paint);
    for(const x of [.72,.81,.90,.99])art.rod(parts,[x,.626,s*.915],[x+.039,.744,s*.905],.014,yarn.silver);
    // Brass piping traces the bonnet seam and the swept rear shoulder.
    art.rod(parts,[.55,.877,s*.535],[1.34,.912,s*.467],.013,gold);
    art.rod(parts,[1.34,.912,s*.467],[2.12,.742,s*.392],.013,gold);
    art.rod(parts,[-2.14,.831,s*.718],[-1.66,.91,s*.781],.015,linen);
    art.egg(parts,[2.208,.688,s*.594],[.082,.113,.145],yarn.silver);
    art.egg(parts,[2.246,.694,s*.61],[.071,.086,.109],yarn.lamp);
    art.egg(parts,[-2.335,.618,s*.527],[.031,.078,.146],yarn.silver);
    art.egg(parts,[-2.355,.619,s*.527],[.027,.053,.121],yarn.stop);
    art.rod(parts,[-2.366,.443,s*.37],[-2.358,.448,s*.655],.027,yarn.silver);
    art.rod(parts,[-2.358,.448,s*.655],[-2.206,.451,s*.837],.027,yarn.silver);
    art.rod(parts,[-.91,.328,s*.903],[.91,.328,s*.896],.017,gold);
  }
  art.egg(parts,[2.302,.485,0],[.047,.123,.49],linen);
  art.egg(parts,[2.329,.49,0],[.030,.103,.452],lining);
  for(let i=-4;i<=4;i++)art.rod(parts,[2.352,.424,i*.084],[2.352,.557,i*.084],.009,gold);
  panel(parts,[[2.035,.795,0],[1.99,.813,-.045],[1.949,.826,0],[1.99,.813,.045]],gold,[0,1,0]);
  art.box(parts,[-2.343,.535,0],[.025,.100,.34],linen);
  for(const z of [-.093,-.028,.046,.102])art.box(parts,[-2.357,.53,z],[.008,.033,.024],lining);

  return {axles,r,track:.82,width:.225,seats3D:{x:-.56,y:.67,spacing:.39,scale:.85,hipY:.42,roof:1.33,wheel:[-.28,.91,-.39],wheelRadius:.145,recline:.26}};
}

function aiguille(parts,art,paint){
  const axles=[-1.4,1.34],r=.339,accent='#df865e';
  flank(parts,[[-2.22,.32,.741,.856],[-1.93,.24,.82,.931],[-1.4,.22,.854,.979],[-.9,.21,.80,.952],
    [-.35,.2,.728,.899],[.43,.20,.655,.885],[.96,.20,.645,.925],[1.33,.21,.701,.953],[1.83,.24,.61,.893],[2.23,.32,.433,.785]],axles,r,paint);
  deck(parts,[[1.205,.275,.719,.82],[1.53,.26,.685,.80],[1.90,.282,.568,.81],[2.23,.312,.437,.778]],paint);
  deck(parts,[[-2.22,.319,.722,.84],[-2.04,.34,.801,.83],[-1.81,.344,.803,.82],[-.60,.415,.787,.79]],lining);
  cabin(parts,art,paint,[[-.63,.785,.774,-.369,1.202,.596],[1.227,.701,.807,.494,1.205,.602]],petrol,'#7aaca1');
  // The ribbed intake, two banks of motor covers and transverse louvers occupy the centre aft of the seats.
  art.box(parts,[-1.34,.827,0],[.98,.07,.81],petrol);
  for(const s of [-1,1]){
    art.egg(parts,[-1.35,.863,s*.249],[.483,.067,.128],'#ae6554');
    for(let x=-1.68;x<-.99;x+=.139)art.rod(parts,[x,.91,s*.173],[x+.035,.918,s*.308],.014,gold);
  }
  for(const x of [-1.82,-1.61,-1.40,-1.19,-.98,-.77])art.rod(parts,[x,.955,-.55],[x,.955,.55],.032,petrol);
  for(const s of [-1,1]){
    const next=(x,y,z)=>[x,y,s*z];
    panel(parts,[next(-1.99,.79,.75),next(-.91,.823,.90),next(-.37,1.19,.604),next(-.85,.96,.64)],paint,[0,1,s]);
    panel(parts,[next(-1.90,.805,.72),next(-.85,.96,.64),next(-.37,1.19,.604),next(-.73,.823,.52)],petrol,[0,1,-s]);
    // Recessed side scoop with an orange edge, ahead of the broad rear arch.
    const face=[next(-1.01,.795,.950),next(-.76,.448,.96),next(-.49,.362,.943),next(.18,.613,.91)];
    panel(parts,face,lining,[0,0,s]);
    art.rod(parts,face[0],face[1],.025,accent);art.rod(parts,face[2],face[3],.016,accent);
    art.rod(parts,[.93,.667,s*.844],[.84,.77,s*.969],.024,lining);
    art.egg(parts,[.82,.776,s*.988],[.109,.043,.052],paint);
    art.rod(parts,[.15,.604,s*.889],[.30,.604,s*.889],.014,yarn.silver);
    art.rod(parts,[-.86,.263,s*.925],[.89,.263,s*.92],.033,petrol);
    // Two tapered embroidered points continue the cockpit tongue onto the low nose.
    const dart=[[1.243,.722,.24,.028],[1.53,.694,.186,.023],[1.90,.577,.137,.015],[2.126,.487,.095,.002]];
    for(let i=1;i<dart.length;i++){
      const [x,y,z,w]=dart[i-1],[xx,yy,zz,ww]=dart[i];
      panel(parts,[next(x,y,z-w),next(x,y,z+w),next(xx,yy,zz+ww),next(xx,yy,zz-ww)],accent,[0,1,0]);
    }
    art.rod(parts,[1.76,.643,s*.747],[2.09,.492,s*.616],.046,lining);
    art.rod(parts,[1.78,.667,s*.753],[2.09,.517,s*.616],.022,yarn.lamp);
    art.rod(parts,[2.09,.517,s*.616],[2.115,.483,s*.423],.021,yarn.lamp);
    art.rod(parts,[-1.95,.82,s*.51],[-2.04,.975,s*.55],.041,lining);
    art.rod(parts,[-2.218,.668,s*.755],[-2.227,.668,s*.19],.028,yarn.stop);
    art.box(parts,[-2.201,.410,s*.493],[.084,.125,.186],yarn.silver);
    art.box(parts,[-2.238,.414,s*.493],[.022,.073,.132],lining);
  }
  deck(parts,[[-2.216,.94,1.002,.89],[-2.045,.965,1.022,.92],[-1.94,.970,1.000,.88]],petrol);
  art.box(parts,[2.222,.335,0],[.045,.056,1.54],lining);
  art.box(parts,[-2.207,.548,0],[.057,.164,1.34],lining);
  for(let i=-2;i<=2;i++)art.box(parts,[-2.14,.285,i*.241],[.18,.135,.029],petrol);
  return {axles,r,track:.864,width:.244,seats3D:{x:.24,y:.54,spacing:.4,scale:.80,hipY:.31,roof:1.15,wheel:[.49,.80,-.4],wheelRadius:.135,recline:.32}};
}

export function createSportingCarRecipe(type,paint,art){
  const chassis=art.section('carrosserie'),racing=type==='supercar';
  const shape=(racing?aiguille:meridienne)(chassis.parts,art,paint);
  cockpit(chassis.parts,art,shape.seats3D,racing?petrol:leather,racing?'#d78765':linen);
  return {chassis,seats3D:shape.seats3D,wheels:wheels(art,shape.axles,shape.r,shape.track,shape.width,racing)};
}
