import {cameraDistance,swimmingSurface,insideRetail} from './paris-world.js';
import {baseTerrainHeight,terrainHeight} from './terrain-height.js';
import {isAircraft} from './airfield.js';
import {vehicleSpec} from './vehicle-types.js';

const ease=(rate,dt)=>1-Math.exp(-rate*dt);
export function createWorldCamera(spawn){
  let x=spawn.x,y=spawn.y,arm=5.25,floor,liftOffset=0,first=true;
  return function cameraFrame({p,car,yaw,pitch=0,speed=0,destroyed,snap,cameraConfig,vehicleImpact},dt,time){
    const spec=car?vehicleSpec(car.type):null,airborne=!!car&&isAircraft(car.type);
    const road=!!car&&!airborne,heli=car?.type==='helicopter',swimming=!car&&p.motion==='swim',indoors=!car&&insideRetail(p);
    const reset=snap||first||Math.hypot(p.x-x,p.y-y)>25;
    first=false;
    // A delayed pivot can go behind the last corner while the car is already
    // in the next street. Road vehicles are the camera's immediate anchor.
    const follow=reset||road?1:ease(heli?20:19,dt);
    x+=(p.x-x)*follow;y+=(p.y-y)*follow;
    floor=swimming?undefined:terrainHeight(p.x,p.y,p.angle,reset?undefined:floor);
    const aircraftGround=airborne?baseTerrainHeight(p.x,p.y):0;
    const groundAt=airborne?()=>aircraftGround:car?.type==='train'?baseTerrainHeight:swimming?(a,b)=>swimmingSurface(a,b,true)??terrainHeight(a,b):
      (a,b)=>terrainHeight(a,b,p.angle,floor);
    const base=groundAt(x,y),offset=(p.lift||0)-(swimming?.55:0);
    const focus=offset+(car?Math.max(1.32,spec.height*.77):1.17);
    const outdoorHeight=(car?Math.max(2.92,spec.height+1.05):2.18)+pitch*2.8;
    const height=offset+(indoors?1.9+Math.max(-.25,Math.min(.32,pitch)):outdoorHeight);
    const far=cameraConfig?.mode==='near'?5.1:8.15;
    const reach=car?far+Math.max(0,spec.halfLength-2)*1.24+(airborne?2.8:0)+Math.min(heli?5.5:2.25,Math.abs(speed)*.065):indoors?1.75:5.25;
    const c=Math.cos(yaw),s=Math.sin(yaw),back=yaw+Math.PI;
    const cast=extra=>Math.max(.18,cameraDistance(x,y,focus,back,reach,height+extra,destroyed,car ? .27 : .18,groundAt));
    let extra=reset?0:liftOffset,available=cast(extra);
    if(road&&available<Math.min(3.75,spec.halfLength+.85)){
      const raised=cast(1.8);
      if(raised>available+.55){available=raised;extra=1.8;}
    }else if(extra){
      const next=extra*(1-ease(7,dt)),trial=cast(next);
      if(trial>=available-.34){available=trial;extra=next;}
    }
    liftOffset=extra;
    arm=reset?available:Math.min(available,arm+(available-arm)*ease(7,dt));
    const endGround=groundAt(x-c*reach,y-s*reach);
    const lift=base+focus+(endGround-base+height+extra-focus)*arm/reach+.12;
    const shake=(vehicleImpact||0)*Math.sin(time*35)*.19;
    const look=road?Math.min(3.35,.55+arm*.32):car?5.8:indoors?2.15:4.15;
    return {x:x-c*arm,y:y-s*arm,z:lift+shake,
      aimX:x+c*look,aimY:y+s*look,aimZ:groundAt(x+c*look,y+s*look)+focus+pitch*.72,
      reset,ground:base,arm};
  };
}
