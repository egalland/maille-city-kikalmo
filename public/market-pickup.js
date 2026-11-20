import {coachRings,pressedShell} from './coachwork.js';
import {fleetFabric as cloth} from './vehicle-fabric.js';

export function marketPickup(paint,{section,box,rod,parcel,makeWheel}){
  const chassis=section('carrosserie'),p=chassis.parts;
  const addPanel=(points,c,glass=false)=>p.push({kind:'panel',points,c,glass});
  const rail=(a,b,r,c)=>rod(p,a,b,r,c);
  const part=(at,size,c)=>box(p,at,size,c);
  const {ink,silver,thread,stop,lamp}=cloth;
  const axles=[-1.507,1.561],r=.388;
  p.push({kind:'shell',surface:'enamel',c:paint,rings:coachRings([
    [-2.305,.525,.802,.76],[-2.215,.41,.865,.88],[-1.91,.354,.896,.911],
    [-.342,.354,.882,.903],[-.27,.368,1.133,.848],[-.156,.373,1.23,.88],
    [.88,.379,1.235,.88],[1.23,.381,1.192,.902],[1.82,.401,1.122,.911],
    [2.18,.44,1.071,.858],[2.307,.524,.994,.738]],axles,r,8)});

  // A recessed slatted bed with a pressed inner tub and tie-downs on each side.
  for(let i=-3;i<=3;i++)part([-1.28,.914,i*.208],[1.88,.046,.200],i%2?'#9b6c4d':'#af8058');
  for(const side of [-1,1]){
    const stations=[[-2.285,.94,1.10,.807],[-2.19,.907,1.176,.865],
      [-1.927,.902,1.202,.872],[-.552,.902,1.231,.871],[-.332,.901,1.255,.856]];
    const rings=stations.map(([x,base,top,z])=>{
      const profile=[[base,z-.103],[top-.026,z-.104],[top+.008,z-.076],
        [top,z+.017],[top-.040,z+.031],[base+.028,z+.020],[base,z-.014]];
      const ring=profile.map(([y,d])=>[x,y,side*d]);
      return side>0?ring:ring.reverse();
    });
    p.push({kind:'shell',rings,c:paint,surface:'enamel'});
    rail([-2.20,1.181,side*.851],[-.35,1.254,side*.852],.017,silver);
    for(const x of [-1.982,-.585]){
      for(const dx of [-.085,.085])rail([x+dx,1.17,side*.84],[x+dx,1.29,side*.84],.013,ink);
      rail([x-.085,1.29,side*.84],[x+.085,1.29,side*.84],.014,silver);
    }
    // Wheel housings inside the cargo bed.
    const hunches=[[-1.91,.925,.936,.065],[-1.79,.925,1.012,.108],[-1.64,.925,1.056,.12],[-1.39,.925,1.056,.12],[-1.23,.925,1.004,.11],[-1.15,.925,.936,.065]];
    pressedShell(p,hunches,'#826453');
    for(const ring of p.at(-1).rings)for(const v of ring)v[2]+=side*.68;

    // Pillars and curved rain gutter follow the inclined glazing.
    const bottomRear=[-.213,1.222,side*.838],topRear=[-.124,1.734,side*.739];
    const bottomFront=[1.213,1.216,side*.829],topFront=[.881,1.734,side*.723];
    const quarterBottom=[.98,1.223,side*.828],quarterTop=[.787,1.735,side*.727];
    addPanel([bottomRear,bottomFront,topFront,topRear],cloth.pane,true);
    rail(bottomRear,topRear,.049,paint);rail(bottomFront,topFront,.052,paint);
    rail(quarterBottom,quarterTop,.013,ink);
    rail(bottomRear,bottomFront,.022,silver);rail(topRear,topFront,.033,paint);
    for(const [a,b] of [
      [[-.19,1.18,.869],[-.136,.569,.883]],[[-.136,.569,.883],[.846,.542,.886]],
      [[.846,.542,.886],[.982,.92,.887]],[[.982,.92,.887],[1.04,1.181,.88]]
    ])rail([a[0],a[1],side*a[2]],[b[0],b[1],side*b[2]],.009,cloth.welt);
    rail([.016,1.132,side*.877],[.170,1.135,side*.877],.019,silver);
    rail([.921,1.288,side*.82],[.844,1.365,side*.963],.023,ink);
    part([.843,1.382,side*.951],[.105,.073,.056],silver);
  }
  // Wide, low-crowned steel roof. The side windows read as an open cab from
  // behind the pickup; the rear window sits between genuine pressed corners.
  pressedShell(p,[[-.253,1.674,1.705,.65],[-.204,1.685,1.777,.769],
    [-.104,1.706,1.831,.797],[.19,1.718,1.854,.807],[.687,1.715,1.839,.795],
    [.885,1.700,1.795,.76],[.959,1.692,1.724,.651]],paint);
  const rearPoint=(y,z)=>[-.227+(y-1.22)*.17,y,z];
  const windPoint=(y,z)=>[1.211-(y-1.22)*.63,y,z];
  for(const [at,bottom,roofBase] of [[rearPoint,1.235,1.698],[windPoint,1.239,1.708]]){
    addPanel([at(bottom,-.71),at(bottom,.71),at(roofBase,.66),at(roofBase,-.66)],cloth.frontPane,true);
    for(const side of [-1,1]){
      rail(at(bottom,side*.704),at(roofBase,side*.655),.016,ink);
      const corner=[at(bottom,side*.83),at(roofBase,side*.737),at(roofBase,side*.661),at(bottom,side*.710)];
      addPanel((at===windPoint)===(side<0)?corner:corner.reverse(),paint);
    }
    rail(at(bottom,-.70),at(bottom,.70),.019,silver);
    rail(at(roofBase,-.652),at(roofBase,.652),.015,ink);
  }
  rail(windPoint(1.26,-.56),windPoint(1.331,-.16),.013,ink);
  rail(windPoint(1.26,.02),windPoint(1.331,.45),.013,ink);
  const mount={x:.345,y:1.004,spacing:.374,scale:.91};
  for(const z of [-mount.spacing,mount.spacing]){
    part([.13,1.206,z],[.132,.348,.426],'#6e594c');
    part([.124,1.423,z],[.109,.13,.232],'#896e58');
    part([.36,1.025,z],[.423,.092,.418],'#745c4e');
  }
  part([.918,1.165,0],[.216,.142,1.47],ink);

  // A tapered hood with a pair of pressed ridges and broad grille surround.
  // Its rear edge meets the cowl below the windshield.
  pressedShell(p,[[1.12,1.154,1.212,.682],[1.27,1.159,1.256,.736],
    [1.76,1.086,1.204,.741],[2.11,1.037,1.137,.701],[2.265,.971,1.071,.613]],paint);
  for(const side of [-1,1]){
    rail([1.23,1.252,side*.36],[1.76,1.202,side*.374],.009,silver);
    rail([1.76,1.202,side*.374],[2.12,1.132,side*.422],.009,silver);
    part([2.281,.902,side*.658],[.073,.151,.246],ink);
    part([2.323,.915,side*.654],[.028,.091,.18],lamp);
    part([-2.29,1.012,side*.79],[.078,.238,.124],ink);
    part([-2.335,1.042,side*.79],[.031,.116,.09],stop);
    part([-2.336,.946,side*.79],[.032,.045,.09],lamp);
  }
  part([2.307,.873,0],[.051,.254,1.025],ink);
  for(let i=0;i<4;i++)part([2.337,.795+i*.05,0],[.022,.018,.965],silver);
  const tail=(y,z)=>[-2.322-(y-.855)*.020,y,z];
  pressedShell(p,[[-2.319,.858,1.129,.729],[-2.301,.838,1.149,.784],[-2.242,.843,1.144,.787],[-2.219,.873,1.118,.729]],paint);
  for(const s of [-1,1]){
    rail(tail(.877,s*.725),tail(1.103,s*.725),.012,silver);
    rail(tail(.901,s*.625),tail(.901,s*.15),.012,ink);
    rail(tail(1.05,s*.625),tail(1.05,s*.15),.012,ink);
    part([-2.316,.852,s*.60],[.062,.044,.134],silver);
  }
  rail(tail(1.137,-.767),tail(1.137,.767),.023,silver);
  part([-2.329,1.058,0],[.033,.058,.228],ink);
  for(const x of [-2.336,2.348])part([x,.545,0],[.129,.092,1.789],silver);
  part([-2.37,.649,0],[.039,.133,.415],thread);
  parcel(p,-1.572,.938,-.188,.612,.365,.485,'#ac8d50');
  parcel(p,-.783,.938,.171,.53,.277,.426,'#899678');
  return {chassis,seats3D:mount,wheels:axles.flatMap(x=>[-.814,.814].map(z=>makeWheel(x,z,r,.204,x>0,false)))};
}
