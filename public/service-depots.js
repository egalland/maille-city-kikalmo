// Depots use the same local metre coordinates as the Noyonnais road network.
export const serviceDepots=[
  {id:'brigade',label:'Gendarmerie · Les Vieilles Mailles',x:-824.8,y:499.2,roles:['police','police','swat','airunit','military','tankunit']},
  {id:'commissariat',label:'Commissariat des Lanternes',x:0,y:-89,roles:['police','police','swat']},
  {id:'secours-gare',label:'Caserne de la Filature',x:792.05,y:205.89,roles:['firefighter','firefighter']},
  {id:'urgences-noyon',label:'Urgences des Tisserands',x:217.84,y:455.49,roles:['medic','medic']},
  {id:'poste-port',label:'Poste du Port des Écheveaux',x:-1074,y:1840,roles:['police','firefighter','medic','swat']},
  {id:'poste-pontoise',label:'Poste du Bout-du-Pont',x:3430,y:2938,roles:['police','police','firefighter','medic','swat']},
  {id:'poste-briqueteries',label:'Poste des Briqueteries',x:2547,y:1090,roles:['police','swat','medic']},
  {id:'poste-hauts',label:'Poste des Hauts de Lande',x:3869,y:-703,roles:['police','firefighter','medic','swat']},
  {id:'poste-ouest',label:'Poste de Mont Renaud',x:-1607,y:979,roles:['police','firefighter','medic','swat']},
  {id:'poste-galerie',label:'Poste de la galerie · Mont Renaud',x:-1637.7,y:1107.1,roles:['police','firefighter'],standby:true}
];
export const serviceModels={police:'police',firefighter:'firetruck',medic:'ambulance',swat:'swat',
  airunit:'helicopter',military:'armored',tankunit:'tank'};
export const serviceUnits=serviceDepots.flatMap(depot=>depot.roles.map((role,index)=>({
  id:depot.id+'-'+index,depot,role,type:serviceModels[role],index
})));
const unitRoles=new Map(serviceUnits.map(unit=>[unit.id,unit.role]));
export const isServiceUnit=(id,role)=>unitRoles.get(id)===role;
