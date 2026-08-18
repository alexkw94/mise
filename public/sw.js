/*
 * Minimal service worker: enough for a real standalone home-screen app,
 * deliberately not a full offline story.
 *
 * - App shell + static assets: stale-while-revalidate, so a cold launch from
 *   the home screen paints immediately instead of showing a white screen.
 * - /api/*: never cached. Both routes hit Claude; a stale nutrition estimate
 *   would be worse than an honest error.
 */

const CACHE = "mise-v2";

// The app may be served from a sub-path (GitHub Pages: /<repo>/). Derive it
// from where this file itself was loaded rather than hard-coding "/".
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const PRECACHE = [
  `${BASE}/`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${BASE}/api/`)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
