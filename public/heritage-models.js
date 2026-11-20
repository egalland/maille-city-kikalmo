const stone='#d8c7a5',carving='#efdebd',weathered='#b8a793',shadow='#8b807b',slate='#505663',tile='#9d604e',glass='#42586b',wood='#734d3b',brass='#c09b56',brick='#a25e50';
const surfaces=new Map(),tau=2*Math.PI;
// The model coordinates are forward from the western/public front, up, and right.
// All surfaces go through this builder for both renderers and roof contact.
function masonry(site){
  const faces=[],c=Math.cos(site.angle),s=Math.sin(site.angle);
  function face(p,color,mat='felt'){
    const world=p.map(([u,h,v])=>[site.x+c*u-s*v,h,site.y+s*u+c*v]);
    faces.push({p:world,color,mat});
  }
  function block(x,z,len,w,y,h,color=stone){
    const a=x-len/2,b=x+len/2,l=z-w/2,r=z+w/2,t=y+h;
    face([[a,y,l],[a,y,r],[a,t,r],[a,t,l]],color);
    face([[b,y,r],[b,y,l],[b,t,l],[b,t,r]],color);
    face([[a,y,r],[b,y,r],[b,t,r],[a,t,r]],color);
    face([[b,y,l],[a,y,l],[a,t,l],[b,t,l]],color);
    face([[a,t,l],[a,t,r],[b,t,r],[b,t,l]],color);
  }
  // Rectangular hip or gable along either local axis.
  function roof(x,z,len,w,base,rise,hip,color=slate,across=false){
    const at=(u,y,v)=>across?[x-v,y,z+u]:[x+u,y,z+v];
    const a=-len/2,b=-a,l=-w/2,r=-l,k=Math.min(len*.499,hip);
    const A=at(a,base,l),B=at(a,base,r),C=at(b,base,r),D=at(b,base,l),L=at(a+k,base+rise,0),R=at(b-k,base+rise,0);
    face([A,B,L],k?color:stone,k?'tileRoof':'felt');face([B,C,R,L],color,'tileRoof');
    face([C,D,R],k?color:stone,k?'tileRoof':'felt');face([D,A,L,R],color,'tileRoof');
  }
  function ring(x,z,r1,r2,y,h,n,color,phase=0,mat='felt'){
    const point=(i,r,Y)=>[x+r*Math.cos(phase+i*tau/n),Y,z+r*Math.sin(phase+i*tau/n)];
    for(let i=0;i<n;i++){
      const a=point(i,r1,y),b=point(i+1,r1,y),d=point(i,r2,y+h);
      if(r2){const q=point(i+1,r2,y+h);face([a,b,q,d],color,mat);face([d,q,[x,y+h,z]],color,mat);}
      else face([a,b,d],color,mat);
    }
  }
  function disk(at,r,y,color,n=12,off=.04){
    const p=[...Array(n)].map((_,i)=>at(Math.cos(i*tau/n)*r,y+Math.sin(i*tau/n)*r,off));
    for(let i=1;i<n-1;i++)face([p[0],p[i],p[i+1]],color,'plain');
  }
  // Local horizontal, vertical, depth coordinates on a wall, with depth positive outwards.
  const front=(u,v=0)=>(a,h,d=0)=>[u-d,h,v+a];
  const back=(u,v=0)=>(a,h,d=0)=>[u+d,h,v-a];
  const side=(v,u=0)=>(a,h,d=0)=>[u+Math.sign(v)*a,h,v+Math.sign(v)*d];
  function panel(at,l,r,b,t,color,d=.06,mat='felt'){
    face([at(l,b,d),at(r,b,d),at(r,t,d),at(l,t,d)],color,mat);
  }
  function outline(w,h,pointed){
    const rim=[];
    for(let i=0;i<=8;i++){
      const a=(1-i/4),k=Math.sqrt(Math.max(0,1-(pointed?(Math.abs(a)+1)**2/4:a*a)));
      rim.push([a*w*.5,h*(pointed?k/.866025403784:k)]);
    }
    return rim;
  }
  function arch(at,width,bottom,spring,rise,opt={}){
    const {molding=width*.09,pointed=true,door=false,mullion=true,inner=glass}=opt;
    const rim=outline(width,rise,pointed);
    const pane=[at(-width/2,bottom,.09),at(width/2,bottom,.09),...rim.map(([x,y])=>at(x,spring+y,.09))];
    for(let i=1;i<pane.length-1;i++)face([pane[0],pane[i],pane[i+1]],door?wood:inner,'plain');
    if(molding){
      const outer=outline(width+2*molding,rise+molding,pointed);
      for(let i=1;i<rim.length;i++){
        const [x,y]=rim[i-1],[X,Y]=rim[i],[a,b]=outer[i-1],[A,B]=outer[i];
        face([at(x,spring+y,.15),at(X,spring+Y,.15),at(A,spring+B,.22),at(a,spring+b,.22)],i%3?carving:weathered);
      }
      for(const s of [-1,1])panel(at,s*width/2,s*(width/2+molding),bottom,spring,carving,.17);
    }
    if(mullion){
      panel(at,-width*.033,width*.033,bottom,spring+rise*.85,door?shadow:weathered,.23);
      if(!door)panel(at,-width*.49,width*.49,spring-.12,spring+.06,weathered,.22);
    }
  }
  function clock(at,y,r){
    disk(at,r*1.13,y,shadow,16,.35);disk(at,r,y,'#f6e7bf',16,.38);
    for(let i=0;i<12;i++){const a=i*tau/12,x=Math.sin(a),v=Math.cos(a);
      face([at(x*r*.73-v*r*.045,y+v*r*.73+x*r*.045,.40),at(x*r*.90-v*r*.045,y+v*r*.90+x*r*.045,.40),at(x*r*.90+v*r*.045,y+v*r*.90-x*r*.045,.40),at(x*r*.73+v*r*.045,y+v*r*.73-x*r*.045,.40)],shadow,'plain');}
    face([at(-.05*r,y,.42),at(-.44*r,y+.31*r,.42),at(.04*r,y+.09*r,.42)],wood);
    face([at(-.05*r,y,.42),at(.31*r,y+.68*r,.42),at(.07*r,y+.02*r,.42)],wood);
  }
  // Arched masonry above a real cut-out. The dark space behind the louvres stays open.
  function belfry(at,width,y,h,openings,louvres){
    const pitch=width/openings,gap=pitch*.58,start=-width/2,fall=h*.28;
    for(let i=0;i<openings;i++){
      const cx=start+pitch*(i+.5),end=y+h;
      panel(at,cx-pitch/2,cx-gap/2,y,end,stone,.015); panel(at,cx+gap/2,cx+pitch/2,y,end,stone,.015);
      const pt=outline(gap,fall,true);
      for(let j=1;j<pt.length;j++){
        const [A,B]=pt[j-1],[a,b]=pt[j];
        face([at(cx+A,end-fall+B,.015),at(cx+a,end-fall+b,.015),at(cx+a,end+.04,.015),at(cx+A,end+.04,.015)],stone);
      }
      if(louvres)for(let j=1;j<=4;j++)panel(at,cx-gap*.49,cx+gap*.49,y+h*j*.143,y+h*j*.143+.16,'#615b5a',-.12);
    }
  }
  function squareBells(x,z,w,y,h,n,detail){
    const f=[front(x-w/2,z),back(x+w/2,z),
      (a,Y,d=0)=>[x+a,Y,z+w/2+d],(a,Y,d=0)=>[x-a,Y,z-w/2-d]];
    for(const at of f)belfry(at,w,y,h,n,detail);
    for(const sx of [-1,1])for(const sz of [-1,1])
      block(x+sx*w*.42,z+sz*w*.42,w*.16,w*.16,y,h+.18,weathered);
  }
  function cross(x,z,y,h){
    block(x,z,h*.055,h*.055,y,h,brass);block(x,z,h*.05,h*.49,y+h*.66,h*.06,brass);
  }
  return {faces,face,block,roof,ring,arch,panel,front,back,side,clock,belfry,squareBells,cross};
}

