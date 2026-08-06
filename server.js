import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function tryReadCert(envPath) {
  try { return readFileSync(envPath); } catch { return null; }
}

function makeServer() {
  const certPath = process.env.HTTPS_CERT;
  const keyPath = process.env.HTTPS_KEY;
  if (certPath && keyPath) {
    const cert = tryReadCert(certPath);
    const key = tryReadCert(keyPath);
    if (cert && key) {
      return createHttpsServer({ cert, key });
    }
  }
  return createServer();
}
import { listAppProcesses, listInstalledApps, realIconService } from "./apps.js";
import { activateApp } from "./actions.js";
import { loadConfig, saveConfig, normalizePinned } from "./config.js";
import { connectOBS } from "./obs-ws.js";
import { ensurePin, newPin, isLoopback, pinFromCookie, pinCookie, writePinFile } from "./auth.js";
import { WebSocketServer } from "ws";

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".apk": "application/vnd.android.package-archive" };
const BODY_TOO_BIG = Symbol("BODY_TOO_BIG");
const BODY_INVALID = Symbol("BODY_INVALID");
/** Limite de body dos endpoints — reorder do dock com muitos apps passa fácil de 1KB. */
const BODY_MAX_BYTES = 64 * 1024;
/** Anti-bruteforce do pin: 5 falhas → lock 60s por IP. */
const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 60_000;
const pinLocks = new Map();

const SEC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function fail(res, err, extra = {}) {
  res.writeHead(500, { "Content-Type": "application/json", ...SEC_HEADERS });
  res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err), ...extra }));
}

function readBody(req, res) {
  return new Promise(resolve => {
    let body = "";
    let big = false;
    req.on("data", c => {
      if (big) return;
      body += c;
      if (Buffer.byteLength(body, "utf8") > BODY_MAX_BYTES) {
        big = true;
        res.writeHead(413, { "Content-Type": "application/json", ...SEC_HEADERS });
        res.end(JSON.stringify({ ok: false, error: "corpo grande demais" }));
      }
    });
    req.on("end", () => {
      if (big) return resolve(BODY_TOO_BIG);
      try { resolve(JSON.parse(body || "{}")); } catch { resolve(BODY_INVALID); }
    });
  });
}

const STATUS_POLL_MS = 6000;

/** Versão do index.html (mtime+size) — o cliente recarrega sozinho quando
 *  o servidor sobe uma UI nova, mesmo com a página aberta há horas no kiosk. */
function uiVersion(root) {
  try {
    const st = statSync(join(root, "index.html"));
    return "v" + Math.floor(st.mtimeMs / 1000).toString(36) + "-" + st.size.toString(36);
  } catch (e) {
    return "v0";
  }
}

/**
 * Feed de status via WebSocket: um único tracker no servidor empurra
 * { type:"apps", pinned, running } pra todos os clients quando muda.
 * Elimina o polling HTTP do device (menos rádio/CPU/bateria no J5).
 */
function createStatusFeed({ readConfig, listProcesses, version = null }) {
  const clients = new Set();
  let timer = null;
  let last = "";
  function sendTo(ws, data) {
    if (ws.readyState === 1) { try { ws.send(JSON.stringify(data)); } catch (e) {} }
  }
  async function broadcast(force) {
    // force=true sempre monta payload (pin do Mac precisa empurrar mesmo com 0 clients? não — sem clients não há o que empurrar;
    // mas last deve invalidar pra próximo client pegar fresco)
    if (!clients.size && !force) return;
    let cfg = { pinned: [] };
    try { cfg = await readConfig(); } catch (e) {}
    if (!cfg || !Array.isArray(cfg.pinned)) cfg = { pinned: [] };
    cfg.pinned = normalizePinned(cfg.pinned);
    let running = [];
    try { running = await listProcesses(); } catch (e) {}
    if (!Array.isArray(running)) running = [];
    const payload = {
      type: "apps",
      pinned: cfg.pinned,
      running,
      devices: clients.size,
      ...(version ? { v: version() } : {}),
    };
    const encoded = JSON.stringify(payload);
    if (!force && encoded === last) return;
    last = encoded;
    if (!clients.size) return;
    for (const ws of clients) sendTo(ws, payload);
  }
  return {
    addClient(ws) {
      clients.add(ws);
      ws.on("close", () => {
        clients.delete(ws);
        if (!clients.size && timer) { clearInterval(timer); timer = null; last = ""; }
      });
      ws.on("error", () => {});
      sendTo(ws, { type: "online", online: true, devices: clients.size, ...(version ? { v: version() } : {}) });
      broadcast(true);
      if (!timer) {
        timer = setInterval(() => broadcast(false), STATUS_POLL_MS);
        if (timer.unref) timer.unref();
      }
    },
    /** Empurra já (ex.: pin/unpin do Mac → device em <1s, sem esperar poll de 6s). */
    ping() { return broadcast(true); },
    clientCount() { return clients.size; },
    close() {
      if (timer) { clearInterval(timer); timer = null; }
      for (const ws of clients) sendTo(ws, { type: "online", online: false });
      clients.clear();
    },
  };
}

