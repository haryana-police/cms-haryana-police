import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Only exclude things that genuinely cannot be bundled for the browser:
  // - pdfjs-dist  → uses WASM workers, lazily imported only in Investigation/Complaints
  // - Native server-only packages that must never reach the browser bundle
  //
  // NOTE: antd / @ant-design/* are back in normal pre-bundling.
  //       The previous STATUS_ACCESS_VIOLATION was caused by Node.js v24
  //       running old native .node binaries (fixed by `npm rebuild`), NOT by antd.
  optimizeDeps: {
    exclude: [
      'pdfjs-dist',
      'canvas',
      'better-sqlite3',
    ],
  },

  server: {
    port: 3000,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/cases': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/kb-files': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/cases': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/kb-files': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
