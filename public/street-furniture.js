// All profiles are measured in metres. Build each finish into the city's shared
// batches so repeating a piece along an avenue costs one instanced draw per finish.
const tau = Math.PI * 2;
const iron = '#345052', patina = '#608079', brass = '#c69864';
const oak = ['#b58057', '#b88961', '#ad7654', '#c19266'];

// Outside of a turned casting, including its shoulders and flanges. A ring is
// [height, radius, colour of the band above]. Flat ring ends can use equal heights.
function casting(b, x, z, rings, sides = 10, material = 'felt', phase = 0) {
  const point = ([y,r], i) => [x+r*Math.cos(phase+tau*i/sides),y,z+r*Math.sin(phase+tau*i/sides)];
  for (let k = 0; k < rings.length-1; k++) {
    const lo = rings[k], hi = rings[k+1];
    for (let i = 0; i < sides; i++) {
      const a=point(lo,i),c=point(hi,i),d=point(hi,i+1),e=point(lo,i+1);
      const u=i/sides, v=(i+1)/sides;
      b.face(material,a,c,d,e,lo[2],[[u,lo[0]],[u,hi[0]],[v,hi[0]],[v,lo[0]]]);
    }
  }
}

// Rounded edge of a cast strap. Draw from a traced profile on the YZ plane;
// one uninterrupted outline describes the bent supports and the planks.
function extrusion(b, x1, x2, outline, color, edgeColor=color) {
  const left=outline.map(([z,y])=>[x1,y,z]),right=outline.map(([z,y])=>[x2,y,z]);
  // Profiles supplied here are convex. Fan covers each end in local UV space.
  for (let i=1;i<outline.length-1;i++) {
    b.tri('felt',left[0],left[i],left[i+1],color);
    b.tri('felt',right[0],right[i+1],right[i],color);
  }
  for (let i=0;i<outline.length;i++) {
    const j=(i+1)%outline.length;
    b.face('felt',left[i],left[j],right[j],right[i],i===0?edgeColor:color);
  }
}

function rail(b, x, profile, width, depth, color) {
  // Offset both edges along the local normal, turning a traced centreline into
  // continuous ironwork with open space between the legs and under the arms.
  const edges=profile.map(([z,y],i)=>{
    const prev=profile[Math.max(0,i-1)],next=profile[Math.min(profile.length-1,i+1)];
    const dz=next[0]-prev[0],dy=next[1]-prev[1],scale=depth*.5/Math.hypot(dz,dy);
    return [[z-dy*scale,y+dz*scale],[z+dy*scale,y-dz*scale]];
  });
  for(let i=1;i<edges.length;i++) {
    const [a,d]=edges[i-1],[bb,c]=edges[i];
    const l=x-width/2,r=x+width/2,pt=(x,[z,y])=>[x,y,z];
    b.face('felt',pt(l,a),pt(l,bb),pt(l,c),pt(l,d),color);
    b.face('felt',pt(r,d),pt(r,c),pt(r,bb),pt(r,a),color);
    b.face('felt',pt(l,a),pt(r,a),pt(r,bb),pt(l,bb),color);
    b.face('felt',pt(l,c),pt(r,c),pt(r,d),pt(l,d),color);
    if(i===1)b.face('felt',pt(l,d),pt(r,d),pt(r,a),pt(l,a),color);
    if(i===edges.length-1)b.face('felt',pt(l,bb),pt(r,bb),pt(r,c),pt(l,c),color);
  }
}

function bench(b,stage) {
  const seatProfile=[[-.263,.487],[-.259,.528],[-.241,.545],[-.199,.551],[-.162,.546],[-.155,.532],[-.159,.495]];
  for(let n=0;n<4;n++){
    const offset=n*.118,fall=.009*Math.sin(n*Math.PI/3);
    extrusion(b,-.84,.84,seatProfile.map(([z,y])=>[z+offset,y-fall]),oak[n], '#d3ad7e');
  }
  const runs=stage===2?[[-.84,-.13],[.10,.84]]:[[-.84,.84]];
  for(let n=0;n<3;n++)for(const [l,r] of runs){
    const y=.687+n*.15+(stage===2&&l>0?.038:0),z=.139+n*.031;
    const prof=[[z,y+.008],[z-.009,y+.094],[z+.006,y+.112],[z+.039,y+.110],[z+.054,y+.095],[z+.05,y+.008],[z+.04,y]];
    extrusion(b,l,r,prof,oak[(n+1)%4],'#d7ad7c');
  }
  for(const x of [-.63,.63]){
    rail(b,x,[[-.235,.045],[-.220,.14],[-.125,.28],[-.060,.385],[-.047,.475],[.10,.485],[.18,.57],[.197,.70],[.265,1.084]],.064,.052,iron);
    rail(b,x,[[.245,.045],[.211,.145],[.122,.255],[.074,.33],[.055,.395],[-.13,.463],[-.22,.473]],.064,.051,iron);
    rail(b,x,[[-.174,.491],[-.190,.614],[-.172,.659],[-.125,.694],[-.040,.706],[.085,.713],[.147,.749],[.184,.812]],.052,.034,iron);
    for(const z of [-.234,.245])b.box(x,.022,z,.108,.032,.085,patina);
    for(let n=0;n<3;n++)b.tube([x,.743+.15*n,.129+.031*n],[x,.743+.15*n,.119+.031*n],.018,.015,brass,6);
  }
  b.tube([-.63,.333,.052],[.63,.333,.052],.024,.024,iron,6);
}

