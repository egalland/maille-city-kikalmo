export const outfitShop=Object.freeze({
  armorPrice:55,armorMax:40,
  dyes:{
    rubis:{label:'Rubis',color:'#b54267',price:35},
    pin:{label:'Vert sapin',color:'#286858',price:45},
    indigo:{label:'Indigo',color:'#414987',price:50}
  }
});
export const withJacket=(base,dye)=>Object.hasOwn(outfitShop.dyes,dye)?base+'~'+dye:base;
export function createArmorLayer(storage){
  let layer=null,remaining=0,server=0,usable=false;
  const key=()=> 'maillecity.armor.'+layer;
  return {
    apply(state){
      if(!state?.armorId){layer=null;remaining=server=0;usable=false;return;}
      const next=state.armorId;
      server=Math.min(outfitShop.armorMax,Math.max(0,state.armor||0));
      remaining=layer===next?Math.min(remaining,server):server;layer=next;usable=state.wearable===true;
      try{const saved=storage?.getItem(key());if(saved!=null&&Number.isInteger(+saved)&&+saved>=0)remaining=Math.min(remaining,+saved);}catch{}
      if(server===0){try{storage?.removeItem(key());}catch{}}
    },
    absorb(amount,cause){
      if(!usable||!['weapon','police','melee','explosion'].includes(cause)||!Number.isFinite(amount)||amount<=0)return 0;
      const used=Math.min(remaining,Math.ceil(amount));
      if(used){remaining-=used;try{storage?.setItem(key(),String(remaining));}catch{}}
      return used;
    },
    wear(){return usable&&remaining<server?{id:layer,remaining}:null;},
    get armor(){return usable?remaining:0;}
  };
}
