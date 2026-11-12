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

- New file ให้ตั้งชื่อก่อนเปิดแท็บว่างใหม่ (ไม่ใส่นามสกุลจะเติม .c) เปลี่ยนชื่อได้ด้วยปุ่มดินสอข้างชื่อไฟล์ ดับเบิลคลิกแท็บ หรือ F2 รองรับเฉพาะ .c และป้องกันชื่อซ้ำแบบไม่แยกตัวพิมพ์เล็ก/ใหญ่ ไฟล์เก่าไม่ถูกแทนที่
- แท็บไฟล์ใหม่ยังว่างเหมือนเดิม ไฟล์เก่ายังคงอยู่ สลับผ่านแท็บหรือ Sidebar และกด × เพื่อปิดแต่ละไฟล์
- เปิดไฟล์ `.c` จากเครื่องได้ ไฟล์ชื่อซ้ำจะเปลี่ยนชื่อให้อัตโนมัติ
- ไม่รองรับการสร้างหรือเปิดแท็บ `.h` แต่ยังใช้ไลบรารีมาตรฐาน เช่น `#include <stdio.h>` ในโปรแกรม `.c` ได้ตามปกติ
- แต่ละแท็บเป็นโปรแกรมอิสระ: Run จะ Compile เฉพาะไฟล์ที่เลือก ไม่ได้ link ทุกไฟล์ `.c` รวมกัน
- Format ใช้ Clang-Format ใน WebAssembly ของเบราว์เซอร์ (Shift+Alt+F) ย่อหน้า 4 ช่อง มีปุ่ม Undo format และไม่เรียง #include ใหม่ หากโค้ดถูกแก้ระหว่างรอ Format จะไม่เขียนทับโค้ดใหม่ Formatter โหลดประมาณ 2.5 MB เฉพาะครั้งแรกที่ใช้และ cache ไว้ ไม่ต้องรอโหลด C compiler 50 MB เพื่อจัดรูปแบบ
- Run / Ctrl+Enter จาก Editor จะ Compile ตรวจข้อผิดพลาดก่อน: โปรแกรมที่รับค่าจาก stdin เช่น `scanf`, `getchar`, `fgets(..., stdin)` จะเปิดแท็บ Input พร้อมสถานะ “Compile ผ่านแล้ว · รอ Input” โดยยังไม่แสดงผล แม้จะมีค่า Input เดิมอยู่ ส่วนโปรแกรมที่ไม่รับ Input จะรันตามปกติ
- กรอกค่าครบในแท็บ Input แล้วกด Enter เพื่อแสดงผล (Shift+Enter สำหรับขึ้นบรรทัดใหม่) ระบบใช้โปรแกรมที่ Compile ผ่านแล้วโดยไม่ Compile ซ้ำ ถ้าแก้โค้ด ชื่อไฟล์ ไฟล์อื่นในโปรเจกต์ หรือมาตรฐาน C จะตรวจ Compile ใหม่ก่อนรัน กด Enter โดยไม่มีค่า Input จะได้รับ EOF
- Output แสดงเมื่อโปรแกรมจบ Problems แสดงคำเตือน ข้อผิดพลาด และเหตุผลที่หยุด
- Stop ยกเลิกการรันที่กำลังรอได้ทันที และทำลาย worker ของโปรแกรมเมื่อ Compile/Run อยู่ หากเป็นการโหลด compiler ครั้งแรก การเตรียม compiler ที่ไม่มีโค้ดผู้ใช้จะทำงานต่อเพื่อเก็บไว้ใช้รอบถัดไป
- ลากเส้นเหนือ Console เพื่อแบ่งพื้นที่ ดับเบิลคลิกเพื่อคืนขนาดเดิม หรือใช้ปุ่มขยายพื้นที่เขียนโค้ด (Esc เพื่อออก)
- ปุ่ม Light / Dark มุมขวาบนสลับโหมดสว่างและมืด ครั้งแรกใช้โหมดของอุปกรณ์ แล้วจำโหมดที่ผู้ใช้เลือกไว้ในเบราว์เซอร์
- Source code และ Ctrl+S ดาวน์โหลดไฟล์ปัจจุบันเป็น `.c` Project ZIP รวมทุกแท็บพร้อมไฟล์ Input และ README

ไฟล์และ Input อยู่ใน React memory เท่านั้น รีเฟรชหรือปิดหน้าเว็บแล้วหาย ไม่มีการบันทึก source ลง localStorage มีเฉพาะขนาด/สถานะ Console และโหมดสีที่ถูกจำไว้

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

Clang-Format ใช้แพ็กเกจ @wasm-fmt/clang-format 23.1.1 (wrapper: MIT; LLVM: Apache 2.0 with LLVM exceptions) พร้อมใบอนุญาตใน public/toolchain/licenses/CLANG-FORMAT-*.txt
