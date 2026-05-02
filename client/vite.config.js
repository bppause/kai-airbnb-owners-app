import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Inject build timestamp as a global constant — resolved at vite build time.
  // __BUILD_TIME__ is the ISO string of when `vite build` (or `vite dev`) ran.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // Allow Firebase ESM imports from gstatic CDN
  optimizeDeps: {
    exclude: []
  },
  server: {
    proxy: { '/api': 'http://localhost:3001' }
  }
})
