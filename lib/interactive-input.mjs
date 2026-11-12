import { MAX_SOURCE_BYTES } from './security.mjs';

// A synchronous WASI read can sleep inside its disposable worker while the
// main thread writes a line and wakes it. No C program runs on the UI thread.
export function createInputBuffer() {
  return new SharedArrayBuffer(8 + MAX_SOURCE_BYTES);
}
export function sendInput(buffer, value) {
  const bytes=new TextEncoder().encode(value), control=new Int32Array(buffer,0,2);
  if(bytes.length>buffer.byteLength-8)throw new Error('Input ต้องไม่เกิน 100 KB');
  if(Atomics.load(control,0)!==0)throw new Error('โปรแกรมยังไม่พร้อมรับค่า');
  new Uint8Array(buffer,8).set(bytes);
  Atomics.store(control,1,bytes.length);
  Atomics.store(control,0,1);
  Atomics.notify(control,0);
}
export function closeInput(buffer) {
  const control=new Int32Array(buffer,0,2);
  Atomics.store(control,0,2);Atomics.notify(control,0);
}
export function blockingInput(buffer, onWaiting) {
  const control=new Int32Array(buffer,0,2);let pending='';
  return max=>{
    if(max<=0)return '';
    while(!pending){
      if(Atomics.load(control,0)===2)return null;
      onWaiting();
      while(Atomics.load(control,0)===0)Atomics.wait(control,0,0);
      if(Atomics.load(control,0)===2)return null;
      const length=Atomics.load(control,1);
      if(length<0||length>buffer.byteLength-8)throw new Error('Invalid input length');
      // Browsers reject SharedArrayBuffer views in TextDecoder; take an owned
      // snapshot before decoding and before allowing the next line to arrive.
      pending=new TextDecoder().decode(new Uint8Array(buffer,8,length).slice());
      Atomics.store(control,0,0);
    }
    let out='',used=0;
    for(const char of pending){const length=new TextEncoder().encode(char).length;if(used+length>max)break;out+=char;used+=length;}
    if(!out)throw new Error('Input read buffer is too small for a UTF-8 character');
    pending=pending.slice(out.length);return out;
  };
}
