import test from 'node:test';
import assert from 'node:assert/strict';
import { format } from '@wasm-fmt/clang-format/node';
import { C_FORMAT_STYLE } from '../lib/format-style.mjs';
import { requestedFilename } from '../lib/security.mjs';

test('file names support C source, headers and an automatic .c suffix',()=>{
 assert.equal(requestedFilename('  hello  '),'hello.c');assert.equal(requestedFilename('utils.h'),'utils.h');assert.equal(requestedFilename('Student_01-test.c'),'Student_01-test.c');
});
test('file names reject traversal, duplicate names, invalid extensions and empty input',()=>{
 for(const name of ['','../secret.c','a/b.c','a\\b.c','.hidden.c','evil.js','bad name.c'])assert.throws(()=>requestedFilename(name));
 assert.throws(()=>requestedFilename('HELLO.c',['hello.c']),/มีไฟล์ชื่อนี้แล้ว/);
 assert.throws(()=>requestedFilename('x'.repeat(101)+'.c'));
});
test('clang-format applies a four-space C style and is idempotent',()=>{
 const source='#include <stdio.h>\nint main(void){int a=1;if(a){printf("%d\\n",a);}return 0;}';
 const result=format(source,'hello.c',C_FORMAT_STYLE);
 assert.match(result,/\n    int a = 1;/);assert.match(result,/\n        printf/);assert.equal(format(result,'hello.c',C_FORMAT_STYLE),result);
});
test('clang-format preserves string literals, comments, macros and include order',()=>{
 const source='#include "z.h"\n#include "a.h"\n#define SQUARE(x) ((x)*(x))\nint f(void){/* keep me */const char*s="{;} // not a comment";return SQUARE(2);}';
 const result=format(source,'test.c',C_FORMAT_STYLE);
 assert.ok(result.indexOf('"z.h"')<result.indexOf('"a.h"'));assert.ok(result.includes('"{;} // not a comment"'));assert.ok(result.includes('/* keep me */'));assert.ok(result.includes('#define SQUARE'));
});
test('formatting an empty document keeps it empty',()=>{
 assert.equal(format('','empty.c',C_FORMAT_STYLE),'');
});

test('imported duplicate names remain valid, bounded and case-insensitively unique',async()=>{
 const {uniqueFilename,safeFilename}=await import('../lib/security.mjs');
 assert.equal(uniqueFilename('HELLO.c',['hello.c']),'HELLO2.c');
 const original='x'.repeat(100)+'.c';const next=uniqueFilename(original,[original]);assert.notEqual(next,original);assert.equal(safeFilename(next),next);assert.ok(next.length<=102);
});
