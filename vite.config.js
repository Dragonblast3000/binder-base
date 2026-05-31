import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Generates a service worker via Workbox so that visited card images and the
// large cards.json file are cached on the user's device after first view —
// makes return visits effectively instant and stops hammering the YGOPRODeck
// image servers.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Binder Base",
        short_name: "Binder Base",
        description: "Plan and print Yu-Gi-Oh binder layouts.",
        background_color: "#0e0f13",
        theme_color: "#0e0f13",
        display: "standalone",
        start_url: "/",
        icons: [
          // Inline-ish SVG icon, declared in /public/icon.svg below.
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        // App shell precaching limited to standard assets; cards.json is handled at runtime.
        globPatterns: ["**/*.{js,css,html,svg,ico}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // Card art from YGOPRODeck — cache after first view, serve stale fast.
            urlPattern: ({ url }) => url.origin === "https://images.ygoprodeck.com",
            handler: "CacheFirst",
            options: {
              cacheName: "ygo-card-images",
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 60 }, // 60 days
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Bundled card database — fresh on demand, fall back to cache offline.
            urlPattern: ({ url }) => url.pathname.endsWith("/cards.json"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ygo-card-db",
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
});