function cathedral(m,details){
  const {block,roof,ring,arch,front,side,face,squareBells,cross}=m;
  // Three vaulted porch bays, a westwork with unequal belfries and an eastward nave.
  block(3.8,0,7.6,32,0,9.9);roof(3.8,0,32.5,8,9.9,3.3,0,tile,true);
  for(const z of [-10.3,0,10.3]){
    const w=z?6.5:7.9;arch(front(-.09,z),w,.1,4.2,z?3.3:4.4,{door:true,molding:.64});
    if(details){arch(front(-.29,z),w*.78,.1,3.8,z?2.9:3.6,{door:true,molding:.28});}
    for(const s of [-1,1])block(.2,z+s*(w*.56),1.1,.49,0,4.75,weathered);
  }
  for(const [u,v,h] of [[-3,3.45,7.8],[-2.9,-6.89,3.7]]){
    block(u,v,2.7,1.8,0,h*.65,weathered);block(u,v,2.15,1.36,h*.65,h*.20,stone);
    roof(u,v,2.45,1.86,h*.85,h*.15,1.1,carving);
  }
  // The small separate masonry outbuilding on the south side of the parvis.
  block(8.12,22.75,4.7,4.9,0,4.9,stone);
  roof(8.12,22.75,5.1,5.27,4.9,2.5,1.9,slate);
  if(details){
    arch(front(5.76,22.75),1.4,.12,2.5,.85,{door:true,molding:.16});
    arch(side(25.20,8.12),1.32,1.2,3.22,.65,{molding:.13});
  }
  block(13.8,0,12.1,31.75,0,24);
  roof(14,0,15.5,12.4,24,5,0,tile);
  for(const sign of [-1,1]){
    const z=sign*10.3,w=10.4,y=sign<0?43.2:40.2;
    block(13.2,z,w,w,14.5,14.7);
    block(13.2,z,w*.71,w*.71,29.0,8.3,'#6e6863');
    block(13.2,z,w*.64,w*.64,37.8,y+8.55-37.8,'#655d59');
    squareBells(13.2,z,w,29.2,7.9,2,false);block(13.2,z,w+.75,w+.75,37.1,.8,carving);
    squareBells(13.2,z,w,37.8,y+8.6-37.8,2,details);
    block(13.2,z,w+.8,w+.8,y+8.6,.85,carving);
    roof(13.2,z,w+.45,w+.45,y+9.45,4,4.8,'#5b5c63');
    for(const a of [-1,1])for(const b of [-1,1]){
      const x0=13.2+a*4.64,z0=z+b*4.64;
      block(x0,z0,1.25,1.25,23.4,7,weathered);
      if(details){block(x0,z0,1.52,1.52,y+9.2,1.3);ring(x0,z0,1.05,0,y+10.5,4.0,4,'#757478',Math.PI/4);}
    }
    cross(13.2,z,y+13.4,2.2);
    if(details){
      for(const u of [10.8,15.4])arch(side(z+sign*w/2,u),2.45,20,24.8,2.2,{molding:.31});
      arch(front(7.99,z),4.1,16.5,22,3.8,{molding:.46});
    }
  }
  if(details){
    for(const z of [-15.1,-5.0,5.0,15.1]){
      block(.34,z,1.05,.95,0,10.75,carving);
      block(.34,z,1.34,1.24,9.48,.42,weathered);
      ring(.34,z,.70,0,10.75,2.5,4,carving,Math.PI/4);
    }
    for(const z of [-10.3,0,10.3]){
      const w=z?6.5:7.9;
      for(const sign of [-1,1])for(let i=0;i<3;i++)
        ring(-.22-i*.18,z+sign*(w*.40+i*.25),.14,.14,0,4.12,6,i%2?stone:carving);
    }
  }
  for(const z of [-3.3,0,3.3])arch(front(7.68,z),2.35,15,20.7,2.3,{molding:.20});
  block(48.4,.8,60.7,13.9,7.2,16.6);
  roof(48.4,.8,61.3,14.9,23.8,8.5,0,tile);
  for(const sign of [-1,1]){
    const z=sign*(sign>0?13.2:10.8);
    block(44.0,z,47.5,sign>0?11.5:8.4,0,10);
    roof(44.0,z,48,sign>0?12:9,10,4.5,2.5,'#9b6a55');
    for(let i=0;i<7;i++){
      const u=23.0+i*6.1,edge=sign>0?19:-15;
      block(u,edge,1.05,1.25,.15,9.9,weathered);
      if(details){
        // Pitched struts return the vault thrust into each aisle buttress.
        const outer=[u,10.3,edge],inner=[u,18.2,sign*7.1+.8];
        const p=(q,dx,h)=>[q[0]+dx,q[1]+h,q[2]];
        face([p(outer,-.32,0),p(inner,-.32,0),p(inner,-.32,1.0),p(outer,-.32,1.0)],weathered);
        face([p(outer,-.32,1.0),p(inner,-.32,1.0),p(inner,.32,1.0),p(outer,.32,1.0)],carving);
        arch(side(sign*6.95+.8,u+2.9),2.65,16.4,20.2,2.2,{molding:.22});
        arch(side(edge,u+2.7),2.55,3.2,7.1,1.8,{molding:.23});
      }
    }
  }
  // Semicircular ambulatory and rounded ends of the transept.
  for(const [x,z,r,eave,top] of [[87,.1,15,10,15.4],[86,.2,8,23.8,31],[68,14.9,9.1,16.4,23.7],[68,-14,8.2,16.4,23.7]]){
    ring(x,z,r,r,0,eave,14,stone);ring(x,z,r+.26,r*.28,eave,top-eave,14,tile);
    if(details)for(let i=0;i<14;i++){
      const a=(i+.5)*tau/14,dx=Math.cos(a),dz=Math.sin(a),at=(u,h,d=0)=>[x+dx*(r*.975+d)-dz*u,h,z+dz*(r*.975+d)+dx*u];
      arch(at,r*.24,eave*.36,eave*.75,r*.17,{molding:.16});
    }
  }
  block(66.8,.6,12.8,30,9.1,15);
  roof(67,.6,31,13.7,24.1,6.9,2,tile,true);
  // The long low annexes bound the irregular northern court in the surveyed outline.
  roof(16.8,-30.3,31,15.1,8.3,5.2,3.2,tile,true);
  roof(67.4,-31.6,29,14.1,8.3,5.2,3.2,tile,true);
}

