// Fuselage faces +X. Separate rigid batches keep the cabin, skids and rotor heads inexpensive.
export function createHelicopter(THREE,{geo,addPart,batchGroup,cord,carTrim,updateSeatedFigures,clearCabin},color,seed){
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
  const belly=new THREE.SphereGeometry(1,32,12,0,Math.PI*2,Math.acos(.19/.48),Math.PI-Math.acos(.19/.48));
  addPart(shell,belly,.26,.89,0,1.57,.48,.83,paint,0,0,0,'yarn');
  const floor=new THREE.SphereGeometry(1,32,5,0,Math.PI*2,0,Math.PI/2);
  addPart(shell,floor,.26,1.071,0,1.44,.009,.76,dark,0,0,0,'felt');
  box(shell,.67,1.014,0,1.45,.025,1.13,'#4b555a');
  oval(shell,-.62,1.34,0,.71,.61,.73,paint);
  oval(shell,-.43,1.95,0,.95,.29,.56,teal);
  oval(shell,.52,1.40,0,1.20,.655,.755,'#8fc6c8','glass');
  box(shell,.30,1.96,0,1.01,.095,.66,teal,0,0,-.06);
  for(const side of [-1,1]){
    const s=z=>z*side;
    cord(shell,[[1.64,1.15,s(.24)],[1.35,1.70,s(.43)],[.65,1.98,s(.40)],[-.18,1.85,s(.48)],[-.46,1.24,s(.65)]],.037,cream);
    cord(shell,[[-.70,1.09,s(.72)],[.38,1.05,s(.816)],[1.26,1.06,s(.60)],[1.65,1.12,s(.23)]],.042,teal);
    carTrim(shell,[.22,1.09,s(.78)],[.13,1.95,s(.49)],.030,dark);
    cord(shell,[[-.25,1.69,s(.61)],[.19,1.72,s(.653)],[.75,1.77,s(.557)],[1.28,1.65,s(.52)]],.027,teal);
    for(let i=0;i<6;i++)carTrim(shell,[-.54+i*.11,.87,s(.805)],[-.51+i*.11,.92,s(.80)],.013,cream);
    box(shell,.43,.92,s(.70),.22,.05,.043,metal);
    oval(shell,.43,1.08,s(.32),.29,.043,.22,teal);
    oval(shell,.15,1.27,s(.32),.086,.23,.20,dark);
    for(const x of [-.67,.90]){
      carTrim(shell,[x,.61,s(.52)],[x-.08,.14,s(.83)],.056,metal);
      oval(shell,x-.08,.151,s(.83),.13,.066,.091,metal);
    }
    cord(shell,[[-1.38,.12,s(.83)],[-.86,.092,s(.83)],[.70,.092,s(.83)],[1.39,.13,s(.83)],[1.55,.24,s(.83)]],.074,dark);
    box(shell,.04,.25,s(.876),.62,.045,.12,gold);
    oval(shell,1.21,.78,s(.49),.17,.095,.10,cream,'glow');
    oval(shell,-.93,1.12,s(.58),.115,.082,.069,side>0?'#70bf92':'#e27267','glow');
    oval(shell,-.73,1.91,s(.48),.59,.235,.25,paint);
    oval(shell,-.22,1.916,s(.49),.06,.15,.162,dark);
    oval(shell,-.19,1.917,s(.49),.042,.102,.109,metal);
    carTrim(shell,[-1.12,1.96,s(.477)],[-1.66,1.83,s(.315)],.115,metal);
    carTrim(shell,[-1.53,1.85,s(.328)],[-1.68,1.82,s(.31)],.088,dark);
    for(let i=0;i<5;i++)box(shell,-1.03+i*.105,1.923,s(.716),.041,.13,.025,dark,side*.24,0,-.29);
    for(let i=0;i<4;i++)box(shell,-.92+i*.11,.77,s(.751),.07,.068,.024,i%2?gold:cream,0,0,-.37);
  }
  box(shell,1.15,1.22,0,.17,.19,.83,dark,0,0,-.16);
  for(const z of [-.24,-.085,.075,.23]){
    oval(shell,1.068,1.256,z,.014,.036,.037,cream);
    oval(shell,1.051,1.256,z,.007,.025,.025,'#4e686d');
  }
  carTrim(shell,[.98,1.07,-.34],[.88,1.27,-.34],.026,dark);
  carTrim(shell,[.88,1.275,-.49],[.88,1.275,-.19],.034,dark);
  carTrim(shell,[.59,1.99,0],[1.69,1.15,0],.033,cream);
  addPart(shell,geo.ball,-1.92,1.36,0,1.22,.235,.255,paint,0,0,-.106);
  carTrim(shell,[-1.06,1.34,0],[-3.38,1.59,0],.12,teal);
  carTrim(shell,[-.97,1.06,0],[-3.05,1.51,0],.058,cream);
  box(shell,-2.75,1.59,0,.71,.09,1.68,teal);
  for(const side of [-1,1])box(shell,-2.76,1.72,side*.78,.37,.27,.085,paint,0,0,-.22);
  const duct=new THREE.TorusGeometry(.385,.092,9,32);
  addPart(shell,duct,-3.04,1.83,0,1,1.13,1.50,paint,0,0,0,'yarn');
  addPart(shell,duct,-3.04,1.83,.115,.99,1.12,.36,cream);
  addPart(shell,duct,-3.04,1.83,-.115,.99,1.12,.36,cream);
  box(shell,-2.98,2.25,0,.24,.35,.125,teal,0,0,-.36);
  oval(shell,-3.02,2.44,0,.075,.066,.068,'#f47a67','glow');
  carTrim(shell,[-1.18,1.02,.17],[-1.65,.66,.17],.035,dark);
  box(shell,-.07,2.07,0,.46,.17,.38,dark);
  carTrim(shell,[.10,2.13,0],[.10,2.56,0],.077,metal);
  rotor.name='Rotor principal';rotor.position.set(.10,2.55,0);group.add(rotor);
  for(let i=0;i<4;i++){
    const a=2*Math.PI*i/4,c=Math.cos(a),s=Math.sin(a);
    box(rotor,1.61*c,0,1.61*s,2.91,.043,.20,dark,0,-a);
    box(rotor,2.90*c,.002,2.90*s,.31,.052,.17,cream,0,-a);
    box(rotor,.46*c,.022,.46*s,.46,.07,.12,gold,0,-a);
    carTrim(rotor,[.16*c,-.10,.16*s],[.56*c,.01,.56*s],.025,metal);
  }
  oval(rotor,0,.045,0,.18,.087,.18,metal);
  tailRotor.name='Rotor de queue';tailRotor.position.set(-3.04,1.83,0);group.add(tailRotor);
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7;
    box(tailRotor,.185*Math.cos(a),.185*Math.sin(a),0,.30,.064,.045,i%2?dark:metal,.24,0,a);
  }
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
    updateSeatedFigures(shell,pose,seatState,seed,'helicopter');
    const target=pose.driver&&pose.chassisHp!==0?24:0;
    rotationSpeed+=(target-rotationSpeed)*(1-Math.exp(-dt*(target?2.1:.85)));
    rotor.rotation.y=(rotor.rotation.y+rotationSpeed*dt)%(Math.PI*2);
    tailRotor.rotation.z=(tailRotor.rotation.z+rotationSpeed*3.5*dt)%(Math.PI*2);
  },dispose(){
    clearCabin(seatState);
    group.traverse(item=>{if(item.isMesh)item.geometry.dispose();});group.removeFromParent();
  }};
}
