// Retain only this tab's technical diagnostics. File URLs are reduced to names.
const records=[];
const key='maillecity.runtime.v1';
try{
  const old=JSON.parse(sessionStorage.getItem(key)||'[]');
  if(Array.isArray(old))records.push(...old.filter(x=>typeof x?.text==='string'&&Number.isFinite(x.at)).slice(-8));
}catch{}
export function recentErrors(){return records.slice();}
export function recordFailure(err,file=''){
  if(!err)return;
  const message=String(err.message||err).replace(/https?:\/\/[^\s)]+/gi,'[adresse]').slice(0,150);
  const where=file.split(/[?#]/)[0].split('/').at(-1)?.replace(/[^a-z0-9_.-]/ig,'').slice(0,40);
  const text=(where?where+' · ':'')+message,at=Date.now();
  if(records.at(-1)?.text===text&&at-records.at(-1).at<5000)return;
  records.push({text,at});if(records.length>8)records.shift();
  try{sessionStorage.setItem(key,JSON.stringify(records));}catch{}
}
if(typeof window!=='undefined'){
  window.addEventListener('error',e=>recordFailure(e.error||e.message,e.filename));
  window.addEventListener('unhandledrejection',e=>recordFailure(e.reason));
}
