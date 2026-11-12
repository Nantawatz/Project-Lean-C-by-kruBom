let worker:Worker|null=null;
let pending=false;
export function formatC(code:string,filename:string):Promise<string>{
  if(pending)return Promise.reject(new Error('กำลังจัดรูปแบบโค้ด กรุณารอสักครู่'));
  pending=true;
  return new Promise((resolve,reject)=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      if(!worker)worker=new Worker(new URL('./format.worker.ts',import.meta.url));
      const current=worker;
      const fail=(message:string)=>{clearTimeout(timer);pending=false;current.terminate();if(worker===current)worker=null;reject(new Error(message));};
      timer=setTimeout(()=>fail('จัดรูปแบบไม่สำเร็จในเวลาที่กำหนด กรุณาลองใหม่'),30000);
      current.onerror=()=>fail('โหลดตัวจัดรูปแบบไม่สำเร็จ กรุณาลองใหม่');
      current.onmessageerror=()=>fail('อ่านผลการจัดรูปแบบไม่สำเร็จ');
      current.onmessage=event=>{clearTimeout(timer);pending=false;if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.code);};
      current.postMessage({code,filename});
    }catch(error){clearTimeout(timer);pending=false;worker?.terminate();worker=null;reject(error);}
  });
}
