import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
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
  esbuild: {
    jsx: 'automatic'
  }
});