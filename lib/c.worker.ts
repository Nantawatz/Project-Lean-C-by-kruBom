import { compileAndRun } from './c-engine.mjs';
import { blockingInput } from './interactive-input.mjs';

// A fresh worker is created for every job and terminated by the owner on
// completion, cancellation, error or timeout. No user code executes in the UI.
self.onmessage=async(event:MessageEvent)=>{
  try{
    let stdout='',stderr='',warnings='';
    const io=event.data.inputBuffer?{
      stdin:blockingInput(event.data.inputBuffer,()=>self.postMessage({type:'input',stdout,stderr,warnings})),
      onOutput:(kind:string,value:string)=>{if(kind==='out')stdout+=value;else stderr+=value;},
      onCompiled:(value:string)=>{warnings=value;}
    }:null;
    const result=await compileAndRun(event.data.program,()=>{throw new Error('Missing prepared toolchain');},(stage:string)=>self.postMessage({type:'stage',stage}),event.data.toolchain,io);
    self.postMessage({type:'result',result});
  }catch(error){self.postMessage({type:'result',result:{error:error instanceof Error?error.message:'Compiler failed'}});}
};
