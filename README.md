# C Studio

A Next.js + React + TypeScript workspace for writing, compiling, running, and exporting C programs. Responsive mint-and-cream interface, highlighted editor, temporary file tabs, example programs, standard input, compiler diagnostics, stop control, C99/C11/C17 selection, and source / ZIP / native executable exports.

## Start

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:3000. Windows x64 installs a bundled Zig compiler through the optional dependency. On other platforms install GCC, or set `C_COMPILER` to the absolute path of a GCC-compatible compiler (Zig is supported as well).

Development uses `.next-dev/`; production builds use `.next/`. These caches are separate so running a build does not overwrite the development server's files. After updating dependencies or configuration, stop the old server with Ctrl+C and run `npm run dev` again. If port 3000 is occupied, Next.js prints the available port it selects.

```powershell
$env:C_COMPILER = 'C:\path\to\gcc.exe'
npm run dev
```

## Usage

Write C or open a `.c` file. For `scanf`, enter all stdin in the Input tab before running. Use Run code or Ctrl+Enter. Output appears after completion; Problems shows compiler diagnostics. Stop terminates the active compiler or program. New file opens a separate blank tab. Switch files using the tabs or sidebar; close individual tabs with ×. Source code and input exist only in React memory: refreshing or closing the page clears every file. Ctrl+S downloads the active source file. Export ZIP downloads all open source files with their individual input files. Only layout preferences persist in localStorage.

Native export builds for the server's operating system and CPU. The first compile can take up to two minutes while Zig prepares its cache. Programs have a five-second run timeout and a 100 KB output cap. Each tab runs independently; multiple translation units are not linked together.

## Execution boundary

This is a personal localhost development tool. `dev` and `start` bind to 127.0.0.1. Compilation endpoints check the localhost hostname, same origin, and a custom request header. **Native programs execute with the server user's permissions; this is not an OS sandbox.** Only run trusted code. Do not expose this server publicly or add a public reverse proxy. Time and output limits do not restrict filesystem, network, memory, or child-process access. Public deployment requires replacing the runner with an authenticated, isolated execution service; Workers/Vercel cannot run this local native process implementation directly.

## Checks

```powershell
npm run build
npm test
```

Runner tests compile real C, check stdin/stdout, syntax errors, runtime timeout and cancellation. Design uses Lucide icons and optional Google Fonts with local font fallbacks.

References: [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Zig overview](https://ziglang.org/intro/overview/).
