import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { safeFilename, validateProgram } from '../lib/security.mjs';
function program(code,options={}){return {code,input:'',filename:'main.c',files:[],standard:'c17',binary:false,...options};}
function run(payload,runLimit=5000){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./engine-worker.mjs',import.meta.url),{workerData:payload});
 let settled=false,timer;
 const done=result=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();resolve(result);};
 timer=setTimeout(()=>done({reason:'Compilation timed out'}),30000);
 worker.on('message',message=>{if(message.type==='result')done(message.result);else if(message.stage==='run'){clearTimeout(timer);timer=setTimeout(()=>done({reason:'Execution time limit exceeded'}),runLimit);}});
 worker.on('error',error=>{clearTimeout(timer);worker.terminate();reject(error);});
});}

test('compiles real C with stdin and stdout',async()=>{
 const r=await run(program('#include <stdio.h>\nint main(void){int a,b;if(scanf("%d %d",&a,&b)!=2)return 1;printf("%d\\n",a+b);return 0;}',{input:'12 8'}));
 assert.equal(r.code,0);assert.equal(r.stdout.trim(),'20');
});
test('reports syntax errors as compilation failures',async()=>{
 const r=await run(program('int main(void){this is invalid C;}'));
 assert.equal(r.stage,'compile');assert.notEqual(r.code,0);assert.match(r.stderr,/error/);
});
test('supports C99, C11 and C17 selection',async()=>{
 for(const [standard,expected] of [['c99','199901'],['c11','201112'],['c17','201710']]){
  const r=await run(program('#include <stdio.h>\nint main(void){printf("%ld",(long)__STDC_VERSION__);return 0;}',{standard}));assert.equal(r.stdout,expected);
 }
});
test('missing stdin yields EOF rather than hanging',async()=>{
 const r=await run(program('#include <stdio.h>\nint main(void){int x;printf("%d",scanf("%d",&x));return 0;}'));
 assert.equal(r.stdout,'-1');assert.equal(r.code,0);
});
test('terminates a runaway program in a disposable worker',async()=>{
 const r=await run(program('int main(void){volatile int x=0;for(;;)x++;}'),200);
 assert.equal(r.reason,'Execution time limit exceeded');
});
test('caps excessive output',async()=>{
 const r=await run(program('#include <stdio.h>\nint main(void){for(;;)puts("abcdefghijklmnopqrstuvwxyz");}'));
 assert.match(r.error,/Output limit/);
});
test('preserves stderr and nonzero status',async()=>{
 const r=await run(program('#include <stdio.h>\nint main(void){fputs("invalid input",stderr);return 2;}'));
 assert.equal(r.code,2);assert.equal(r.stderr,'invalid input');
});
test('exports an actual WASI binary with a bounded memory',async()=>{
 const r=await run(program('int main(void){return 0;}',{binary:true}));
 assert.ok(r.binary.length>100);assert.deepEqual(Array.from(r.binary.subarray(0,4)),[0,97,115,109]);
 assert.ok(WebAssembly.validate(r.binary));
});
test('runs with only a virtual filesystem and no host environment',async()=>{
 const r=await run(program('#include <stdio.h>\n#include <stdlib.h>\nint main(void){FILE*f=fopen("/package.json","r");printf("%d %d",f==NULL,getenv("HOME")==NULL);return 0;}'));
 assert.equal(r.stdout,'1 1');assert.equal(r.code,0);
});
test('program linear memory cannot grow beyond the configured 64 MiB',async()=>{
 const r=await run(program('#include <stdio.h>\n#include <stdlib.h>\nint main(void){void*p=malloc(80*1024*1024);printf("%d",p==NULL);free(p);return 0;}'));
 assert.equal(r.stdout,'1');assert.equal(r.code,0);
});
test('supports local header tabs without linking unrelated main functions',async()=>{
 const r=await run(program('#include <stdio.h>\n#include "values.h"\nint main(void){printf("%d",ANSWER);return 0;}',{files:[{name:'values.h',code:'#define ANSWER 42'},{name:'other.c',code:'int main(void){return 1;}'}]}));
 assert.equal(r.stdout,'42');assert.equal(r.code,0);
});
test('UTF-8 stdin survives the virtual input interface',async()=>{
 const r=await run(program('#include <stdio.h>\nint main(void){char s[100];if(fgets(s,100,stdin))printf("%s",s);return 0;}',{input:'สวัสดี\n'}));
 assert.equal(r.stdout,'สวัสดี\n');
});
test('validates paths, duplicate names, standards and resource limits',()=>{
 assert.equal(safeFilename('../../secret.c'),'source.c');
 assert.throws(()=>validateProgram(program('',{filename:'../secret.c'})),/filename/);
 assert.throws(()=>validateProgram(program('',{standard:'anything'})),/standard/);
 assert.throws(()=>validateProgram(program('ก'.repeat(34000))),/100 KB/);
 assert.throws(()=>validateProgram(program('',{files:[{name:'a.c',code:''},{name:'a.c',code:''}]})),/duplicate/);
 assert.throws(()=>validateProgram(program('',{files:Array.from({length:31},(_,i)=>({name:`a${i}.c`,code:''}))})),/30/);
});
test('toolchain assets exactly match the pinned integrity manifest',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/toolchain/manifest.json',import.meta.url)));
 for(const [name,entry] of Object.entries(manifest)){
  const data=await readFile(new URL('../public/toolchain/'+name,import.meta.url));assert.equal(data.length,entry.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256);
 }
});

