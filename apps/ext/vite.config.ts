/**
 * Shared Vite configuration for the extension's bundles.
 *
 * The entries are built one at a time by `scripts/build.mjs`, because a Chrome
 * content script cannot be an ES module and Rollup refuses to emit more than one
 * IIFE bundle from a single build.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'chrome110',
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
  },
});
