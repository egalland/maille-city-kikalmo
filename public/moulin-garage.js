export const moulinGarage={id:'garage-moulin',label:'Garage du Moulin · Le Bout-du-Pont',name:'Garage du Moulin',x:2971.5,y:3589.8,angle:Math.PI/2};

export const moulinFleet=[
  ['tank',2966.0,3604.9,1.76,'#5c6950'],
  ['helicopter',2971.6,3617.6,.09,'#34486b'],
  ['armored',2977.6,3606.8,1.51,'#5e6b61'],
  ['supercar',2967.8,3594.1,1.52,'#bc4f48'],
  ['gt',2973.2,3594.6,1.55,'#303d54'],
  ['sport',2973.1,3601.8,1.58,'#cfab6e'],
  ['supercar',2965.8,3612.6,1.62,'#e6decf'],
  ['gt',2978.2,3612.9,1.51,'#54758a'],
  ['estate',2977.7,3620.2,.05,'#6f8278']
].map(([type,x,y,angle,color],i)=>({id:'moulin-parc-'+i,type,kind:'car',x,y,angle,color,parked:true,moving:false,speed:0}));
