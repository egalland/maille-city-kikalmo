import * as T from './three.js';
import {puppetKnit} from './puppet-material.js';
import {itemDyes} from './kikalmo-dyes.js';

const sphere=new T.SphereGeometry(1,14,10),tiny=new T.SphereGeometry(1,10,7);
const box=new T.BoxGeometry(2,2,2),ringGeo=new T.TorusGeometry(1,.13,8,25);
const cylinder=new T.CylinderGeometry(1,1,2,18),cone=new T.ConeGeometry(1,2,18);
const diamond=new T.OctahedronGeometry(1),up=new T.Vector3(0,1,0);
const caches=new Map(),dyes=new Map();
const fabrics={
  48:['#662f36','#e39145','pumpkin'],49:['#332745','#b6a8d3','star'],
  74:['#9c3c42','#efd3a0','jacquard'],75:['#365c4e','#b3ce8d','tree'],
  76:['#e9cbbb','#b64454','stripe'],77:['#3b526c','#e1e9e2','snow'],
  78:['#a36645','#eed5ad','button'],79:['#e2dbbb','#bc8e50','star']
};
export function yarn(color){
  if(!dyes.has(color))dyes.set(color,new T.MeshLambertMaterial({color,map:puppetKnit()}));
  return dyes.get(color);
}
function piece(parent,geo,dye,x,y,z,sx,sy,sz){
  const mesh=new T.Mesh(geo,yarn(dye));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
}
export function ball(parent,dye,x,y,z,sx,sy,sz){return piece(parent,sphere,dye,x,y,z,sx,sy,sz);}
const bead=(group,dye,x,y,z,sx,sy,sz)=>piece(group,tiny,dye,x,y,z,sx,sy,sz);
const tile=(group,dye,x,y,z,sx,sy,sz)=>piece(group,box,dye,x,y,z,sx,sy,sz);
const gem=(group,dye,x,y,z,sx,sy,sz)=>piece(group,diamond,dye,x,y,z,sx,sy,sz);
function ring(g,dye,x,y,z,sx,sy,sz,flat=false){
  const m=piece(g,ringGeo,dye,x,y,z,sx,sy,sz);
  if(flat)m.rotation.x=Math.PI/2;else m.rotation.y=Math.PI/2;
  return m;
}
function stem(g,dye,from,to,radius,taper=false){
  const a=new T.Vector3(...from),b=new T.Vector3(...to),d=b.clone().sub(a),p=a.lerp(b,.5);
  const m=piece(g,taper?cone:cylinder,dye,p.x,p.y,p.z,radius,d.length()/2,radius);
  m.quaternion.setFromUnitVectors(up,d.normalize());return m;
}
function braid(g,dye,points,radius){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  const mesh=new T.Mesh(new T.TubeGeometry(curve,points.length*4,radius,6),yarn(dye));g.add(mesh);return mesh;
}
const eachSide=fn=>{fn(-1);fn(1);};
const ink='#251e2d',gold='#d4ae69',linen='#f6e1bd';
export function colorsFor(id){
  if(id===163)return ['#2b1844','#63427b'];
  if(id===91)return ['#3e2054','#a76db6'];
  if(id===121)return ['#30273b','#ba9862'];
  return fabrics[id]||itemDyes[id]||['#665375','#d1b086'];
}
function keyByGroup(groups){
  return Object.fromEntries(Object.entries(groups).flatMap(([style,ids])=>ids.map(id=>[id,style])));
}
const headwear=keyByGroup({
  beret:[1,2],beanie:[3,4,62,63],topHat:[5,65,216],feltHat:[6,220],pirate:[7,8,204],
  antenna:[9,10],headphones:[11,12],crown:[17,18,64,200,208,210,218,226],halo:[19,20],
  wizard:[21,22,42,45],stocking:[58,59,60],antlers:[61],veil:[202],goggles:[206,214,224],
  foxMask:[212],jester:[222]
});
const adornment=keyByGroup({
  star:[13,71],heart:[14,70],bow:[15,16,43,69],constellation:[23,24,47,72,73],pumpkin:[44,46],
  snow:[66],candy:[67],gift:[68],drone:[201,215,225],compass:[203],parrot:[205],gear:[207],
  beetle:[209],raven:[211],lantern:[213],bat:[217],jelly:[219],brooch:[221],cards:[223],book:[227]
});
const suitStyles=keyByGroup({
  helmet:[25,26,28,29,32,101,120,122,125,131,133,149,157],
  creature:[27,30,41,52,56,93,139,145,146,232],
  nature:[31,39,53,54,55,118,138,230],
  hood:[40,50,98,99,100,102,104,107,108,109,110,111,114,123,124,127,135,136,143,159,233],
  regal:[57,92,97,105,112,113,116,117,119,121,128,132,134,137,140,144,147,148,152,160,161],
  hat:[103,106,115,126,129,130,141,142,150,151,153,154,156,158,162],
  carnival:[51,155,164,231,234],sunbird:[90],dragon:[91],abyss:[163]
});

