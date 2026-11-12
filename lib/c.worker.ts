import { compileAndRun } from './c-engine.mjs';

// A fresh worker is created for every job and terminated by the owner on
// completion, cancellation, error or timeout. No user code executes in the UI.
self.onmessage=async(event:MessageEvent)=>{
  try{
    const result=await compileAndRun(event.data.program,()=>{throw new Error('Missing prepared toolchain');},(stage:string)=>self.postMessage({type:'stage',stage}),event.data.toolchain);
    self.postMessage({type:'result',result});
  }catch(error){self.postMessage({type:'result',result:{error:error instanceof Error?error.message:'Compiler failed'}});}
};
