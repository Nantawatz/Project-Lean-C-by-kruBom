import { WASI } from '@runno/wasi';
import { gunzipSync } from 'fflate';
import { MAX_OUTPUT, validateProgram } from './security.mjs';

const timestamps = () => ({ access:new Date(), modification:new Date(), change:new Date() });
const virtualFile = (path, content) => ({path, content, mode:typeof content === 'string'?'string':'binary', timestamps:timestamps()});
export function extractSysroot(compressed) {
  const data = gunzipSync(compressed);
  if (data.byteLength > 40000000) throw new Error('Compiler filesystem is too large');
  const text = (offset,length) => new TextDecoder().decode(data.subarray(offset,offset+length)).split('\0')[0];
  const fs = Object.create(null);
  for(let offset=0;offset+512<=data.length;) {
    const name=text(offset,100), prefix=text(offset+345,155);
    if(!name)break;
    const size=parseInt(text(offset+124,12).trim()||'0',8);
    if(!Number.isFinite(size)||size<0||offset+512+size>data.length)throw new Error('Invalid compiler archive');
    const path='/'+(prefix?prefix+'/':'')+name.replace(/^\.\//,'');
    if(path.split('/').includes('..'))throw new Error('Unsafe compiler path');
    const type=data[offset+156];
    if(type===0||type===48)fs[path]=virtualFile(path,data.slice(offset+512,offset+512+size));
    offset+=512+Math.ceil(size/512)*512;
  }
  if(!fs['/sys/include/stdio.h'])throw new Error('Compiler headers not found');
  return fs;
}

// Only these WASI imports are supplied. There is no host filesystem, shell,
// network, process environment or JavaScript import available to compiled C.
async function execute(bytes, fs, args, input='', limited=false) {
  let stdout='',stderr='',offset=0,written=0,outputBytes=0;
  const collect=(kind,value)=>{
    outputBytes+=new TextEncoder().encode(value).length;
    if(outputBytes>MAX_OUTPUT)throw new Error('Output limit exceeded (100 KB)');
    if(kind==='out')stdout+=value;else stderr+=value;
  };
  const wasi=new WASI({fs,args,env:{},stdout:v=>collect('out',v),stderr:v=>collect('err',v),stdin:max=>{
    if(offset>=input.length)return null;
    // Return complete UTF-8 characters within the requested byte budget.
    let out='';let used=0;
    for(const char of input.slice(offset)){const n=new TextEncoder().encode(char).length;if(used+n>max)break;out+=char;used+=n;}
    offset+=out.length;return out||null;
  }});
  const imports=wasi.getImportObject();
  if(limited)for(const namespace of Object.values(imports)){
    const write=namespace.fd_write;
    namespace.fd_write=(fd,ptr,count,result)=>{
      if(fd>=3){const position=wasi.drive.tell(fd);if(position[0]===0&&position[1]>1000000n)return 22;}
      const view=new DataView(wasi.memory.buffer);
      if(count>65536)throw new Error('Invalid write request');
      for(let i=0;i<count;i++)written+=view.getUint32(ptr+i*8+4,true);
      if(written>8000000)throw new Error('Virtual file write limit exceeded (8 MB)');
      return write(fd,ptr,count,result);
    };
    const resize=namespace.fd_filestat_set_size;
    namespace.fd_filestat_set_size=(fd,size)=>size>1000000n?22:resize(fd,size);
    const seek=namespace.fd_seek;
    namespace.fd_seek=(fd,delta,whence,result)=>delta>1000000n||delta< -1000000n?22:seek(fd,delta,whence,result);
    const pwrite=namespace.fd_pwrite;
    namespace.fd_pwrite=(fd,ptr,count,position,result)=>{
      if(position>1000000n||count>65536)return 22;
      const view=new DataView(wasi.memory.buffer);
      for(let i=0;i<count;i++)written+=view.getUint32(ptr+i*8+4,true);
      if(written>8000000)throw new Error('Virtual file write limit exceeded (8 MB)');
      return pwrite(fd,ptr,count,position,result);
    };
    const open=namespace.path_open;
    namespace.path_open=(...args)=>Object.keys(wasi.drive.fs).length>=32||wasi.drive.openMap.size>=64?22:open(...args);
  }
  const module=bytes instanceof WebAssembly.Module?bytes:await WebAssembly.compile(bytes);
  const instance=await WebAssembly.instantiate(module,imports);
  const result=wasi.start({instance,module});
  return {...result,stdout,stderr};
}

export async function prepareToolchain(loadAsset) {
  const [compiler,linker,archive]=await Promise.all(['clang.wasm','wasm-ld.wasm','clang-fs.tar.gz'].map(loadAsset));
  const [compilerModule,linkerModule]=await Promise.all([WebAssembly.compile(compiler),WebAssembly.compile(linker)]);
  return {compiler:compilerModule,linker:linkerModule,sysroot:extractSysroot(archive)};
}

/** @param {(stage: string) => void} onStage */
export async function compileAndRun(payload, loadAsset, onStage=(_stage)=>{}, prepared=null) {
  validateProgram(payload);
  const started=Date.now();
  let phase='compile';
  try{
    if(!prepared)onStage('loading');
    const {compiler,linker,sysroot}=prepared||await prepareToolchain(loadAsset);
    // Keep the cached toolchain free from program files and compiler writes.
    let fs=structuredClone(sysroot);
    for(const f of payload.files)fs['/'+f.name]=virtualFile('/'+f.name,f.code);
    fs['/'+payload.filename]=virtualFile('/'+payload.filename,payload.code);
    onStage('compile');
    const compiled=await execute(compiler,fs,['clang','-cc1','-triple','wasm32-unknown-wasi','-isysroot','/sys','-internal-isystem','/sys/include','-internal-isystem','/sys/lib/clang/8.0.1/include',`-std=${payload.standard}`,'-I/','-Wall','-Wextra','-ferror-limit','8','-O0','-emit-obj','-o','/program.o','-x','c','/'+payload.filename]);
    if(compiled.exitCode!==0)return {stage:'compile',code:compiled.exitCode,stdout:compiled.stdout,stderr:compiled.stderr,duration:Date.now()-started};
    fs=compiled.fs;
    const linked=await execute(linker,fs,['wasm-ld','--no-threads','--export-dynamic','--max-memory=67108864','-z','stack-size=1048576','-L/sys/lib/wasm32-wasi','/sys/lib/wasm32-wasi/crt1.o','/program.o','-lc','-lm','-o','/program.wasm']);
    if(linked.exitCode!==0)return {stage:'compile',code:linked.exitCode,stdout:linked.stdout,stderr:linked.stderr,duration:Date.now()-started};
    const binary=linked.fs['/program.wasm'];
    if(!binary||binary.mode!=='binary')throw new Error('No compiled WebAssembly was produced');
    if(payload.binary)return {binary:binary.content,name:payload.filename.replace(/\.[^.]+$/,'.wasm')};
    phase='run';onStage('run');
    const result=await execute(binary.content,{},['program'],payload.input,true);
    return {stage:'run',code:result.exitCode,stdout:result.stdout,stderr:result.stderr||(result.exitCode===134?'WebAssembly trapped: invalid memory access, stack overflow or memory limit exceeded.':''),warnings:compiled.stderr,duration:Date.now()-started};
  }catch(e){return {stage:phase,code:1,error:e instanceof Error?e.message:'Compiler failed',duration:Date.now()-started};}
}