const headShapes=[
  [.227,.275,.221], [.220,.313,.206], [.231,.297,.207],
  [.218,.273,.249], [.235,.272,.242], [.225,.281,.205]
];
const hairDyes=['#57332c','#793b24','#9d7141','#492d32','#473649','#a58e66','#674739','#3a252b'];
const eyeDyes=['#542d64','#4a8193','#446b61','#675040','#324f53','#896648'];
const irisPremium={36:'#50bac5',37:'#a278c5',38:'#498f5e'};
const shirtDyes=[
  ['#9f7756','#dfb473'],['#3d6c68','#7aba97'],['#6d506e','#ad84a2'],
  ['#354f73','#819fc4'],['#864a43','#d88366'],['#596858','#9db478']
];

function hair(g,style,primary,trim){
  if(!style)return;
  if(style===33||style===35){
    ball(g,primary,-.095,.16,0,.207,.195,.248);
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5;
      bead(g,i%3?primary:trim,Math.cos(a)*.147-.067,.204+Math.sin(i*2)*.037,Math.sin(a)*.211,.087,.085,.087);
    }
  }else if(style===34){
    ball(g,primary,-.096,.16,0,.173,.162,.215);
    eachSide(s=>{for(let i=0;i<3;i++){
      const x=.074-i*.089,z=s*(.195+.009*i);
      braid(g,i===2?trim:primary,[[x,.235,z*.71],[x+.024,.09,z],[x-.018,-.035,z*1.10],[x-.067,-.177,z*.92]],.023);
    }});
  }else{
    ball(g,primary,-.081,.155,0,.171,.159,.215);
    for(let i=0;i<4;i++){
      const z=(i-1.5)*.102,high=.268+(style%3)*.014;
      braid(g,i===1?trim:primary,[[-.106,.139,z*.87],[-.09,high,z],[.075,high+.018,z+.034],[.16,.183,z+.061]],.044);
    }
    if(style===4||style===6)ball(g,primary,-.212,.124,0,.087,.123,.109);
    if(style===5)eachSide(s=>ball(g,primary,-.077,-.022,.198*s,.085,.158,.060));
  }
}
function face(g,a,suit,masked){
  const [d,h,w]=headShapes[a.shape],skin=a.color;
  const head=ball(g,skin,0,0,0,d,h,w);
  head.name='kikalmo-head-volume';
  eachSide(s=>{
    ball(g,skin,-.027,-.023,w*.96*s,.064,.066,.046);
    if(masked)return;
    const x=d*.912,z=.089*s,y=.041+(a.eyes%3)*.013;
    const ir=irisPremium[a.premiumEyes]||eyeDyes[a.eyes];
    ball(g,linen,x,y,z,.048,.050+(a.eyes===0?.012:0),.053);
    bead(g,ir,x+.035,y-.005,z+.005*s,.023,.032,.029).name=a.premiumEyes?'kikalmo-premiumEyes-'+a.premiumEyes:'kikalmo-iris';
    bead(g,ink,x+.049,y-.005,z+.006*s,.014,.023,.019);
    bead(g,'#fff6e1',x+.061,y+.006,z-.003*s,.009,.010,.010);
    const brow=hairDyes[a.hair],tilt=a.eyes===4?-.022:.014;
    braid(g,brow,[[x-.011,y+.075,z-.036],[x+.009,y+.086,z],[x-.012,y+.071+tilt,z+.044]],.014);
  });
  if(!masked){
    const n=a.nose,lip=a.mouth,y=-.109-(a.shape===1?.026:0);
    if(n!==0)ball(g,skin,d+.022,-.032,0,.045+.003*n,.030+n%3*.006,.032+n%4*.005);
    braid(g,'#593638',[[d-.018,y+.012,-.058-lip*.004],[d+.005,y-(lip%3)*.012,0],[d-.018,y+.012,.058+lip*.004]],.010);
    if(lip===3||lip===5)bead(g,linen,d+.005,y-.001,0,.015,.010,.040);
  }
  if(!suit&&(!a.headwear||['headphones','halo','antenna','goggles','antlers'].includes(headwear[a.headwear]))){
    const [primary,trim]=a.premiumHair?colorsFor(a.premiumHair):[hairDyes[a.hair],hairDyes[(a.hair+2)%8]];
    const locks=new T.Group();locks.name=a.premiumHair?'kikalmo-premiumHair-'+a.premiumHair:'kikalmo-hair';
    hair(locks,a.premiumHair||a.hair,primary,trim);g.add(locks);
  }
  if(!masked&&a.accessory){
    if(a.accessory<=3)goggles(g,a.accessory===2?'#7a4356':ink,gold,false);
    else if(a.accessory===4)eachSide(s=>ring(g,gold,-.023,-.09,w*s,.05,.049,.08));
    else if(a.accessory===5)braid(g,linen,[[d+.003,-.075,-.058],[d+.026,-.071,0],[d+.003,-.075,.058]],.021);
    else bead(g,gold,d-.024,-.073,w*.64,.024,.019,.026);
  }
}
function crown(g,dye,trim,style){
  ring(g,dye,-.025,.251,0,.217,.082,.231,true);
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,x=Math.cos(angle)*.205-.023,z=Math.sin(angle)*.214;
    stem(g,dye,[x,.244,z],[x*1.12,.305+(i%2)*.045,z*1.09],.029,true);
    if(i%2===0)gem(g,trim,x,.305,z,.026,.046,.027);
  }
  gem(g,trim,.199,.287,0,.039,.073,.051);
  if(style===18||style===226)ring(g,trim,.236,.376,0,.042,.057,.047);
}
function goggles(g,dye,trim,tinted){
  eachSide(s=>{
    if(tinted)ball(g,trim,.209,.075,.092*s,.052,.064,.070);
    ring(g,dye,.240,.073,.096*s,.072,.061,.071);
    braid(g,dye,[[.212,.075,.157*s],[.11,.09,.215*s],[-.09,.079,.210*s]],.016);
  });
  stem(g,dye,[.235,.078,-.054],[.235,.078,.054],.013);
}
function hat(g,type,dye,trim,id){
  switch(type){
    case 'beret':
      ball(g,dye,-.019,.268,0,.250,.107,.262).rotation.x=.13;
      ring(g,trim,-.014,.214,0,.205,.064,.218,true);bead(g,trim,-.033,.377,0,.026,.025,.024);break;
    case 'beanie':
      ball(g,dye,-.024,.234,0,.225,.152,.230);
      ring(g,trim,-.017,.170,0,.214,.112,.223,true);bead(g,trim,-.029,.397,0,.045,.042,.046);break;
    case 'topHat':
      piece(g,cylinder,dye,-.025,.403,0,.176,.151,.188);
      ball(g,dye,-.012,.264,0,.259,.046,.256);
      ring(g,trim,-.025,.304,0,.174,.104,.183,true);break;
    case 'feltHat':
      ball(g,dye,-.028,.252,0,.262,.053,.267);
      ball(g,dye,-.06,.313,0,.189,.109,.195);
      ring(g,trim,-.056,.291,0,.174,.065,.182,true);
      if(id===220)ball(g,ink,.145,.235,0,.15,.026,.188);
      break;
    case 'pirate':
      ball(g,dye,-.033,.299,0,.189,.140,.216);
      eachSide(s=>ball(g,dye,.022,.274,.151*s,.245,.074,.137).rotation.x=-s*.64);
      braid(g,trim,[[.028,.339,-.249],[.17,.314,-.13],[.201,.286,0],[.17,.314,.13],[.028,.339,.249]],.014);
      gem(g,linen,.19,.337,0,.026,.056,.050);break;
    case 'antenna':
      eachSide(s=>{
        braid(g,dye,[[-.058,.22,.116*s],[-.033,.34,.126*s],[.037,.437,.194*s]],.019);
        bead(g,trim,.037,.437,.194*s,.051,.042,.045);
      });break;
    case 'headphones':
      braid(g,dye,[[-.035,.034,-.213],[-.052,.264,-.166],[-.049,.325,0],[-.052,.264,.166],[-.035,.034,.213]],.023);
      eachSide(s=>{ball(g,dye,-.021,.018,.225*s,.083,.093,.048);ball(g,trim,-.015,.019,.256*s,.061,.071,.020);});break;
    case 'halo':ring(g,trim,-.013,.422,0,.248,.090,.246,true);break;
    case 'wizard':
      ball(g,dye,-.040,.258,0,.290,.037,.292);
      stem(g,dye,[-.048,.248,0],[-.158,.637,.038],.190,true);
      ring(g,trim,-.066,.307,0,.149,.092,.158,true);
      gem(g,trim,.096,.341,0,.024,.041,.041);break;
    case 'stocking':
      ball(g,dye,-.04,.251,0,.221,.129,.228);
      ring(g,linen,-.027,.189,0,.211,.111,.221,true);
      stem(g,dye,[-.06,.272,0],[-.164,.487,.060],.150,true);
      bead(g,trim,-.167,.486,.068,.060,.056,.061);break;
    case 'antlers':
      eachSide(s=>{
        const root=[-.068,.210,.114*s],tip=[-.098,.573,.235*s];
        braid(g,dye,[root,[-.104,.37,.210*s],tip],.032);
        stem(g,trim,[-.102,.377,.207*s],[.011,.481,.257*s],.029,true);
        stem(g,dye,[-.106,.459,.235*s],[-.191,.535,.279*s],.024,true);
      });break;
    case 'veil':
      ball(g,dye,-.077,.208,0,.180,.114,.229);
      ball(g,dye,-.188,.039,0,.079,.279,.225);
      braid(g,trim,[[.078,.192,-.201],[.156,.228,0],[.078,.192,.201]],.023);break;
    case 'goggles':goggles(g,dye,trim,true);break;
    case 'foxMask':
      ball(g,linen,.123,.246,0,.058,.098,.147).rotation.z=-.29;
      eachSide(s=>{stem(g,linen,[.086,.285,.096*s],[.049,.424,.136*s],.057,true);gem(g,trim,.172,.253,.078*s,.015,.033,.036);});break;
    case 'crown':crown(g,dye,trim,id);break;
    case 'jester':jester(g,dye,trim);break;
  }
}
function jester(g,dye,trim){
  ball(g,dye,-.071,.223,0,.195,.139,.227);
  eachSide(s=>{
    braid(g,dye,[[.004,.229,.134*s],[-.033,.354,.222*s],[-.087,.341,.307*s],[-.092,.218,.339*s]],.064);
    bead(g,trim,-.089,.197,.342*s,.042,.043,.041);
  });
  gem(g,trim,.116,.319,0,.044,.070,.048);
}
function mask(g,dye,trim,id){
  const base=id===96?'#9d493d':id===95?'#d7b795':'#eadab9';
  ball(g,base,.187,-.012,0,.090,.188,.177);
  eachSide(s=>{
    braid(g,ink,[[.249,.058,.031*s],[.264,.079,.092*s],[.230,.060,.137*s]],.020);
    braid(g,id===96?trim:ink,[[.254,-.049,.016*s],[.254,-.073,.076*s],[.229,-.042,.128*s]],.017);
    bead(g,id===96?linen:dye,.227,-.049,.120*s,.038,.034,.035);
  });
  bead(g,base,.274,-.015,0,.044,.041,.030);
  gem(g,trim,.234,.139,0,.021,.062,.030);
}
function badge(g,type,dye,trim,id){
  const x=.214,y=-.082,z=.145;
  switch(type){
    case 'star':case 'snow':
      bead(g,trim,x,y,z,.027,.058,.056);
      for(let i=0;i<(type==='star'?5:6);i++){
        const a=i*Math.PI*2/(type==='star'?5:6);
        stem(g,dye,[x+.014,y,z],[x+.014,y+Math.cos(a)*.092,z+Math.sin(a)*.092],.022,true);
      }break;
    case 'heart':
      eachSide(s=>ball(g,dye,x,y+.021,z+.032*s,.038,.049,.048));
      gem(g,dye,x,y-.036,z,.048,.065,.061);break;
    case 'bow':
      eachSide(s=>ball(g,dye,x,y+.018*s,z+.066*s,.039,.049,.074).rotation.x=s*.43);
      bead(g,trim,x+.025,y,z,.043,.034,.033);break;
    case 'constellation':
      for(let i=0;i<5;i++)gem(g,i%2?trim:dye,x+.015,y+Math.cos(i*1.9)*.075,z+Math.sin(i*1.9)*.089,.018,.026+i*.004,.022);break;
    case 'pumpkin':
      for(let i=-1;i<=1;i++)ball(g,dye,x,y,z+i*.033,.044,.059,.044);
      stem(g,trim,[x,y+.056,z],[x,y+.086,z+.014],.017);break;
    case 'candy':
      braid(g,dye,[[x,y-.067,z+.032],[x,y+.059,z+.019],[x,y+.070,z-.029],[x,y+.036,z-.043]],.024);
      for(let i=0;i<3;i++)bead(g,trim,x+.016,y-.04+i*.032,z+.026,.013,.011,.025);break;
    case 'gift':case 'book':case 'cards':
      tile(g,dye,x,y,z,.039,.068,.060).rotation.x=type==='cards'?.27:0;
      tile(g,trim,x+.031,y,z,.015,.058,type==='gift'?.015:.049);
      if(type==='gift')tile(g,trim,x+.031,y,z,.014,.016,.058);
      if(type==='cards')tile(g,linen,x+.018,y-.025,z-.039,.017,.058,.046).rotation.x=-.23;
      break;
    case 'drone':
      xDrone(g,dye,trim,id);break;
    case 'compass':case 'gear':case 'brooch':
      ring(g,trim,x,y,z,.046,.070,.066);
      gem(g,dye,x+.029,y,z,.031,.054,.041);
      if(type==='gear')for(let i=0;i<8;i++)bead(g,dye,x,y+.070*Math.cos(i*Math.PI/4),z+.070*Math.sin(i*Math.PI/4),.023,.019,.019);
      break;
    case 'parrot':case 'raven':case 'bat':
      ball(g,dye,.015,.19,.279,.079,.101,.058);
      bead(g,trim,.060,.261,.281,.068,.055,.052);
      stem(g,trim,[.095,.267,.283],[.146,.248,.283],.025,true);
      if(type==='bat')eachSide(s=>gem(g,trim,.005,.220,.279+s*.083,.035,.058,.081));
      break;
    case 'beetle':
      ball(g,dye,x,y,z,.047,.062,.045);
      braid(g,trim,[[x+.045,y-.056,z],[x+.057,y,z],[x+.044,y+.055,z]],.010);break;
    case 'lantern':
      tile(g,dye,x,y,z,.054,.063,.050);
      bead(g,trim,x+.045,y,z,.025,.040,.036);
      ring(g,dye,x,y+.078,z,.029,.037,.042);break;
    case 'jelly':
      ball(g,dye,x,y+.048,z,.047,.049,.066);
      for(let i=-1;i<=1;i++)braid(g,trim,[[x,y+.018,z+i*.030],[x+.017,y-.03,z+i*.035],[x-.009,y-.076,z+i*.040]],.012);
      break;
  }
}
function xDrone(g,dye,trim,id){
  const z=id===201?.32:.286;
  ball(g,dye,.054,.207,z,.071,.049,.064);
  eachSide(s=>{
    stem(g,dye,[.05,.193,z],[.052,.204,z+s*.080],.018);
    ring(g,trim,.052,.214,z+s*.084,.051,.039,.051,true);
  });
  bead(g,trim,.115,.209,z,.024,.029,.034);
}

