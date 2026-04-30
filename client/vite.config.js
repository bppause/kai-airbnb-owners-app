import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Allow Firebase ESM imports from gstatic CDN
  optimizeDeps: {
    exclude: []
  },
  server: {
    proxy: { '/api': 'http://localhost:3001' }
  }
})
