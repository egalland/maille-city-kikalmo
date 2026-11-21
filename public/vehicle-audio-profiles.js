import {automaticGear} from './vehicle-handling.js';
import {vehicleSpec} from './vehicle-types.js';

const profiles={
  petrol:{idle:43, rev:82, cutoff:620, rumble:.016, horn:[405,510]},
  small:{idle:53, rev:104, cutoff:890, rumble:.013, horn:[430,548]},
  sport:{idle:61, rev:151, cutoff:1350, rumble:.031, horn:[380,477]},
  diesel:{idle:28, rev:61, cutoff:350, rumble:.064, horn:[246,316]},
  bike:{idle:46, rev:147, cutoff:1540, rumble:.036, horn:[510,641]},
  armoured:{idle:25, rev:49, cutoff:310, rumble:.070, horn:[182,238]},
  train:{idle:37, rev:43, cutoff:480, rumble:.071, horn:[163,228]},
  helicopter:{idle:71, rev:13, cutoff:330, rumble:.080, pulse:11.1, horn:null},
  airship:{idle:38, rev:24, cutoff:240, rumble:.046, pulse:7.3, horn:null}
};
const families={
  compact:'small',scooter:'small',cargo:'small',
  sport:'sport',gt:'sport',supercar:'sport',motorbike:'bike',
  van:'diesel',ambulance:'diesel',firetruck:'diesel',swat:'diesel',bus:'diesel',
  camper:'diesel',flatbed:'diesel',boxtruck:'diesel',tipper:'diesel',pickup:'diesel',
  armored:'armoured',tank:'armoured',train:'train',helicopter:'helicopter',airship:'airship'
};
export const vehicleSoundProfile=type=>profiles[families[type]||'petrol'];

export function engineTone(type,speed){
  const profile=vehicleSoundProfile(type),rate=Math.abs(speed);
  const spec=vehicleSpec(type);
  const geared=!profile.pulse&&type!=='train';
  const gear=Math.max(1,automaticGear(spec,speed));
  const load=Math.min(1,rate/(geared?7.8+Math.pow(gear,1.38)*5.9:spec.forward));
  return {
    frequency:profile.idle+profile.rev*load,
    cutoff:profile.cutoff*(.66+load*.65),
    volume:.023+load*.025,
    rumble:profile.rumble*(.7+load*.65),
    pulse:profile.pulse?profile.pulse+load*.55:0
  };
}
