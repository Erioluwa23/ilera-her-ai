const CACHE = "ileraher-public-v3";
// Only non-personal offline help and static assets. Authenticated documents, RSC,
// private APIs and recordings never enter this shared cache.
const CORE = ["/offline.html"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate", event => event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("ileraher-") && key !== CACHE).map(key => caches.delete(key))))])));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/") || event.request.headers.has("rsc")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html"))); return;
  }
  if (!url.pathname.startsWith("/_next/static/") && url.pathname !== "/offline.html" && !url.pathname.startsWith("/images/")) return;
  event.respondWith(fetch(event.request).then(response => { if (response.ok && !response.headers.get("cache-control")?.includes("no-store")) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); } return response; }).catch(() => caches.match(event.request)));
});
