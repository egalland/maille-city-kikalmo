import {broadcastBeat,readRadio} from './car-radio.js';
const floor=.001;
export function createStreetAudio(){
  let context,master,bed,noise,roll,engine,rotorPulse,rotorDepth,siren,enabled=false,footAt=0;
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
        engine=loop('triangle');siren=loop('sine');
        rotorPulse=context.createOscillator();rotorDepth=context.createGain();rotorDepth.gain.value=0;
        rotorPulse.connect(rotorDepth).connect(engine.gain.gain);rotorPulse.start();
      }
      if(context.state==='suspended')void context.resume().catch(()=>{});
    }catch{}
  }
  function loop(kind){
    const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=kind;
    gain.gain.value=floor;oscillator.connect(gain).connect(master);oscillator.start();
    return {oscillator,gain};
  }
  function tone(hz,seconds=.08,wave='triangle',volume=.04,end=hz){
    if(!enabled||context?.state!=='running')return;
    const t=context.currentTime,o=context.createOscillator(),g=context.createGain();o.type=wave;o.frequency.setValueAtTime(hz,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(16,end),t+seconds);
    g.gain.setValueAtTime(Math.max(floor,volume),t);g.gain.exponentialRampToValueAtTime(floor,t+seconds);
    o.connect(g).connect(master);o.start(t);o.stop(t+seconds+.015);
  }
  function grit(seconds,volume,frequency){
    if(!enabled||context?.state!=='running')return;
    const t=context.currentTime,node=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    node.buffer=noise;filter.type='lowpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(floor,t+seconds);
    node.connect(filter).connect(gain).connect(master);node.start(t,Math.random());node.stop(t+seconds);
  }
  function update({speed,driving,vehicleType,walking,city,sirenDistance,time,epoch,weather}){
    if(!enabled||context?.state!=='running')return;
    const t=context.currentTime;
    const helicopter=vehicleType==='helicopter',blimp=vehicleType==='airship',rate=Math.abs(speed);
    const pitch=helicopter?58+rate*.9:blimp?42+rate*1.3:32+rate*2.3;
    engine.oscillator.frequency.setTargetAtTime(pitch,t,.08);
    rotorPulse.frequency.setTargetAtTime(helicopter?11+rate*.09:6.4+rate*.11,t,.35);
    rotorDepth.gain.setTargetAtTime(driving?(helicopter?.028:blimp?.012:0):0,t,.22);
    engine.gain.gain.setTargetAtTime(driving?.035+Math.min(.045,Math.abs(speed)*.002):floor,t,.15);
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
  return {toggle,unlock,tone,grit,update,setRadio(value){radio=Boolean(value);},horn(volume=1){tone(185,.38,'sawtooth',.044*volume);tone(233,.34,'triangle',.062*volume);},dispose:()=>context?.close().catch(()=>{})};
}