function hood(g,dye,trim,style){
  ball(g,dye,-.097,.018,0,.197,.315,.265);
  eachSide(s=>{
    braid(g,dye,[[.045,-.236,.109*s],[-.009,-.166,.225*s],[-.037,.033,.269*s],[-.038,.220,.224*s],[-.074,.303,.072*s]],.058);
    braid(g,trim,[[.083,-.211,.115*s],[.043,-.133,.222*s],[.019,.038,.248*s],[.024,.203,.207*s],[.018,.286,.072*s]],.025);
  });
  if(style==='abyss')ball(g,dye,-.21,-.155,0,.116,.209,.180);
}
function suitCap(g,type,dye,trim,id){
  switch(type){
    case 'helmet':
      ball(g,dye,-.061,.03,0,.239,.303,.272);
      ring(g,trim,.082,.005,0,.252,.220,.199);
      eachSide(s=>ball(g,trim,-.022,-.040,.259*s,.068,.086,.051));
      if(id===25||id===26||id===149)stem(g,trim,[-.12,.263,.1],[-.15,.385,.15],.026);
      if(id===29||id===120||id===133)gem(g,trim,.101,.284,0,.041,.086,.063);
      if(id===26||id===32||id===101||id===122||id===131||id===157)goggles(g,dye,trim,true);
      break;
    case 'creature':case 'dragon':
      hood(g,dye,trim,type);
      eachSide(s=>{
        const round=[30,52,56,145,232].includes(id);
        if(round)ball(g,trim,-.053,.258,.186*s,.087,.102,.067);
        else{
          stem(g,dye,[-.054,.226,.153*s],[-.129,.428,.244*s],.098,true);
          stem(g,trim,[.008,.238,.157*s],[-.081,.374,.222*s],.048,true);
        }
        if(id===30)for(let i=0;i<3;i++)stem(g,trim,[-.079,.120-i*.067,.224*s],[-.127,.157-i*.094,(.34-i*.017)*s],.032,true);
        if(id===52)stem(g,trim,[-.121,.283,.131*s],[-.201,.535,.234*s],.036);
        if(id===91)braid(g,trim,[[.053,.221,.146*s],[-.016,.339,.199*s],[-.101,.458,.193*s],[-.198,.521,.242*s]],.041);
      });
      if(id===27||id===91) for(let i=0;i<4;i++)
        stem(g,trim,[-.20+i*.022,.132+i*.051,0],[-.319+i*.043,.19+i*.080,0],.057,true);
      break;
    case 'nature':
      hood(g,dye,trim,type);
      if(id===31){
        ball(g,dye,-.035,.269,0,.328,.108,.331);
        eachSide(s=>bead(g,linen,.042,.346,.161*s,.048,.021,.049));
      }else if(id===55){
        for(let i=0;i<3;i++)piece(g,cone,dye,-.069,.284+i*.087,0,.244-i*.059,.114,.244-i*.059);
        gem(g,trim,-.069,.548,0,.044,.061,.040);
      }else{
        stem(g,trim,[-.057,.278,0],[-.086,.384,.031],.043);
        eachSide(s=>braid(g,trim,[[-.068,.355,0],[-.079,.349,s*.067],[-.110,.376,s*.153]],.021));
      }break;
    case 'hood':
      hood(g,dye,trim,type);
      if(id===233||id===104||id===135||id===136){
        gem(g,trim,.058,.285,0,.031,.056,.040);
        eachSide(s=>gem(g,trim,.054,.191,.194*s,.019,.030,.028));
      }
      if(id===50)hat(g,'stocking',dye,trim,id);
      if(id===99||id===123||id===124)hat(g,'veil',dye,trim,id);
      break;
    case 'regal':
      hood(g,dye,trim,type);crown(g,trim,dye,id);
      if([105,118,119,121,140,144,160,161].includes(id))
        eachSide(s=>braid(g,trim,[[-.063,.228,.183*s],[-.098,.315,.236*s],[-.158,.428,.271*s],[-.221,.438,.256*s]],.041));
      if(id===147||id===148)eachSide(s=>{for(let i=0;i<3;i++)
        stem(g,trim,[-.077,.248,.12*s],[-.157+i*.049,.451-i*.036,(.201+i*.024)*s],.032,true);});
      break;
    case 'hat':
      hat(g,[103,106,142,154].includes(id)?'wizard':[126,150,151,156].includes(id)?'feltHat':'topHat',dye,trim,id);
      if(id===129||id===130||id===162)goggles(g,trim,dye,false);
      if(id===162)gem(g,trim,.159,.416,0,.034,.070,.064);
      break;
    case 'carnival':
      jester(g,dye,trim);
      if(id===234||id===231)hat(g,'stocking',dye,trim,id);
      break;
    case 'sunbird':
      hood(g,dye,trim,type);
      eachSide(s=>{for(let i=0;i<5;i++)
        stem(g,i%2?trim:gold,[.013,.206,(.061+i*.025)*s],[-.039,.540-i*.040,(.070+i*.048)*s],.064,true);});
      gem(g,gold,.112,.379,0,.042,.100,.054);break;
    case 'abyss':
      hood(g,dye,trim,type);
      eachSide(s=>{
        braid(g,trim,[[.051,-.172,.133*s],[.034,-.101,.234*s],[-.025,.099,.287*s],[-.109,.254,.256*s],[-.148,.281,.199*s]],.044);
        for(let i=0;i<4;i++){
          const z=(.061+i*.050)*s,y=.429-i*.032;
          braid(g,trim,[[-.09,.223,z*.89],[-.09,.31,z],[-.10,y,z*1.056],[-.066,y+.018,z*1.16]],.026);
          gem(g,'#3eaaa3',-.063,y+.026,z*1.17,.023,.044,.025);
        }
      });
      gem(g,gold,.107,.292,0,.035,.103,.048);
      gem(g,'#36938f',.134,.299,0,.029,.066,.030);
      break;
  }
}
function suitBody(g,type,dye,trim,id){
  const rigid=type==='helmet',wild=type==='creature'||type==='dragon'||type==='sunbird';
  if(rigid){
    ball(g,trim,.124,-.035,0,.104,.184,.205);
    tile(g,dye,.203,-.027,0,.022,.109,.133);
    for(let i=-1;i<=1;i++)bead(g,i===0?gold:linen,.229,-.058,i*.062,.017,.023,.019);
  }else{
    ball(g,dye,-.161,-.092,0,.105,.263,.242);
    braid(g,trim,[[-.236,.051,-.205],[-.250,-.193,-.145],[-.221,-.294,0],[-.250,-.193,.145],[-.236,.051,.205]],.018);
    braid(g,trim,[[.102,.158,-.231],[.148,.090,-.133],[.211,.045,0],[.148,.090,.133],[.102,.158,.231]],.032);
    gem(g,gold,.222,.035,0,.032,.063,.049);
    gem(g,trim,.242,.037,0,.025,.039,.032);
  }
  eachSide(s=>{
    ball(g,trim,-.005,.054,.259*s,.140,.094,.090);
    braid(g,dye,[[.076,.089,.302*s],[.014,.129,.325*s],[-.098,.091,.301*s]],.022);
    if(wild){
      for(let i=0;i<3;i++)gem(g,trim,-.153-i*.043,.072-i*.056,(.176+i*.027)*s,.073,.059,.044);
    }
    if(type==='abyss'){
      braid(g,trim,[[.147,.055,.152*s],[.172,.108,.233*s],[.009,.144,.320*s],[-.141,.087,.299*s],[-.184,-.041,.224*s]],.043);
      braid(g,'#b49462',[[.123,.067,.237*s],[.153,-.041,.211*s],[.155,-.147,.172*s],[.134,-.224,.129*s]],.011);
      for(let i=0;i<3;i++){
        gem(g,i===1?trim:'#468781',.191-i*.014,-.074-i*.055,.105*s,.027,.037,.023);
        bead(g,'#987b54',.142+i*.006,.011-i*.065,.242*s,.026,.019,.019);
      }
    }
  });
  if(id===93||id===139||id===146||id===91||id===27){
    braid(g,dye,[[-.171,-.281,0],[-.303,-.303,.065],[-.428,-.223,.129],[-.481,-.113,.150]],.054);
    bead(g,trim,-.469,-.123,.147,.067,.058,.058);
  }
}

