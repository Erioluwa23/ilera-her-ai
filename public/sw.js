const CACHE="ileraher-lite-v2";
const CORE=["/lite","/manifest.webmanifest"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting()});
self.addEventListener("activate",event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("ileraher-lite-")&&key!==CACHE).map(key=>caches.delete(key))))])));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/v1/"))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&!response.headers.get("cache-control")?.includes("no-store")){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match("/lite"))));
});
