// The contact normal points from B to A. The midpoint of the contacting faces'
// shared tangent interval gives a centred bumper hit no artificial spin.
import {vehicleSpec} from './vehicle-types.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

function contactArm(body,spec,tx,ty){
  const c=Math.cos(body.angle),s=Math.sin(body.angle);
  const radius=spec.halfLength*Math.abs(c*tx+s*ty)+spec.halfWidth*Math.abs(c*ty-s*tx);
  const inertia=spec.mass*(spec.halfLength**2+spec.halfWidth**2)/3;
  return {t:body.x*tx+body.y*ty,radius,inertia};
}

export function vehicleContact(a,b,nx,ny){
  const sa=vehicleSpec(a.type),sb=vehicleSpec(b.type),tx=-ny,ty=nx;
  const pa=contactArm(a,sa,tx,ty),pb=contactArm(b,sb,tx,ty);
  const contact=(Math.max(pa.t-pa.radius,pb.t-pb.radius)+Math.min(pa.t+pa.radius,pb.t+pb.radius))*.5;
  const armA=pa.t-contact,armB=pb.t-contact;
  const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny+(b.spin||0)*armB-(a.spin||0)*armA;
  if(closing<=.005)return null;
  const inverseMass=1/sa.mass+1/sb.mass+armA*armA/pa.inertia+armB*armB/pb.inertia;
  const impulse=closing/inverseMass;
  function change(mass,inertia,arm,j){
    return {vx:j*nx/mass,vy:j*ny/mass,spin:j*arm/inertia};
  }
  return {closing,a:change(sa.mass,pa.inertia,armA,impulse),b:change(sb.mass,pb.inertia,armB,-impulse)};
}

// Route-following traffic regains its lane with a damped steering correction.
// Unattended vehicles lose speed to rolling friction and retain their final pose.
export function createVehicleDisplacements(){
  const states=new Map();
  function push(car,kick,origin){
    let s=states.get(car.id);
    if(!s){
      s={x:0,y:0,yaw:0,px:car.x,py:car.y,angle:car.angle||0,vx:0,vy:0,spin:0,origin};
      states.set(car.id,s);
    }
    s.vx=clamp(s.vx+kick.vx,-37,37);s.vy=clamp(s.vy+kick.vy,-37,37);
    s.spin=clamp(s.spin+kick.spin,-2.7,2.7);s.origin=origin;
  }
  function advance(car,dt,move,canRotate){
    const s=states.get(car.id);
    if(!s)return null;
    const guided=!!(car.routeId||car.occupied||car.id.startsWith('unit-'));
    const k=guided?2.2:0,drag=guided?2.9:2.2,decay=Math.exp(-drag*dt);
    const bx=car.x,by=car.y,heading=car.angle||0;
    s.vx=(s.vx-k*s.x*dt)*decay;s.vy=(s.vy-k*s.y*dt)*decay;s.spin=(s.spin-k*s.yaw*dt)*decay;
    const x=s.px,y=s.py,oldHeading=s.angle,nextHeading=heading+s.yaw+s.spin*dt;
    const angle=Math.abs(wrap(nextHeading-oldHeading))<.0001||canRotate(x,y,nextHeading)?nextHeading:oldHeading;
    if(angle===oldHeading)s.spin=0;
    const pos=move(x,y,bx+s.x-x+s.vx*dt,by+s.y-y+s.vy*dt,angle);
    if(pos.hit){
      const inward=Math.min(0,s.vx*pos.normalX+s.vy*pos.normalY);
      s.vx-=inward*pos.normalX;s.vy-=inward*pos.normalY;
    }
    s.x=pos.x-bx;s.y=pos.y-by;s.yaw=wrap(angle-heading);s.px=pos.x;s.py=pos.y;s.angle=angle;
    const speed=car.speed||0,vx=Math.cos(heading)*speed+s.vx,vy=Math.sin(heading)*speed+s.vy;
    const settled=Math.hypot(s.vx,s.vy)<.075&&Math.abs(s.spin)<.045&&(!guided||Math.hypot(s.x,s.y)<.07&&Math.abs(s.yaw)<.025);
    Object.assign(car,{x:pos.x,y:pos.y,angle,vx,vy,spin:s.spin,speed:vx*Math.cos(angle)+vy*Math.sin(angle),
      moving:Math.hypot(vx,vy)>.10,move:Math.hypot(vx,vy)>.10});
    if(!settled)return null;
    states.delete(car.id);
    return {parked:!guided,origin:s.origin};
  }
  function retain(ids){for(const id of states.keys())if(!ids.has(id))states.delete(id);}
  return {push,advance,retain,has:id=>states.has(id),clear:()=>states.clear(),delete:id=>states.delete(id),get size(){return states.size;}};
}
