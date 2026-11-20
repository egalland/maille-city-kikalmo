const key='maillecity.camera.v1';
export const cameraModes=Object.freeze({chase:'Poursuite',near:'Rapprochée',driver:'Conducteur'});
function limit(v,min,max,defaultValue){
  return Number.isFinite(v)?Math.min(max,Math.max(min,v)):defaultValue;
}
export function cameraOptions(raw={}){
  return {sensitivity:limit(raw?.sensitivity,.4,1.8,1),fov:limit(raw?.fov,65,100,80),
    mode:Object.hasOwn(cameraModes,raw?.mode)?raw.mode:'chase'};
}
export function readCameraOptions(){
  try{return cameraOptions(JSON.parse(localStorage.getItem(key)));}catch{return cameraOptions();}
}
export function writeCameraOptions(config){
  try{localStorage.setItem(key,JSON.stringify(config));}catch{}
}
export function cameraFieldOfView(aspect,fov){
  // The horizontal angle is the reference on landscape displays. Keep a taller
  // field on portrait phones so the ground and skyline both remain visible.
  const radians=Math.PI/180,scale=Math.tan(fov*radians/2)/Math.tan(40*radians);
  const base=aspect<1?62:Math.min(53,2*Math.atan(Math.tan(40*radians)/aspect)/radians);
  return 2*Math.atan(Math.tan(base*radians/2)*scale)/radians;
}
export function cameraSettingsControls(game){
  const group=document.createElement('fieldset');group.className='mc-camera-options';
  const legend=document.createElement('legend');legend.textContent='Caméra';group.append(legend);
  const settings=game.getCameraOptions();
  function slider(key,label,min,max,step,format){
    const wrap=document.createElement('label'),caption=document.createElement('span'),output=document.createElement('output'),control=document.createElement('input');
    caption.textContent=label;control.type='range';control.min=min;control.max=max;control.step=step;control.value=settings[key];
    output.textContent=format(settings[key]);
    control.addEventListener('input',()=>{const value=Number(control.value);game.setCameraOptions({[key]:value});output.textContent=format(value);});
    wrap.append(caption,output,control);group.append(wrap);
  }
  slider('sensitivity','Sensibilité',.4,1.8,.05,value=>Math.round(value*100)+' %');
  if(game.graphicsMode!=='canvas'){
    slider('fov','Angle de vue',65,100,1,value=>value+'°');
    const label=document.createElement('label'),select=document.createElement('select');
    label.append('Caméra au volant');select.className='mc-input';
    for(const [value,title] of Object.entries(cameraModes)){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}
    select.value=settings.mode;select.addEventListener('change',()=>game.setCameraOptions({mode:select.value}));label.append(select);group.append(label);
  }
  return group;
}
