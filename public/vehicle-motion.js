// Suspension samples both axles; height is absolute while airborne.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function stepVehicleBody(previous,{x,y,angle,speed,halfLength,dt},ground){
  const c=Math.cos(angle),s=Math.sin(angle),wheelbase=halfLength*.73;
  const floor=ground(x,y);
  const slope=(ground(x+c*wheelbase,y+s*wheelbase)-ground(x-c*wheelbase,y-s*wheelbase))/(wheelbase*2);
  const pitch=Math.atan(clamp(slope,-.7,.7));
  if(!previous)return {height:floor,lift:0,vy:0,pitch,slope,landed:0};
  if(previous.lift>0){
    const vy=previous.vy-15.4*dt,height=previous.height+(previous.vy+vy)*.5*dt;
    const airbornePitch=previous.pitch+clamp(-.08-previous.pitch,-dt*.7,dt*.7);
    if(height>floor)return {height,lift:height-floor,vy,pitch:airbornePitch,slope,landed:0};
    return {height:floor,lift:0,vy:0,pitch,slope,landed:Math.max(0,-vy)};
  }
  const ramp=previous.slope*speed,release=(previous.slope-slope)*speed;
  const launch=Math.min(6.8,ramp),rise=(floor-previous.height)/dt;
  if(Math.abs(speed)>10&&launch>1.22&&release>.27&&launch>rise+.6){
    const vy=launch,height=Math.max(floor,previous.height)+vy*dt;
    return {height,lift:height-floor,vy,pitch:previous.pitch,slope,landed:0};
  }
  return {height:floor,lift:0,vy:0,pitch,slope,landed:0};
}
