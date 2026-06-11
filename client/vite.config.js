import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: '0.0.0.0', // Force it to listen on all local network interfaces
    
    // Explicit array pattern required for Vite 8 edge proxy routing
    allowedHosts: [
      '.trycloudflare.com',
      'localhost',
      '127.0.0.1'
    ],

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})