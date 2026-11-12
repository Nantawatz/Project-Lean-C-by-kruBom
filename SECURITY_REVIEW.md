# Security review — C Studio

วันที่ตรวจ: 12 พฤศจิกายน 2026

ขอบเขต: source ของแอป, execution boundary, dependency audit, integrity ของ compiler assets, HTTP security headers และทดสอบ Production build ภายในเครื่อง เป็นการตรวจ code และทดสอบตามกรณี ไม่ใช่การรับรองว่าไม่มีช่องโหว่ทุกชนิด

## ประเด็นที่พบและแก้

| ประเด็น | ผลกระทบของโครงสร้างเดิม | การแก้ |
| --- | --- | --- |
| Native code execution บนเซิร์ฟเวอร์ | โค้ด C มีสิทธิ์เท่ากับโปรเซส server; hostname check ไม่ใช่ sandbox | ลบ native runner และ dependency ของ Zig; ปิด `/api/run` ด้วย HTTP 410; ทุก run ใช้ browser WASM worker |
| Online execution ใช้งานไม่ได้ | Vercel ไม่มี compiler ที่จัดเตรียมไว้และ endpoint จำกัด localhost | self-host Clang/WASI assets ใน public และ Compile/Run ใน browser |
| Resource exhaustion | ลูปค้างและ Output / virtual writes อาจกินทรัพยากร | worker ถูก terminate เมื่อ Stop / timeout / จบ; จำกัด memory ด้วย linker 64 MiB, Output, virtual writes, source, Input และจำนวนไฟล์ |
| Compiler supply chain | runtime download ที่เปลี่ยนได้อาจไม่ตรงกับรุ่นที่ทดสอบ | commit toolchain พร้อม SHA-256 และตรวจใน trusted preparation worker ก่อนเก็บใช้ซ้ำ; pin Runno และ fflate |
| Dependency advisory | fflate 0.8.2 ที่ทดลองนำเข้ามี advisory | ใช้ 0.8.3; PostCSS override 8.5.32; audit ไม่พบรายการช่องโหว่ใน dependency production ณ วันที่ตรวจ |
| Browser hardening | ไม่ได้ระบุ policy สำหรับ frame, object หรือ external connections | CSP, frame-ancestors none, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy |
| File/path validation | ชื่อไฟล์และโปรเจกต์อาจไม่ตรงขอบเขตที่กำหนด | จำกัดชื่อไฟล์ .c, ปฏิเสธ traversal/duplicate paths, จำกัดขนาดเป็น UTF-8 bytes |

## Threat boundary

ผู้เยี่ยมชมอาจเขียน C ที่เป็นอันตรายได้ แต่ C ทำงานเป็น WASI WebAssembly ภายใน dedicated worker ไม่ใช่ JavaScript eval หรือ native process ไม่ได้รับ host filesystem, environment, network หรือ shell imports runtime ใช้ virtual filesystem ใหม่เมื่อ Run ไม่แชร์กับ sysroot ของ compiler

Worker ของโปรแกรมถูกทำลายหลังจบหรือเมื่อผู้ใช้ Stop และหน้าหลักยังใช้งานได้ระหว่างรัน มี trusted preparation worker แยกสำหรับโหลดและเตรียม compiler เท่านั้น หาก Stop ขณะรอ compiler การเตรียมชุดนี้ยังทำต่อได้ แต่ไม่มี source หรือ Input ผู้ใช้ถูกส่งเข้า worker เตรียม compiler ทรัพยากร compiler เป็น asset ที่เชื่อถือได้และมี integrity check ส่วนโค้ด C ของผู้ใช้ไม่ถูกส่งไป server เพื่อ Compile

UI ใช้ React text rendering สำหรับ source, output และ errors ไม่มี dangerouslySetInnerHTML หรือการนำโค้ดผู้ใช้ไป eval เป็น JavaScript

## ผลการตรวจ

