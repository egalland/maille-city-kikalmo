export const emergencyColors=['#428dff','#83d8ff'];
export function emergencyFlash(t,side){
  const phase=((t+side*.43)%.86+.86)%.86;
  return phase<.095?1:phase>=.17&&phase<.255?.78:0;
}
const intervals={police:[750,965,.5],swat:[640,835,.46],firefighter:[430,530,.58],medic:[630,810,.34]};
export function sirenTone(role,time){
  const [low,high,beat]=intervals[role]||intervals.police;
  return Math.floor(time/beat)%2?high:low;
}
