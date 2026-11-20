// Every observer samples the same 50-second cycle from the shared simulation clock.
const cycle = 50;
const walkStart = 36;
const phaseAt = (signal, epoch) => ((epoch / 1000 + signal.offset) % cycle + cycle) % cycle;

export function lampState(signal, heading, epoch) {
  const t = phaseAt(signal, epoch);
  const priority = Math.abs(Math.cos(heading - signal.axis)) >= .72;
  const start = priority ? 0 : 18;
  const green = priority ? 14 : 13;
  return t >= start && t < start + green ? 'green'
    : t >= start + green && t < start + green + 2 ? 'amber' : 'red';
}

export function pedestrianGreen(signal, epoch) {
  const t = phaseAt(signal, epoch);
  return t >= walkStart && t < 46;
}

const pointAlong = (arm, forward, across) => [
  arm.x + Math.cos(arm.angle) * forward - Math.sin(arm.angle) * across,
  arm.y + Math.sin(arm.angle) * forward + Math.cos(arm.angle) * across
];

// The body waits on the sidewalk until WALK. It then has a full crossing and
// clearance interval, including at the widest junction accepted by the generator.
export function crossingWalker(arm, signal, epoch) {
  const elapsed = epoch / 1000 + signal.offset;
  const t = phaseAt(signal, epoch);
  const side = Math.floor(elapsed / cycle) % 2 === 0 ? 1 : -1;
  const edge = arm.width / 2 + .85;
  const lead = Math.min(9, arm.approach);
  const distance = t < 9 ? lead * (1 - t / 9) : t > 45 ? lead * (t - 45) / 5 : 0;
  const fraction = Math.min(1, Math.max(0, (t - walkStart) / 9));
  const [x, y] = pointAlong(arm, arm.setback + distance, side * edge * (1 - 2 * fraction));
  const crossing = t >= walkStart && t < 45;
  const speed = t < 9 ? lead / 9 : crossing ? 2 * edge / 9 : t > 45 ? lead / 5 : 0;
  const angle = t < 9 ? arm.angle + Math.PI : t > 45 ? arm.angle : arm.angle - side * Math.PI / 2;
  return {x, y, angle, speed, moving: speed > 0, activity: crossing ? 'crossing' : speed ? 'walking' : 'waiting'};
}

export function junctionSignals(routes, roads, {builtUp, clear, hash}) {
  const byId = new Map(), sites = [], candidates = new Map(), endpoints = new Map();
  for (const route of routes.values()) for (const j of route.junctions) candidates.set(j.id, j);
  for (const road of roads) {
    if (road.level || road.bridge || road.kind === 'path' || road.kind === 'motorway' || road.w < 4 || road.w > 10) continue;
    for (const reverse of [false, true]) {
      const start = reverse ? road.path.at(-1) : road.path[0];
      const id = start.join(',') + ',' + road.level;
      if (!candidates.has(id)) continue;
      const points = reverse ? road.path.slice().reverse() : road.path;
      const next = points.find(p => Math.hypot(p[0] - start[0], p[1] - start[1]) >= 12);
      if (!next) continue;
      const angle = Math.atan2(next[1] - start[1], next[0] - start[0]);
      const branch = {x: start[0], y: start[1], angle, width: road.w, kind: road.kind, length: Math.hypot(next[0]-start[0], next[1]-start[1])};
      if (!endpoints.has(id)) endpoints.set(id, []);
      endpoints.get(id).push(branch);
    }
  }
  const priority = arm => arm.kind === 'primary' ? 2 : arm.kind === 'secondary' ? 1 : 0;
  for (const [id, arms] of endpoints) {
    if (arms.length < 3 || !arms.some(arm => priority(arm))) continue;
    const {x, y} = arms[0];
    if (!builtUp(x,y) || sites.some(s => Math.hypot(s.x - x, s.y - y) < 68)) continue;
    arms.sort((a,b) => priority(b) - priority(a) || b.width - a.width);
    const axis = arms[0].angle;
    if (!arms.some(arm => Math.abs(Math.cos(arm.angle - axis)) < .66)) continue;
    const valid = [];
    for (const arm of arms) {
      const setback = Math.max(4.4, arm.width / 2 + 1);
      const approach = Math.min(8,arm.length-setback-1),edge=arm.width/2+.85;
      const pole = pointAlong(arm,setback+1.3,-edge-.57);
      if (approach<3 || !clear(...pole,.38)) continue;
      let blocked = false;
      for (const side of [-1,1]) for(let d=0; d<=Math.ceil(approach); d++) {
        if(!clear(...pointAlong(arm,setback+Math.min(d,approach),side*edge),.55)) blocked=true;
      }
      if (!blocked) valid.push({...arm, setback, approach, pole});
    }
    // Every approach gets an actual visible light. Skip congested or squeezed sites.
    if(valid.length!==arms.length) continue;
    const signal={id,x,y,axis,offset:hash(id)%cycle,arms:valid};
    byId.set(id,signal);sites.push(signal);
  }
  return {byId,sites};
}

export function sidewalkRoutine(seconds, route, index, hour) {
  // Residents whose trip ends at night leave the street at their next doorway.
  const visitor = (route.key + index * 17) % 5;
  const speed = .85 + (route.key % 67) * .009;
  const travel = route.length / speed;
  const rest = 4 + ((route.key + index) % 15);
  const period = (travel + rest) * 2;
  const clock = (seconds + route.key % period + index * period / route.count) % period;
  const returning = clock >= travel + rest;
  const progress = returning ? clock - travel - rest : clock;
  const walking = progress < travel;
  const departureHour = (hour - progress / 60 + 48) % 24;
  if ((departureHour < 6 || departureHour >= 22) && visitor > 1) return null;
  return {distance: returning ? Math.max(0,route.length-progress*speed) : Math.min(route.length,progress*speed),
    returning, speed: walking ? speed : 0, activity: walking ? 'walking' : 'visiting'};
}
