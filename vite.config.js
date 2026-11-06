import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // L'agent choisit quand appliquer une mise à jour (pas de rechargement en plein contrôle)
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: "KODACHECK — Vérification & registre d'engins",
        short_name: 'KODACHECK',
        description:
          "Vérification des plaques d'immatriculation et registre national des engins signalés volés.",
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#020617',
        theme_color: '#020617',
        categories: ['utilities', 'government'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Coquille de l'application : pages, code, styles et icônes, disponibles sans réseau
        globPatterns: ['**/*.{js,css,html,svg,png,ico,jpeg,webmanifest}'],
        // Le moteur OCR (~15 Mo) n'est pas pré-téléchargé : il est mis en cache à la première utilisation
        globIgnores: ['ocr/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/ocr\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kodacheck-ocr',
              expiration: { maxEntries: 12 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Les appels Supabase ne sont jamais mis en cache ici : les données hors-ligne
          // passent par la base locale (IndexedDB) synchronisée par l'application.
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
