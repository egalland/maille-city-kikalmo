import {broadcastBeat,readRadio} from './car-radio.js';
import {engineTone,vehicleSoundProfile} from './vehicle-audio-profiles.js';
import {weaponCatalog} from './weapon-catalog.js';
const floor=.001;
const reports={
  sidearm:[4100,310,.075,.23],revolver:[3500,240,.105,.27],compact:[5300,360,.065,.20],
  shotgun:[2500,145,.19,.31],double:[2900,166,.17,.31],rifle:[4700,212,.114,.25],
  assault:[5050,206,.103,.26],sniper:[3800,172,.175,.29],launcher:[1500,98,.26,.32],rocket:[2300,71,.52,.37]
};
export function createStreetAudio(){
  let context,master,bed,noise,roll,own,ambient,siren,enabled=false,footAt=0;
  let beat=-1,lastChirp=0,radio=readRadio();
  function toggle(on){
    enabled=on;
    if(master)master.gain.setTargetAtTime(on?.68:floor,context.currentTime,.08);
  }
  function unlock(){
    if(!enabled)return;
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Audio)return;
    try {
      if(!context){
        context=new Audio();
        master=context.createGain();master.gain.value=.68;master.connect(context.destination);
        noise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
        const data=noise.getChannelData(0);let low=0;
        for(let i=0;i<data.length;i++){
          const white=Math.random()*2-1;low=.89*low+white*.11;data[i]=white*.56+low*.44;
        }
        bed=context.createBufferSource();bed.buffer=noise;bed.loop=true;
        const breeze=context.createBiquadFilter();breeze.type='lowpass';breeze.frequency.value=480;
        roll=context.createGain();roll.gain.value=.018;
        bed.connect(breeze).connect(roll).connect(master);bed.start();
        own=motor();ambient=motor();siren=loop('sine');
      }
      if(context.state==='suspended')void context.resume().catch(()=>{});
    }catch{}
  }
  function loop(kind){
    const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=kind;
    gain.gain.value=floor;oscillator.connect(gain).connect(master);oscillator.start();
    return {oscillator,gain};
  }
  function motor(){
    const core=context.createOscillator(),harmonic=context.createOscillator(),partial=context.createGain();
    const filter=context.createBiquadFilter(),body=context.createGain(),level=context.createGain();
    const rumble=context.createGain(),dust=context.createBufferSource(),pulse=context.createOscillator(),mod=context.createGain();
    const direction=context.createStereoPanner?.();
    core.type='triangle';harmonic.type='sawtooth';partial.gain.value=.17;
    body.gain.value=.75;level.gain.value=floor;rumble.gain.value=floor;mod.gain.value=0;
    filter.type='lowpass';filter.Q.value=.64;filter.frequency.value=440;
    core.connect(filter);harmonic.connect(partial).connect(filter);
    dust.buffer=noise;dust.loop=true;dust.connect(rumble).connect(filter);
    filter.connect(body).connect(level);
    if(direction)level.connect(direction).connect(master);else level.connect(master);
    pulse.connect(mod).connect(body.gain);
    core.start();harmonic.start();pulse.start();dust.start(0,Math.random());
    return {core,harmonic,filter,level,rumble,pulse,mod,direction};
  }
  function setMotor(voice,listener,t){
    if(!listener){voice.level.gain.setTargetAtTime(floor,t,.15);return;}
    const sound=engineTone(listener.type,listener.speed||0),rate=listener.doppler??1;
    voice.core.frequency.setTargetAtTime(sound.frequency*rate,t,.09);
    voice.harmonic.frequency.setTargetAtTime(sound.frequency*1.998*rate,t,.087);
    voice.filter.frequency.setTargetAtTime(sound.cutoff,t,.12);
    voice.rumble.gain.setTargetAtTime(sound.rumble,t,.14);
    voice.level.gain.setTargetAtTime(sound.volume*(listener.volume??1),t,.16);
    voice.pulse.frequency.setTargetAtTime(sound.pulse||9,t,.23);
    voice.mod.gain.setTargetAtTime(sound.pulse?.49:0,t,.3);
    voice.direction?.pan.setTargetAtTime(listener.pan||0,t,.13);
  }
  function tone(hz,seconds=.08,wave='triangle',volume=.04,end=hz,pan=0){
    if(!enabled||context?.state!=='running')return;
    const t=context.currentTime,o=context.createOscillator(),g=context.createGain();o.type=wave;o.frequency.setValueAtTime(hz,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(16,end),t+seconds);
    g.gain.setValueAtTime(Math.max(floor,volume),t);g.gain.exponentialRampToValueAtTime(floor,t+seconds);
    const direction=pan&&context.createStereoPanner?.();
    if(direction){direction.pan.value=pan;o.connect(g).connect(direction).connect(master);}
    else o.connect(g).connect(master);
    o.onended=()=>{g.disconnect();direction?.disconnect();};
    o.start(t);o.stop(t+seconds+.015);
  }
  function grit(seconds,volume,frequency){
    if(!enabled||context?.state!=='running')return;
    const t=context.currentTime,node=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    node.buffer=noise;filter.type='lowpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(floor,t+seconds);
    node.connect(filter).connect(gain).connect(master);node.start(t,Math.random());node.stop(t+seconds);
  }
  function gunshot(kind,volume=1,pan=0,distance=0){
    const profile=reports[kind==='rocket'?'rocket':weaponCatalog[kind]?.profile];
    if(!profile||!enabled||context?.state!=='running'||volume<=0)return;
    const [crack,body,tail,level]=profile,t=context.currentTime;
    const output=context.createGain(),direction=context.createStereoPanner?.();
    output.gain.value=Math.min(1,volume);
    if(direction){direction.pan.value=pan;output.connect(direction).connect(master);}else output.connect(master);
    const cutoff=1+distance/42,layers=[
      ['highpass',crack/cutoff,.023,level,0],
      ['lowpass',body*2.45/cutoff,tail,level*.85,.002],
      ['bandpass',1040/cutoff,tail*.95,level*.14,.055],
      ['bandpass',2100/cutoff,.050,level*.20,.022]
    ];
    const offset=Math.random()*.6;
    for(const [type,hz,duration,peak,delay] of layers){
      const node=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),start=t+delay;
      filter.type=type;filter.frequency.value=Math.max(80,hz);
      gain.gain.setValueAtTime(peak,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      node.buffer=noise;node.connect(filter).connect(gain).connect(output);
      node.onended=()=>{node.disconnect();filter.disconnect();gain.disconnect();};
      node.start(start,offset+delay);node.stop(start+duration);
    }
    setTimeout(()=>{output.disconnect();direction?.disconnect();},(tail+.13)*1000);
  }
  function update({speed,driving,vehicleType,nearby,walking,city,sirenDistance,time,epoch,weather}){
    if(!enabled||context?.state!=='running')return;
    const t=context.currentTime;
    setMotor(own,driving?{type:vehicleType,speed}:null,t);
    setMotor(ambient,nearby,t);
    siren.oscillator.frequency.setTargetAtTime(680+215*Math.sin(time*5.6),t,.07);
    siren.gain.gain.setTargetAtTime(Math.max(floor,.10*(1-sirenDistance/145)),t,.11);
    roll.gain.setTargetAtTime((city?.027:.018)+(weather?.rain||0)*.044,t,.5);
    const step=Math.floor(epoch / 155);
    if(driving&&radio&&beat!==step){
      beat=step;
      for(const note of broadcastBeat(step))tone(note.hz,note.length,note.wave,note.volume);
    }
    if(!city&&!driving&&weather?.daylight>.65&&weather.rain<.15&&time>lastChirp+8){
      lastChirp=time;tone(1820,.085,'sine',.016,2490);
    }
    if(walking&&time>footAt){footAt=time+Math.max(.23,.60-speed*.061);grit(.085,.035,500);}
  }
  function horn(type,volume=1,duration=.36,pan=0){
    const pair=vehicleSoundProfile(type).horn;
    if(!pair)return;
    tone(pair[0],duration,'triangle',.085*volume,pair[0]*.986,pan);
    tone(pair[1],duration*.96,'triangle',.071*volume,pair[1],pan);
    tone(pair[0]*2,duration*.51,'sine',.030*volume,pair[0]*2,pan);
  }
  return {toggle,unlock,tone,grit,gunshot,update,horn,setRadio(value){radio=Boolean(value);},dispose:()=>context?.close().catch(()=>{})};
}
