import {motionSeed} from './locomotion-pose.js';

export function reactionTo(actor,threat,now,direct=false,alarm=false){
  if(actor.responder||actor.down)return null;
  const seed=motionSeed(String(actor.id));
  return {x:threat.x,y:threat.y,until:now+(alarm?7600+seed%5200:direct?9400:5600),
    start:now+(alarm&&!direct?140+seed%490:0),pace:alarm?4.1+(seed%9)*.11:4.1,
    fight:direct&&!alarm&&seed%5===0};
}

export function reactionGoal(actor,reaction,blocked,now=Infinity){
  const away=Math.atan2(actor.y-reaction.y,actor.x-reaction.x);
  if(now<reaction.start)return {...actor,angle:away+Math.PI,moving:false,speed:0};
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
        moving:true,speed:reaction.fight?3.05:reaction.pace??4.1,sprinting:!reaction.fight,closeContact:reaction.fight};
    }
  }
  return best||actor;
}
