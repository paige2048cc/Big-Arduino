import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use '/' for Vercel, '/Big-Arduino/' for GitHub Pages
const base = process.env.VERCEL ? '/' : '/Big-Arduino/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    proxy: {
      // Proxy API requests to Vercel dev server during local development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
