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
  optimizeDeps: {
    // Exclude pdfjs-dist from pre-bundling — it ships its own worker
    exclude: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      // Allow SharedArrayBuffer for PDF processing
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
