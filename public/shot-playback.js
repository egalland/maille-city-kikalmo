// Replay recent accepted shots on the observer's clock. Network delay must not
// consume the whole muzzle flash before the first frame can show it.
export const maxShotAge=1500;
export function createShotPlayback(){
  const pending=[];
  const seen=new Map();
  const scheduled=new Map();

  function push(event,now){
    const firedAt=event.data?.firedAt??event.at;
    if(!Number.isFinite(firedAt)||firedAt<now-maxShotAge||firedAt>now+350)return;
    for(const [id,until] of seen)if(until<now)seen.delete(id);
    const id=event.player+'/'+(event.data?.shotId??event.seq??firedAt);
    if(seen.has(id))return;
    seen.set(id,now+maxShotAge);
    if(pending.length>=160)pending.shift();
    pending.push({event,firedAt,showAt:null});
  }

  function flush(now,play){
    pending.sort((a,b)=>a.firedAt-b.firedAt);
    for(const shot of pending){
      if(shot.showAt!==null)continue;
      const previous=scheduled.get(shot.event.player);
      const gap=previous?Math.max(26,Math.min(75,shot.firedAt-previous.firedAt)):0;
      shot.showAt=previous?Math.min(now+140,Math.max(now,previous.showAt+gap)):now;
      scheduled.set(shot.event.player,shot);
    }
    for(let i=0;i<pending.length;){
      const shot=pending[i];
      if(shot.showAt>now){i++;continue;}
      pending.splice(i,1);
      if(now-shot.firedAt<=maxShotAge)play(shot.event,Math.min(.028,Math.max(0,(now-shot.showAt)/1000)));
    }
    for(const [sender,last] of scheduled)if(now-last.showAt>maxShotAge)scheduled.delete(sender);
  }

  return {push,flush};
}
