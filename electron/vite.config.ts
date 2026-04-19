import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'renderer',
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    watch: {
      ignored: ['**/opencode.json'],
    },
  },
});
