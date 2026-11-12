// Inspect the linked program rather than treating words in comments/strings
// as input operations. The WASI stdin callback is the runtime fallback.
function functionNames(module) {
  const names=new Set();
  for(const section of WebAssembly.Module.customSections(module,'name')){
    const bytes=new Uint8Array(section);let offset=0;
    const number=()=>{let value=0,shift=0;for(let i=0;i<5;i++){if(offset>=bytes.length)throw new Error('Invalid name section');const byte=bytes[offset++];value+=(byte&127)*2**shift;if(!(byte&128))return value;shift+=7;}throw new Error('Invalid integer');};
    try{while(offset<bytes.length){const kind=bytes[offset++],size=number(),end=offset+size;if(end>bytes.length)break;
      if(kind===1){const count=number();for(let i=0;i<count;i++){number();const length=number();if(offset+length>end)throw new Error('Invalid function name');names.add(new TextDecoder().decode(bytes.subarray(offset,offset+length)));offset+=length;}}
      offset=end;
    }}catch{/* A stripped/unknown name section is handled by the stdin hook. */}
  }
  return names;
}
function identifiers(source){
  // Keep only C identifiers, ignoring quoted strings, character literals and
  // comments so printf("scanf stdin") does not trigger input mode.
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,' ').match(/[A-Za-z_]\w*/g)||[];
}
export function expectsStandardInput(module,payload){
  const imports=WebAssembly.Module.imports(module);
  if(!imports.some(item=>/^wasi_/.test(item.module)&&item.name==='fd_read'))return false;
  const names=functionNames(module);
  if(['scanf','vscanf','getchar','getchar_unlocked','gets','getwchar','getwchar_unlocked','wscanf','vwscanf'].some(name=>names.has(name)))return true;
  // Other tabs are independent programs. Inspect only the selected source;
  // stdin inside an included helper is still caught by the runtime hook.
  if(identifiers(payload.code).includes('stdin'))return true;
  // Without a file-opening import, fd_read is normally the standard input
  // path, including read(0, ...) and input helpers using a function pointer.
  return !imports.some(item=>item.name==='path_open');
}
export function compilationKey(payload){
  return JSON.stringify({code:payload.code,filename:payload.filename,standard:payload.standard,files:payload.files.map(file=>({name:file.name,code:file.code}))});
}
