const CACHE = "dokke-v34";
const REQUIRED_SHELL = ["/", "/index.html"];
const OPTIONAL_PRECACHE = [
  "/icon-192.png", "/icon-192-dark.png", "/icon-512.png", "/manifest.webmanifest"
];

self.addEventListener("install", function(e) {
  var install = caches.open(CACHE).then(function(c) {
    return c.addAll(REQUIRED_SHELL).then(function() {
      // Ícones e manifesto podem faltar sem bloquear a instalação do PWA.
      return Promise.all(OPTIONAL_PRECACHE.map(function(url) {
        return c.add(url).catch(function() { return null; });
      }));
    });
  }).then(function() {
    return self.skipWaiting();
  }).catch(function(error) {
    // Uma instalação incompleta não pode substituir o worker e o shell atuais.
    return caches.delete(CACHE).then(function() { throw error; }, function() { throw error; });
  });
  e.waitUntil(install);
});

self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e) {
  var url = new URL(e.request.url);
  if (url.pathname.indexOf("/api/") === 0 || url.pathname === "/health") return;
  // O script do Service Worker nunca pode ficar preso no cache antigo;
  // a revisão nova precisa chegar ao WebView para invalidar a UI.
  if (url.pathname === "/sw.js") return;
  // navegação (HTML do app): NETWORK-FIRST — sempre traz a versão mais nova,
  // evita ficar servindo UI antiga em cache (dots/layout antigos no J5)
  var nav = (e.request && e.request.mode === "navigate") ||
            url.pathname === "/" || url.pathname === "/index.html";
  if (nav) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).then(function(resp) {
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
