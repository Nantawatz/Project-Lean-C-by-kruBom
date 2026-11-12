import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { compileAndRun } from '../lib/c-engine.mjs';
try {
 const result=await compileAndRun(workerData,async name=>new Uint8Array(await readFile(new URL('../public/toolchain/'+name,import.meta.url))),stage=>parentPort.postMessage({type:'stage',stage}));
 parentPort.postMessage({type:'result',result});
}catch(error){parentPort.postMessage({type:'result',result:{error:error.message}});}
