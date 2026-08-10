const CACHE = "dokke-v11";
const PRECACHE = ["/", "/index.html", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(PRECACHE); }).then(function() { return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e) {
  var url = new URL(e.request.url);
  if (url.pathname.indexOf("/api/") === 0 || url.pathname === "/health") return;
  // navegação (HTML do app): NETWORK-FIRST — sempre traz a versão mais nova,
  // evita ficar servindo UI antiga em cache (dots/layout antigos no J5)
  var nav = (e.request && e.request.mode === "navigate") ||
            url.pathname === "/" || url.pathname === "/index.html";
  if (nav) {
    e.respondWith(
      fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200 && resp.type === "basic") {
          var clone = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function() {
        return caches.match(e.request).then(function(r) { return r || caches.match("/index.html"); });
      })
    );
    return;
  }
  // assets (icons, sw, manifest): cache-first com fallback
  e.respondWith(caches.match(e.request).then(function(r) {
    return r || fetch(e.request).then(function(resp) {
      if (resp && resp.status === 200 && resp.type === "basic") {
        var clone = resp.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      }
      return resp;
    });
  }).catch(function() { return caches.match("/index.html"); }));
});
