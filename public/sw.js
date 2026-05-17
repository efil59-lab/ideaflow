const CACHE_NAME = "ideaflow-v" + Date.now();

// Install - skip waiting immediately
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate - delete ALL old caches immediately
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch - network first, no cache for HTML
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Always fetch HTML fresh from network
  if (url.pathname === "/" || url.pathname.endsWith(".html")) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