// Cache regressions: sharing compiler assets must never share user files.
test('prepared compiler is reused without reloading or leaking source files',async()=>{
 const {prepareToolchain,compileAndRun}=await import('../lib/c-engine.mjs');
 let reads=0;
 const prepared=await prepareToolchain(async name=>{reads++;return new Uint8Array(await readFile(new URL('../public/toolchain/'+name,import.meta.url)));});
 const noFetch=()=>{throw new Error('Warm runs must not fetch assets');};
 const first=await compileAndRun(program('#include <stdio.h>\n#include "private.h"\nint main(void){printf("%d",VALUE);return 0;}',{files:[{name:'private.h',code:'#define VALUE 42'}]}),noFetch,()=>{},prepared);
 const second=await compileAndRun(program('#include <stdio.h>\nint main(void){puts("warm");return 0;}'),noFetch,()=>{},prepared);
 const third=await compileAndRun(program('#include "private.h"\nint main(void){return VALUE;}'),noFetch,()=>{},prepared);
 assert.equal(reads,3);assert.equal(first.stdout,'42');assert.equal(second.stdout,'warm\n');assert.equal(third.stage,'compile');assert.notEqual(third.code,0);
 assert.equal(prepared.sysroot['/private.h'],undefined);assert.equal(prepared.sysroot['/program.o'],undefined);assert.equal(prepared.sysroot['/program.wasm'],undefined);
});

function assetFixture(){
 const data=new TextEncoder().encode('trusted compiler asset');
 const entry={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
 const items=new Map();let fetches=0;
 const cache={match:async key=>items.get(key)?.clone(),put:async(key,value)=>items.set(key,value.clone()),delete:async key=>items.delete(key)};
 return {data,entry,items,storage:{open:async()=>cache},fetchAsset:async()=>{fetches++;return new Response(data);},count:()=>fetches};
}
test('verified persistent cache avoids repeat asset downloads',async()=>{
 const {loadVerifiedAsset}=await import('../lib/toolchain-assets.mjs');const f=assetFixture();
 const first=await loadVerifiedAsset('compiler.wasm',f.entry,f.storage,f.fetchAsset);
 const second=await loadVerifiedAsset('compiler.wasm',f.entry,f.storage,f.fetchAsset);
 assert.deepEqual(first,f.data);assert.deepEqual(second,f.data);assert.equal(f.count(),1);
});
test('corrupted cache is discarded and replaced by verified bytes',async()=>{
 const {loadVerifiedAsset}=await import('../lib/toolchain-assets.mjs');const f=assetFixture();
 f.items.set('/toolchain/compiler.wasm?sha256='+f.entry.sha256,new Response('tampered cache'));
 const result=await loadVerifiedAsset('compiler.wasm',f.entry,f.storage,f.fetchAsset);
 assert.deepEqual(result,f.data);assert.equal(f.count(),1);
});
test('cache quota or unavailable storage falls back to in-memory preparation',async()=>{
 const {loadVerifiedAsset}=await import('../lib/toolchain-assets.mjs');const f=assetFixture();
 const result=await loadVerifiedAsset('compiler.wasm',f.entry,{open:async()=>{throw new Error('Storage unavailable');}},f.fetchAsset);
 assert.deepEqual(result,f.data);assert.equal(f.count(),1);
});
test('unverified network assets are rejected and never cached',async()=>{
 const {loadVerifiedAsset}=await import('../lib/toolchain-assets.mjs');const f=assetFixture();
 await assert.rejects(loadVerifiedAsset('compiler.wasm',f.entry,f.storage,async()=>new Response('wrong compiler')),/integrity/);
 assert.equal(f.items.size,0);
});
