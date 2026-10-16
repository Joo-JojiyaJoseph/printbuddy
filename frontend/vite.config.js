import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Browser security headers. The strict Content-Security-Policy is applied to the built site (`npm run preview`, or copy
// public/_headers / the nginx snippet in the README to your web server). The dev server skips CSP because Vite's
// hot reload needs inline scripts.
const base = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
}
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' http: https:; worker-src 'self' blob:; frame-src 'self' about: blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: base, proxy: { '/api': 'http://localhost:8000' } },
  preview: { headers: { ...base, 'Content-Security-Policy': csp } },
  // Pre-bundle everything up front so Vite never re-optimises mid-session (that made pages go blank until a hard refresh).
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'lucide-react', 'qrcode.react', 'pdfjs-dist/legacy/build/pdf.mjs'] },
  build: { target: 'es2022', modulePreload: { resolveDependencies: (_f, deps) => deps.filter((d) => !/\/pdf-/.test(d)) }, chunkSizeWarningLimit: 600, rollupOptions: { output: { manualChunks(id) {
    if (id.includes('pdfjs-dist')) return 'pdf'
    if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
    if (id.includes('lucide-react') || id.includes('qrcode.react')) return 'ui'
  } } } },
  // Tests always use the in-browser mock API, whatever VITE_USE_MOCK says in the developer's .env.
  test: { environment: 'jsdom', setupFiles: './src/test/setup.js', globals: true, env: { VITE_USE_MOCK: 'true' } },
})
