// Rigid stitched gores, a suspended launch and two independently driven screws.
function makeEnvelope(THREE,color){
  const stations=24,panels=20,position=[],normal=[],uv=[],pigment=[];
  const sea=new THREE.Color(color||'#7eaca4'),pine=new THREE.Color('#397878');
  const oat=new THREE.Color('#f5d89f'),brass=new THREE.Color('#bc884b');
  const radius=u=>Math.max(0,Math.sin(Math.PI*u))**.68*(.88+.20*u);
  const rows=[];
  for(let i=0;i<=stations;i++){
    const u=i/stations,profile=radius(u),row=[];
    const slope=(radius(Math.min(.9999,u+.001))-radius(Math.max(.0001,u-.001)))/.002;
    for(let j=0;j<=panels;j++){
      const a=j/panels*Math.PI*2,sin=Math.sin(a),cos=Math.cos(a);
      const n=new THREE.Vector3(-slope/11.08,sin/1.56,cos/2.08).normalize();
      row.push({xyz:[-5.54+11.08*u,3.45+1.56*profile*sin,2.08*profile*cos],normal:[n.x,n.y,n.z],uv:[u*15,j/panels*16]});
    }
    rows.push(row);
  }
  for(let i=0;i<stations;i++)for(let j=0;j<panels;j++){
    const shade=i<2||i>=22?brass:i===3||i===20?oat:j%5===0?pine:sea;
    const a=rows[i][j],b=rows[i+1][j],c=rows[i+1][j+1],d=rows[i][j+1];
    for(const v of [a,b,d,d,b,c]){
      position.push(...v.xyz);normal.push(...v.normal);uv.push(...v.uv);pigment.push(shade.r,shade.g,shade.b);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(pigment,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}

function tailFin(THREE){
  const profile=new THREE.Shape();
  profile.moveTo(-2.65,0);profile.quadraticCurveTo(-3.52,.34,-4.28,.98);
  profile.quadraticCurveTo(-4.65,1.23,-5.51,1.15);
  profile.lineTo(-5.12,.23);profile.lineTo(-5.52,0);profile.closePath();
  return new THREE.ExtrudeGeometry(profile,{depth:.07,bevelEnabled:false,curveSegments:5});
}

export function createAirship(THREE,art,color,seed=0){
  const {geo,addPart,batchGroup,carTrim}=art;
  const group=new THREE.Group(),frame=new THREE.Group(),cabin=new THREE.Group();
  group.name='Navette Nuage';frame.name='Enveloppe et nacelle';group.add(frame,cabin);
  const cream='#efdcb3',trim='#9d663d',wood='#785049',deep='#315b60';
  const box=(x,y,z,l,h,w,paint)=>addPart(frame,geo.box,x,y,z,l,h,w,paint);
  const oval=(x,y,z,l,h,w,paint)=>addPart(frame,geo.ball,x,y,z,l,h,w,paint);
  const shell=makeEnvelope(THREE,color),fin=tailFin(THREE);
  addPart(frame,shell,0,0,0,1,1,1,'#ffffff');
  for(const rotation of [0,Math.PI*.5,-Math.PI*.5,Math.PI]){
    addPart(frame,fin,0,3.45,0,1,1.28,1,deep,rotation);
  }
  // Gold bands run across the gores. The baskets and tension cords stay visible below.
  for(const [x,ry,rz] of [[-1.85,1.40,1.85],[2.3,1.40,1.86]]){
    const curve=[];
    for(let k=0;k<=24;k++){
      const a=k*Math.PI/12;curve.push([x,3.45+ry*Math.sin(a),rz*Math.cos(a)]);
    }
    art.cord(frame,curve,.035,cream);
  }
  oval(.48,.47,0,1.47,.37,.70,wood);
  box(.48,.55,0,2.64,.28,1.22,deep);
  for(const side of [-1,1]){
    const z=side*.63;
    carTrim(frame,[-.68,.71,z],[1.63,.71,z],.07,cream);
    for(const x of [-.67,.36,1.62])carTrim(frame,[x,.66,z],[x-.08,1.55,z*.90],.045,trim);
    for(const x of [-.57,1.48]){
      carTrim(frame,[x,.72,z],[x<0?-1.86:2.30,2.58,1.50*side],.043,trim);
      carTrim(frame,[x,.24,z*.75],[x,.12,z],.042,deep);
    }
    carTrim(frame,[-.82,.10,z],[1.68,.10,z],.075,trim);
    const pod=oval(-1.15,.96,side*.89,.53,.19,.18,deep);pod.name='Moteur latéral';
  }
  oval(.48,1.55,0,1.44,.10,.74,cream);
  box(1.48,.84,0,.22,.20,.93,wood);
  for(const side of [-1,1])box(.69,.33,side*.32,.52,.13,.36,'#965d50');
  carTrim(frame,[1.16,.64,-.32],[1.06,.82,-.32],.035,deep);
  carTrim(frame,[1.06,.855,-.465],[1.06,.855,-.175],.032,wood);
  const blades=[];
  for(const side of [-1,1]){
    const hub=new THREE.Group();hub.name='Hélice latérale';hub.position.set(-1.68,.95,side*.89);
    for(let n=0;n<3;n++){
      const a=n*Math.PI*2/3;
      addPart(hub,geo.ball,0,.23*Math.cos(a),.23*Math.sin(a),.046,.29,.077,cream,a);
    }
    addPart(hub,geo.ball,-.06,0,0,.09,.09,.09,trim);
    batchGroup(hub);frame.add(hub);blades.push(hub);
  }
  batchGroup(frame);shell.dispose();fin.dispose();
  cabin.userData.seats3D={x:.74,y:.70,spacing:.285,scale:1.22};
  const seats=[{},{},{}];let spin=0;
  return {group,update(pose={},dt=.016,time=0){
    const moving=!!pose.driver&&!pose.wrecked;
    spin+=((moving?9:0)+Math.abs(pose.speed||0)*1.85)*Math.min(.1,dt);
    blades.forEach((o,i)=>{o.rotation.x=i?spin:-spin;});
    const afloat=pose.lift>.14;
    frame.rotation.z=afloat?.019*Math.sin(time*1.6)+Math.min(.04,Math.abs(pose.speed||0)*.002):0;
    frame.rotation.x=afloat?-.055*(pose.turn||0):0;
    cabin.rotation.copy(frame.rotation);
    art.updateSeatedFigures(cabin,pose,seats,seed,'airship');
    if(pose.wrecked){frame.scale.y=.46;frame.rotation.z=-.08;cabin.visible=false;}
    else{frame.scale.y=1;cabin.visible=true;}
  },dispose(){
    art.clearCabin(seats);
    frame.traverse(child=>{if(child.isMesh)child.geometry.dispose();});group.removeFromParent();
  }};
}
