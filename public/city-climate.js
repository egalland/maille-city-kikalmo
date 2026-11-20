// All clocks use the same server timestamp. One real minute is one city hour.
const minute = 60000;
const smooth = t => t*t*(3-2*t);
const unit = t => Math.max(0, Math.min(1, t));
function front(slot) {
  const seed = Math.imul(slot ^ (slot >>> 16), 0x45d9f3b);
  const n = (Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0) / 4294967296;
  return n < .33 ? .55 + n : 0;
}
let lastSecond, sample;
export function cityClimate(epoch = Date.now()) {
  const second = Math.floor(epoch / 1000);
  if (second === lastSecond) return sample;
  const hour = ((epoch / minute % 24) + 24) % 24;
  const altitude = Math.cos((hour - 12) * Math.PI / 12);
  const daylight = smooth(unit((altitude + .16) / .56));
  const weatherTime = epoch / (minute * 4), slot = Math.floor(weatherTime);
  const mix = smooth(unit((weatherTime-slot) * 5));
  const rain = front(slot-1)*(1-mix) + front(slot)*mix;
  lastSecond = second;
  sample = {hour, daylight, rain, lamps: 1-daylight, grip: 1-.19*rain,
    twilight: 4*daylight*(1-daylight)};
  return sample;
}
