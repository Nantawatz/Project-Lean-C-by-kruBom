import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const jobs = new Map();
export function stop(id) { const job = jobs.get(id); if (job) { job.aborted = true; job.child?.kill(); } }
function execute(command, args, job, cwd, input = '', limit = 10000) {
  return new Promise((resolve, reject) => {
    if (job.aborted) return reject(new Error('Stopped by user'));
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false, env: { ...process.env, ZIG_GLOBAL_CACHE_DIR: path.join(process.cwd(), '.c-studio', 'zig-cache'), ZIG_LOCAL_CACHE_DIR: path.join(cwd, 'zig-cache') } });
    job.child = child;
    let stdout = '', stderr = '', reason = '';
    const timer = setTimeout(() => { reason = 'Execution time limit exceeded'; child.kill(); }, limit);
    const collect = (kind, data) => { if (kind === 'out') stdout += data; else stderr += data; if (stdout.length + stderr.length > 100000) { reason = 'Output limit exceeded'; child.kill(); } };
    child.stdout.on('data', d => collect('out', d)); child.stderr.on('data', d => collect('err', d));
    child.stdin.on('error', () => {}); child.stdin.end(input);
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code, reason: job.aborted ? 'Stopped by user' : reason }); });
  });
}
export async function runProgram({ code, input = '', id, standard = 'c17', binary = false }) {
  if (typeof code !== 'string' || code.length > 100000 || typeof input !== 'string' || input.length > 100000 || !['c99','c11','c17'].includes(standard)) throw new Error('Invalid source or input (maximum 100 KB)');
  if (jobs.has(id)) throw new Error('This run is already active');
  if (jobs.size >= 2) throw new Error('Two jobs are already running. Try again shortly.');
  const job = { aborted: false, child: null }; jobs.set(id, job);
  let dir;
  const started = Date.now();
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'c-studio-'));
    const bundled = path.join(process.cwd(), 'node_modules', '@oven', 'zig-win32-x64', 'zig.exe');
    let compiler = process.env.C_COMPILER || 'gcc', prefix = [];
    if (!process.env.C_COMPILER && process.platform === 'win32') { try { await access(bundled); compiler = bundled; prefix = ['cc']; } catch {} }
    if (path.basename(compiler).startsWith('zig') && !prefix.length) prefix = ['cc'];
    await writeFile(path.join(dir, 'main.c'), code);
    const executable = path.join(dir, process.platform === 'win32' ? 'program.exe' : 'program');
    const compilation = await execute(compiler, [...prefix, 'main.c', `-std=${standard}`, '-Wall', '-Wextra', '-O0', '-o', executable], job, dir, '', 120000);
    if (compilation.code !== 0 || compilation.reason) return { stage: 'compile', ...compilation, duration: Date.now() - started };
    if (binary) return { binary: await readFile(executable), name: path.basename(executable) };
    const result = await execute(executable, [], job, dir, input, 5000);
    return { stage: 'run', ...result, warnings: compilation.stderr, duration: Date.now() - started };
  } catch (e) { if (e.code === 'ENOENT') throw new Error('C compiler not found. Run npm install on Windows, or install GCC and set C_COMPILER.'); throw e; }
  finally { jobs.delete(id); if (dir) await rm(dir, { recursive: true, force: true }); }
}
