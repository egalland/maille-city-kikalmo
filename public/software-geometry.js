// City batches are non-indexed triangle lists. Nearby triangles occur together
// in the builder, so one conservative local box skips a whole invisible street.
export const verticesPerBlock=96;
export function triangleBlocks(positions){
  const boxes=[];
  for(let start=0;start<positions.length;start+=verticesPerBlock*3){
    let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
    const end=Math.min(positions.length,start+verticesPerBlock*3);
    for(let i=start;i<end;i+=3){
      const x=positions[i],y=positions[i+1],z=positions[i+2];
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);z0=Math.min(z0,z);z1=Math.max(z1,z);
    }
    boxes.push((x0+x1)/2,(y0+y1)/2,(z0+z1)/2,(x1-x0)/2,(y1-y0)/2,(z1-z0)/2);
  }
  return new Float32Array(boxes);
}

export function blockVisible(box,i,m,near,far){
  const x=box[i],y=box[i+1],z=box[i+2],rx=box[i+3],ry=box[i+4],rz=box[i+5];
  const w=m[3]*x+m[7]*y+m[11]*z+m[15],rw=Math.abs(m[3])*rx+Math.abs(m[7])*ry+Math.abs(m[11])*rz;
  const extent=w+rw;
  if(extent<near||w-rw>far)return false;
  return Math.abs(m[0]*x+m[4]*y+m[8]*z+m[12])<=extent+Math.abs(m[0])*rx+Math.abs(m[4])*ry+Math.abs(m[8])*rz &&
    Math.abs(m[1]*x+m[5]*y+m[9]*z+m[13])<=extent+Math.abs(m[1])*rx+Math.abs(m[5])*ry+Math.abs(m[9])*rz;
}
