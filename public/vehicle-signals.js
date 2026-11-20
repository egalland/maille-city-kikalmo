export function automaticLights(climate){
  return climate.lamps>.32||climate.rain>.45;
}
export function doorOpening(start,now,side){
  const phase=(now-start)/920;
  if(phase<0||phase>=1)return 0;
  return Math.sign(side)*Math.sin(Math.PI*phase)**.75;
}
