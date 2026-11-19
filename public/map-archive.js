const offlineMaps='maille-city-bundled-sectors-v1';

async function mapCache(storage){
  try{return await (storage??globalThis.caches)?.open(offlineMaps);}
  catch{return undefined;}
}

async function readResponse(response,compressed){
  if(!response?.ok)throw new Error('Données cartographiques indisponibles.');
  const data=compressed
    ? await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json()
    : await response.json();
  if(!data?.metadata||!['buildings','streets','water','green'].every(key=>Array.isArray(data[key])))
    throw new Error('Données cartographiques incomplètes.');
  return data;
}

export async function readMapArchive(key,{fetcher=globalThis.fetch,storage}={}){
  const enfer=key==='enfer',url=enfer?'/map-enfer.gz?rev=20261119b':'/sector-'+key+'.gz';
  const compatibilityURL='/map-enfer.json?rev=20261119b';
  const compressed=typeof globalThis.DecompressionStream==='function';
  const cache=await mapCache(storage);
  const preferred=compressed?url:compatibilityURL;
  if(compressed||enfer){
    try{
      const saved=await cache?.match(preferred);
      if(saved)return await readResponse(saved,compressed);
    }catch{
      // A partial or stale offline copy must never mask a working network response.
      try{await cache?.delete(preferred);}catch{}
    }
  }
  async function download(address,gzip){
    const response=await fetcher(address,{cache:'reload'});
    let copy;
    if(cache)try{copy=response.clone();}catch{}
    const data=await readResponse(response,gzip);
    if(copy)try{void cache.put(address,copy).catch(()=>{});}catch{}
    return data;
  }
  if(!enfer)return download(url,true);
  if(compressed){
    try{return await download(url,true);}
    catch(error){console.warn('Archive Enfer, bascule vers le chargement compatible.',error);}
  }
  return download(compatibilityURL,false);
}
