import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, ".", "").VITE_BASE || "/",
  plugins: [
    react(),
    {
      name: "offline-shell",
      apply: "build",
      generateBundle(_, bundle) {
        const files = [
          "index.html",
          ...Object.keys(bundle),
          "icon-192.png",
          "icon-512.png",
          "manifest.webmanifest",
        ];
        const version = Date.now().toString(36);
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `
const PREFIX = 'fairway-shell:' + self.registration.scope;
const CACHE = PREFIX + ${JSON.stringify(version)};
const SHELL = new URL('index.html', self.registration.scope).href;
const ASSETS = ${JSON.stringify(files)}.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (!response.ok) throw new Error('Navigation unavailable');
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match(SHELL))));
  } else if (ASSETS.includes(event.request.url)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request, { ignoreVary: true });
      return cached || fetch(event.request);
    }));
  }
});
`,
        });
      },
    },
  ],
  preview: { allowedHosts: [".devinapps.com", "localhost"] },
}));
