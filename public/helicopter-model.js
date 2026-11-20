// Fuselage faces +X. Separate rigid batches keep the cabin, skids and rotor heads inexpensive.
export function createHelicopter(THREE,{geo,addPart,batchGroup,cord,carTrim,updateSeatedFigures},color,seed){
  const group=new THREE.Group(),shell=new THREE.Group(),rotor=new THREE.Group(),tailRotor=new THREE.Group();
  const seatState=[{},{},{}],paint=/^#[\da-f]{6}$/i.test(color||'')?color:'#db8553';
  const dark='#38454b',cream='#fff0c9',metal='#7e8987',gold='#efbd68',teal='#447873';
  group.name='Hélicoptère Libellule';shell.name='Cellule en feutre';group.add(shell);
  function oval(parent,x,y,z,sx,sy,sz,tone,style='yarn'){
    return addPart(parent,geo.ball,x,y,z,sx,sy,sz,tone,0,0,0,style);
  }
  function box(parent,x,y,z,sx,sy,sz,tone,rx=0,ry=0,rz=0){
    return addPart(parent,geo.box,x,y,z,sx,sy,sz,tone,rx,ry,rz);
  }
  oval(shell,.26,.89,0,1.57,.48,.83,paint);
  oval(shell,-.62,1.34,0,.71,.61,.73,paint);
  oval(shell,-.58,1.88,0,.61,.29,.49,teal);
  // Transparent bubble canopy surrounds two independent occupied seats.
  oval(shell,.53,1.37,0,1.15,.71,.75,'#a9d8cd','glass');
  for(const side of [-1,1]){
    const s=z=>z*side;
    cord(shell,[[1.64,1.15,s(.24)],[1.35,1.70,s(.43)],[.65,1.98,s(.40)],[-.18,1.85,s(.48)],[-.46,1.24,s(.65)]],.037,cream);
    cord(shell,[[-.70,1.09,s(.72)],[.38,1.05,s(.816)],[1.26,1.06,s(.60)],[1.65,1.12,s(.23)]],.042,teal);
    carTrim(shell,[.22,1.09,s(.78)],[.13,1.95,s(.49)],.030,dark);
    for(let i=0;i<6;i++)carTrim(shell,[-.54+i*.11,.87,s(.805)],[-.51+i*.11,.92,s(.80)],.013,cream);
    box(shell,.43,.92,s(.70),.22,.05,.043,metal);
    oval(shell,.43,.93,s(.32),.31,.095,.23,dark);
    oval(shell,.15,1.13,s(.32),.10,.29,.22,dark);
    for(const x of [-.67,.90])carTrim(shell,[x,.61,s(.52)],[x-.08,.14,s(.83)],.056,metal);
    cord(shell,[[-1.38,.12,s(.83)],[-.86,.092,s(.83)],[.70,.092,s(.83)],[1.39,.13,s(.83)],[1.55,.24,s(.83)]],.074,dark);
    oval(shell,1.21,.78,s(.49),.17,.095,.10,cream,'glow');
    oval(shell,-.93,1.12,s(.58),.115,.082,.069,side>0?'#70bf92':'#e27267','glow');
    for(let i=0;i<4;i++)box(shell,-.86+i*.13,1.84,s(.47),.048,.15,.03,dark,side*.2,0,-.24);
  }
  carTrim(shell,[.59,1.99,0],[1.69,1.15,0],.033,cream);
  carTrim(shell,[-1.02,1.31,0],[-3.38,1.59,0],.12,paint);
  carTrim(shell,[-.97,1.06,0],[-3.05,1.51,0],.058,cream);
  box(shell,-3.00,1.58,0,.60,.07,1.38,teal);
  box(shell,-3.23,1.74,0,.36,.96,.09,paint,0,0,-.35);
  box(shell,-3.38,2.10,0,.30,.16,.10,cream,0,0,-.35);
  box(shell,-.07,2.07,0,.46,.17,.38,dark);
  carTrim(shell,[.10,2.13,0],[.10,2.56,0],.077,metal);
  rotor.name='Rotor principal';rotor.position.set(.10,2.55,0);group.add(rotor);
  for(let i=0;i<3;i++){
    const a=2*Math.PI*i/3,c=Math.cos(a),s=Math.sin(a);
    box(rotor,1.58*c,0,1.58*s,2.96,.043,.17,dark,0,-a);
    box(rotor,2.90*c,.002,2.90*s,.31,.052,.17,cream,0,-a);
    box(rotor,.46*c,.022,.46*s,.46,.07,.12,gold,0,-a);
  }
  oval(rotor,0,.045,0,.18,.087,.18,metal);
  tailRotor.name='Rotor de queue';tailRotor.position.set(-3.30,1.70,.17);group.add(tailRotor);
  box(tailRotor,0,0,0,.97,.075,.045,dark);
  for(const s of [-1,1])box(tailRotor,s*.43,.001,.003,.12,.083,.050,cream);
  oval(tailRotor,0,0,.033,.07,.07,.055,gold);
  for(const section of [rotor,tailRotor,shell])batchGroup(section);
  shell.userData.seats3D={x:.54,y:1.0,spacing:.32,scale:1.24};
  const debris=new THREE.Group();debris.name='Épave de la Libellule';debris.visible=false;group.add(debris);
  oval(debris,.28,.43,0,1.39,.37,.71,'#524449');
  box(debris,-1.83,.43,.32,2.53,.14,.16,'#62524f',0,-.14,-.14);
  box(debris,.1,.57,-.8,2.1,.04,.16,metal,.19,.47);
  box(debris,.53,.40,.65,1.12,.08,.15,paint,-.23,-.66,.28);batchGroup(debris);
  let rotationSpeed=0;
  return {group,update(pose={},dt=.016){
    const wrecked=!!pose.wrecked;debris.visible=wrecked;
    shell.visible=rotor.visible=tailRotor.visible=!wrecked;
    if(wrecked)return;
    updateSeatedFigures(shell,pose,seatState,seed);
    const target=pose.driver&&pose.chassisHp!==0?24:0;
    rotationSpeed+=(target-rotationSpeed)*(1-Math.exp(-dt*(target?2.1:.85)));
    rotor.rotation.y=(rotor.rotation.y+rotationSpeed*dt)%(Math.PI*2);
    tailRotor.rotation.z=(tailRotor.rotation.z+rotationSpeed*3.5*dt)%(Math.PI*2);
  },dispose(){
    for(const seat of seatState)seat.figure?.removeFromParent();
    group.traverse(item=>{if(item.isMesh)item.geometry.dispose();});group.removeFromParent();
  }};
}
