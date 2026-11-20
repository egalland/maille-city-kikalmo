// Fictional airfields on surveyed open ground, accessible on foot from nearby venues.
export const helipad=Object.freeze({id:'helipad',type:'helicopter',name:'Héliport des Halles',x:-12,y:-236,angle:.48,color:'#df8b52'});
export const mooring=Object.freeze({id:'mooring',type:'airship',name:'Amarrage des Navettes',x:20,y:-68,angle:.12,color:'#7eaca4'});
export const airfields=Object.freeze([helipad,mooring]);
export const isAircraft=type=>type==='helicopter'||type==='airship';
export const flightCeiling=72;
