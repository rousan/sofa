/**
 * Shared Vite configuration for the extension.
 *
 * The scripts Chrome injects are built one at a time as IIFE bundles by
 * `scripts/build.mjs`, because a content script cannot be an ES module and
 * Rollup will not emit several IIFE bundles from one build. The popup is an
 * ordinary page, so it is built the ordinary way, with React and Tailwind.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'chrome110',
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
  },
});
