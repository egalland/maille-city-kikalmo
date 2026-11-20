// Rigid chassis with a forward-control cab; dimensions and articulation are in metres.
import {fleetFabric as yarn} from './vehicle-fabric.js';

const frame='#423d48',steel='#696c72',silver='#bab0a2',canvas='#486e71',piping='#678b83';
const bed='#a26843',rim='#c59560',inside='#74563e';
const quad=(parts,points,c)=>parts.push({kind:'panel',points,c});

function truckCab(parts,art,shape,paint){
  const {box,rod,hull,cabin}=art,{half,roof}=shape;
  const back=half-2.13,front=half-.15,sill=1.53;
  hull(parts,[[back-.10,.90,1.53,.90],[back,.77,1.57,1.03],
    [front-.25,.77,1.57,1.03],[front+.06,.89,1.48,.97]],paint,[back-.03,front+.035]);
  cabin(parts,art,{rear:back-.03,front:front+.035,sill,roof,z:.997,inset:.063,rearRake:.03,frontRake:.22,splits:[.24]},paint);
  for(const s of [-1,1]){
    box(parts,[back+.05,1.94,s*.984],[.17,.74,.048],paint);
    box(parts,[back+.55,1.32,s*1.033],[.24,.045,.033],silver);
    for(let j=0;j<2;j++){
      const x=back+.35+j*.045, y=.54+j*.19;
      box(parts,[x,y,s*1.026],[.68,.073,.21],frame);
      rod(parts,[x-.25,y+.045,s*1.095],[x+.23,y+.045,s*1.095],.016,silver);
    }
    rod(parts,[front-.23,2.08,s*.983],[front-.12,2.05,s*1.11],.026,frame);
    box(parts,[front-.13,2.01,s*1.124],[.10,.25,.070],frame);
    box(parts,[front-.185,2.02,s*1.124],[.013,.19,.053],silver);
    rod(parts,[back+.16,1.47,s*1.035],[back+.16,.91,s*1.035],.014,yarn.welt);
    // Quarter-round wheel arch in the front skirt.
    const axle=shape.axles.at(-1),tire=shape.r+.055;
    for(let i=0;i<7;i++){
      const p=j=>[axle+tire*Math.cos(Math.PI*j/7),shape.r+tire*Math.sin(Math.PI*j/7),s*1.036];
      rod(parts,p(i),p(i+1),.045,paint);
    }
    box(parts,[front+.075,1.19,s*.75],[.081,.16,.28],yarn.ink);
    box(parts,[front+.119,1.19,s*.75],[.038,.107,.22],yarn.lamp);
    box(parts,[front+.108,1.43,s*.88],[.040,.065,.134],yarn.brass);
    box(parts,[-half+.052,.74,s*.86],[.096,.12,.25],yarn.stop);
    const foot=front-.06,cap=front-.23;
    rod(parts,[foot,1.62,s*.76],[cap,2.07,s*.44],.014,frame);
    rod(parts,[cap+.006,2.07,s*.62],[cap+.006,2.07,s*.25],.016,frame);
  }
  box(parts,[half-.10,.72,0],[.20,.19,2.16],steel);
  box(parts,[front+.076,1.19,0],[.111,.44,1.11],frame);
  for(let j=0;j<4;j++)box(parts,[front+.137,1.04+j*.084,0],[.023,.033,1.026],silver);
  box(parts,[half-.001,.77,0],[.018,.132,.38],yarn.thread);
  box(parts,[-half+.052,.58,0],[.106,.115,2.12],silver);
}

