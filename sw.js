const C = "work-time-v11";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=7",
  "./utils.js",
  "./storage.js",
  "./time.js",
  "./normalize.js",
  "./render.js",
  "./handlers.js",
  "./theme.js",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(C)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== C)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches
            .open(C)
            .then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});