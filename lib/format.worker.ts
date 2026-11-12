import init,{format} from '@wasm-fmt/clang-format/web';
import { loadVerifiedAsset } from './toolchain-assets.mjs';
import manifest from '../public/toolchain/manifest.json';
import { C_FORMAT_STYLE } from './format-style.mjs';
import { MAX_SOURCE_BYTES, safeFilename } from './security.mjs';
let ready:Promise<void>|null=null;
self.onmessage=async(event:MessageEvent)=>{
  try{
    if(!self.crossOriginIsolated)throw new Error('Formatter isolation is unavailable. Refresh the page and retry.');
    const {code,filename}=event.data;
    if(typeof code!=='string'||new TextEncoder().encode(code).length>MAX_SOURCE_BYTES||safeFilename(filename)!==filename)throw new Error('Invalid formatter input');
    if(!ready)ready=loadVerifiedAsset('clang-format.wasm',manifest['clang-format.wasm']).then(bytes=>init(new Uint8Array(bytes)));
    await ready;
    const output=format(code,filename,C_FORMAT_STYLE);
    if(new TextEncoder().encode(output).length>MAX_SOURCE_BYTES)throw new Error('โค้ดหลังจัดรูปแบบมีขนาดเกิน 100 KB');
    self.postMessage({code:output});
  }catch(error){ready=null;self.postMessage({error:error instanceof Error?error.message:'Format failed'});}
};
