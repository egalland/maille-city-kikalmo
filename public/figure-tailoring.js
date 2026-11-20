import * as THREE from './three.js';

// Horizontal pattern rings give the clothes real shoulders, a waist and a hem.
// x is the depth of the fabric, z its width and y the height on the rig.
function pattern(rings, sides = 16) {
  const positions = [], uvs = [], indices = [];
  for (let row = 0; row < rings.length; row++) {
    const [y, depth, width, shift = 0] = rings[row];
    for (let col = 0; col <= sides; col++) {
      const u = col / sides, angle = u * Math.PI * 2;
      positions.push(shift + Math.cos(angle) * depth, y, Math.sin(angle) * width);
      uvs.push(u * 2, row / (rings.length - 1));
      if (row && col) {
        const d = row * (sides + 1) + col, c = d - 1, b = d - sides - 1, a = b - 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export const jacketPattern = pattern([
  [-.259, .118, .159], [-.238, .18, .213], [-.189, .184, .22], [-.12, .178, .207],
  [.014, .196, .219], [.128, .179, .25], [.16, .153, .252], [.202, .12, .174], [.212, .091, .118]
]);
export const headPattern = pattern([
  [-.107,.08,.086,.006],[-.079,.167,.162,.022],[-.014,.218,.230,.007],
  [.072,.263,.275], [.172,.267,.275,-.006], [.254,.243,.25,-.014],
  [.322,.188,.201,-.026], [.365,.109,.119,-.036], [.382,.010,.012,-.038]
],20);

// A patch is cut from a planar silhouette and padded away from its stitching.
// It reads on the back as well as the front; one material batch holds all panels.
function patch(outline, rise) {
  const shape = new THREE.Shape();
  shape.moveTo(...outline[0]);
  outline.slice(1).forEach(([u,v])=>shape.lineTo(u,v));
  shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:rise,bevelEnabled:true,bevelSize:.007,bevelThickness:.004,bevelSegments:1,steps:1});
  // silhouette x maps to lateral z, rise to front x, y remains vertical
  g.rotateY(Math.PI / 2);
  return g;
}
const patchShapes={
  bib:patch([[-.115,.142],[.115,.142],[.13,.015],[.165,-.132],[.177,-.265],[-.177,-.265],[-.165,-.132],[-.13,.015]],.013),
  pocket:patch([[-.064,.037],[.064,.037],[.058,-.025],[.012,-.045],[-.057,-.027]],.009),
  flap:patch([[-.11,.075],[.11,.075],[.117,-.050],[.079,-.075],[-.09,-.075],[-.118,-.052]],.015),
  lapel:patch([[-.035,.12],[.085,.153],[.092,.095],[.056,.068],[.084,.051],[-.03,-.109]],.010),
  shield:patch([[0,.102],[.081,.070],[.074,-.039],[0,-.108],[-.074,-.039],[-.081,.070]],.008),
  scarf:patch([[-.054,.082],[.059,.083],[.052,-.11],[.025,-.146],[0,-.116],[-.045,-.157],[-.069,-.12]],.014)
};
const sailorBand=pattern([[-1,.982,.982],[0,1,1],[1,.982,.982]],16);
const streetCuts=['atelier','poste','marche','manteau','marin','poste'];

export function dressCivilian(torso,head,look,high,tools) {
  const {part,small,cord}=tools,{pick,coat,trim,pelt}=look,style=streetCuts[pick%6];
  const ink='#354654',leather='#995f3c',canvas='#e5be82';
  function panel(parent,shape,x,y,z,color,rotationZ=0,rotationY=0,scale=1){
    return part(parent,patchShapes[shape],x,y,z,scale,scale,scale,color,0,rotationY,rotationZ);
  }
  if(style==='atelier'||style==='marche'){
    const fabric=style==='atelier'?'#426a80':'#cc9565';
    panel(torso,'bib',.183,-.008,0,fabric,-.035);
    if(high){
      for(const s of [-1,1]){
        cord(torso,[[.179,.108,s*.10],[.132,.17,s*.119],[.016,.209,s*.135],[-.132,.159,s*.127],[-.182,.068,s*.079]],.021,fabric);
        small(torso,.204,.11,s*.104,.01,.013,.013,'#f5bc64');
      }
      panel(torso,'pocket',.21,.024,0,style==='atelier'?ink:canvas);
      cord(torso,[[.173,-.161,-.107],[.205,-.18,0],[.173,-.161,.107]],.007,canvas);
      if(style==='marche')small(head,-.20,.033,.179,.104,.094,.093,pelt.shade);
    }
  }else if(style==='poste'){
    small(torso,-.012,-.146,.212,.125,.119,.069,leather);
    panel(torso,'flap',-.010,-.11,.257,canvas,0,-Math.PI/2,.93);
    if(high){
      cord(torso,[[-.02,.202,-.176],[.124,.15,-.122],[.194,.065,-.03],[.177,-.017,.115],[.052,-.114,.231]],.022,leather);
      cord(torso,[[-.02,.202,-.176],[-.117,.164,-.127],[-.195,.06,-.013],[-.181,-.042,.112],[-.05,-.114,.23]],.02,leather);
      small(torso,-.003,-.132,.286,.016,.023,.010,'#bc7841');
    }
  }else if(style==='manteau'){
    for(const s of [-1,1]){
      panel(torso,'lapel',.172,.002,.078*s,trim,0,-.33*s,s===1?1:.92);
      if(high)for(const y of [-.14,-.064,.005])small(torso,.181,y,s*.067,.012,.016,.016,'#5e4954');
    }
  }else{
    for(const [y,depth,width] of [[-.148,.186,.218],[-.063,.191,.218],[.023,.199,.225]]){
      part(torso,sailorBand,0,y,0,depth,.016,width,trim);
    }
    // Ribbed fold of the watch cap casts a rim around the face.
    small(head,-.035,.32,0,.263,.109,.268,coat);
    small(head,-.021,.293,0,.265,.048,.273,trim);
    small(head,-.071,.422,-.015,.055,.047,.05,coat);
  }
}

export function travelerScarf(cape,head,look,tools){
  const {part,small,cord}=tools;
  const accent=({lagon:'#db9852',foret:'#c78a54',braise:'#6d9c92',bruyere:'#b9a0ca'})[look.skinId]||'#db9852';
  const dark='#524257',cream='#f5d59c';
  small(cape,-.032,.053,0,.204,.07,.217,accent);
  small(cape,-.054,.029,0,.218,.044,.230,accent);
  // The scarf is tied behind the wearer's left shoulder; two padded ends
  // hang on the outside of the travelling cape, visible from the chase camera.
  small(cape,-.171,.029,-.157,.069,.054,.066,accent);
  part(cape,patchShapes.scarf,-.286,-.058,-.145,1,1.16,1,accent,-.20,Math.PI,-.59);
  part(cape,patchShapes.scarf,-.236,-.034,-.192,.83,.78,.83,cream,-.29,Math.PI,-.68);
  // Contrast panel sits against the sloping centre back. The needle points
  // up and the yarn trails off to the lower left.
  const badge=part(cape,patchShapes.shield,-.408,-.263,.018,1,1,1,dark,0,Math.PI,-.625);
  const custom=[[-.015,-.046,-.04],[-.023,-.016,.011],[-.026,.067,.037]];
  badge.updateMatrix();
  const follow=points=>points.map(([x,y,z])=>new THREE.Vector3(-x,y,-z).applyMatrix4(badge.matrix).toArray());
  cord(cape,follow(custom),.009,cream);
  cord(cape,follow([[-.02,.034,.025],[-.025,.046,-.014],[-.025,.015,-.043],[-.02,-.014,-.028],[-.02,-.006,.010]]),.007,accent);
  for(const s of [-1,1]){
    cord(head,[[.088,.055,.259*s],[.065,.038,.276*s],[.044,.062,.282*s]],.007,look.pelt.shade);
  }
}

// A needle-felted colour panel follows the skull so the cheek and nape meet in profile.
function peltPanel(toAngle, from, to, xRadius, zRadius) {
  const positions=[],uvs=[],indices=[],segments=26,rows=3;
  for(let row=0;row<=rows;row++)for(let i=0;i<=segments;i++){
    const u=i/segments,angle=toAngle(u),pitch=from(u)+(to(u)-from(u))*row/rows;
    const radius=Math.cos(pitch);
    positions.push(-.006+xRadius*radius*Math.cos(angle),.12+.249*Math.sin(pitch),zRadius*radius*Math.sin(angle));
    uvs.push(u*2,row/rows);
    if(row&&i){const d=row*(segments+1)+i,c=d-1,b=d-segments-1,a=b-1;indices.push(a,c,b,b,c,d);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export const foxBib=peltPanel(u=>(u-.5)*4.85,u=>-.89-.33*(1-Math.abs(2*u-1)),u=>{
  const f=Math.abs(2*u-1);
  return -.18 + .33*Math.sin(Math.PI*f) - .43*f*f + .07*Math.cos(f*Math.PI*4);
},.274,.291);
export const foxCrown=peltPanel(u=>u*Math.PI*2,u=>.63+.13*Math.cos(2*Math.PI*u)+.065*Math.cos(8*Math.PI*u),()=>1.56,.272,.288);
export const outerFoxEar=pattern([[-.046,.053,.068],[.015,.072,.102],[.088,.067,.077,-.014],[.15,.047,.050,-.026],[.209,.023,.023,-.035],[.238,.004,.003,-.037]],10);
