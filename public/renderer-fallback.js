// Keep the input canvas and game state when the renderer changes.
export function rendererFallback(createPrimary,createCompatible,{forceCompatible=false,report=()=>{}}={}){
  let current,compatible=false,disposed=false;
  function fallback(error){
    compatible=true;
    report(error);
    try{current?.dispose();}catch(cleanupError){console.warn('Nettoyage du rendu 3D',cleanupError);}
    current=createCompatible();
  }
  if(forceCompatible){compatible=true;current=createCompatible();}
  else try{current=createPrimary(fallback);}catch(error){fallback(error);}
  return {
    get available(){return !disposed&&current.available;},
    get mode(){return current.mode;},
    get drawCalls(){return current.drawCalls;},
    render(state,dt,time){
      try{return current.render(state,dt,time);}
      catch(error){
        if(compatible||disposed)throw error;
        fallback(error);
        return current.render({...state,snap:true},dt,time);
      }
    },
    aim(...args){return current.aim(...args);},
    projectTarget(...args){return current.projectTarget(...args);},
    effect(...args){return current.effect(...args);},
    dispose(){disposed=true;current.dispose();}
  };
}
