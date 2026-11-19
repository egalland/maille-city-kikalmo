import {motionSeed} from './locomotion-pose.js';

export function reactionTo(actor,threat,now,direct=false){
  if(actor.responder||actor.down)return null;
  return {x:threat.x,y:threat.y,until:now+(direct?9400:5600),
    fight:direct&&motionSeed(String(actor.id))%5===0};
}

export function reactionGoal(actor,reaction,blocked){
  const away=Math.atan2(actor.y-reaction.y,actor.x-reaction.x);
  if(reaction.fight&&Math.hypot(actor.x-reaction.x,actor.y-reaction.y)<1.55)
    return {...actor,angle:away+Math.PI,moving:false,speed:0,closeContact:true};
  const heading=reaction.fight?away+Math.PI:away;
  let best=null,score=-Infinity;
  for(const turn of [0,.48,-.48,.97,-.97,1.5,-1.5,2,-2]){
    const angle=heading+turn,c=Math.cos(angle),s=Math.sin(angle);
    let reach=0;
    for(let d=.8;d<=6;d+=.8){if(blocked(actor.x+c*d,actor.y+s*d))break;reach=d;}
    const rank=reach-Math.abs(turn)*1.35;
    if(reach&&rank>score){
      score=rank;best={...actor,x:actor.x+c*reach,y:actor.y+s*reach,angle,
        moving:true,speed:reaction.fight?3.05:4.1,sprinting:!reaction.fight,closeContact:reaction.fight};
    }
  }
  return best||actor;
}
