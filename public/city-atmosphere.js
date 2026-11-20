import * as T from './three.js';
import {cityClimate} from './city-climate.js';

// One reusable batch of rain stitches follows the camera. Lamp light is shared
// by the near-detail street lamps; it adds no shadow-casting light per prop.
export function createAtmosphere(scene, sky, renderer, software) {
  const night = new T.Color('#7a91ac'), day = new T.Color('#ffffff');
  const dusk = new T.Color('#ffc294'), rainGrey = new T.Color('#b5c2c9');
  const fogNight = new T.Color('#647a90'), fogDay = scene.fog.color.clone();
  const count = software ? 0 : 96, positions = new Float32Array(count*6);
  const geometry = new T.BufferGeometry();
  const lines = new T.LineSegments(geometry,new T.LineBasicMaterial({
    color:'#d5e6ec',transparent:true,opacity:.30,depthWrite:false}));
  const buf = new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position',buf); lines.frustumCulled=false;scene.add(lines);
  let tick=-1;
  return {
    update(epoch,camera) {
      const climate=cityClimate(epoch);
      const {daylight,rain,twilight}=climate;
      if(Math.floor(epoch/1000)!==tick){
        tick=Math.floor(epoch/1000);
        sky.material.color.copy(night).lerp(day,daylight).lerp(dusk,twilight*.53).lerp(rainGrey,rain*.5);
        scene.fog.color.copy(fogNight).lerp(fogDay,daylight).lerp(dusk,twilight*.34).lerp(rainGrey,rain*.3);
        scene.fog.density=.00054+rain*.00072;
        scene.userData.ambientBrightness=.46+.54*daylight-.1*rain;
        renderer.toneMappingExposure=.82+.18*daylight;
      }
      lines.visible=count>0&&rain>.03;
      if(!lines.visible)return;
      lines.position.copy(camera.position);
      const dropCount=Math.ceil(count*rain), seconds=(epoch % 120000)/1000;
      geometry.setDrawRange(0,dropCount*2);
      for(let i=0;i<dropCount;i++){
        const off=i*6, y=12-((i*9.37+seconds*12)%24);
        const x=(((i*19.315+camera.position.x*-1+y*.16)%24)+24)%24-12;
        const z=(((i*8.743-camera.position.z)%24)+24)%24-12;
        positions.set([x,y,z,x-.07,y-.43,z],off);
      }
      buf.needsUpdate=true;
    },
    dispose(){scene.remove(lines);geometry.dispose();lines.material.dispose();}
  };
}
