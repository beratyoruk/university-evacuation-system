/// <reference lib="webworker" />

/**
 * Custom service worker for the evacuation app.
 *
 * Caching strategy:
 *   - App shell (HTML/JS/CSS): precached at install time, served stale-while-revalidate.
 *   - Floor plan API responses: cache first, then network — critical for offline evacuation.
 *   - Route API responses: network first with cache fallback — keep latest routes available offline.
 *   - Static assets (images, shaders): cache first with long expiration.
 *
 * This file is compiled by vite-plugin-pwa with strategies: "injectManifest",
 * which injects the precache manifest into self.__WB_MANIFEST at build time.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Precache app shell
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Floor plan — critical for offline evacuation
registerRoute(
  ({ url }) => url.pathname.match(/\/api\/v\d+\/floors\/[^/]+\/plan$/),
  new CacheFirst({
    cacheName: "floor-plans-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// Evacuation route — prefer fresh, but fall back on cache if offline
registerRoute(
  ({ url }) => url.pathname.endsWith("/evacuation/route"),
  new NetworkFirst({
    cacheName: "evacuation-routes-cache",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

// Buildings / floors metadata
registerRoute(
  ({ url }) =>
    url.pathname.match(/\/api\/v\d+\/(buildings|floors)/) !== null &&
    !url.pathname.match(/\/plan$/),
  new StaleWhileRevalidate({
    cacheName: "api-metadata-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

// Static images / icons / fonts
registerRoute(
  ({ request }) =>
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style",
  new CacheFirst({
    cacheName: "static-assets-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// Skip waiting — activate new SW immediately when user reloads
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", () => {
  // Don't auto-activate to avoid disrupting a user mid-evacuation; require reload
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