function embroidery(g,trim,id){
  const style=fabrics[id][2];
  for(let row=0;row<3;row++)for(let i=-2;i<=2;i++){
    const z=i*.064,y=-.070-row*.071,x=.181-z*z*1.23-row*.009;
    if(style==='stripe'){
      tile(g,trim,x,y,z,.017,.017,.027).rotation.x=.59;
    }else if(style==='tree'){
      stem(g,trim,[x,y-.022,z],[x,y+.029,z],.021,true);
    }else if(style==='button'||style==='pumpkin'){
      bead(g,trim,x,y,z,.022,.023,style==='pumpkin'?.027:.021);
    }else if(style==='snow'){
      tile(g,trim,x,y,z,.013,.005,.025);
      tile(g,trim,x,y,z,.013,.024,.005);
    }else{
      gem(g,trim,x,y,z,.016,.014+(i===0?.010:0),.022);
    }
  }
}

function wrap(id,slot,design){
  const key=slot+':'+id;
  if(!caches.has(key)){
    const item=new T.Group();
    const [dye,trim]=colorsFor(id);
    design(item,dye,trim);
    item.name='kikalmo-'+slot+'-'+id;
    caches.set(key,item);
  }
  return caches.get(key).clone(true);
}

export function wardrobe(avatar,head,chest){
  const suit=avatar.costume,suitType=suitStyles[suit],fabric=avatar.fabric;
  const [coat,trim]=suit?colorsFor(suit):fabric?colorsFor(fabric):shirtDyes[avatar.outfit];
  const [width,depth]=suit?[.277,.201]:[.266,.181];
  ball(chest,coat,-.012,-.071,0,depth,.304,width).name='kikalmo-jacket';
  ball(chest,ink,-.012,-.310,0,.148,.119,.218);
  ball(chest,avatar.color,0,.153,0,.113,.129,.127);

  const headPivot=new T.Group();
  if(avatar.premiumFace)headPivot.name='kikalmo-premiumFace-'+avatar.premiumFace;
  headPivot.position.set(.020,.192,0);
  head.add(headPivot);
  face(headPivot,avatar,suitType,!!avatar.facewear);
  if(suit){
    headPivot.add(wrap(suit,'costume-head',(g,d,t)=>suitCap(g,suitType,d,t,suit)));
    chest.add(wrap(suit,'costume-body',(g,d,t)=>suitBody(g,suitType,d,t,suit)));
  }else{
    braid(chest,trim,[[.106,.115,-.162],[.164,.070,-.105],[.182,-.067,0],[.164,.070,.105],[.106,.115,.162]],.027);
    for(let i=0;i<4;i++)bead(chest,i%2?trim:linen,.169,-.020-i*.064,0,.019,.016,.016);
  }
  if(fabric){
    const pattern=wrap(fabric,'fabric',(g,d,t)=>embroidery(g,t,fabric));
    pattern.position.x=suit?.032:0;
    chest.add(pattern);
  }
  if(avatar.headwear){
    const model=wrap(avatar.headwear,'headwear',(g,d,t)=>hat(g,headwear[avatar.headwear],d,t,avatar.headwear));
    model.position.y=suit?.070:0;headPivot.add(model);
  }
  if(avatar.facewear){
    const model=wrap(avatar.facewear,'facewear',(g,d,t)=>mask(g,d,t,avatar.facewear));
    model.position.x=headShapes[avatar.shape][0]-.224;headPivot.add(model);
  }
  if(avatar.adornment)chest.add(wrap(avatar.adornment,'adornment',(g,d,t)=>badge(g,adornment[avatar.adornment],d,t,avatar.adornment)));
  const pants=suit?new T.Color(coat).multiplyScalar(.66).getStyle():ink;
  const glove=suit?(suit===163?'#392351':coat):avatar.color;
  return {coat,trim,pants,glove};
}

export const modeledItems={headwear,adornment,costume:suitStyles};
