import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Sitio de dos páginas: landing narrativa (/) y tienda independiente (/tienda).
export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), tienda: resolve(__dirname, 'tienda/index.html') },
    },
  },
});
