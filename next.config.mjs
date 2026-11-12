import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @param {string} phase @returns {import('next').NextConfig} */
export default function config(phase) {
  return {
    // Development must not reuse production build files or stale compiled config.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    typescript: { tsconfigPath: phase === PHASE_DEVELOPMENT_SERVER ? 'tsconfig.json' : 'tsconfig.production.json' },
    poweredByHeader: false,
    async headers() {
      return [{ source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" + (phase === PHASE_DEVELOPMENT_SERVER ? " 'unsafe-eval'" : '') + "; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'" + (phase === PHASE_DEVELOPMENT_SERVER ? ' ws: wss:' : '') + "; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
      ] }];
    },
  };
}
