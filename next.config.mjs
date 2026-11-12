import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @param {string} phase @returns {import('next').NextConfig} */
export default function config(phase) {
  return {
    // Development must not reuse production build files or stale compiled config.
    distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next'),
    serverExternalPackages: ['@oven/zig-win32-x64'],
  };
}
