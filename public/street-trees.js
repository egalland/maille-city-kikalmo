// Bark and leaf sprays are batched and instanced separately.
// The three species retain their branching and outer contour in both detail levels.
const trees = [
  { bark:'#796651', wood:'#96826a', grain:'#b59a76', foliage:['#456854','#5d8163','#799775','#96ac80'], span:1.47, tip:6.22, girth:.23, lean:.12 },
  { bark:'#756c59', wood:'#827a60', grain:'#9f9879', foliage:['#606f4b','#79885a','#97a46f','#b0b783'], span:.85, tip:6.66, girth:.16, lean:-.09 },
  { bark:'#b3a590', wood:'#a6957b', grain:'#746b62', foliage:['#4c756c','#628c7b','#81a893','#a0bba0'], span:1.24, tip:6.09, girth:.17, lean:.40 }
];
const tau = Math.PI * 2;
const golden = 2.39996323;
const offset = ([x,y,z], angle, distance, rise) => [x+Math.cos(angle)*distance, y+rise, z+Math.sin(angle)*distance];

// A leaf cluster is an alpha-cut twig with dozens of stems and individual felt leaves.
// It is drawn once at load time and reused by both renderers.
export function paintLeafTwig(g, size) {
  g.save();
  g.scale(size/256,size/256);
  function stem(x,y,u,v,w) {
    g.strokeStyle='#8d8272';g.lineWidth=w;g.lineCap='round';g.beginPath();
    g.moveTo(x,y);g.lineTo(u,v);g.stroke();
  }
  function leaf(x,y,angle,len,width,tone) {
    g.save();g.translate(x,y);g.rotate(angle);
    g.fillStyle=tone;g.beginPath();g.moveTo(0,0);
    g.bezierCurveTo(-width*.9,-len*.12,-width*1.1,-len*.62,0,-len);
    g.bezierCurveTo(width*.2,-len*.82,width*1.38,-len*.28,0,0);g.fill();
    g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(width*.08,-len*.36,0,-len*.85);
    g.strokeStyle='rgba(74,82,63,.47)';g.lineWidth=1.25;g.stroke();
    g.restore();
  }
  const tones=['#d0d0ac','#e6e6ce','#b4b6a2','#dcdccb','#fbf6d8'];
  const xAt=u=>118+15*u+7*Math.sin(u*4);
  for(let i=0;i<8;i++){
    const u=i/8+.04,v=(i+1)/8+.04;
    stem(xAt(u),250-207*u,xAt(v),250-207*v,3.8-2*u);
  }
  for(let i=0;i<7;i++)for(const side of [-1,1]){
    const u=(i+.6)/8, x=xAt(u), y=250-u*211+(side===1?0:8);
    const span=(1-.55*u)*(61+19*Math.sin(u*4));
    const endX=x+span*side,endY=y-46+9*Math.sin(i*4+side);
    stem(x,y,endX,endY,2.3-u);
    for(let j=1;j<=4;j++){
      const f=j/4, xx=x+(endX-x)*f, yy=y+(endY-y)*f;
      const len=33+7*Math.sin(i*2+j+side), w=15+3.7*Math.cos(i+j*2.4);
      leaf(xx,yy,side*(j%2===0?.35:1.62),len,w,tones[(i+2*j+(side+1))%tones.length]);
    }
    leaf(endX,endY,side*.92,36,13,tones[(i+3)%tones.length]);
  }
  leaf(xAt(1.04),34,-.12,30,12,'#e8e8d1');
  g.restore();
}

function drawSpray(b, origin, facing, size, dye, phase, distant) {
  const count=distant?4:7;
  for (let i=0;i<count;i++){
    const a=facing+i*tau/count+.24*Math.sin(i*3+phase);
    const length=size*(.85+.22*Math.cos(i*3.7+phase));
    const tilt=.16+.73*Math.sin(i*2.82+phase);
    const end=offset(origin,a,length,length*tilt);
    const roll=(i%2?1:-1)*(.60+.24*Math.cos(phase*2+i*1.5));
    const width=size*(distant?.73:.64);
    const side=point=>offset(point,a+Math.PI/2,width,width*roll);
    const other=point=>offset(point,a-Math.PI/2,width,-width*roll);
    const color=dye[1+(Math.cos(a+phase)>.2?1:0)+(Math.sin(a-phase)>.82?1:0)];
    b.face('foliage',other(origin),side(origin),side(end),other(end),color);
  }
}

// Tapered branch joins can meet inside the trunk or foliage without drawing an internal cap.
function branch(b,a,end,r,s,col,sides) {
  if (b.segment) return b.segment(a,end,r,s,col);
  const dx=end[0]-a[0],dy=end[1]-a[1],dz=end[2]-a[2];
  const length=Math.hypot(dx,dy,dz), p=Math.hypot(dx,dz);
  const ux=p>1e-7?dz/p:1,uz=p>1e-7?-dx/p:0;
  const vx=dy*uz/length,vy=(dz*ux-dx*uz)/length,vz=-dy*ux/length;
  function ring(center,radius,i){
    const u=radius*Math.cos(tau*i/sides),v=radius*Math.sin(tau*i/sides);
    return [center[0]+ux*u+vx*v,center[1]+vy*v,center[2]+uz*u+vz*v];
  }
  for (let i=0;i<sides;i++)
    b.face('felt',ring(a,r,i),ring(a,r,i+1),ring(end,s,i+1),ring(end,s,i),col);
}

