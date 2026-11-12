import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { compileAndRun } from '../lib/c-engine.mjs';
import { blockingInput } from '../lib/interactive-input.mjs';
try {
 let stdout='',stderr='';
 const io=workerData.inputBuffer?{stdin:blockingInput(workerData.inputBuffer,()=>parentPort.postMessage({type:'input',stdout,stderr})),onOutput:(kind,value)=>{if(kind==='out')stdout+=value;else stderr+=value;}}:null;
 const result=await compileAndRun(workerData,async name=>new Uint8Array(await readFile(new URL('../public/toolchain/'+name,import.meta.url))),stage=>parentPort.postMessage({type:'stage',stage}),null,io);
 parentPort.postMessage({type:'result',result});
}catch(error){parentPort.postMessage({type:'result',result:{error:error.message}});}
