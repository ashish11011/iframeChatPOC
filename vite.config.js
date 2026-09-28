import { defineConfig } from 'vite';
export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/ws': { target: 'ws://localhost:3001', ws: true }, '/health': 'http://localhost:3001' } }
});
