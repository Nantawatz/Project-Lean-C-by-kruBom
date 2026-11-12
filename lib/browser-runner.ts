import { validateProgram } from './security.mjs';
export type ProgramRequest={code:string;input:string;filename:string;standard:string;files:{name:string;code:string}[];binary:boolean};
export type ProgramResult={stage?:string;stdout?:string;stderr?:string;warnings?:string;error?:string;reason?:string;code?:number;duration?:number;binary?:Uint8Array;name?:string};
export function startBrowserRun(payload:ProgramRequest,onStage:(stage:string)=>void){
  validateProgram(payload);
  const worker=new Worker(new URL('./c.worker.ts',import.meta.url));
  let done=false,timer:ReturnType<typeof setTimeout>;
  let finish:(result:ProgramResult)=>void=()=>{};
  const started=Date.now();
  const promise=new Promise<ProgramResult>(resolve=>{
    finish=result=>{if(done)return;done=true;clearTimeout(timer);worker.terminate();resolve(result);};
    const limit=(ms:number,reason:string)=>{clearTimeout(timer);timer=setTimeout(()=>finish({code:1,reason,duration:Date.now()-started}),ms);};
    limit(120000,'Compiler loading timed out. Check your connection and retry.');
    worker.onmessage=(event:MessageEvent)=>{
      const message=event.data;
      if(message.type==='stage'){
        onStage(message.stage);
        if(message.stage==='compile')limit(60000,'Compilation time limit exceeded');
        if(message.stage==='run')limit(5000,'Execution time limit exceeded (5 seconds)');
      }else if(message.type==='result')finish(message.result);
    };
    worker.onerror=()=>finish({code:1,error:'Browser compiler failed. Refresh the page and retry.'});
    worker.onmessageerror=()=>finish({code:1,error:'Could not read the compiler result.'});
    worker.postMessage(payload);
  });
  return {promise,stop:()=>finish({code:1,reason:'Stopped by user',duration:Date.now()-started})};
}