function windowBay(m,at,width,sill,top,stonework=true){
  m.panel(at,-width*.5,width*.5,sill,top,glass,.10,'plain');
  if(!stonework)return;
  const rail=Math.min(.15,width*.065),mid=sill+(top-sill)*.64;
  for(const side of [-1,1])m.panel(at,side*width*.5-rail/2,side*width*.5+rail/2,sill-.12,top+.16,carving,.17);
  m.panel(at,-rail*.5,rail*.5,sill,top,carving,.16);
  for(const y of [sill-.08,mid,top])m.panel(at,-width*.54,width*.54,y,y+rail,carving,.17);
}
function dormer(m,x,z,w,h,y,frontward=true){
  const at=frontward?m.front(x-.6,z):m.back(x+.6,z);
  m.block(x,z,1.25,w,y,h,weathered);
  m.roof(x,z,1.5,w+.4,y+h,w*.65,0,slate);
  m.arch(at,w*.5,y+.22,y+h*.55,h*.25,{molding:.12});
}
function council(m,details){
  const {block,roof,ring,arch,front,back,clock,squareBells,face}=m;
  block(4.15,0,8.3,27.2,0,10.2);
  roof(4.2,0,27.65,9.2,10.2,7.6,.25,slate,true);
  // The old isolated belfry has disappeared. A small lantern rises on the slate ridge.
  ring(4.2,.15,1.09,1.02,17.45,1.25,8,shadow,Math.PI/8);
  squareBells(4.2,.15,1.55,18.6,1.6,1,false);
  ring(4.2,.15,1.28,.58,20.2,.9,8,slate,Math.PI/8);ring(4.2,.15,.56,0,21.1,2.7,8,slate);
  block(0,0,.32,27.1,4.20,.30,carving);block(0,0,.43,27.5,9.90,.30,carving);
  for(let i=0;i<5;i++){
    const z=(i-2)*5.05;
    windowBay(m,front(0,z),2.35,5.18,9.13,details);
    if(i===2)arch(front(-.06,z),1.9,.03,2.8,.74,{door:true,molding:.21});
    else windowBay(m,front(0,z),1.85,.95,3.21,details);
    if(details){
      dormer(m,1.92,z,2.22,1.65,12.25);
      for(const side of [-1,1]){
        const p=z+side*1.52;
        block(.0,p,.39,.16,5.02,5.07,carving);
        if(i===2&&side===1)continue;
        arch(front(-.16,p),.48,6.13,7.12,.44,{mullion:false,inner:shadow,molding:.11});
        ring(-.23,p,.34,0,7.65,1.03,4,carving,Math.PI/4);
      }
      windowBay(m,back(8.3,z),2.15,5.14,8.7);
    }
  }
  if(details){
    for(let i=-17;i<=17;i++){
      const v=i*.77;
      block(-.10,v,.34,.24,9.58,.36,weathered);
      face([[-.24,9.91,v-.29],[-.24,9.91,v+.29],[-.36,9.67,v]],carving);
    }
    for(const z of [-10.1,-5.05,0,5.05,10.1]){
      block(-.12,z,.42,2.77,9.14,.19,carving);
      m.panel(front(-.16,z),-.94,.94,4.78,4.92,weathered,.18);
    }
    // The clock occupies the round-arched pediment underneath the roof lantern.
    const at=front(-.40);
    face([at(-2.12,10.16),at(2.12,10.16),at(1.37,11.88),at(-1.37,11.88)],stone);
    arch(at,2.62,10.18,11.34,1.11,{pointed:false,mullion:false,inner:stone,molding:.22});
    clock(front(-.64),11.37,.73);
    for(const z of [-10.1,-5.05,0,5.05,10.1]){
      block(-.20,z,.47,2.58,4.93,.25,'#6b5445');
      for(let k=-3;k<=3;k++)block(-.31,z+k*.32,.28,.29,5.15,.2,k%2?'#a96361':'#778562');
    }
    for(const z of [-12.6,12.6]){block(0,z,.55,.5,0,10.3,carving);
      ring(0,z,.52,0,10.3,1.9,4,carving,Math.PI/4);}
  }
  // Surveyed projection beneath the projecting masonry wing on the street.
  block(-1.51,-10.41,3.0,5.7,0,8.0,stone);
  roof(-1.51,-10.41,6.1,3.35,8.,1.85,.9,slate,true);
  windowBay(m,front(-3.15,-10.4),2.1,4.57,7.46,details);
  arch(front(-3.15,-10.4),2.53,.08,2.18,.88,{pointed:false,door:true,molding:.22});
  // The assembly hall behind the court runs at right angles to the ornate street front.
  block(33.8,19.5,28.7,16.2,0,10.1,'#c1af95');
  roof(33.8,19.5,29.1,16.9,10.1,6.4,1.6,slate);
  ring(9,1.7,2.25,2.25,7,7.2,12,stone);
  ring(9,1.7,2.49,0,14.2,6,12,slate);
}
function villageChurch(m,details,kind){
  const {block,roof,ring,arch,front,side,clock,squareBells,cross,face}=m;
  if(kind==='pont'){
    block(13.4,-.3,17.1,11.6,0,6.2);roof(13.4,-.3,18,12.2,6.2,4.25,0,tile);
    block(18.65,-.55,6.2,14.5,0,5.65);roof(18.65,-.55,15.1,6.6,5.65,3.1,1.2,tile,true);
    ring(22.5,.03,5.1,5.1,0,5.5,10,stone);ring(22.5,.03,5.45,1.8,5.5,3.2,10,tile);
    block(2.85,0,5.65,5.9,0,14.4,stone);
    block(2.85,0,5.96,6.12,9.83,.35,carving);block(2.85,0,5.96,6.12,14.22,.32,carving);
    squareBells(2.85,0,5.7,14.55,3.8,2,details);
    block(2.85,0,6.05,6.15,18.4,.45,carving);
    roof(2.85,0,5.64,5.9,18.85,1.38,2.75,weathered);
    for(const i of [-1,1])for(const j of [-1,1]){
      const x=2.85+i*2.53,z=j*2.67;
      for(let n=0;n<4;n++)block(x,z,1.34-n*.22,1.34-n*.22,18.64+n*.48,.50,carving);
    }
    for(const at of [front(.0),side(2.95,2.85),side(-2.95,2.85)]){
      m.panel(at,-1.12,1.12,11.15,13.4,weathered);clock(at,12.28,.91);
    }
    arch(front(0),3.75,.07,3.06,1.84,{pointed:false,door:true,molding:.38});
    for(const z of [-2.27,2.27])block(.12,z,.43,.42,0,9.4,carving);
    cross(2.85,0,20.2,1.15);
    if(details)for(const sign of [-1,1])for(const u of [8.15,12.1,16.0]){
      arch(side(sign*5.8-.3,u),1.68,3.1,4.75,.78,{pointed:false,molding:.15});
      block(u+1.5,sign*5.8-.3,.45,.58,0,4.95,weathered);
    }
  }else if(kind==='briques'){
    block(13.6,.85,26.6,9.2,0,6.2);roof(13.6,.85,27.1,9.7,6.2,4.45,.2,slate);
    block(2,-.8,4.06,12.9,0,7.25);
    const at=front(-.04,-.80);
    face([at(-6.5,7.1),at(6.5,7.1),at(0,10.8)],stone);
    arch(at,2.85,.05,2.8,1.32,{pointed:false,door:true,molding:.39});
    arch(at,1.12,4.64,5.83,.64,{pointed:false,mullion:false,inner:shadow,molding:.22});
    for(const sign of [-1,1])for(const u of [4.12,5.50]){
      const z=-.8+sign*u;block(0,z,.42,.58,0,6.99,carving);
      block(0,z,.60,.87,6.58,.36,carving);
    }
    block(0,-.8,.59,13.35,6.90,.54,carving);
    if(details)for(let j=-9;j<=9;j++)m.panel(at,j*.65-.06,j*.65+.06,6.98,7.28,weathered,.38);
    block(4.8,-.23,3.25,3.16,9,1.80,slate);
    squareBells(4.8,-.23,2.82,10.8,2.4,1,details);
    roof(4.8,-.23,3.28,3.22,13.2,4,1.6,slate);cross(4.8,-.23,17.2,1.05);
    for(const sign of [-1,1])for(const u of [8.5,13.3,18.2,23]){
      if(details)arch(side(.85+sign*4.6,u),1.72,2.93,4.64,1.04,{pointed:false,molding:.16});
    }
  }else{
    block(18.1,.6,25.6,9.1,0,6.4);roof(18.1,.6,26.1,9.65,6.4,4.28,.6,slate);
    block(26.1,.1,10.4,16.9,0,5.5);roof(26.1,.1,17.5,10.9,5.5,4.2,.85,slate,true);
    ring(30.2,.4,4.2,4.2,0,5.48,8,stone);ring(30.2,.4,4.48,1.05,5.48,3.81,8,slate);
    block(2.65,0,5.3,5.4,0,10.65);
    squareBells(2.65,0,5.1,10.65,3.25,2,details);
    roof(2.65,0,5.7,5.8,13.9,3.56,2.85,slate);
    ring(2.65,0,1.20,1.05,17.4,.58,8,shadow);
    for(let i=0;i<8;i++)ring(2.65+.94*Math.cos(i*tau/8),.94*Math.sin(i*tau/8),.11,.11,17.95,1.38,4,carving);
    ring(2.65,0,1.26,.99,19.3,.63,8,slate);ring(2.65,0,.99,.23,19.93,.67,8,slate);
    cross(2.65,0,20.59,.93);
    arch(front(-.04),2.65,.06,2.38,1.46,{pointed:false,door:true,molding:.27});
    if(details)for(const sign of [-1,1])for(const u of [8.3,13.5,18.8]){
      arch(side(sign*4.55+.6,u),1.7,2.1,4.5,1.15,{molding:.18});
    }
  }
}
function villageHall(m,details,isBrick){
  const {block,roof,panel,front,back}=m;
  const w=isBrick?19.3:18.55,depth=isBrick?10.35:6.19,eave=isBrick?7.7:4.76;
  const wall=isBrick?brick:'#d7c6a8',cover=isBrick?'#a3604a':slate;
  block(depth/2,0,depth,w,0,eave,wall);
  roof(depth/2,0,w+.65,depth+.64,eave,isBrick?4.6:3.34,depth*.40,cover,true);
  block(.12,0,.44,w,.45,.29,weathered);block(.05,0,.4,w,eave-.17,.25,carving);
  const rows=isBrick?[1.10,4.48]:[1.08];
  for(const [ri,sill] of rows.entries())for(let i=-2;i<=2;i++){
    const at=front(-.05,i*w*.181),top=sill+(isBrick?2.01:2.46);
    if(!ri&&!i){panel(at,-.8,.8,.08,top,wood,.12);
      panel(at,-.93,.93,top,top+.18,carving,.17);
      panel(at,-.05,.05,.08,top,weathered,.18);
    }else windowBay(m,at,1.4,sill,top,details);
    if(details)windowBay(m,back(depth,i*w*.182),1.26,sill,top-.15);
  }
  for(const s of [-1,1])for(let n=0;n<Math.floor(eave/.64);n++)
    block(.16,s*(w*.5-.29),.45, n%2?.49:.73,n*.64,.59,carving);
  if(isBrick){
    block(18.9,2.56,10.2,7.5,0,3.78,brick);
    roof(18.9,2.56,10.55,7.89,3.78,3.0,1.97,cover);
    if(details)for(const v of [-6.1,0,6.1])dormer(m,1.62,v,1.75,1.34,8.45);
  }
  block(depth*.67,-w*.29,.83,.70,eave+1.5,2.70,brick);
}

