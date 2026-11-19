export const abandonedFor=35_000;
export const disconnectedFor=60_000;
export const wreckFor=24_000;
export const exitDriverFor=8_000;

export function parkingExpired(vehicle,now){
  return !!vehicle&&!vehicle.occupied&&vehicle.expiresAt>0&&vehicle.expiresAt<=now;
}

export function wreckExpired(wear,now){
  return wear?.hp===0&&wear.explodeAt>0&&wear.explodeAt+wreckFor<=now;
}
