import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshStandardMaterial,TorusGeometry} from './three.js';

// Vehicle-local axes here are left/right on X, forward on -Z.
export function createDriverView(scene){
  const root=new Group();root.visible=false;scene.add(root);
  const dark=new MeshStandardMaterial({color:'#353d40',roughness:.94});
  const trim=new MeshStandardMaterial({color:'#a9855b',roughness:.95});
  const accent=new MeshStandardMaterial({color:'#d5cca5',roughness:.87});
  function part(parent,geo,mat,x,y,z){
    const mesh=new Mesh(geo,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  const dash=part(root,new BoxGeometry(1,.25,.45),dark,0,-.36,-.66);
  const seam=part(root,new BoxGeometry(1,.015,.025),trim,0,-.24,-.45);
  const steering=new Group();root.add(steering);steering.position.set(0,-.28,-.44);
  part(steering,new TorusGeometry(.155,.024,7,24),trim,0,0,0);
  for(const angle of [Math.PI/2,-.6,.6+Math.PI]){
    const spoke=part(steering,new BoxGeometry(.15,.021,.021),dark,.073*Math.cos(angle),.073*Math.sin(angle),0);
    spoke.rotation.z=angle;
  }
  const hub=part(steering,new CylinderGeometry(.05,.05,.027,12),accent,0,0,0);
  hub.rotation.x=Math.PI/2;
  const bars=part(root,new BoxGeometry(.57,.033,.035),trim,0,-.30,-.43);
  return {
    set(active,spec,player,terrain,steer,pitch){
      root.visible=active;if(!active)return;
      const a=player.angle||0,c=Math.cos(a),s=Math.sin(a);
      const lateral=spec.openSeat?0:-spec.halfWidth*.35,forward=spec.halfLength*.16;
      const x=player.x+c*forward-s*lateral,z=player.y+s*forward+c*lateral;
      root.position.set(x,terrain+(player.lift||0)+spec.height*.80,z);
      root.rotation.set(0,-Math.PI/2-a,0,'YXZ');root.rotateX(pitch||0);
      steering.rotation.z=(steer||0)*-.9;
      steering.visible=dash.visible=seam.visible=!spec.openSeat;bars.visible=!!spec.openSeat;
      dash.scale.x=seam.scale.x=spec.halfWidth*1.9;dash.position.x=seam.position.x=-lateral;
    },
    eye:root.position,
    dispose(){scene.remove(root);root.traverse(n=>n.geometry?.dispose());dark.dispose();trim.dispose();accent.dispose();}
  };
}