export function makeApp(deps = {}) {
  const {
    root = join(import.meta.dirname, "public"),
    appTools = { listAppProcesses, listInstalledApps },
    actions = { activateApp },
    obs = null,
    iconService = realIconService(),
    onStatusChange = null,
    getDeviceCount = null,
  } = deps;
  const configFile = deps.configFile ?? (deps.config === undefined ? join(import.meta.dirname, "config.json") : null);
  const readConfig = async () => {
    if (configFile) return loadConfig(configFile);
    const c = deps.config || { pinned: [] };
    return { pinned: normalizePinned(c.pinned) };
  };
  const appVersion = deps.version || (() => uiVersion(root));
  const persistConfig = async cfg => {
    cfg.pinned = normalizePinned(cfg.pinned);
    if (configFile) await saveConfig(configFile, cfg);
    else if (deps.config) deps.config.pinned = cfg.pinned;
    return cfg;
  };
  const handler = (req, res) => {
    const url = new URL(req.url, "http://x");
    const ok = body => { res.writeHead(200, { "Content-Type": "application/json", ...SEC_HEADERS }); res.end(JSON.stringify(body)); };
    // config que o cliente pode ver — nunca vaza o pin (só o dono lê via /api/pin)
    const publicCfg = cfg => ({ pinned: normalizePinned(cfg.pinned) });
    if (url.pathname === "/health") { res.writeHead(200, { "Content-Type": "application/json", ...SEC_HEADERS }); res.end(JSON.stringify({ ok: true, service: "j5-dock" })); return; }
    if (url.pathname === "/api/probe") {
      const flags = Object.fromEntries(url.searchParams);
      console.log("[probe]", JSON.stringify({ ua: req.headers["user-agent"], ...flags }));
      res.writeHead(204); res.end(); return;
    }
    // ---------- auth: pin de 4 dígitos (gate do kiosk da LAN) ----------
    const trustLoopback = deps.trustLoopback !== false;
    const auth = deps.auth;
    const ipOf = req.socket.remoteAddress || "?";
    const authed = () =>
      (trustLoopback && isLoopback(ipOf)) ||
      (!!auth && pinFromCookie(req.headers.cookie) === auth.getPin());
    if (auth && url.pathname === "/api/auth" && req.method === "POST") {
      readBody(req, res).then(body => {
        if (body === BODY_TOO_BIG || body === BODY_INVALID) {
          res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
          res.end(JSON.stringify({ ok: false, error: "corpo inválido" }));
          return;
        }
        const given = typeof body?.pin === "string" ? body.pin.trim() : "";
        if (given === "") {
          res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
          res.end(JSON.stringify({ ok: false, error: "código vazio" }));
          return;
        }
        const now = Date.now();
        const lock = pinLocks.get(ipOf);
        if (lock && lock.until > now) {
          res.writeHead(429, { "Content-Type": "application/json", ...SEC_HEADERS });
          res.end(JSON.stringify({ ok: false, error: "muitas tentativas — aguarde" }));
          return;
        }
        if (given === auth.getPin()) {
          pinLocks.delete(ipOf);
          res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": pinCookie(auth.getPin()), ...SEC_HEADERS });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        const prev = pinLocks.get(ipOf);
        if (!prev || now - prev.last > PIN_LOCK_MS) {
          pinLocks.set(ipOf, { fails: 1, last: now, until: 0 });
        } else {
          prev.fails += 1;
          prev.last = now;
          if (prev.fails >= PIN_MAX_FAILS) prev.until = now + PIN_LOCK_MS;
        }
        res.writeHead(401, { "Content-Type": "application/json", ...SEC_HEADERS });
        res.end(JSON.stringify({ ok: false, error: "código inválido" }));
      });
      return;
    }
    if (auth && url.pathname === "/api/pin") {
      // só o dono (loopback) lê/regenera — atacante na LAN não descobre o pin
      if (!isLoopback(ipOf)) {
        res.writeHead(403, { "Content-Type": "application/json", ...SEC_HEADERS });
        res.end(JSON.stringify({ ok: false, error: "acesso negado" }));
        return;
      }
      if (req.method === "POST") {
        Promise.resolve()
          .then(async () => { const p = newPin(); await auth.setPin(p); return p; })
          .then(p => ok({ ok: true, pin: p }))
          .catch(err => fail(res, err));
        return;
      }
      ok({ ok: true, pin: auth.getPin() });
      return;
    }
    // wall: todo /api/* exige cookie válido — loopback do Mac (dono) passa
    if (url.pathname.startsWith("/api/") && !authed()) {
      res.writeHead(401, { "Content-Type": "application/json", ...SEC_HEADERS });
      res.end(JSON.stringify({ ok: false, error: "acesso negado" }));
      return;
    }
    if (url.pathname === "/api/apps") {
      Promise.resolve()
        .then(() => readConfig())
        .then(cfg => appTools.listAppProcesses()
          .then(running => ok({ pinned: cfg.pinned, running, v: appVersion() }))
          .catch(() => ok({ pinned: cfg.pinned, running: [], v: appVersion() })))
        .catch(err => fail(res, err));
      return;
    }
    if (url.pathname === "/api/config") {
      Promise.resolve()
        .then(() => readConfig())
        .then(cfg => ok({ ok: true, config: publicCfg(cfg) }))
        .catch(err => fail(res, err));
      return;
    }
    // POST = adiciona um; PUT = substitui a lista inteira (app Mac / bulk)
    if (url.pathname === "/api/config/pinned" && (req.method === "POST" || req.method === "PUT")) {
      readBody(req, res).then(body => {
        if (body === BODY_TOO_BIG) return;
        if (body === BODY_INVALID) {
          res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
          res.end(JSON.stringify({ ok: false, error: "corpo inválido" }));
          return;
        }
        if (req.method === "PUT") {
          const list = body?.apps ?? body?.pinned;
          if (!Array.isArray(list)) {
            res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
            res.end(JSON.stringify({ ok: false, error: "apps deve ser array" }));
            return;
          }
          const pinned = normalizePinned(list);
          Promise.resolve()
            .then(() => readConfig())
            .then(cfg => { cfg.pinned = pinned; return persistConfig(cfg); })
            .then(cfg => ok({ ok: true, config: publicCfg(cfg), pushed: true }))
            .then(() => { if (onStatusChange) onStatusChange(); })
            .catch(err => fail(res, err));
          return;
        }
        const app = typeof body?.app === "string" ? body.app.trim() : "";
        if (app === "") {
          res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
          res.end(JSON.stringify({ ok: false, error: "app inválido" }));
          return;
        }
        Promise.resolve()
          .then(() => readConfig())
          .then(cfg => {
            cfg.pinned = normalizePinned(cfg.pinned);
            if (!cfg.pinned.includes(app)) cfg.pinned.push(app);
            return persistConfig(cfg);
          })
          .then(cfg => ok({ ok: true, config: publicCfg(cfg), pushed: true }))
          .then(() => { if (onStatusChange) onStatusChange(); })
          .catch(err => fail(res, err));
      });
      return;
    }
    const unpin = url.pathname.match(/^\/api\/config\/pinned\/([^/]+)$/);
    if (unpin && req.method === "DELETE") {
      let app;
      try { app = decodeURIComponent(unpin[1]); }
      catch {
        res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
        res.end(JSON.stringify({ ok: false, error: "nome inválido" }));
        return;
      }
      app = typeof app === "string" ? app.trim() : "";
      Promise.resolve()
        .then(() => readConfig())
        .then(cfg => {
          cfg.pinned = normalizePinned(cfg.pinned).filter(x => x !== app);
          return persistConfig(cfg);
        })
        .then(cfg => ok({ ok: true, config: publicCfg(cfg), pushed: true }))
        .then(() => { if (onStatusChange) onStatusChange(); })
        .catch(err => fail(res, err));
      return;
    }
    // Status p/ app Mac: quantos devices escutam o WS + health
    if (url.pathname === "/api/status" && req.method === "GET") {
      Promise.resolve()
        .then(() => readConfig())
        .then(cfg => ok({
          ok: true,
          service: "j5-dock",
          devices: typeof getDeviceCount === "function" ? getDeviceCount() : 0,
          pinned: normalizePinned(cfg.pinned).length,
          config: { pinned: normalizePinned(cfg.pinned) },
        }))
        .catch(err => fail(res, err));
      return;
    }
    if (url.pathname === "/api/apps/installed") {
      Promise.resolve()
        .then(() => appTools.listInstalledApps())
        .then(apps => ok({ ok: true, apps }))
        .catch(err => fail(res, err));
      return;
    }
    const activate = url.pathname.match(/^\/api\/apps\/([^/]+)\/activate$/);
    if (activate) {
      let name;
      try { name = decodeURIComponent(activate[1]); }
      catch {
        res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
        res.end(JSON.stringify({ ok: false, error: "nome inválido" }));
        return;
      }
      if (req.method === "POST") {
        readBody(req, res).then(body => {
          if (body === BODY_TOO_BIG) return;
          let pid = body?.pid;
          if (!(Number.isInteger(pid) && pid > 0)) pid = undefined;
          actions.activateApp({ name, pid })
            .then(() => ok({ ok: true }))
            .then(() => { if (onStatusChange) onStatusChange(); })
            .catch(err => fail(res, err));
        });
        return;
      }
    }
    const icon = url.pathname.match(/^\/api\/apps\/([^/]+)\/icon$/);
    if (icon) {
      let name;
      try { name = decodeURIComponent(icon[1]); }
      catch {
        res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
        res.end(JSON.stringify({ ok: false, error: "nome inválido" }));
        return;
      }
      Promise.resolve()
        .then(() => iconService.getIconPng(name))
        .then(buf => {
          if (!buf) {
            res.writeHead(404, { "Content-Type": "application/json", ...SEC_HEADERS });
            res.end(JSON.stringify({ ok: false, error: "app não encontrado" }));
            return;
          }
          res.writeHead(200, {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
            ...SEC_HEADERS,
          });
          res.end(buf);
        })
        .catch(err => fail(res, err));
      return;
    }
    if (url.pathname === "/api/obs/state") {
      if (!obs) { ok({ ok: true, connected: false }); return; }
      Promise.resolve().then(() => obs.getState())
        .then(state => ok({ ok: true, connected: true, state }))
        .catch(err => fail(res, err, { connected: true }));
      return;
    }
    const obsAction = fn => {
      if (!obs) { ok({ ok: false, connected: false }); return; }
      Promise.resolve().then(() => obs[fn]())
        .then(() => ok({ ok: true }))
        .catch(err => fail(res, err));
    };
    if (url.pathname === "/api/obs/record" && req.method === "POST") { obsAction("toggleRecord"); return; }
    if (url.pathname === "/api/obs/stream" && req.method === "POST") { obsAction("toggleStream"); return; }
    if (url.pathname === "/api/obs/stop-all" && req.method === "POST") { obsAction("stopAll"); return; }
    if (url.pathname === "/api/obs/scene" && req.method === "POST") {
      readBody(req, res).then(body => {
        if (body === BODY_TOO_BIG) return;
        if (body === BODY_INVALID) {
          res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
          res.end(JSON.stringify({ ok: false, error: "corpo inválido" }));
          return;
        }
        if (!(typeof body?.scene === "string" && body.scene.trim() !== "")) {
          res.writeHead(400, { "Content-Type": "application/json", ...SEC_HEADERS });
          res.end(JSON.stringify({ ok: false, error: "cena inválida" }));
          return;
        }
        if (!obs) { ok({ ok: false, connected: false }); return; }
        Promise.resolve().then(() => obs.switchScene(body.scene.trim()))
          .then(() => ok({ ok: true }))
          .catch(err => fail(res, err));
      });
      return;
    }
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    const p = join(root, file);
    /* path traversal guard: resolved path must stay inside root */
    if (!resolve(p).startsWith(resolve(root))) {
      res.writeHead(403, { "Content-Type": "application/json", ...SEC_HEADERS });
      res.end(JSON.stringify({ ok: false, error: "acesso negado" }));
      return;
    }
    const isUi = url.pathname === "/" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/sw.js");
    readFile(p).then(b => {
      res.writeHead(200, {
        "Content-Type": `${MIME[extname(p)] || "text/plain"}; charset=utf-8`,
        "Cache-Control": isUi ? "no-cache, no-store, must-revalidate" : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      res.end(b);
    })
      .catch(() => { res.writeHead(404); res.end("not found"); });
  };
  return handler;
}

export async function startServer(arg = {}) {
  const opts = typeof arg === "number" ? { port: arg } : (arg ?? {});
  const port = opts.port ?? 3000;
  if (opts.obs === undefined) {
    opts.obs = await connectOBS({
      password: process.env.OBS_WS_PASSWORD,
      host: process.env.OBS_WS_HOST,
      port: process.env.OBS_WS_PORT && Number(process.env.OBS_WS_PORT),
    });
  }
  const configProvided = opts.config !== undefined;
  const configFile = configProvided ? null : (opts.configFile ?? join(import.meta.dirname, "config.json"));
  // pin de acesso (4 dígitos): fixo em .j5-pin, só regenera via POST /api/pin
  const pinRoot = opts.root ?? import.meta.dirname;
  let currentPin = await ensurePin(pinRoot);
  opts.auth = {
    getPin: () => currentPin,
    setPin: async (p) => { currentPin = p; await writePinFile(p, pinRoot); },
  };
  opts.trustLoopback = opts.trustLoopback !== false;
  const uiVer = () => uiVersion(join(import.meta.dirname, "public"));
  const feed = createStatusFeed({
    readConfig: () => configFile ? loadConfig(configFile) : Promise.resolve(opts.config || { pinned: [] }),
    listProcesses: (opts.appTools && opts.appTools.listAppProcesses)
      ? opts.appTools.listAppProcesses
      : listAppProcesses,
    version: uiVer,
  });
  const handler = makeApp({
    ...opts,
    onStatusChange: () => feed.ping(),
    getDeviceCount: () => feed.clientCount(),
  });
  const server = makeServer();
  server.on("request", handler);
  // path /ws é o default do upgrade no mesmo server; clients conectam em ws://host:port/
  // (browser usa location.host + "/ws" — o ws library aceita qualquer path no mesmo port)
  const wss = new WebSocketServer({
    server,
    verifyClient: (info) => {
      if (opts.trustLoopback && isLoopback(info.req.socket.remoteAddress)) return true;
      return pinFromCookie(info.req.headers.cookie) === currentPin;
    },
  });
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let m = null;
      try { m = JSON.parse(raw.toString("utf8")); } catch (e) {}
      if (m && m.type === "ping") feed.ping();
    });
    feed.addClient(ws);
  });
  await new Promise((res, rej) => {
    // erro de listen (ex.: EADDRINUSE) rejeita em vez de crash sem handler
    server.once("error", rej);
    server.listen(port, () => {
      server.off("error", rej);
      res();
    });
  });
  let closed = false;
  const close = () => new Promise((resolve, reject) => {
    if (closed) return resolve();
    if (!server.listening) { closed = true; feed.close(); try { wss.close(); } catch (e) {} return resolve(); }
    closed = true;
    feed.close();
    try { wss.close(); } catch (e) {}
    server.close(e => e ? reject(e) : resolve());
  });
  return { port: server.address().port, close };
}

// bootstrap: só quando executado direto (node server.js), nunca no import
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const proto = (process.env.HTTPS_CERT && process.env.HTTPS_KEY) ? "https" : "http";
  startServer()
    .then(({ port }) => console.log(`j5-dock ouvindo em ${proto}://127.0.0.1:${port}`))
    .catch(err => { console.error(err); process.exitCode = 1; });
}
