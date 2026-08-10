import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";

test("GET / serve as 2 telas (apps + apps abertos) liquid glass", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") || "", /text\/html/);
    const html = await r.text();
    assert.match(html, /id="dokke"/, "html deve marcar a raiz da tela");
    assert.match(html, /id="screens"/, "html deve ter o wrapper das 2 telas");
    assert.match(html, /id="screenApps"/, "html deve ter a tela apps");
    assert.match(html, /id="screenRecents"/, "html deve ter a tela recentes");
    assert.match(html, /id="vdots"/, "html deve ter os dots verticais laterais");
    assert.match(html, /id="launchpad"/, "html deve ter o launchpad");
    assert.match(html, /OBS Commander/, "html deve conter o drawer OBS Commander");
    assert.match(html, /function tileLong/, "long-press no launchpad fixa/desfixa favorito");
    assert.doesNotMatch(html, /Recentes\.\.\./, "tela 2 sem título Recentes...");
    assert.doesNotMatch(html, /\.screens\.up/, "sem classe .up com transform CSS (tranco)");
    assert.match(html, /function goScreen/, "troca de tela final via goScreen (sem setY fixo)");
    assert.match(html, /body\.is-recents/, "troca de tela por classe opacity (não empilha telas)");
    assert.match(html, /function renderDeck/, "tela 2 com dock horizontal organizado");
    assert.doesNotMatch(html, /layoutTimeTravel|centerTimeTravel|bindTimeTravel|favscroll|favrow/, "Time Travel v01 removido (deck v03)");
    assert.match(html, /"Apps abertos"/, "tela 2 com título Apps abertos");
    assert.doesNotMatch(html, /tzone-pin|tdivider/, "tela 2 v03 sem split pinados/divisor antigo");
    assert.doesNotMatch(html, /Long press any app to pin|Long press any app to unpin/, "tela 2 não oferece fixação");
    assert.doesNotMatch(html, /📌/, "sem emoji de pin");
    assert.match(html, /\.thint/, "hint com classe thint presente");
    assert.doesNotMatch(html, /\.ddiv|className = "ddiv"/, "tela 2 sem grupo de fixados ou divisor");
    assert.match(html, /\.dcard\.front/, "card da frente com classe front");
    assert.doesNotMatch(html, /toque em \+ para adicionar/, "copy morta do botão + removida");
    assert.match(html, /id="upDownload"/, "aviso de atualização deve ter ação explícita");
    assert.match(html, /DokkeAndroid\.requestUpdate/, "Android deve controlar o download da atualização");
    assert.match(html, /cmpVer\(rel\.tag, apkNow\)/, "APK deve comparar a versão instalada com a release");
  } finally { await close(); }
});

test("GET / inclui PWA manifest link, apple-mobile-web-app e service worker", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /rel="manifest"\s+href="\/manifest\.webmanifest"/, "link rel=manifest deve apontar para manifest.webmanifest");
    assert.match(html, /name="apple-mobile-web-app-capable"\s+content="yes"/, "apple-mobile-web-app-capable=yes");
    assert.match(html, /name="apple-mobile-web-app-status-bar-style"/, "apple-mobile-web-app-status-bar-style deve existir");
    assert.match(html, /rel="apple-touch-icon"/, "apple-touch-icon deve existir");
    assert.match(html, /viewport-fit=cover/, "viewport-fit=cover deve estar no viewport meta");
    assert.match(html, /serviceWorker/, "deve registrar service worker");
    assert.match(html, /\/sw\.js/, "deve referenciar sw.js");
  } finally { await close(); }
});

test("GET /manifest.webmanifest retorna JSON válido com display standalone", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
    assert.equal(r.status, 200);
    const m = await r.json();
    assert.equal(m.display, "standalone");
    assert.equal(m.name, "dokke");
    assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, "manifest deve ter icons");
  } finally { await close(); }
});

test("GET /sw.js retorna service worker com cache-first", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/sw.js`);
    assert.equal(r.status, 200);
    const js = await r.text();
    assert.match(js, /caches\.open/, "sw.js deve usar Cache API");
    assert.match(js, /cache-first|caches\.match/, "sw.js deve ter strategy cache-first");
    assert.match(js, /install/, "sw.js deve ter evento install");
    assert.match(js, /activate/, "sw.js deve ter evento activate");
    assert.match(js, /fetch/, "sw.js deve ter evento fetch");
  } finally { await close(); }
});
