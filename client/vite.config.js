import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'write-build-meta',
      closeBundle() {
        writeFileSync('./dist/build-meta.json', JSON.stringify({ buildTime: BUILD_TIME }));
      },
    },
  ],
  // Inject build timestamp as a global constant — resolved at vite build time.
  // __BUILD_TIME__ is the ISO string of when `vite build` (or `vite dev`) ran.
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  // Allow Firebase ESM imports from gstatic CDN
  optimizeDeps: {
    exclude: []
  },
  build: {
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
    minify: false,
  },
  server: {
    proxy: { '/api': 'http://localhost:3001' }
  }
})