function cargoCurtain(parts,art,h){
  const {box,rod,hull}=art,back=-h+.13,front=h-2.32,lo=1.04,hi=3.10;
  const center=(back+front)/2,length=front-back;
  box(parts,[center,lo,0],[length,.21,2.13],frame);
  hull(parts,[[back-.025,hi-.085,hi+.025,1.085],[back+.15,hi-.06,hi+.12,1.117],
    [front-.13,hi-.06,hi+.12,1.117],[front+.025,hi-.085,hi+.05,1.08]],'#d1c294');
  const sections=8;
  for(const side of [-1,1]){
    const trimZ=side*1.13;
    for(let i=0;i<sections;i++){
      const x=back+i*length/sections,next=x+length/sections;
      const row=(at,top,z)=>[at,top,side*z];
      const lower=lo+.13;
      // Each suspended length of canvas sags between the two buckled straps.
      const columns=[[x,lower,1.094],[x+(next-x)*.36,lower-.035,1.140],[x+(next-x)*.68,lower-.023,1.136],[next,lower,1.094]];
      for(let k=1;k<columns.length;k++){
        const a=columns[k-1],b=columns[k];
        const cloth=[row(a[0],a[1],a[2]),row(b[0],b[1],b[2]),row(b[0],hi,b[2]-.033),row(a[0],hi,a[2]-.033)];
        quad(parts,side<0?cloth.reverse():cloth,k===3?'#486971':canvas);
      }
      rod(parts,row(x,hi-.19,1.105),row(x+.03,lower+.34,1.125),.013,piping);
      box(parts,[x+.042,lower+.115,trimZ],[.054,.31,.035],frame);
      box(parts,[x+.042,lower+.105,side*1.152],[.091,.078,.024],silver);
      if(i%2===0)box(parts,[x+.19,lo-.02,side*1.073],[.126,.046,.027],yarn.lamp);
    }
    for(const y of [lo+.06,hi-.04])rod(parts,[back,y,trimZ],[front,y,trimZ],.038,silver);
    // A woven shuttle makes the local freight livery readable even on a moving truck.
    const points=[[-.93,0],[-.43,.195],[.54,.12],[.90,0],[.44,-.16],[-.51,-.10]];
    const shuttle=points.map(([x,y])=>[center+x,2.23+y,side*1.145]);
    quad(parts,side<0?shuttle:shuttle.reverse(),yarn.thread);
    const eye=[[-.36,-.026],[.10,.048],[.42,.032],[-.11,-.047]].map(([x,y])=>[center+x,2.23+y,side*1.149]);
    quad(parts,side<0?eye:eye.reverse(),canvas);
  }
  box(parts,[front,2.07,0],[.088,2.02,2.15],'#92a6a0');
  for(const s of [-1,1]){
    box(parts,[back-.031,2.07,s*.536],[.068,2.02,1.05],'#a4a99e');
    for(const y of [1.19,1.97,2.88])box(parts,[back-.077,y,s*.91],[.051,.076,.22],silver);
    rod(parts,[back-.09,1.17,s*.32],[back-.09,3.01,s*.32],.027,steel);
    rod(parts,[back-.104,1.57,s*.32],[back-.104,1.51,s*.58],.022,frame);
  }
}

function tipperBin(parts,art,h){
  const {box,rod}=art,x0=-h+.095,x1=h-2.34,zLow=.80,zHigh=1.116,low=1.06,high=2.11;
  for(const side of [-1,1]){
    const s=side,shell=[[x0+.24,low,s*zLow],[x1-.18,low,s*zLow],[x1,high,s*zHigh],[x0-.015,high,s*zHigh]];
    if(side<0)shell.reverse();
    quad(parts,shell,bed);
    quad(parts,shell.map(([x,y,z])=>[x,y+.006,z-s*.072]).reverse(),inside);
    rod(parts,[x0,high,s*zHigh],[x1,high,s*zHigh],.054,rim);
    for(let j=0;j<5;j++){
      const x=x0+.30+(x1-x0-.50)*j/4;
      rod(parts,[x+.14,low+.025,s*(zLow+.02)],[x-.045,high-.064,s*(zHigh+.014)],.051,rim);
    }
    rod(parts,[x0+.23,low,s*zLow],[x1-.17,low,s*zLow],.055,frame);
    // A pin and cheek retain the tailgate on the open-top hopper.
    box(parts,[x0+.06,high-.13,s*1.118],[.21,.16,.078],steel);
  }
  for(const [at,shift] of [[x0,.24],[x1,-.18]]){
    const gate=[[at+shift,low,-zLow],[at+shift,low,zLow],[at,high,zHigh],[at,high,-zHigh]];
    quad(parts,at===x0?gate:gate.reverse(),bed);
    quad(parts,gate.slice().reverse(),inside);
    rod(parts,[at,high,-zHigh],[at,high,zHigh],.053,rim);
  }
  for(let i=1;i<4;i++){
    const z=-.94+i*.47;
    rod(parts,[x0+.19,low+.16,z*.75],[x0,high-.04,z],.042,rim);
  }
  box(parts,[(x0+x1)/2,low+.03,0],[x1-x0-.42,.088,zLow*2],inside);
  // Irregular low aggregate pile with flat facets, leaving the inside of the hopper visible.
  const xs=[x0+.27,x0+.69,(x0+x1)/2,x1-.65,x1-.20],heights=[1.36,1.68,1.91,1.65,1.40];
  const rims=xs.map((x,i)=>[[x,1.26,-.78],[x+.025,heights[i]-.19,-.51],[x,heights[i],i%2?.14:-.09],[x-.06,heights[i]-.22,.47],[x,1.25,.77]]);
  const gravel=['#817c71','#908774','#9d8e76','#807d78'];
  for(let i=1;i<rims.length;i++)for(let j=1;j<5;j++){
    quad(parts,[rims[i-1][j-1],rims[i][j],rims[i][j-1]],gravel[(i+j)%4]);
    quad(parts,[rims[i-1][j-1],rims[i-1][j],rims[i][j]],gravel[(i+j+1)%4]);
  }
  const head=x1-.12;
  quad(parts,[[head,high,-1.08],[head,high,1.08],[head+.15,2.54,1.03],[head+.15,2.54,-1.03]],bed);
  box(parts,[head+.31,2.55,0],[.44,.085,2.11],rim);
}