export function drawStreetTree(b, variant, stage=0, distant=false) {
  const species = variant%trees.length, t = trees[species], sections = distant ? 4 : 6;
  const point = y => [t.lean*(y/t.tip)**1.3 + .09*Math.sin(y*1.34+species)*y/t.tip, y, .105*Math.sin(y*.87)*y/t.tip];
  const heights = [0,.25,2.0,3.3,4.35,5.35,t.tip];
  const radii = [1.65,1,.83,.66,.50,.30,.07].map(r=>r*t.girth);
  for (let i=0;i<heights.length-1;i++) {
    branch(b,point(heights[i]),point(heights[i+1]),radii[i],radii[i+1],i<3?t.bark:t.wood,sections);
  }
  if (!distant) {
    for (let i=0;i<5;i++) {
      const angle = i*golden + species;
      branch(b,offset(point(.035),angle,.38+(i%2)*.08,0),offset(point(.30),angle,t.girth*.60,.09),.042,.09,t.bark,5);
    }
    // Birch has short horizontal lenticels; on darker trunks the grain follows the trunk.
    for (let i=0;i<12;i++) {
      const y=.47+.19*i, r=t.girth*(.99-.105*y), a=i*golden, c=point(y);
      branch(b,offset(c,a,r,0),offset(c,a+(species===2?.86:.19),r-.006,species===2?.022:.20),.014,.008,t.grain,4);
    }
  }
  const count = species===1 ? 13 : 11;
  for (let i=0;i<count;i++) {
    const u=i/(count-1), a=species*.74+i*golden;
    const h=2.0+u*(t.tip-2.62);
    if (stage===2 && i===2) {
      branch(b,point(h),offset(point(h),a,.39,.22),.098,.067,t.bark,sections);
      continue;
    }
    const reach=t.span*(.55+.56*Math.sin(Math.PI*(u*.77+.16)))*(1-.38*u)*(.93+.16*Math.sin(i*1.83+.5));
    const elbow=offset(point(h),a+.1,reach*.55,(species===1?.78:.43)*(1-.75*u));
    const end=offset(elbow,a-.08,reach*.53,(species===1?.99:1.04)*(1-.86*u));
    const r=t.girth*(.55-.35*u);
    branch(b,point(h),elbow,r,r*.64,t.bark,sections);
    branch(b,elbow,end,r*.64,.024,t.wood,sections);
    const size=(.96-.17*u)*(species===1?.71:1.08);
    for (let j=0;j<2;j++) {
      const heading=j===0?a:a+(i%2===0?1.08:-1.08), stem=j===0?end:elbow;
      const tip=offset(stem,heading,(j===0?.21:.66)*size,.22+.13*Math.sin(i*1.83+j));
      if (!distant) branch(b,stem,tip,.038,.014,t.wood,4);
      drawSpray(b,tip,heading,size*(j===0?1:.85),t.foliage,i+j*2.2,distant);
    }
    if(i%2===0)drawSpray(b,elbow,a+1.83,size*.94,t.foliage,i+.73,distant);
  }
  drawSpray(b,point(t.tip),species,.50,t.foliage,.26,distant);
}

// Sprite mode projects the same branch cards through its fixed view. Order is local to each baked sprite.
const twigTints=new Map();
let leafMask;
function coloredTwig(color) {
  if(twigTints.has(color))return twigTints.get(color);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  if(!leafMask){
    leafMask=document.createElement('canvas');leafMask.width=256;leafMask.height=256;
    paintLeafTwig(leafMask.getContext('2d'),256);
  }
  const ctx=canvas.getContext('2d');ctx.drawImage(leafMask,0,0);
  ctx.globalCompositeOperation='multiply';ctx.fillStyle=color;ctx.fillRect(0,0,256,256);
  ctx.globalCompositeOperation='destination-in';
  ctx.drawImage(leafMask,0,0);
  twigTints.set(color,canvas);return canvas;
}
export function paintStreetTree(g,variant,stage) {
  const faces=[];
  function face(points,color,leaf=false) {
    const depth=points.reduce((sum,p)=>sum+p[2],0)/points.length;
    faces.push({points,color,depth,leaf});
  }
  drawStreetTree({
    face(material,a,b,c,d,col){face([a,b,c,d],col,material==='foliage');},
    segment(a,b,r,s,col){
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      const edge=(p,w)=>[p[0]+nx*w,p[1]+ny*w,p[2]];
      face([edge(a,r),edge(b,s),edge(b,-s),edge(a,-r)],col);
    }
  },variant,stage,false);
  const project=([x,y,z])=>[52+x*18.0,143-y*19.4+z*.95];
  faces.sort((a,b)=>a.depth-b.depth);
  for (const {points,color,leaf} of faces) {
    const p=points.map(project);
    if(leaf){
      const [bottomLeft,,topRight,topLeft]=p;
      g.save();
      g.transform((topRight[0]-topLeft[0])/256,(topRight[1]-topLeft[1])/256,
        (bottomLeft[0]-topLeft[0])/256,(bottomLeft[1]-topLeft[1])/256,...topLeft);
      g.drawImage(coloredTwig(color),0,0);g.restore();
    }else{
      g.fillStyle=color;g.beginPath();g.moveTo(...p[0]);
      for (const v of p.slice(1))g.lineTo(...v);
      g.closePath();g.fill();
    }
  }
}
