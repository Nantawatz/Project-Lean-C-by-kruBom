export const MAX_SOURCE_BYTES = 100000;
export const MAX_PROJECT_BYTES = 1000000;
export const MAX_FILES = 30;
export const MAX_OUTPUT = 100000;
const encoder = new TextEncoder();
export function safeFilename(value) {
  const name = String(value).replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,99}\.c$/i.test(name)) return 'source.c';
  return name;
}
export function requestedFilename(value, existingNames=[]) {
  let name=value.trim();
  if(!name)throw new Error('กรุณาระบุชื่อไฟล์');
  if(!name.includes('.'))name+='.c';
  if(safeFilename(name)!==name)throw new Error('ใช้ชื่อภาษาอังกฤษ ตัวเลข _ - และนามสกุล .c เท่านั้น');
  if(existingNames.some(existing=>existing.toLowerCase()===name.toLowerCase()))throw new Error('มีไฟล์ชื่อนี้แล้ว กรุณาใช้ชื่ออื่น');
  return name;
}
export function uniqueFilename(value, existingNames=[]) {
  const original=safeFilename(value), used=new Set(existingNames.map(name=>name.toLowerCase()));
  let candidate=original, number=1;
  const dot=original.lastIndexOf('.'), stem=original.slice(0,dot), extension=original.slice(dot);
  while(used.has(candidate.toLowerCase())){
    const suffix=String(++number);
    candidate=stem.slice(0,100-suffix.length)+suffix+extension;
  }
  return candidate;
}
export function validateProgram(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid program');
  if (typeof value.code !== 'string' || encoder.encode(value.code).length > MAX_SOURCE_BYTES) throw new Error('โค้ดแต่ละไฟล์ต้องไม่เกิน 100 KB');
  if (typeof value.input !== 'string' || encoder.encode(value.input).length > MAX_SOURCE_BYTES) throw new Error('Input ต้องไม่เกิน 100 KB');
  if (!['c99','c11','c17'].includes(value.standard)) throw new Error('Invalid C standard');
  if(value.mode!==undefined&&!['auto','submit'].includes(value.mode))throw new Error('Invalid run mode');
  if (safeFilename(value.filename) !== value.filename) throw new Error('Invalid filename');
  if (!Array.isArray(value.files) || value.files.length > MAX_FILES) throw new Error('เปิดได้สูงสุด 30 ไฟล์');
  const names = new Set();
  let size = 0;
  for (const file of value.files) {
    if (!file || typeof file.name !== 'string' || safeFilename(file.name) !== file.name || names.has(file.name)) throw new Error('Invalid or duplicate filename');
    names.add(file.name);
    if (typeof file.code !== 'string' || encoder.encode(file.code).length > MAX_SOURCE_BYTES) throw new Error('โค้ดแต่ละไฟล์ต้องไม่เกิน 100 KB');
    size += encoder.encode(file.code).length;
  }
  if (size > MAX_PROJECT_BYTES) throw new Error('โค้ดรวมต้องไม่เกิน 1 MB');
}
