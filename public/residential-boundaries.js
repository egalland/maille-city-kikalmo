// Each collision strip is also one render span. Subdivision makes walls follow
// the terrain and lets the chunk/grid indices stream only the visible street.
export function* boundarySpans(rows){
  for(let run=0;run<rows.length;run++){
    const [way,kind,heightDm,coords]=rows[run];
    // Surveyed lines with no recorded material get a consistent textile finish.
    const style=kind==='fence'?(way%4===0?'board':'mesh'):kind;
    const h=heightDm/10||({brick:1.32,stone:1.50,board:1.58,mesh:1.46})[style];
    const halfWidth=style==='hedge'?.48:style==='brick'||style==='stone'?.13:.075;
    for(let i=2;i<coords.length;i+=2){
      const ax=coords[i-2]/10,ay=coords[i-1]/10,dx=coords[i]/10-ax,dy=coords[i+1]/10-ay;
      const length=Math.hypot(dx,dy);
      if(length<.05)continue;
      const count=Math.ceil(length/12),angle=Math.atan2(dy,dx);
      for(let n=0;n<count;n++){
        const a=[ax+dx*n/count,ay+dy*n/count],b=[ax+dx*(n+1)/count,ay+dy*(n+1)/count];
        yield {type:'enclosure',id:'fence-'+run+'-'+i+'-'+n,way,style,a,b,
          x:(a[0]+b[0])*.5,y:(a[1]+b[1])*.5,angle,halfLength:length/count*.5,halfWidth,h};
      }
    }
  }
}

// In the three-dimensional scene, brick and wood have thickness and a top;
// mesh panels use an alpha-tested diamond weave to reveal the garden behind.
export function drawBoundary(batch,span,detail){
  const {a,b,style,h,halfWidth}=span,dx=b[0]-a[0],dy=b[1]-a[1],length=span.halfLength*2;
  const nx=-dy/length,ny=dx/length;
  const offset=(p,r)=>[p[0]+nx*r,p[1]+ny*r];
  const brick=style==='brick',wall=brick||style==='stone',mesh=style==='mesh';
  const color=wall?(brick?'#b57f6a':'#ac9b92'):mesh?'#76958a':'#a47f68';
  const mat=wall?'parcelMasonry':mesh?'parcelMesh':'parcelWood';
  const near=offset(a,halfWidth),far=offset(b,halfWidth),backA=offset(a,-halfWidth),backB=offset(b,-halfWidth);
  if(style==='hedge'){
    batch.wall('felt',near,far,0,h*.70,'#46634c');
    batch.wall('felt',backB,backA,0,h*.70,'#405944');
    batch.wall('felt',backA,near,0,h*.71,'#425d48');
    batch.wall('felt',far,backB,0,h*.71,'#425d48');
    batch.quad('felt',[near,far,backB,backA],h*.71,'#5c7952');
    const count=Math.ceil(length/(detail?1.25:2.6));
    for(let i=0;i<count;i++){
      const t=(i+.5)/count;
      batch.ball(a[0]+dx*t,h*.68,a[1]+dy*t,length/count*.66,h*.34,.55,
        i%2?'#607e54':'#517152',detail?9:6,detail?5:4,'felt');
    }
    return;
  }
  const top=h-(wall?.06:mesh?.04:.035);
  const textureWidth=mesh?.90:wall?1.36:.92;
  if(mesh){
    batch.wall(mat,a,b,.08,top,color,length/textureWidth,(top-.08)/textureWidth);
    batch.wall('plain',a,b,top,h,'#566d68');
  }else{
    batch.wall(mat,near,far,-.045,top,color,length/textureWidth,h/textureWidth);
    batch.wall(mat,backB,backA,-.045,top,color,length/textureWidth,h/textureWidth);
    batch.wall('felt',backA,near,-.045,top,color);batch.wall('felt',far,backB,-.045,top,color);
    const cap=wall?'#d0af96':'#bfa084';
    batch.quad('felt',[near,far,backB,backA],h,cap);
    batch.wall('felt',near,far,top,h,cap,length,1);
    batch.wall('felt',backB,backA,top,h,cap,length,1);
  }
  if(!detail)return;
  const posts=Math.max(1,Math.ceil(length/(wall?6.2:3.2))),size=wall?.33:mesh?.095:.13;
  for(let i=0;i<posts;i++){
    const t=i/posts,x=a[0]+t*dx,y=a[1]+t*dy;
    batch.box(x,-.035,y,size,h+.10,size,wall?'#ae8370':mesh?'#546e66':'#806858');
    if(wall)batch.box(x,h+.065,y,size+.08,.055,size+.08,'#d1b9a0');
  }
}
