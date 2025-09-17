import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: './dist/renderer',
    emptyOutDir: true,
    target: 'electron-renderer',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  // Minimal optimizeDeps to avoid missing modules
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
});