function lamp(b,stage,luminous) {
  const shell='plain';
  casting(b,0,0,[[.015,.23,iron],[.06,.245,patina],[.095,.238,iron],[.12,.177,iron],[.42,.165,patina],[.46,.18,iron],[.515,.155,iron],[.74,.128,iron],[.88,.088,patina],[.916,.105,iron],[.954,.078,iron],[3.72,.051,patina],[3.77,.081,iron],[3.84,.079,iron],[3.91,.045,iron],[3.96,.012,iron]],10,shell);
  // A curved suspended lantern and its supporting scrolled bracket are legible
  // as a silhouette from either direction along a street.
  rail(b,0,[[0,3.45],[.01,3.68],[.06,3.93],[.17,4.18],[.33,4.36],[.49,4.42],[.65,4.415],[.77,4.345],[.811,4.24],[.81,4.18]],.064,.074,iron);
  rail(b,0,[[.01,3.53],[.12,3.65],[.28,3.72],[.391,3.84],[.409,3.983],[.366,4.086],[.282,4.12],[.21,4.08]],.045,.046,patina);
  const z=.81,phase=Math.PI/4;
  casting(b,0,z,[[4.18,.06,brass],[4.13,.057,iron],[4.11,.088,iron],[4.09,.118,patina],[4.04,.146,iron],[3.97,.31,iron],[3.921,.36,patina],[3.894,.36,iron],[3.893,.28,iron]],8,shell,phase);
  const pane=stage===2?'#9c9384':'#ffe3a1';
  casting(b,0,z,[[3.46,.096,pane],[3.54,.135,pane],[3.86,.275,pane],[3.895,.278,pane]],8,luminous&&stage<2?'lantern':shell,phase);
  for(let i=0;i<4;i++){
    const theta=phase+i*tau/4,c=Math.cos(theta),s=Math.sin(theta);
    b.tube([c*.128,3.51,z+s*.128],[c*.281,3.894,z+s*.281],.012,.017,iron,4,shell);
  }
  casting(b,0,z,[[3.38,.008,brass],[3.43,.033,iron],[3.466,.106,patina],[3.519,.136,iron]],8,shell,phase);
}

function crate(b,stage) {
  for(let i=0;i<5;i++){
    const x=(i-2)*.167;
    for(const side of [-1,1])b.box(x,.07,side*.368,.156,.64,.047,oak[i%4]);
    b.box(x,.734,0,.155,.034,.69,oak[(i+1)%4]);
  }
  for(const side of [-1,1]){
    for(let i=0;i<4;i++)b.box(side*.414,.065,(i-1.5)*.173,.041,.65,.161,oak[(i+1)%4]);
    for(const y of [.045,.657]){
      b.box(0,y,side*.398,.884,.084,.045,'#986e51');
      b.box(side*.433,y,0,.046,.084,.772,'#a57954');
    }
    const end=stage===2?.015:.34,top=stage===2?.39:.633;
    const front=side*.411,back=side*.391;
    const vertices=z=>[[-.355,.13,z],[-.294,.13,z],[end+.047,top,z],[end-.016,top,z]];
    b.face('felt',...vertices(front),'#d2a57a');b.face('felt',...vertices(back),'#b28259');
    for(const x of [-.345,.345])for(const y of [.09,.698])b.tube([x,y,side*.421],[x,y,side*.426],.016,.015,iron,5);
  }
}

