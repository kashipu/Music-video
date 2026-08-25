import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'favicon-96x96.png', 'apple-touch-icon.png'],
      workbox: {
        // El HTML NUNCA desde cache. Si se precachea, tras cada deploy el usuario
        // sigue viendo el bundle viejo hasta la segunda carga: la pagina ya se
        // pinto con el index.html cacheado (que apunta a los JS anteriores)
        // mientras el SW nuevo se activa por detras. Recargar solo no sirve:
        // /:slug/video reproduce durante horas y un reload la cortaria.
        // Los assets si se precachean: van con hash en el nombre, son inmutables.
        navigateFallback: null,
        globIgnores: ['**/index.html'],
      },
      manifest: {
        name: 'Repítela',
        short_name: 'Repítela',
        description: 'Panel de administración de Repítela',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#07070B',
        theme_color: '#07070B',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Permite probar Wompi en dev a través de un túnel (webhook + redirect https).
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  test: {
    exclude: ['tests-e2e/**', 'node_modules/**'],
  },
})