- npm test: 40 tests ครอบคลุมการ Compile C จริง, standards, stdin/stdout, EOF, syntax errors, worker timeout, output cap, stderr/exit status, WASM export, virtual filesystem/environment boundary, การแยกโปรแกรมแต่ละแท็บ และ integrity assets รวมถึงการใช้ prepared compiler ซ้ำโดยไม่เก็บไฟล์ผู้ใช้ การป้องกัน cache เสีย fallback เมื่อ storage ใช้ไม่ได้ และการปฏิเสธ asset ที่ hash ไม่ตรง
- Production build และ TypeScript ผ่าน
- Browser QA ของ Production: Run แสดงผลจริง, Stop ทำลาย worker และ compiled WASM ดาวน์โหลดได้
- ตรวจ response headers และยืนยัน native endpoint ปิดใช้งาน
- `npm audit --omit=dev`: 0 reported vulnerabilities ณ เวลาตรวจ
- เพิ่ม CI ให้ตรวจ test/build/audit ทุก push และ pull request

## ข้อจำกัดที่ยังคงอยู่

1. ความปลอดภัยของ sandbox ยังพึ่งพา browser WebAssembly implementation และ Runno WASI จึงต้องอัปเดต dependencies/เบราว์เซอร์อย่างสม่ำเสมอ
2. ขีดจำกัด 64 MiB ใช้กับ linear memory ของโปรแกรม C ไม่ได้ครอบคลุม compiler, เบราว์เซอร์ หรือ overhead ของ virtual filesystem ทั้งหมด โค้ดบางชนิดยังทำให้แท็บใช้ CPU/memory สูงได้ก่อน timeout จึงไม่ถือเป็น hard OS-level resource accounting
3. CSP อนุญาต unsafe-inline สำหรับ Next.js bootstrap และ inline styling รวมทั้ง wasm-unsafe-eval สำหรับ WebAssembly ใน Production; JavaScript unsafe-eval เปิดเฉพาะ dev
4. HTTP headers หรือ dependency audit ไม่ใช่หลักประกันว่าปลอดภัยทุกกรณี Google Fonts ยังเป็น external font request แต่ source และ Input ไม่ได้ถูกส่งไปที่นั่น
5. Export โปรแกรมเป็น WASI `.wasm` ไม่ใช่ native `.exe`; ไม่รองรับ OS APIs/ไลบรารีนอก sysroot หรือ multi-file linking
6. Hosting bandwidth สำหรับ toolchain ยังขึ้นกับโควตาของ Vercel; โหลดครั้งแรกประมาณ 50 MB ก่อน compression ไม่มีคำรับรองว่าการ hosting จะฟรีเสมอ

## การดูแลหลังส่งมอบ

ตรวจ npm audit และ CI เป็นระยะ ก่อนอัปเดต compiler ให้ตรวจ upstream licenses/provenance, เปลี่ยน manifest SHA-256, ทดสอบทั้งชุดและ browser QA ใหม่ หากต้องการรับรายงานช่องโหว่ให้ใช้ private GitHub security advisory แทนการโพสต์ exploit พร้อมข้อมูลผู้ใช้ใน public issue

## Compiler cache

เก็บเฉพาะ asset compiler ที่ตรวจ hash แล้วใน Cache Storage ตาม key ที่มี SHA-256 ของ manifest และเก็บ WebAssembly.Module กับ sysroot ต้นฉบับใน memory ระหว่างเปิดหน้า แต่ละ job รับ structured clone ของ template และสร้าง WASI instance ใหม่ ไม่ใช้ WASI memory, user virtual files, source หรือ Input ร่วมกัน การปิดหน้าเว็บล้าง compiler modules ใน memory ส่วน Cache Storage อาจอยู่ต่อจนเบราว์เซอร์ลบ ไม่ถือเป็นที่เก็บ source code

## Named files and formatting