function hydrant(b,stage) {
  const red='#ad5052', hi='#cb7361',dark='#80494b';
  casting(b,0,0,[[.016,.205,dark],[.058,.218,red],[.095,.213,hi],[.109,.176,red],[.23,.167,red],[.27,.175,red],[.52,.179,red],[.581,.186,dark],[.599,.205,hi],[.636,.204,red],[.651,.159,red],[.704,.182,hi],[.761,.166,red],[.816,.114,red],[.832,.058,dark]],12,'plain');
  casting(b,0,0,[[.828,.053,brass],[.898,.052,brass],[.908,.036,brass]],6,'plain');
  for(const side of [-1,1]){
    if(stage===2&&side<0)continue;
    for(const [start,end,r,s,c,sides] of [[.137,.219,.111,.104,red,10],[.214,.248,.123,.123,hi,10],[.25,.28,.112,.10,dark,10],[.278,.304,.072,.070,brass,6]])
      b.tube([side*start,.435,0],[side*end,.435,0],r,s,c,sides,'plain');
  }
  b.tube([0,.423,-.115],[0,.423,-.21],.127,.125,hi,10,'plain');
  b.tube([0,.423,-.210],[0,.423,-.243],.111,.105,red,10,'plain');
  b.tube([0,.423,-.238],[0,.423,-.264],.062,.06,brass,6,'plain');
  for(let i=0;i<4;i++){
    const a=Math.PI/4+i*tau/4,x=.182*Math.cos(a),z=.182*Math.sin(a);
    b.tube([x,.078,z],[x,.104,z],.021,.019,brass,6,'plain');
  }
}

function postbox(b) {
  casting(b,0,0,[[.016,.135,iron],[.071,.14,patina],[.10,.093,iron],[.17,.073,iron],[.75,.052,patina],[.792,.073,iron]],8);
  const shell=[[-.203,.793],[-.203,1.22],[-.173,1.296],[-.103,1.337],[.11,1.337],[.176,1.296],[.205,1.219],[.205,.793]];
  extrusion(b,-.29,.29,shell,'#d19d38','#e7b955');
  for(const face of [-1,1]){
    const z=face*.205;
    b.box(0,1.109,z,.385,.057,.012,'#3e4543');
    extrusion(b,-.214,.214,[[z,1.18],[z+face*.068,1.157],[z+face*.073,1.168],[z+face*.014,1.207]],'#9d7539','#ebc46e');
    b.box(-.029,.912,z,.188,.103,.014,'#e9dcbc');
    b.box(-.031,.977,z+face*.008,.12,.009,.012,'#79847c');
    b.tube([.169,.90,z],[.169,.90,z+face*.016],.019,.017,iron,6);
  }
}

function bin(b,stage) {
  const dark='#384c4b',green='#5e7d70';
  casting(b,0,0,[[.022,.227,dark],[.073,.245,green],[.12,.216,green],[.144,.223,dark]],12,'plain');
  // Visible liner sits inside a basket of spaced flat bars, with a true opening.
  casting(b,0,0,[[.126,.204,dark],[.24,.202,dark],[.723,.246,dark],[.758,.232,dark],[.723,.218,dark],[.549,.207,dark]],12,'plain');
  for(let i=0;i<13;i++){
    const a=i*tau/13,half=.12,pt=(u,r,y)=>[Math.cos(u)*r,y,Math.sin(u)*r];
    const level=[[.14,.225],[.27,.235],[.76,.286],[.83,.289]];
    for(let j=0;j<level.length-1;j++){
      const [y,r]=level[j],[cy,cr]=level[j+1];
      b.face('plain',pt(a-half,r,y),pt(a-half,cr,cy),pt(a+half,cr,cy),pt(a+half,r,y),i%3?green:patina);
    }
  }
  const offset=stage===2?.055:0;
  casting(b,offset,0,[[.805,.291,iron],[.826,.31,patina],[.862,.306,green],[.88,.280,green],[.876,.244,iron],[.847,.237,iron]],16,'plain');
  casting(b,0,0,[[.27,.237,iron],[.296,.241,green]],13,'plain');
}

function bollard(b) {
  casting(b,0,0,[[.012,.135,iron],[.043,.142,patina],[.066,.129,iron],[.084,.109,iron],[.142,.101,iron],[.172,.105,patina],[.192,.094,iron],[.591,.079,iron],[.603,.093,brass],[.646,.093,brass],[.658,.085,iron],[.702,.086,patina],[.721,.118,iron],[.762,.118,iron],[.813,.094,patina],[.844,.044,patina],[.85,.001,patina]],10,'plain');
}

export function streetFurniture(batch, kind, stage, luminous) {
  switch(kind){
    case 'bench': return bench(batch,stage);
    case 'lamp': return lamp(batch,stage,luminous);
    case 'crate': return crate(batch,stage);
    case 'hydrant': return hydrant(batch,stage);
    case 'postbox': return postbox(batch);
    case 'bin': return bin(batch,stage);
    default: return bollard(batch);
  }
}
