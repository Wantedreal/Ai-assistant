import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Three.js and 3D viewer into their own chunk
          'three-vendor': ['three'],
          // Separate other vendors
          'react-vendor': ['react', 'react-dom'],
          'axios-vendor': ['axios'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',  // explicit IPv4, NOT localhost
        changeOrigin: true,
      }
    }
  }
})