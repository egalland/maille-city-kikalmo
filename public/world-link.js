// Existing invitation links still open at their original location in the shared world.
export function worldURL(href) {
  const url=new URL(href);
  for(const key of [...url.searchParams.keys()]) {
    if(['salon','room'].includes(key.toLowerCase()))url.searchParams.delete(key);
  }
  return url;
}
export function selectedWorld(href){
  const q=new URL(href).searchParams;
  if(q.get('monde')==='enfer')return 'enfer';
  return q.get('monde')==='paris'||(q.has('lon')&&q.has('lat'))?'paris':'enfer';
}
export function switchWorldURL(href,map){
  const url=worldURL(href);url.hash='';
  for(const key of ['lon','lat','lieu','halte','monde'])url.searchParams.delete(key);
  if(map==='paris')url.searchParams.set('monde','paris');
  return url.href;
}

export function renderModeURL(href,rescue=false){
  const url=new URL(href);
  if(rescue)url.searchParams.set('rendu','secours');
  else url.searchParams.delete('rendu');
  return url.href;
}
