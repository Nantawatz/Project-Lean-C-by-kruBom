import { prepareToolchain } from './c-engine.mjs';
import { loadVerifiedAsset } from './toolchain-assets.mjs';
import manifest from '../public/toolchain/manifest.json';

// Trusted preparation only: no user program or input enters this worker.
self.onmessage=async()=>{
  try{
    // Keep the worker entry tied to the isolated deployment. This also gives
    // previously cached worker scripts a new content hash after enabling COEP.
    if(!self.crossOriginIsolated)throw new Error('Compiler isolation is unavailable. Refresh the page and retry.');
    const toolchain=await prepareToolchain((name:keyof typeof manifest)=>loadVerifiedAsset(name,manifest[name]));
    self.postMessage({type:'ready',toolchain});
  }catch(error){self.postMessage({type:'error',error:error instanceof Error?error.message:'Could not prepare compiler'});}
};