function silhouette(m,key){
  const {block,roof,ring}=m;
  if(key==='cathedrale'){
    block(47,.9,61,14,7.2,16.6);roof(48,.9,62,15,23.8,8.5,0,tile);
    block(13,0,12,31,7,17);
    for(const sign of [-1,1]){
      const h=sign<0?52:49,z=sign*10.3;
      block(13.2,z,10.6,10.6,20,h-20);roof(13.2,z,11,11,h,4.7,5,slate);
      m.arch(m.front(7.85,z),4.7,h-11,h-5,3.7,{molding:0,inner:shadow});
    }
    roof(4,0,32,8,9.9,3.3,0,tile,true);
    roof(45,14,48,10,10,4.5,2,tile);roof(45,-11,48,9,10,4.5,2,tile);
    ring(86,.2,14.9,14.9,0,10,10,stone);ring(86,.2,15.1,3,10,6.4,10,tile);
    block(67,.5,13,35,7,16.8);roof(67,.5,35,14,23.8,6.9,2,tile,true);
    roof(16.8,-30.3,31,15,8.3,5.2,3,tile,true);roof(67.4,-31.6,29,14,8.3,5.2,3,tile,true);
  }else if(key==='hotel-ville'){
    block(4.2,0,8.4,27.4,0,10.2);roof(4.2,0,27.7,9.2,10.2,7.6,.25,slate,true);
    ring(4.2,0,1.04,.72,17.5,2.8,6,stone);ring(4.2,0,.9,0,20.3,2.8,6,slate);
    for(const v of [-10,-5,0,5,10])dormer(m,1.92,v,2.2,1.65,12.25);
    block(33.8,19.5,28.7,16.2,0,10.1);roof(33.8,19.5,29.1,16.9,10.1,6.4,1.6,slate);
  }else if(key.startsWith('mairie')){
    villageHall(m,false,key==='mairie-briques');
  }else{
    const large=key==='eglise-saules',flat=key==='eglise-pont',L=large?32:27,H=flat?18.7:large?14:11;
    block(L/2,0,L,10,0,6.3);roof(L/2,0,L+.5,11,6.3,4.3,1,flat?tile:slate);
    block(3,0,5.5,5.55,3.3,H-3.3);roof(3,0,5.85,5.85,H,flat?1.7:3.4,2.9,flat?stone:slate);
    if(large||!flat)ring(3,0,1.2,.5,H+3.3,large?3:2.2,8,slate);
    m.arch(m.front(.2),2.55,H-4,H-1.7,1.1,{molding:0,inner:shadow});
  }
}
export function heritageModel(site,details=true){
  const key=site.key+'/'+details;
  if(surfaces.has(key))return surfaces.get(key);
  const model=masonry(site);
  if(details==='silhouette')silhouette(model,site.key);
  else switch(site.key){
    case 'cathedrale':cathedral(model,details);break;
    case 'hotel-ville':council(model,details);break;
    case 'mairie-pont':villageHall(model,details,false);break;
    case 'mairie-briques':villageHall(model,details,true);break;
    default:villageChurch(model,details,site.key.slice(7));
  }
  surfaces.set(key,model.faces);
  return model.faces;
}

