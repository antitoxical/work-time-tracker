const C = "work-time-v15";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=10",
  "./utils.js",
  "./storage.js",
  "./time.js",
  "./normalize.js",
  "./render.js",
  "./handlers.js",
  "./theme.js",
  "./supabase.js",
  "./supabase-auth.js",
  "./calendar-view.js",
  "./manifest.json"
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() =>
      caches.open(C).then(cache => cache.addAll(ASSETS))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" }).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(C).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
