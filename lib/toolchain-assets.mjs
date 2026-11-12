export async function loadVerifiedAsset(name, entry, storage=globalThis.caches, fetchAsset=globalThis.fetch, cryptoApi=globalThis.crypto) {
  const key=`/toolchain/${name}?sha256=${entry.sha256}`;
  let cache;
  try { cache=await storage?.open('c-studio-toolchain-v1'); } catch { /* Private mode / quota: use network without persistent caching. */ }
  const verify=async response=>{
    if(!response.ok)throw new Error(`โหลด compiler ไม่สำเร็จ (${response.status}) กรุณาลองใหม่`);
    const buffer=await response.arrayBuffer();
    if(buffer.byteLength!==entry.bytes)throw new Error('Compiler integrity check failed');
    const digest=await cryptoApi.subtle.digest('SHA-256',buffer);
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==entry.sha256)throw new Error('Compiler integrity check failed');
    return new Uint8Array(buffer);
  };
  try {
    const cached=await cache?.match(key);
    if(cached)return await verify(cached);
  } catch { try{await cache?.delete(key);}catch{} }
  const response=await fetchAsset(key,{credentials:'omit'});
  const bytes=await verify(response);
  try{await cache?.put(key,new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}));}catch{}
  return bytes;
}
