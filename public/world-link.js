// Existing invitation links still open at their original location in the shared world.
export function worldURL(href) {
  const url=new URL(href);
  for(const key of [...url.searchParams.keys()]) {
    if(['salon','room'].includes(key.toLowerCase()))url.searchParams.delete(key);
  }
  return url;
}
export function selectedWorld(href){
  return new URL(href).searchParams.get('monde')==='enfer'?'enfer':'paris';
}
export function switchWorldURL(href,map){
  const url=worldURL(href);url.hash='';
  for(const key of ['lon','lat','lieu','halte','monde'])url.searchParams.delete(key);
  if(map==='enfer')url.searchParams.set('monde','enfer');
  return url.href;
}
