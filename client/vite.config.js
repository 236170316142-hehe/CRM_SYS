import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  // Use '/' for production (Render), './' only for local file:// access
  base: '/',

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
  },

  server: {
    host: '0.0.0.0',
    allowedHosts: [
      '.trycloudflare.com',
      '.onrender.com',
      'localhost',
      '127.0.0.1',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
}))
