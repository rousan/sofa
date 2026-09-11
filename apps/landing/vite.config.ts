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

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
