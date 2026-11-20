import * as T from './three.js';
import {cityClimate} from './city-climate.js';
import {sunBearing} from './textile-sky.js';

export function enferLighting(scene,renderer,touch){
  const radius=touch?43:63,mapSize=touch?1024:2048;
  scene.background=new T.Color('#c7d4d2');
  scene.fog=new T.FogExp2('#c8d1c6',.00054);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const sky=new T.HemisphereLight('#dceeff','#967360',1.48);
  const sun=new T.DirectionalLight('#ffe3ba',2.36);
  sun.castShadow=true;
  sun.shadow.mapSize.set(mapSize,mapSize);
  Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:3,far:230});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.00024;
  sun.shadow.normalBias=.095;
  sun.shadow.intensity=.80;
  scene.add(sky,sun,sun.target);
  const offset=new T.Vector3(Math.cos(sunBearing)*83,83,Math.sin(sunBearing)*83);
  let x=Infinity,y=Infinity,tick=-1;
  return {
    update(p,height,time,snap,scale=1,epoch=Date.now()){
      const sx=Math.round(p.x/6)*6,sy=Math.round(p.y/6)*6;
      const refresh=Math.floor(time*(scale<.84?9:touch?15:24));
      if(!snap&&sx===x&&sy===y&&refresh===tick)return;
      const {daylight,rain}=cityClimate(epoch);
      sky.intensity=.92+daylight*.56;
      sun.intensity=.42+daylight*1.94-rain*.32;
      sun.shadow.intensity=.38+.42*daylight-.22*rain;
      if(sx!==x||sy!==y||snap){
        x=sx;y=sy;
        sun.target.position.set(x,height+2,y);
        sun.position.copy(sun.target.position).add(offset);
      }
      tick=refresh;
      renderer.shadowMap.needsUpdate=true;
    },
    dispose(){sun.shadow.dispose();}
  };
}
