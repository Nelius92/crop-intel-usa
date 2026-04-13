import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://crop-intel-api-production.up.railway.app',
        changeOrigin: true,
        secure: false,
      },
      '/drought-api': {
        target: 'https://usdmdataservices.unl.edu/api',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/drought-api/, ''),
      }
    }
  }
})
