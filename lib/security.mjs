export const MAX_SOURCE_BYTES = 100000;
export const MAX_PROJECT_BYTES = 1000000;
export const MAX_FILES = 30;
export const MAX_OUTPUT = 100000;
const encoder = new TextEncoder();
export function safeFilename(value) {
  const name = String(value).replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,99}\.(c|h)$/i.test(name)) return 'source.c';
  return name;
}
export function validateProgram(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid program');
  if (typeof value.code !== 'string' || encoder.encode(value.code).length > MAX_SOURCE_BYTES) throw new Error('โค้ดแต่ละไฟล์ต้องไม่เกิน 100 KB');
  if (typeof value.input !== 'string' || encoder.encode(value.input).length > MAX_SOURCE_BYTES) throw new Error('Input ต้องไม่เกิน 100 KB');
  if (!['c99','c11','c17'].includes(value.standard)) throw new Error('Invalid C standard');
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
