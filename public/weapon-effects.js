import {weaponCatalog,weaponList} from './weapon-catalog.js';

const lifetimes={shot:.13,cone:.17,rocket:.43,fist:.18,yarn:.32,ribbon:.36,pompom:.44,confetti:.38,boomerang:.48,bubbles:.5,spool:.42,star:.36,chime:.48};
export const rocketFlightTime=(length,kind)=>Math.max(.092,length/(kind==='tankShell'?430:205));
const byEffect=Object.fromEntries(weaponList.map(w=>[w.effect,w.palette]));
const effectName=kind=>weaponCatalog[kind]?.effect||kind;
export function effectDuration(kind){return lifetimes[effectName(kind)]||.17;}

// Each stroke is a world-space polyline; both camera backends project the same strands.
export function buildShotEffect(kind,x,y,angle,length,progress=.5,barrel=false,drop=0){
  const key=effectName(kind),pal=weaponCatalog[kind]?.palette||byEffect[key]||byEffect.shot;
  if(![x,y,angle,length].every(Number.isFinite)||length<0)return [];
  const u=Math.max(0,Math.min(1,progress)),len=Math.max(.03,length);
  const cs=Math.cos(angle),sn=Math.sin(angle),lines=[];
  const pt=(along,side=0,z=1.04)=>{
    const spread=barrel?Math.max(0,Math.min(1,along/1.6)):1;
    return {x:x+cs*along-sn*side*spread,y:y+sn*along+cs*side*spread,z:1.03+(z-1.03)*spread};
  };
  const line=(color,width,points)=>lines.push({color,width,points});
  const curve=(color,width,count,point)=>line(color,width,Array.from({length:count+1},(_,i)=>point(i/count)));
  function loop(at,side,height,r,color,width=1.8){
    curve(color,width,12,t=>pt(at,side+r*Math.cos(t*2*Math.PI),height+r*Math.sin(t*2*Math.PI)));
  }
  const along=len*Math.min(1,.18+1.03*u),pulse=.72+u*.45;
  if(key==='fist'){
    curve('#ffe8bb',2.5,9,t=>pt(len*(.38+.54*Math.sin(Math.PI*t)),(t-.5)*1.35,1.0+.13*Math.sin(Math.PI*t)));
  }else if(key==='shot'){
    line('#ffdb9a',1.45,[pt(0,0,1.03),pt(len,0,1.01+drop)]);
  }else if(key==='cone'){
    // A short expanding muzzle plume suggests the spread. No long pellet beams.
    const reach=Math.min(3.65,len)*(.28+.72*u),spread=reach*.16;
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,side=Math.cos(a),up=Math.sin(a);
      line(i%2?'#c89e74':'#f7cf96',2.9,[pt(reach*.30,side*spread*.24,1.03+up*spread*.24),
        pt(reach,side*spread,1.03+up*spread+drop*reach/len)]);
    }
  }else if(key==='rocket'){
    const tip=len*u,body=Math.max(0,tip-.76),tail=Math.max(0,body-8.5);
    const flame=Math.max(0,body-.85),height=d=>1.03+drop*d/len;
    for(const [color,width,offset] of [['#77706b',6.8,.15],['#bfb6a5',3.4,-.08]]){
      curve(color,width,14,t=>{
        const d=tail+(flame-tail)*t;
        return pt(d,offset*Math.sin(t*11+u*7),height(d)+.15*(1-t));
      });
    }
    line('#ff6f27',7,[pt(flame,0,height(flame)),pt(body,0,height(body))]);
    line('#fff3bb',3,[pt((flame+body)/2,0,height((flame+body)/2)),pt(body,0,height(body))]);
    line('#242b26',8,[pt(body,0,height(body)),pt(tip,0,height(tip))]);
    line('#9da581',3.4,[pt(body,0,height(body)+.059),pt(tip,0,height(tip)+.045)]);
    for(const side of [-1,1])line('#d0bd90',2.1,[pt(body,side*.18,height(body)),pt((tip+body)/2,0,height((tip+body)/2))]);
  }else if(key==='yarn'||key==='ribbon'){
    const ribbon=key==='ribbon',turns=ribbon?2.5:3.75;
    for(let j=0;j<(ribbon?2:1);j++)curve(j?pal.trim:pal.accent,j?1.3:2.4,24,t=>{
      const wave=Math.sin(t*Math.PI*2*turns-u*3)*Math.sin(Math.PI*t),s=wave*(ribbon?.32:.22);
      return pt(t*len,s+j*.11,1.03+(ribbon?Math.sin(t*Math.PI)*.37:0)+wave*.12+j*.055);
    });
    if(ribbon)line(pal.trim,2,[pt(len-.42,-.17),pt(len),pt(len-.42,.17)]);
  }else if(key==='pompom'){
    curve(pal.trim,1.7,13,t=>pt(t*len,0,1.02+Math.sin(t*Math.PI)*1.25));
    const height=1.02+Math.sin(Math.PI*Math.min(1,along/len))*1.25;
    for(let i=0;i<5;i++){const a=i*2*Math.PI/5;loop(along,Math.cos(a)*.16,height+Math.sin(a)*.16,.17,pal.accent,2.1);}
    for(let j=0;j<8;j++){const a=j*Math.PI/4;line(j%2?pal.trim:pal.accent,1.8,[pt(len,0,1.02),pt(len+Math.cos(a)*pulse*.35,Math.sin(a)*pulse*.62,1.12+Math.cos(2*a)*pulse*.40)]);}
  }else if(key==='confetti'){
    line(pal.trim,1.1,[pt(0),pt(len*.55)]);
    for(let i=0;i<5;i++){
      const f=(i+1)/5,spread=.32*Math.sin(i*4+u)*f,z=1.02+Math.cos(i*2.5)*.38*f;
      line([pal.accent,'#80ddc9','#ffe284'][i%3],2.25,[pt(len*f-.17,spread,z),pt(len*f,spread+.13,z+.12),pt(len*f+.12,spread+.02,z+.17)]);
    }
  }else if(key==='boomerang'){
    curve(pal.accent,2.1,17,t=>pt(t*len,.61*Math.sin(Math.PI*t),1.04+.22*Math.sin(Math.PI*t)));
    curve(pal.trim,1.1,17,t=>pt(t*len,-.47*Math.sin(Math.PI*t),1.01));
    line(pal.trim,2.8,[pt(along-.3,-.26,1.14),pt(along+.22,0,1.38),pt(along-.12,.33,1.16)]);
  }else if(key==='bubbles'){
    for(let i=0;i<4;i++){const f=(i+1)/4;const at=len*f,side=.15*Math.sin(i*2.3+u*3),z=1+.23*f+.11*Math.sin(i+u*4),r=.11+f*.13;
      loop(at,side,z,r,i%2?pal.accent:pal.trim,1.8);line('#fff2df',1.6,[pt(at,side-r*.53,z+r*.31),pt(at,side-r*.23,z+r*.67)]);}
  }else if(key==='spool'){
    curve(pal.accent,2.15,27,t=>pt(len*t,Math.sin(t*Math.PI*9-u*5)*.21,.29+Math.cos(t*Math.PI*9-u*5)*.17));
    loop(along,0,.32,.27,pal.trim,2.2);
  }else if(key==='star'){
    line(pal.accent,1.25,[pt(0),pt(along)]);
    for(let j=0;j<2;j++){const at=j?along:len*.64,r=j?.30:.14;curve(j?pal.trim:pal.accent,2.1,10,t=>{
      const k=Math.round(t*10),a=t*Math.PI*2+u*3.6,rr=k%2?r*.43:r;return pt(at,Math.cos(a)*rr,1.12+Math.sin(a)*rr);
    });}
  }else if(key==='chime'){
    for(let i=0;i<3;i++){const r=len*(.27+.30*i+.10*u);
      curve(i%2?pal.trim:pal.accent,2-i*.18,22,t=>{const a=(t-.5)*2.65;return pt(r*Math.cos(a),r*Math.sin(a),.85+.21*Math.cos(a));});}
  }
  return lines;
}

export function muzzleFlash(kind,x,y,angle){
  const {palette,noise}=weaponCatalog[kind];
  const c=Math.cos(angle),s=Math.sin(angle),scale=kind==='shotgun'?1.45:noise?1:.77;
  const point=(forward,side,up)=>({x:x+scale*(c*forward-s*side),y:y+scale*(s*forward+c*side),z:1.03+scale*up});
  const origin=point(0,0,0),bright=noise?'#fff0bd':palette.trim,accent=noise?'#ffa359':palette.accent;
  return [
    {color:bright,width:4.3,points:[origin,point(.19,0,0)]},
    ...[[.30,-.102,.018],[.25,.092,.055],[.34,.012,.075],[.19,.027,-.072]].map(([a,b,c])=>
      ({color:accent,width:2.25,points:[point(.078,b*.2,c*.24),point(a,b,c)]}))
  ];
}
