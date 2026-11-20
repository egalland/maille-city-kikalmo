export const abandonedFor=35_000;
export const disconnectedFor=60_000;
export const wreckFor=24_000;
export const exitDriverFor=8_000;

export function parkingExpired(vehicle,now){
  return !!vehicle&&!vehicle.occupied&&vehicle.expiresAt>0&&vehicle.expiresAt<=now;
}

export function wreckExpired(wear,now){
  const retiredAt=wear?.explodeAt||wear?.disabledAt;
  return !!retiredAt&&retiredAt+wreckFor<=now;
}

// A deterministic parking space or traffic route becomes eligible for a fresh car after the tow.
export const replacementDelay=75_000;
export function replacementAt(wear){
  const end=wear?.explodeAt||wear?.disabledAt;
  return end?end+wreckFor+replacementDelay:0;
}

export function pruneVehicleWorld(world,now){
  for(const [id,wear] of Object.entries(world.vehicleDamage)){
    if(!wreckExpired(wear,now))continue;
    const returnsAt=replacementAt(wear);
    if(returnsAt>now)world.retiredVehicles[id]=returnsAt;
    delete world.vehicleDamage[id];
    delete world.vehicles[id];
  }
  for(const [id,until] of Object.entries(world.retiredVehicles)){
    if(until<=now)delete world.retiredVehicles[id];
    else delete world.vehicles[id];
  }
}
