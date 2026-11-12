# C Studio

ระบบเขียน Compile รัน และ Export ภาษา C ด้วย Next.js / React / TypeScript

## เริ่มใช้งาน

```powershell
npm ci
npm run dev
```

เปิด URL ที่ Terminal แสดง (ปกติ http://127.0.0.1:3000)
ไม่ต้องติดตั้ง GCC, Zig, Docker หรือ API key โค้ด Compile และรันใน WebAssembly worker ของเบราว์เซอร์ ทั้งบน localhost และ Vercel

Development ใช้ `.next-dev/` ส่วน Production ใช้ `.next/` เพื่อไม่ให้ cache ชนกัน เมื่อติดตั้ง dependency ใหม่ให้หยุด server เดิมด้วย Ctrl+C แล้วเริ่มใหม่

## การใช้งาน

- New file เปิดแท็บว่างใหม่ ไฟล์เก่ายังคงอยู่ สลับผ่านแท็บหรือ Sidebar และกด × เพื่อปิดแต่ละไฟล์
- เปิดไฟล์ `.c` / `.h` จากเครื่องได้ ไฟล์ชื่อซ้ำจะเปลี่ยนชื่อให้อัตโนมัติ
- แต่ละแท็บเป็นโปรแกรมอิสระ: Run จะ Compile เฉพาะไฟล์ที่เลือก สามารถ `#include "values.h"` จากแท็บ header ได้ แต่ไม่ได้ link ทุกไฟล์ `.c` รวมกัน
- กรอกค่าที่ `scanf` ต้องใช้ในแท็บ Input ก่อนกด Run หรือ Ctrl+Enter หากไม่มี Input จะได้รับ EOF
- Output แสดงเมื่อโปรแกรมจบ Problems แสดงคำเตือน ข้อผิดพลาด และเหตุผลที่หยุด
- Stop ยกเลิกการรันที่กำลังรอได้ทันที และทำลาย worker ของโปรแกรมเมื่อ Compile/Run อยู่ หากเป็นการโหลด compiler ครั้งแรก การเตรียม compiler ที่ไม่มีโค้ดผู้ใช้จะทำงานต่อเพื่อเก็บไว้ใช้รอบถัดไป
- ลากเส้นเหนือ Console เพื่อแบ่งพื้นที่ ดับเบิลคลิกเพื่อคืนขนาดเดิม หรือใช้ปุ่มขยายพื้นที่เขียนโค้ด (Esc เพื่อออก)
- Source code และ Ctrl+S ดาวน์โหลดไฟล์ปัจจุบันเป็น `.c` หรือ `.h` Project ZIP รวมทุกแท็บพร้อมไฟล์ Input และ README
- Compiled program ดาวน์โหลด `.wasm` ที่รันด้วย WASI preview1 runtime ได้ ไม่ใช่ Windows `.exe` หากต้องการ `.exe` ให้ Export source แล้วใช้ GCC/Clang บน Windows

ไฟล์และ Input อยู่ใน React memory เท่านั้น รีเฟรชหรือปิดหน้าเว็บแล้วหาย ไม่มีการบันทึก source ลง localStorage มีเฉพาะขนาด/สถานะ Console ที่ถูกจำไว้

## Deploy บน Vercel

เชื่อม repository แล้วเลือก Next.js ใช้ `npm run build` เป็น Build Command และใช้ค่า Output Directory ตาม Next.js ไม่ต้องตั้ง Environment Variables ไม่ต้องตั้ง `NEXT_DIST_DIR` บน Vercel

Compiler และ sysroot ถูกเก็บใน `public/toolchain/` รวมประมาณ 50 MB (ก่อน HTTP compression) และโหลดเมื่อ Run ครั้งแรก จากนั้นเก็บไฟล์ที่ตรวจ SHA-256 แล้วใน Cache Storage (หากเบราว์เซอร์อนุญาต) พร้อมเก็บโมดูล WebAssembly ที่เตรียมแล้วและ sysroot ต้นฉบับไว้ในหน่วยความจำระหว่างเปิดหน้าเว็บ รอบถัดไปใช้ชุดเดิมโดยไม่โหลดหรือเตรียมใหม่ ไฟล์เสมือนของโปรแกรมยังถูกสร้างแยกใหม่ทุกครั้ง ผู้ใช้ต้องมีอินเทอร์เน็ตและเบราว์เซอร์ที่รองรับ WebAssembly, Web Workers และ Web Crypto เช่น Chrome/Edge/Firefox รุ่นปัจจุบัน Toolchain มี SHA-256 ที่ฝังใน bundle และตรวจตอนเตรียมชุด compiler รวมถึงตอนอ่านจาก persistent cache หาก cache เสียจะโหลดชุดที่ตรวจสอบแล้วใหม่ หากไม่มีสิทธิ์ใช้ cache หรือพื้นที่เต็ม ยังใช้ cache ในหน่วยความจำได้จนกว่าจะปิด/รีเฟรชหน้า

ไม่ต้องส่งโค้ดผู้ใช้ไปยัง API Compile ภายนอก และไม่มี native server execution อีกต่อไป `/api/run` เดิมตอบ 410 ให้ไคลเอนต์เก่ารีเฟรชหน้าใหม่

## ขอบเขตและข้อจำกัด

- รองรับ C99 / C11 / C17, stdin/stdout และ standard library ที่ sysroot รองรับ เหมาะกับการเรียนและตัวอย่าง console
- ไม่ใช่ Linux/Windows เต็มระบบ: ไม่มี shell, sockets, Windows API, การติดตั้ง package หรือการอ่านไฟล์จริง โปรแกรมเห็นเฉพาะไฟล์เสมือน
- Compile timeout 60 วินาทีหลังโหลด toolchain, โหลดสูงสุด 120 วินาที, Run สูงสุด 5 วินาที
- Memory ของโปรแกรม C สูงสุด 64 MiB, Output ประมาณ 100 KB, source ต่อไฟล์และ Input ไม่เกิน 100 KB, รวม source 1 MB, เปิดสูงสุด 30 ไฟล์
- Compile ใช้หน่วยความจำมากกว่าโปรแกรมที่รัน โทรศัพท์หรืออุปกรณ์หน่วยความจำน้อยอาจไม่เหมาะกับโค้ดขนาดใหญ่
- ไม่มีบัญชีผู้ใช้หรือ cloud save ผู้ใช้ต้อง Export เพื่อเก็บงาน

## ตรวจสอบก่อนส่งมอบ

```powershell
npm ci
npm test
npm run build
npm audit --omit=dev
```

CI ทำคำสั่งเหล่านี้ทุก push / pull request ผลตรวจและขอบเขต security review อยู่ใน [SECURITY_REVIEW.md](SECURITY_REVIEW.md)

## Third-party notices

Runno WASI เป็น MIT ส่วน compiler / linker / sysroot ใช้ LLVM, LLD, wasm-clang และ musl ใบอนุญาตอยู่ใน `public/toolchain/licenses/` พร้อม provenance และ SHA-256 ใน `public/toolchain/manifest.json` ดู [Runno](https://github.com/taybenlor/runno) และ [wasm-clang](https://github.com/binji/wasm-clang)
