import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute, Route } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { createHandlerBoundToURL } from 'workbox-precaching';

// Take control immediately
self.skipWaiting();
clientsClaim();

// Precache all assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback (exclude hivesigner callback)
const navHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(navHandler, {
    denylist: [/^\/hivesigner\.html/],
  })
);

// Runtime cache: JS, CSS, fonts
registerRoute(
  /\.(?:js|css|woff2?)$/i,
  new StaleWhileRevalidate({ cacheName: 'static-assets' })
);

// Runtime cache: images
registerRoute(
  /\.(?:png|jpg|jpeg|svg|webp)$/i,
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

// ── Share Target handler ──
// When the OS shares a video file to our PWA, the browser POSTs to /share-target.
// We intercept it, stash the file in a temporary cache, and redirect to /studio.
const SHARE_CACHE = 'share-target-cache';

const shareTargetRoute = new Route(
  ({ url, request }) => {
    return url.pathname === '/share-target' && request.method === 'POST';
  },
  async ({ request }) => {
    const formData = await request.formData();
    const videoFile = formData.get('video');

    if (videoFile) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put('/shared-video', new Response(videoFile, {
        headers: {
          'Content-Type': videoFile.type,
          'X-File-Name': videoFile.name,
        },
      }));
    }

    return Response.redirect('/studio?shared=true', 303);
  },
  'POST'
);
registerRoute(shareTargetRoute);
