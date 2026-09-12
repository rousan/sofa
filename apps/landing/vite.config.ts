/**
 * Build configuration for the site at sofa.rousanali.com.
 *
 * Tailwind is wired through its Vite plugin rather than PostCSS, which is how
 * version 4 is meant to be used: the theme lives in the stylesheet, so there is
 * no config file to keep in step.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Two pages, so two entries. The privacy policy gets a directory of its
      // own so it is served at /privacy/ rather than /privacy.html.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy/index.html'),
      },
    },
  },
});
