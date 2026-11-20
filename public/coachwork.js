import {BufferGeometry, Float32BufferAttribute, MeshPhongMaterial} from './three.js';

// A continuous stamped body wraps under the sill and turns into the wheel wells.
// Keeping longitudinal bands separate preserves the crease along the shoulder.
export const enamel = new MeshPhongMaterial({vertexColors:true, specular:0x655c4f, shininess:32});

function geometry(positions,uvs,indices){
  const shape=new BufferGeometry();
  shape.setAttribute('position',new Float32BufferAttribute(positions,3));
  shape.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  shape.setIndex(indices);shape.computeVertexNormals();
  return shape;
}

export function coachBody(stations,axles,radius,opening){
  return ringGeometry(coachRings(stations,axles,radius,14,opening));
}
export function coachRings(stations,axles,radius,steps=14,opening){
  const xs=new Set(stations.map(([x])=>x)),clearance=radius+.055;
  if(opening)for(const x of [opening[0]-.022,opening[0],opening[1],opening[1]+.022])xs.add(x);
  for(const axle of axles){
    for(let n=0;n<=steps;n++)xs.add(axle-clearance*Math.cos(Math.PI*n/steps));
  }
  const rings=[...xs].sort((a,b)=>a-b).map(x=>{
    const i=stations.findIndex(s=>s[0]>=x),b=stations[Math.max(i,0)],a=stations[Math.max(0,i-1)];
    const t=(x-a[0])/(b[0]-a[0]||1);
    const [,floor,belt,width]=a.map((v,j)=>v+(b[j]-v)*t);
    const dx=Math.min(...axles.map(axle=>Math.abs(x-axle)));
    const arch=dx<=clearance+1e-6?Math.max(0,radius+Math.sqrt(Math.max(0,clearance*clearance-dx*dx))-floor):0;
    const sill=floor+arch, shoulder=Math.max(belt,sill+.082);
    const w=width+arch*.082;
    const side=s=>[
      [x,floor-.030,s*width*.70],[x,sill-.019,s*(w-.103)],
      [x,sill,s*(w-.026)],[x,sill+.028,s*w],
      [x,.49*(sill+.03)+.51*(shoulder-.04),s*(w-.009)],
      [x,shoulder-.047,s*(w-.026)],[x,shoulder,s*(w-.081)],
      [x,shoulder+.018,s*width*.69]
    ];
    // Press the cockpit well into the shell between the A- and C-pillars.
    const inside=opening&&x>=opening[0]&&x<=opening[1],deck=inside?floor+.027:shoulder+.017;
    return [...side(-1),[x,deck,-width*.68],[x,deck,width*.68],...side(1).reverse()];
  });
  return rings;
}

export function ringGeometry(rings){
  const positions=[],uvs=[],indices=[],sides=rings[0].length;
  for(let side=0;side<sides;side++){
    const next=(side+1)%sides, offset=positions.length/3;
    for(let i=0;i<rings.length;i++){
      positions.push(...rings[i][side],...rings[i][next]);uvs.push(i/(rings.length-1),0,i/(rings.length-1),1);
      if(i){
        const a=offset+2*(i-1),b=a+1;
        indices.push(a,b,a+2,b,b+2,a+2);
      }
    }
  }
  for(const [end,reverse] of [[0,true],[rings.length-1,false]]){
    const ring=rings[end],offset=positions.length/3;
    const centre=ring.reduce((p,q)=>p.map((v,k)=>v+q[k]/sides),[0,0,0]);
    positions.push(...centre);uvs.push(.5,.5);
    for(const point of ring){positions.push(...point);uvs.push(point[2],point[1]);}
    for(let j=0;j<sides;j++){
      const a=offset+1+j,b=offset+1+(j+1)%sides;
      indices.push(offset,...(reverse?[b,a]:[a,b]));
    }
  }
  return geometry(positions,uvs,indices);
}

// Stations go from rear to nose. The crown is wider than the underside so the
// light catches a pressed shoulder instead of reading as an inflated ellipse.
export function pressedShell(parts,stations,color,surface='enamel'){
  const rings=stations.map(([x,bottom,top,w])=>{
    const h=top-bottom;
    return [[x,bottom,-w*.57],[x,bottom+h*.19,-w*.86],[x,bottom+h*.55,-w],
      [x,bottom+h*.80,-w*.94],[x,top-h*.035,-w*.62],[x,top,0],
      [x,top-h*.035,w*.62],[x,bottom+h*.80,w*.94],[x,bottom+h*.55,w],
      [x,bottom+h*.19,w*.86],[x,bottom,w*.57]];
  });
  parts.push({kind:'shell',rings,c:color,surface});
}

export function mudguard(parts,cx,cy,radius,halfWidth,start,end,color){
  const rings=[];
  for(let i=0;i<=10;i++){
    const a=(start+(end-start)*i/10)*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
    const profile=[[-1,-.017],[-1,.007],[-.82,.025],[0,.033],[.82,.025],[1,.007],[1,-.017],[0,-.004]];
    rings.push(profile.map(([z,relief])=>[cx+cs*(radius+relief),cy+sn*(radius+relief),z*halfWidth]));
  }
  // Decreasing polar angle moves the stations from rear to front.
  parts.push({kind:'shell',rings,c:color,surface:'enamel'});
}
