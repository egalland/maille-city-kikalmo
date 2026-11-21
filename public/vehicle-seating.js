// One rule for the world driver, the rendered cabin and bullet contacts.
export function driverOnBoard(vehicle){
  if(!vehicle||vehicle.noDriver||vehicle.cabinStopped||vehicle.driverOutside)return false;
  if(vehicle.self)return true;
  if(vehicle.peer)return !!vehicle.vehicle;
  return vehicle.occupied===true||!!(vehicle.routeId&&!vehicle.parked);
}
