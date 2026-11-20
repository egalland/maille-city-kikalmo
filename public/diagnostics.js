// Budgets are targets for the WebGL path. Rendering time measures CPU submission,
// and draw calls provide a GPU workload indicator where the renderer reports it.
export const frameBudgets=Object.freeze({
  desktop:Object.freeze({fps:60,simulation:5,render:8,heap:384,draws:1100}),
  mobile:Object.freeze({fps:30,simulation:9,render:17,heap:256,draws:650})
});

export function createFrameMeter(){
  let enabled=false,windowStart=null,frames=0,presented=0,simulation=0,population=0,render=0,hud=0,sample=null;
  function reset(){
    windowStart=null;frames=presented=simulation=population=render=hud=0;sample=null;
  }
  return {
    get enabled(){return enabled;},
    set enabled(value){enabled=Boolean(value);reset();},
    read:()=>sample,
    frame(t,pop,cpu,draw,ui,wasPresented,counts){
      if(!enabled)return;
      if(windowStart===null||t-windowStart>4000){reset();windowStart=t;return;}
      frames++;presented+=Number(wasPresented);population+=pop;simulation+=cpu;render+=draw;hud+=ui;
      const elapsed=t-windowStart;
      if(elapsed<1000)return;
      sample={fps:presented*1000/elapsed,simulation:simulation/frames,population:population/frames,
        render:presented?render/presented:0,hud:hud/frames,...counts()};
      windowStart=t;frames=presented=simulation=population=render=hud=0;
    }
  };
}

export function createDiagnosticsToggle(game){
  const row=document.createElement('div');row.className='mc-option-row';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='mc-secondary';
  toggle.textContent='Diagnostic en jeu';
  toggle.setAttribute('aria-pressed',String(game.diagnostics.enabled));row.append(toggle);
  toggle.addEventListener('click',()=>{
    const meter=game.diagnostics;
    meter.enabled=!meter.enabled;
    toggle.setAttribute('aria-pressed',String(meter.enabled));
    if(!meter.enabled){document.getElementById('performanceHud')?.remove();return;}
    const box=document.createElement('aside');box.id='performanceHud';box.setAttribute('aria-label','Performances du jeu');
    const title=document.createElement('strong');title.textContent='Diagnostic';
    const lines=document.createElement('div');box.append(title,lines);
    document.getElementById('scene').append(box);
    const budget=frameBudgets[matchMedia('(pointer:coarse)').matches?'mobile':'desktop'];
    function refresh(){
      if(!box.isConnected)return;
      const s=meter.read();
      if(!s)lines.textContent='Mesure en cours…';
      else{
        const ms=n=>n.toFixed(1)+' ms', mem=performance.memory?.usedJSHeapSize;
        lines.textContent=[
          Math.round(s.fps)+' i/s · cible '+budget.fps+' · '+s.mode,
          'Simulation '+ms(s.simulation)+' / '+budget.simulation+' ms',
          'Population '+ms(s.population)+' · HUD '+ms(s.hud),
          'Rendu CPU '+ms(s.render)+' / '+budget.render+' ms',
          'Appels de dessin '+(s.draws??'n.d.')+' / '+budget.draws,
          'PNJ '+s.actors+' · véhicules '+s.cars+' · joueurs distants '+s.peers,
          'Synchro '+s.requests+' requêtes · latence '+(s.rtt!=null?Math.round(s.rtt)+' ms':'n.d.'),
          'Mémoire JS '+(Number.isFinite(mem)?Math.round(mem/1048576)+' Mio':'n.d.')+' / '+budget.heap+' Mio'
        ].join('\n');
      }
      setTimeout(refresh,1000);
    }
    refresh();
  });
  return row;
}