ชื่อไฟล์ใหม่/เปลี่ยนชื่อผ่าน validation เดิม (.c, ไม่มี traversal, ปฏิเสธชื่อซ้ำไม่แยกตัวพิมพ์เล็กใหญ่) การเปิดไฟล์ชื่อซ้ำจะสร้างชื่อที่ไม่ชนกัน Format ทำงานใน worker แยกด้วย Clang-Format WASM ที่ pin เวอร์ชันและ SHA-256 โหลดจาก origin เดียว ไม่ส่ง source ไปบริการภายนอก จำกัด source/output 100 KB และ timeout 30 วินาที มี snapshot guard ป้องกันผล Format เขียนทับโค้ดที่ผู้ใช้แก้ระหว่างรอ และมี Undo เฉพาะผล Format ล่าสุดที่ยังไม่ได้แก้ไขต่อ Formatter เก็บไว้ใช้ซ้ำใน memory ของหน้าปัจจุบัน และ source ไม่ถูกเก็บใน persistent cache

## ตรวจความเสถียรก่อน Push รอบล่าสุด

- แก้การตรวจ stdin ที่เคยอ่านโค้ดจากแท็บอื่น ทำให้บางโปรแกรมรอ Input โดยไม่จำเป็น และเพิ่ม regression test ยืนยันการแยกแท็บ
- ตรวจ Run แบบรอ Input, Enter ส่งค่าจากโปรแกรมที่ Compile แล้ว, syntax errors, โค้ดที่ไม่รับ Input และการเปลี่ยน source เพื่อยกเลิกผล Compile เก่า
- ตรวจ Production ในเครื่อง: Format, สร้างแท็บว่างโดยรักษาไฟล์เดิม, สลับ Light/Dark, Stop, timeout และรันงานต่อหลังหยุด
- ดาวน์โหลด Source และตรวจว่าเนื้อหาตรงกับ Editor, ตรวจไฟล์และ Input ภายใน Project ZIP และตรวจ WebAssembly.validate ของโปรแกรมที่ Export
- npm test ผ่าน 33 รายการ, Production build ผ่าน, npm audit --omit=dev ไม่พบรายงานช่องโหว่ และ /api/run ตอบ 410

## Interactive stdin

หน้าเว็บใช้ WASI worker เดิมตลอดหนึ่งโปรแกรม แต่ละ Enter ส่งบรรทัด UTF-8 ผ่าน SharedArrayBuffer ขนาดคงที่ 100 KB แล้ว Atomics.notify ให้ worker ทำงานต่อ ไม่รัน C บน main thread และไม่เริ่มโปรแกรมใหม่เพื่อจำลองการรับค่า โปรแกรม C ไม่ได้รับ import ของ JavaScript หรือ shared buffer โดยตรง

จำกัด Input สะสม 100 KB เช่นเดิม แยก shared buffer ต่อ job, หยุด worker เมื่อ Stop / เปลี่ยน source / สลับแท็บ / timeout และคืน EOF เมื่อผู้ใช้จบการป้อนค่า เวลารอ Input ไม่กินงบประมวลผล 5 วินาที และไม่รวมในเวลาที่ UI รายงาน เพิ่ม COOP same-origin และ COEP require-corp เพื่อเปิด crossOriginIsolated ภายใต้ HTTPS หรือ localhost

ตั้ง stdout เป็น unbuffered ด้วย constructor ภายใน source ที่ Compile เท่านั้น เพื่อให้ prompt แสดงก่อน scanf โดยไม่เปลี่ยน source ที่บันทึก/Export ใช้ #line รักษาตำแหน่ง error ของผู้ใช้ ทดสอบแยกสอง scanf, Unicode/บรรทัดว่าง, EOF loop, โปรแกรมไม่รับ Input, error line numbers และขนาด/สถานะ shared input

ตรวจซ้ำก่อนส่ง Interactive stdin: npm test ผ่าน 40 รายการ, Production build ผ่าน, npm audit --omit=dev ไม่พบรายงานช่องโหว่ ตรวจการคลิกแท็บเดิมระหว่างรอค่าแล้ว Console ต้องไม่ถูกล้าง และป้องกันข้อความ worker ที่มาถึงหลัง Stop เปลี่ยนสถานะกลับมารอค่า ทดสอบ Production รับสองค่าได้ Sum = 20, Stop ระหว่างรอ, เปลี่ยน source ระหว่างรอ และสร้าง/รันแท็บใหม่หลังหยุดโปรแกรมเดิม ไม่พบ warn/error ใน Console ระหว่างกรณีทดสอบ
