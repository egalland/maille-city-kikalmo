// Original sixteen-bar theme for the vehicle radio. The shared clock keeps
// every receiver on the same broadcast without sending notes over the network.
const harmony=[0,0,5,5,2,7,0,7],phrase=[7,null,12,9,null,4,7,null,9,null,7,4,2,null,4,null];
const frequency=midi=>440*2**((midi-69)/12);
export function broadcastBeat(step){
  const root=48+harmony[Math.floor(step/16)%harmony.length];
  const interval=phrase[step%16],notes=[];
  if(step%4===0)notes.push({hz:frequency(root-12+(step%8?7:0)),volume:.032,length:.32,wave:'triangle'});
  if(interval!==null)notes.push({hz:frequency(root+12+interval),volume:.017,length:step%4?.12:.24,wave:'sine'});
  return notes;
}
export function readRadio(){
  try{return localStorage.getItem('maillecity.radio.v1')==='on';}catch{return false;}
}
export function storeRadio(on){
  try{localStorage.setItem('maillecity.radio.v1',on?'on':'off');}catch{}
}
