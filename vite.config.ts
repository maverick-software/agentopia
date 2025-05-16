import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': { 
        target: 'https://txhscptzjrrudnqwavcb.supabase.co/functions/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
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