// Index roof triangles in metre-space. Walking, camera clearance and rotor
// clearance can then query the actual tower/roof above this part of the plan.
const roofIndices=new Map(),cell=6;
function roofIndex(site){
  if(roofIndices.has(site))return roofIndices.get(site);
  const map=new Map();
  for(const face of heritageModel(site,false)){
    const p=face.p;
    for(let i=1;i<p.length-1;i++){
      const [a,b,c]=[p[0],p[i],p[i+1]],det=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
      if(Math.abs(det)<.001)continue;
      const top=[a,b,c,det],xs=[a[0],b[0],c[0]],zs=[a[2],b[2],c[2]];
      for(let gx=Math.floor(Math.min(...xs)/cell);gx<=Math.floor(Math.max(...xs)/cell);gx++)
        for(let gz=Math.floor(Math.min(...zs)/cell);gz<=Math.floor(Math.max(...zs)/cell);gz++){
          const k=gx+':'+gz;if(!map.has(k))map.set(k,[]);map.get(k).push(top);
        }
    }
  }
  roofIndices.set(site,map);return map;
}
export function heritageHeight(site,x,z,foundation=site.plinth){
  let height=foundation;
  for(const [a,b,c,det] of roofIndex(site).get(Math.floor(x/cell)+':'+Math.floor(z/cell))||[]){
    const u=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/det;
    const v=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/det;
    if(u>=-.0002&&v>=-.0002&&u+v<1.0002)height=Math.max(height,a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]));
  }
  return height;
}
