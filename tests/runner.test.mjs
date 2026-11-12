import test from 'node:test';
import assert from 'node:assert/strict';
import { runProgram, stop } from '../lib/runner.mjs';
import { randomUUID } from 'node:crypto';
test('compiles and runs actual C with stdin', async () => {
 const result = await runProgram({id:randomUUID(),code:'#include <stdio.h>\nint main(void){int a,b;if(scanf("%d %d",&a,&b)!=2)return 1;printf("%d\\n",a+b);return 0;}',input:'12 8'});
 assert.equal(result.stage,'run'); assert.equal(result.code,0); assert.equal(result.stdout.trim(),'20');
});
test('reports actual compiler diagnostics',async()=>{
 const r=await runProgram({id:randomUUID(),code:'int main(void) { this is invalid C; }'});
 assert.equal(r.stage,'compile'); assert.notEqual(r.code,0); assert.match(r.stderr,/error/i);
});
test('terminates an infinite loop',async()=>{
 const r=await runProgram({id:randomUUID(),code:'int main(void){for(;;){}return 0;}'});
 assert.equal(r.reason,'Execution time limit exceeded');
});
test('stop cancels an active job',async()=>{
 const id=randomUUID();const pending=runProgram({id,code:'int main(void){for(;;){}return 0;}'});
 const timer=setTimeout(()=>stop(id),1500);
 try { const r=await pending;assert.equal(r.reason,'Stopped by user'); } finally {clearTimeout(timer);}
});
test('exports a real native binary',async()=>{
 const r=await runProgram({id:randomUUID(),code:'int main(void){return 0;}',binary:true});
 assert.ok(r.binary?.length>100); if(process.platform==='win32')assert.equal(r.binary.subarray(0,2).toString(),'MZ');
});
test('caps excessive program output',async()=>{
 const r=await runProgram({id:randomUUID(),code:'#include <stdio.h>\nint main(void){for(;;)puts("abcdefghijklmnopqrstuvwxyz");}'});
 assert.equal(r.reason,'Output limit exceeded');
});
test('preserves stderr and nonzero exit codes',async()=>{
 const r=await runProgram({id:randomUUID(),code:'#include <stdio.h>\nint main(void){fprintf(stderr,"invalid input");return 2;}'});
 assert.equal(r.stage,'run');assert.equal(r.code,2);assert.equal(r.stderr,'invalid input');
});
test('rejects invalid standards and oversized source',async()=>{
 await assert.rejects(runProgram({id:randomUUID(),code:'',standard:'invalid'}),/Invalid/);
 await assert.rejects(runProgram({id:randomUUID(),code:' '.repeat(100001)}),/Invalid/);
});
