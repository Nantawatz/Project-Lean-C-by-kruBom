import { validateProgram } from './security.mjs';
import type { prepareToolchain } from './c-engine.mjs';
export type ProgramRequest={code:string;input:string;filename:string;standard:string;files:{name:string;code:string}[];binary:boolean;mode?:'auto'|'submit';compiledBinary?:Uint8Array;compileWarnings?:string};
export type ProgramResult={stage?:string;stdout?:string;stderr?:string;warnings?:string;error?:string;reason?:string;code?:number;duration?:number;binary?:Uint8Array;name?:string;awaitingInput?:boolean;compiledBinary?:Uint8Array};
type Toolchain=Awaited<ReturnType<typeof prepareToolchain>>;
let prepared:Promise<Toolchain>|null=null;
let compilerReady=false;
function getToolchain(){
  if(prepared)return prepared;
  const pending=new Promise<Toolchain>((resolve,reject)=>{
    const loader=new Worker(new URL('./toolchain.worker.ts',import.meta.url));
    const timer=setTimeout(()=>{loader.terminate();reject(new Error('Compiler loading timed out. Check your connection and retry.'));},120000);
    const fail=(message:string)=>{clearTimeout(timer);loader.terminate();reject(new Error(message));};
    loader.onmessage=event=>{
      if(event.data.type==='ready'){clearTimeout(timer);loader.terminate();compilerReady=true;resolve(event.data.toolchain);}
      else fail(event.data.error||'Could not prepare compiler.');
    };
    loader.onerror=()=>fail('Could not load the browser compiler. Refresh and retry.');
    loader.onmessageerror=()=>fail('Could not read the compiler assets.');
    loader.postMessage({type:'prepare'});
  });
  prepared=pending.catch(error=>{prepared=null;compilerReady=false;throw error;});
  return prepared;
}
export function startBrowserRun(payload:ProgramRequest,onStage:(stage:string)=>void){
  validateProgram(payload);
  let worker:Worker|undefined;
  let done=false,timer:ReturnType<typeof setTimeout>;
  let finish:(result:ProgramResult)=>void=()=>{};
  const started=Date.now();
  const promise=new Promise<ProgramResult>(resolve=>{
    finish=result=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();resolve(result);};
    const limit=(ms:number,reason:string)=>{clearTimeout(timer);timer=setTimeout(()=>finish({code:1,reason,duration:Date.now()-started}),ms);};
    if(!payload.compiledBinary&&!compilerReady)onStage('loading');
    limit(120000,'Compiler loading timed out. Check your connection and retry.');
    (payload.compiledBinary?Promise.resolve(null):getToolchain()).then(toolchain=>{
      if(done)return;
      // Each program gets a fresh worker and cloned filesystem; only trusted
      // compiler modules and the clean sysroot template are shared between jobs.
      worker=new Worker(new URL('./c.worker.ts',import.meta.url));
      onStage('compile');limit(60000,'Compilation time limit exceeded');
      worker.onmessage=(event:MessageEvent)=>{
        const message=event.data;
        if(message.type==='stage'){
          onStage(message.stage);
          if(message.stage==='compile')limit(60000,'Compilation time limit exceeded');
          if(message.stage==='run')limit(5000,'Execution time limit exceeded (5 seconds)');
        }else if(message.type==='result')finish({...message.result,duration:Date.now()-started});
      };
      worker.onerror=()=>finish({code:1,error:'Browser compiler failed. Refresh the page and retry.'});
      worker.onmessageerror=()=>finish({code:1,error:'Could not read the compiler result.'});
      worker.postMessage({program:payload,toolchain});
    }).catch(error=>finish({code:1,error:error instanceof Error?error.message:'Could not prepare compiler.'}));
  });
  return {promise,stop:()=>finish({code:1,reason:'Stopped by user',duration:Date.now()-started})};
}
