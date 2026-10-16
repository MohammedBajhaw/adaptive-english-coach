// Service worker for the installed web app. It is generated into dist/ at build time:
// the build id and the list of built files are filled in by vite.github-pages.config.ts.
const CACHE = "aec-__BUILD_ID__";
const PRECACHE = __PRECACHE__;
const scopeUrl = path => new URL(path, self.registration.scope).href;

self.addEventListener("install", event => {
  // No skipWaiting: a new version takes over only when the app is reopened, so a lesson in progress is never interrupted.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE.map(scopeUrl))));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("aec-") && key !== CACHE).map(key => caches.delete(key)))),
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Supabase, fonts and every other origin always go to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(scopeUrl("./"))));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    })),
  );
});
