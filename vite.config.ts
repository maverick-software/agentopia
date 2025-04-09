import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    hmr: {
      overlay: false
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'monaco-editor': ['react-monaco-editor'],
          'virtualization': ['react-window', 'react-virtualized-auto-sizer']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});