export const freightPaint={boxtruck:'#bc8849',tipper:'#6d8880'};
export function createFreightRecipe(type,paint,art){
  const boxBody=type==='boxtruck';
  const shape=boxBody?{half:3.675,roof:2.43,axles:[-2.09,2.65],r:.48,track:.99,seatX:2.67}:
    {half:3.225,roof:2.54,axles:[-2.05,-.85,2.18],r:.49,track:.965,seatX:2.22};
  const {half,seatX,roof,axles,r,track}=shape;
  const chassis=art.section('carrosserie'),parts=chassis.parts;
  for(const side of [-1,1]){
    art.box(parts,[0,.74,side*.69],[half*2-.28,.20,.14],frame);
    for(const axle of axles.slice(0,-1)){
      art.box(parts,[axle-.46,.59,side*track],[.08,.54,.32],frame);
      art.box(parts,[axle,.99,side*track],[.88,.069,.32],frame);
    }
    art.box(parts,[.17,.68,side*.88],[1.12,.35,.29],silver);
    for(const yy of [.51,.80])art.rod(parts,[-1.15,yy,side*1.032],[.90,yy,side*1.032],.039,frame);
  }
  truckCab(parts,art,shape,paint);
  if(boxBody)cargoCurtain(parts,art,half);
  else tipperBin(parts,art,half);
  const seats3D={x:seatX,y:1.70,spacing:.48,scale:1,hipY:1.24,roof:roof-.025,wheel:[seatX+.39,1.73,-.48],wheelRadius:.19,recline:.15};
  art.upholstery(parts,art,seats3D,type);
  const wheels=axles.flatMap(x=>[-1,1].map(side=>art.makeWheel(x,side*track,r,.255,x>0,false)));
  // The driving renderer passes a distance hint for the trim and animated crew.
  // These parts share the working wheels and seat anchors at both detail levels.
  const distant=art.section('Silhouette poids lourd'),lowParts=distant.parts;
  const short=(p,size,c)=>art.box(lowParts,p,size,c);
  short([0,.73,0],[2*half-.16,.26,1.86],frame);
  short([half-1.09,1.19,0],[1.98,.82,2.03],paint);
  for(const side of [-1,1]){
    short([half-2.04,1.99,side*.94],[.14,.90,.094],paint);
    art.rod(lowParts,[half-.15,1.52,side*.99],[half-.40,roof,side*.94],.065,paint);
    short([half-.06,1.16,side*.74],[.12,.13,.24],yarn.lamp);
  }
  short([half-1.20,roof+.075,0],[1.78,.14,1.98],paint);
  if(boxBody){
    short([-1.095,2.09,0],[half*2-2.48,2.10,2.18],canvas);
    short([-1.095,3.15,0],[half*2-2.48,.105,2.19],yarn.binding);
    for(const s of [-1,1])art.rod(lowParts,[-2.05,2.15,s*1.10],[-.1,2.25,s*1.10],.065,yarn.thread);
  }else tipperBin(lowParts,{box:art.box,rod(){}},half);
  for(const x of axles)for(const side of [-1,1]){
    lowParts.push({kind:'disc',p:[x,r,side*track],r,width:.255,c:yarn.tyre});
    lowParts.push({kind:'disc',p:[x,r,side*(track+.137)],r:r*.585,width:.029,c:silver});
  }
  // Keep the distant panes removable through the same damage flag as the cab glass.
  for(const side of [-1,1]){
    lowParts.push({kind:'panel',glass:true,c:yarn.pane,points:[[half-2.04,1.53,side*.989],[half-.15,1.53,side*.989],[half-.40,roof,side*.94],[half-2.04,roof,side*.94]]});
  }
  lowParts.push({kind:'panel',glass:true,c:yarn.frontPane,points:[[half-.15,1.53,-.989],[half-.15,1.53,.989],[half-.40,roof,.94],[half-.40,roof,-.94]]});
  return {chassis,wheels,seats3D,distant};
}
