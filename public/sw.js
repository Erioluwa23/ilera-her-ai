const CACHE = "ileraher-lite-v4";
// These routes render an account-neutral shell; health records are loaded from
// private account APIs or browser audio storage. Never cache APIs or the server-rendered admin.
const SHELLS = new Set([
  "/",
  "/cycle",
  "/voice",
  "/chat",
  "/lite",
  "/voice-lite",
  "/history",
  "/logs",
  "/log",
  "/help",
  "/feedback",
  "/help/feedback",
  "/settings/privacy",
]);
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const response = await fetch("/manifest.webmanifest");
      if (response.ok && !response.redirected)
        await cache.put("/manifest.webmanifest", response);
    }),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) => key.startsWith("ileraher-lite-") && key !== CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
    ]),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    /^\/(api|v1|login|signup)(\/|$)/.test(url.pathname)
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const shell =
          event.request.mode === "navigate" &&
          SHELLS.has(url.pathname) &&
          response.headers.get("content-type")?.includes("text/html");
        const asset =
          url.pathname.startsWith("/_next/static/") ||
          url.pathname === "/manifest.webmanifest";
        if (
          response.ok &&
          !response.redirected &&
          (shell ||
            (asset &&
              !response.headers.get("cache-control")?.includes("no-store")))
        ) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate")
          return (
            (await caches.match("/lite")) ||
            new Response(
              '<!doctype html><meta name="viewport" content="width=device-width"><title>Offline · ÌleraHer</title><body style="font:16px system-ui;background:#FBF8FD;color:#30213F;padding:24px"><h1>You are offline</h1><p>This page has not been saved for offline access. Browser recordings remain on this device. Account cycle records need a connection. Reconnect, then open the app again.</p></body>',
              { status: 503, headers: { "content-type": "text/html" } },
            )
          );
        return Response.error();
      }),
  );
});
