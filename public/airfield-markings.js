import * as THREE from './three.js';
import {airfields} from './airfield.js';
import {terrainHeight} from './terrain-height.js';
import {puppetKnit} from './puppet-material.js';

// A single mesh per landing ground. Every stitch samples local terrain height.
export function createAirfieldMarkings(scene){
  const material=new THREE.MeshLambertMaterial({vertexColors:true,map:puppetKnit(),side:THREE.DoubleSide});
  function build(field){
    const positions=[],colors=[],uv=[],base=terrainHeight(field.x,field.y);
    const heli=field.type==='helicopter',r=heli?5.55:6.05;
    const ground=heli?'#4c6460':'#766451',ivory='#ffe3aa',gold='#dca364';
    const tint=new THREE.Color();
    function tri(a,b,c,paint,raise){
      tint.set(paint);
      for(const [x,z] of [a,b,c]){
        positions.push(x,terrainHeight(field.x+x,field.y+z)-base+raise,z);
        colors.push(tint.r,tint.g,tint.b);uv.push(x/2,z/2);
      }
    }
    function band(a,b,width,paint,height){
      const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      const u=-dz*width/(len*2),v=dx*width/(len*2);
      const p=[a[0]+u,a[1]+v],q=[b[0]+u,b[1]+v],s=[a[0]-u,a[1]-v],t=[b[0]-u,b[1]-v];
      tri(p,q,s,paint,height);tri(s,q,t,paint,height);
    }
    const onCircle=(i,radius)=>[Math.cos(i*Math.PI/24)*radius,Math.sin(i*Math.PI/24)*radius];
    for(let i=0;i<48;i++){
      const a=onCircle(i,r),b=onCircle(i+1,r);
      tri([0,0],b,a,ground,.076);
      band(onCircle(i,r-.45),onCircle(i+1,r-.45),.20,ivory,.11);
      if(i%2===0)band(onCircle(i,r-.12),onCircle(i+.7,r-.12),.09,gold,.115);
    }
    if(heli){
      band([-1.2,-1.8],[-1.2,1.8],.51,ivory,.13);band([1.2,-1.8],[1.2,1.8],.51,ivory,.13);
      band([-1.2,0],[1.2,0],.52,ivory,.14);
    }else{
      band([-1.5,1.9],[0,-1.95],.48,ivory,.13);band([0,-1.95],[1.5,1.9],.48,ivory,.13);
      band([-.99,.55],[.99,.55],.42,ivory,.14);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,material);mesh.name=field.name;mesh.position.set(field.x,base,field.y);
    scene.add(mesh);return mesh;
  }
  const meshes=airfields.map(build);
  return {update(viewer){
    meshes.forEach(m=>{m.visible=(m.position.x-viewer.x)**2+(m.position.z-viewer.y)**2<320**2;});
  },dispose(){meshes.forEach(m=>{m.removeFromParent();m.geometry.dispose();});material.dispose();}};
}
