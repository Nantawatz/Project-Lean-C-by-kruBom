import { compileAndRun } from './c-engine.mjs';
import manifest from '../public/toolchain/manifest.json';

// A fresh worker is created for every job and terminated by the owner on
// completion, cancellation, error or timeout. No user code executes in the UI.
self.onmessage=async(event:MessageEvent)=>{
  const result=await compileAndRun(event.data,async(name:keyof typeof manifest)=>{
    const response=await fetch(`/toolchain/${name}`,{credentials:'omit'});
    if(!response.ok)throw new Error(`โหลด compiler ไม่สำเร็จ (${response.status}) กรุณาลองใหม่`);
    const buffer=await response.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',buffer);
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==manifest[name].sha256)throw new Error('Compiler integrity check failed. Refresh and try again.');
    return new Uint8Array(buffer);
  },(stage:string)=>self.postMessage({type:'stage',stage}));
  self.postMessage({type:'result',result});
};
