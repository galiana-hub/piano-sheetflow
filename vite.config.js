import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas para compatibilidad total con GitHub Pages
  base: './',
  server: {
    port: 3000,
    open: false,
    host: true
  }
});
