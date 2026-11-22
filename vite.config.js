import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves this repository from /piano-sheetflow/.
  base: '/piano-sheetflow/',
  server: {
    port: 3000,
    open: false,
    host: true
  }
});
