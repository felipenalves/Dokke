import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { createSocket } from "node:dgram";
import { networkInterfaces } from "node:os";
import { mkdirSync, existsSync, copyFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
import { activateApp, openWebsite } from "./actions.js";
import {
  loadConfig,
  saveConfig,
  normalizePinned,
  normalizeConfig,
  createWebsitePiece,
  piecesToPinned,
  normalizePieces,
  materializePiecePositions,
  firstAvailablePiecePosition,
  MAX_PINNED_APPS,
  MAX_PINNED_PIECES,
  MAX_DOCK_SLOTS,
  PINNED_LIMIT_CODE,
  PINNED_LIMIT_MESSAGE,
  pinnedLimits,
} from "./config.js";
import { connectOBS } from "./obs-ws.js";
import { ensurePin, newPin, isLoopback, sessionCookie, tokenFromCookie, clearLegacyPinCookie, createSessionStore, createPinLocks, safeEqual, writePinFile } from "./auth.js";
import { WebSocketServer } from "ws";

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".apk": "application/vnd.android.package-archive" };
const BODY_TOO_BIG = Symbol("BODY_TOO_BIG");
const BODY_INVALID = Symbol("BODY_INVALID");
/** Limite de body dos endpoints — reorder do dock com muitos apps passa fácil de 1KB. */
const BODY_MAX_BYTES = 64 * 1024;
/** Anti-bruteforce do pin: 5 falhas → lock 60s por IP (podado a cada registro). */
const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 60_000;
const pinLocks = createPinLocks({ maxFails: PIN_MAX_FAILS, lockMs: PIN_LOCK_MS });
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Ping de client força broadcast — limitado por conexão pra não virar amplificador. */
const PING_MIN_INTERVAL_MS = 1500;
/** Detecta conexões WebSocket quebradas sem adicionar tráfego HTTP. */
const WS_HEARTBEAT_MS = 30_000;

/** Origin ausente é permitido para clientes nativos; Origin presente precisa
 * ser exatamente a origem que atendeu a conexão (protocolo + host + porta). */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const protocol = req.socket.encrypted ? "https:" : "http:";
    if (!req.headers.host) return false;
    const serverOrigin = new URL(`${protocol}//${req.headers.host}`).origin;
    return new URL(origin).origin === serverOrigin;
  } catch {
    return false;
  }
}

// versão publicada no GitHub (releases/latest) — stale-while-revalidate; nunca bloqueia o request
// usa redirect da URL pública (sem API → sem rate limit)
const VERSION_CACHE_MS = 10 * 60 * 1000;
const versionCache = { value: null, age: 0, refreshing: null };
async function refreshVersion() {
  if (versionCache.refreshing) return versionCache.refreshing;
  versionCache.refreshing = (async () => {
    let timer = null;
    try {
      const ctrl = new AbortController();
      timer = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch("https://github.com/felipenalves/Dokke/releases/latest",
        { redirect: "manual", signal: ctrl.signal });
      const loc = r.headers.get("location") || "";
      const m = loc.match(/\/releases\/tag\/([^/]+)$/);
      if (!m) return;
      versionCache.value = {
        tag: m[1],
        htmlUrl: "https://github.com/felipenalves/Dokke/releases/tag/" + m[1],
        apkUrl: "https://github.com/felipenalves/Dokke/releases/latest/download/dokke.apk",
      };
      versionCache.age = Date.now();
    } catch {
    } finally {
      if (timer) clearTimeout(timer);
      versionCache.refreshing = null;
    }
  })();
  return versionCache.refreshing;
}
refreshVersion();

function latestVersionSnapshot() {
  if (!versionCache.age || Date.now() - versionCache.age >= VERSION_CACHE_MS) {
    refreshVersion();
  }
  return versionCache.value;
}

const SEC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/** Respostas JSON de API — nunca podem ser cacheadas (dados em tempo real).
 *  Sem isso o browser/WebView pode cachear GET /api/* heuristicamente. */
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...SEC_HEADERS,
};

/** Detalhe fica no log do servidor; o cliente recebe mensagem genérica. */
function fail(res, err, extra = {}) {
  console.error("[dokke] erro interno:", err?.message ?? err);
  res.writeHead(500, JSON_HEADERS);
  res.end(JSON.stringify({ ok: false, error: "erro interno", ...extra }));
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
        res.writeHead(413, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error: "corpo grande demais" }));
      }
    });
    req.on("end", () => {
      if (big) return resolve(BODY_TOO_BIG);
      try { resolve(JSON.parse(body || "{}")); } catch { resolve(BODY_INVALID); }
    });
  });
}

// Estado dos apps precisa parecer instantâneo na tela 2. O lsappinfo tem cache
// próprio de 1,5 s em apps.js, então este intervalo não cria um fork por frame.
const STATUS_POLL_MS = 1500;

/**
 * Descoberta automática de servidor (UDP broadcast) — o APK Android manda
 * "dokke:discover" em 255.255.255.255 e o servidor responde com seu IP:porta.
 * Assim o device acha o Mac mesmo quando o DHCP troca o IP (queda de luz,
 * reinício de roteador). Zero deps — dgram é builtin do Node.
 */
const DISCOVERY_PORT = 3001;
export const DISCOVERY_MAGIC = "dokke:discover";

function ipv4ToInt(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inSubnet(ip, addr, mask) {
  const a = ipv4ToInt(ip), b = ipv4ToInt(addr), m = ipv4ToInt(mask);
  if (a == null || b == null || m == null) return false;
  return (a & m) === (b & m);
}

/** IP da interface que está na mesma rede do cliente (Wi-Fi, Ethernet, Tailscale…). */
function localIpFor(peerIp) {
  for (const infos of Object.values(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      if (inSubnet(peerIp, info.address, info.netmask)) return info.address;
    }
  }
  // fallback: primeira IPv4 não-interna (cobre 127.0.0.1 em testes)
  for (const infos of Object.values(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === "IPv4" && !info.internal) return info.address;
    }
  }
  return null;
}

/** Sobe o listener UDP que responde "dokke:<ip>:<porta>" pra quem perguntar. */
export function startDiscovery(port = DISCOVERY_PORT, { portHint = 3000, log = console.log } = {}) {
  const sock = createSocket("udp4");
  sock.on("message", (msg, rinfo) => {
    if (msg.toString("utf8").trim() !== DISCOVERY_MAGIC) return;
    const ip = localIpFor(rinfo.address);
    if (!ip) return;
    const reply = `dokke:${ip}:${portHint}`;
    sock.send(reply, rinfo.port, rinfo.address);
    log(`[discover] ${rinfo.address}:${rinfo.port} → ${reply}`);
  });
  sock.on("error", e => log(`[discover] erro: ${e.message}`));
  sock.bind(port, () => { sock.setBroadcast(true); });
  return sock;
}

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
    let cfg = normalizeConfig({});
    try { cfg = await readConfig(); } catch (e) {}
    cfg = normalizeConfig(cfg);
    let running = [];
    try { running = await listProcesses(); } catch (e) {}
    if (!Array.isArray(running)) running = [];
    const payload = {
      type: "apps",
      pieces: cfg.pieces,
      revision: cfg.revision,
      pinned: cfg.pinned,
      running,
      devices: clients.size,
      ...(version ? { v: version() } : {}),
      limits: pinnedLimits(),
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
    actions = { activateApp, openWebsite },
    obs = null,
    iconService = realIconService(),
    onStatusChange = null,
    getDeviceCount = null,
  } = deps;
  const configFile = deps.configFile ?? (deps.config === undefined ? join(import.meta.dirname, "config.json") : null);
  const readConfig = async () => {
    if (configFile) return loadConfig(configFile);
    return normalizeConfig(deps.config || {});
  };
  const appVersion = deps.version || (() => uiVersion(root));
  const persistConfig = async cfg => {
    const safe = normalizeConfig(cfg);
    if (configFile) await saveConfig(configFile, safe);
    else if (deps.config) Object.assign(deps.config, safe);
    return safe;
  };
  // serializa load→mutate→persist das mutações de pinned: POSTs concorrentes
  // não perdem update nem colidem no arquivo de config
  let configQueue = Promise.resolve();
  const withConfigLock = fn => {
    const run = configQueue.then(fn);
    configQueue = run.catch(() => {});
    return run;
  };
  const handler = (req, res) => {
    const url = new URL(req.url, "http://x");
    const ok = body => { res.writeHead(200, JSON_HEADERS); res.end(JSON.stringify(body)); };
    if (STATE_CHANGING_METHODS.has(req.method) && !sameOrigin(req)) {
      res.writeHead(403, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: "Origin não permitido" }));
      return;
    }
    // config que o cliente pode ver — nunca vaza o pin (só o dono lê via /api/pin)
    const publicCfg = cfg => {
      const safe = normalizeConfig(cfg);
      return {
        schemaVersion: safe.schemaVersion,
        revision: safe.revision,
        pieces: safe.pieces,
        pinned: safe.pinned,
        limits: pinnedLimits(),
      };
    };
    const respondError = (status, body) => {
      res.writeHead(status, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, ...body }));
    };
    const rejectRevision = cfg => respondError(409, {
      code: "REVISION_CONFLICT",
      error: "a configuração mudou; recarregue e tente novamente",
      config: publicCfg(cfg),
    });
    const rejectMixedLegacy = cfg => respondError(409, {
      code: "MIXED_PIECES_REQUIRES_NEW_CLIENT",
      error: "essa configuração mista exige um cliente atualizado",
      config: publicCfg(cfg),
    });
    const isSameOrder = (left, right) => left.length === right.length && left.every((id, i) => id === right[i]);
    const configHasWebsites = cfg => cfg.pieces.some(piece => piece.type === "website");
    const piecesResponse = (cfg, piece = null, added = undefined) => ({
      ok: true,
      ...(piece ? { piece } : {}),
      ...(added === undefined ? {} : { added }),
      config: publicCfg(cfg),
    });
    const rejectPinnedLimit = () => {
      respondError(409, {
        code: PINNED_LIMIT_CODE,
        error: PINNED_LIMIT_MESSAGE,
        limits: pinnedLimits(),
      });
    };
    const readPiecePosition = body => {
      if (body?.position === undefined) return { ok: true, position: null };
      if (!Number.isInteger(body.position) || body.position < 0 || body.position >= MAX_DOCK_SLOTS) {
        return { ok: false };
      }
      return { ok: true, position: body.position };
    };
    if (url.pathname === "/health") { res.writeHead(200, JSON_HEADERS); res.end(JSON.stringify({ ok: true, service: "Dokke" })); return; }
    if (url.pathname === "/api/probe") {
      const flags = Object.fromEntries(url.searchParams);
      console.log("[probe]", JSON.stringify({ ua: req.headers["user-agent"], ...flags }));
      res.writeHead(204); res.end(); return;
    }
    if (url.pathname === "/api/version" && req.method === "GET") {
      // versão local (embutida no server) + versão publicada no GitHub — info pública
      let local = { tag: "v0.0.0", apkVersion: "0.0.0" };
      try {
        const raw = readFileSync(join(root, "version.json"), "utf8");
        local = JSON.parse(raw);
      } catch {}
      ok({ ok: true, local, latest: latestVersionSnapshot() });
      return;
    }
    // ---------- auth: pin de 4 dígitos (gate do kiosk da LAN) ----------
    // cookie carrega token de sessão opaco — o PIN nunca trafega de volta
    const trustLoopback = deps.trustLoopback !== false;
    const auth = deps.auth;
    const ipOf = req.socket.remoteAddress || "?";
    const authed = () =>
      (trustLoopback && isLoopback(ipOf)) ||
      (!!auth && typeof auth.checkSession === "function" && auth.checkSession(tokenFromCookie(req.headers.cookie)));
    if (auth && url.pathname === "/api/auth" && req.method === "POST") {
      readBody(req, res).then(body => {
        if (body === BODY_TOO_BIG || body === BODY_INVALID) {
          res.writeHead(400, JSON_HEADERS);
          res.end(JSON.stringify({ ok: false, error: "corpo inválido" }));
          return;
        }
        const given = typeof body?.pin === "string" ? body.pin.trim() : "";
        if (given === "") {
          res.writeHead(400, JSON_HEADERS);
          res.end(JSON.stringify({ ok: false, error: "código vazio" }));
          return;
        }
        if (pinLocks.isLocked(ipOf)) {
          res.writeHead(429, JSON_HEADERS);
          res.end(JSON.stringify({ ok: false, error: "muitas tentativas — aguarde" }));
          return;
        }
        if (safeEqual(given, auth.getPin())) {
          pinLocks.reset(ipOf);
          Promise.resolve()
            .then(() => auth.issueSession())
            .then(token => {
              res.writeHead(200, {
                "Content-Type": "application/json",
                // dois Set-Cookie: sessão nova + apaga legado que carregava o PIN
                "Set-Cookie": [
                  sessionCookie(token, { secure: Boolean(req.socket.encrypted) }),
                  clearLegacyPinCookie(),
                ],
                ...SEC_HEADERS,
              });
              res.end(JSON.stringify({ ok: true }));
            })
            .catch(err => fail(res, err));
          return;
        }
        pinLocks.register(ipOf);
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error: "código inválido" }));
      });
      return;
    }
    if (auth && url.pathname === "/api/pin") {
      // só o dono (loopback) lê/regenera — atacante na LAN não descobre o pin
      if (!isLoopback(ipOf)) {
        res.writeHead(403, JSON_HEADERS);
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
      res.writeHead(401, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: "acesso negado" }));
      return;
    }
    if (url.pathname === "/api/apps") {
      Promise.resolve()
        .then(() => readConfig())
        .then(cfg => appTools.listAppProcesses()
          .then(running => ok({ pieces: cfg.pieces, revision: cfg.revision, pinned: cfg.pinned, running, v: appVersion(), limits: pinnedLimits() }))
          .catch(() => ok({ pieces: cfg.pieces, revision: cfg.revision, pinned: cfg.pinned, running: [], v: appVersion(), limits: pinnedLimits() })))
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
          res.writeHead(400, JSON_HEADERS);
          res.end(JSON.stringify({ ok: false, error: "corpo inválido" }));
          return;
        }
        if (req.method === "PUT") {
          const list = body?.apps ?? body?.pinned;
          if (!Array.isArray(list)) {
            res.writeHead(400, JSON_HEADERS);
            res.end(JSON.stringify({ ok: false, error: "apps deve ser array" }));
            return;
          }
          const pinned = normalizePinned(list);
          if (pinned.length > MAX_PINNED_APPS) {
            rejectPinnedLimit();
            return;
          }
          withConfigLock(() => Promise.resolve()
            .then(() => readConfig())
            .then(cfg => {
              if (configHasWebsites(cfg)) {
                rejectMixedLegacy(cfg);
                return null;
              }
              const nextPieces = materializePiecePositions(pinned.map(name => ({ id: `app:${name}`, type: "app", name })));
              const changed = !isSameOrder(cfg.pieces.map(piece => piece.id), nextPieces.map(piece => piece.id));
              if (changed) {
                cfg.pieces = nextPieces;
                cfg.revision += 1;
              }
              return persistConfig(cfg).then(next => ({ cfg: next, changed }));
            })
            .then(result => {
              if (!result) return;
              ok({ ok: true, config: publicCfg(result.cfg), pushed: true });
              if (result.changed && onStatusChange) onStatusChange();
            })
            .catch(err => fail(res, err)));
          return;
        }
        const app = typeof body?.app === "string" ? body.app.trim() : "";
        if (app === "") {
          res.writeHead(400, JSON_HEADERS);
          res.end(JSON.stringify({ ok: false, error: "app inválido" }));
          return;
        }
        const positionResult = readPiecePosition(body);
        if (!positionResult.ok) {
          respondError(400, { code: "INVALID_PIECE_POSITION", error: "posição inválida" });
          return;
        }
        withConfigLock(() => Promise.resolve()
          .then(() => readConfig())
          .then(cfg => {
            const existing = cfg.pieces.find(piece => piece.type === "app" && piece.name === app);
            if (!existing) {
              if (cfg.pieces.length >= MAX_PINNED_PIECES) {
                const err = new Error(PINNED_LIMIT_MESSAGE);
                err.code = PINNED_LIMIT_CODE;
                throw err;
              }
              cfg.pieces = materializePiecePositions(cfg.pieces);
              const position = positionResult.position ?? firstAvailablePiecePosition(cfg.pieces);
              if (position === null || cfg.pieces.some(piece => piece.position === position)) {
                const err = new Error("posição do dock já está ocupada");
                err.code = "PIECE_SLOT_OCCUPIED";
                throw err;
              }
              cfg.pieces.push({ id: `app:${app}`, type: "app", name: app, position });
              cfg.revision += 1;
            }
            return persistConfig(cfg).then(next => ({ cfg: next, changed: !existing }));
          })
          .then(result => {
            ok({ ok: true, config: publicCfg(result.cfg), pushed: true });
            if (result.changed && onStatusChange) onStatusChange();
          })
          .catch(err => {
            if (err?.code === PINNED_LIMIT_CODE) rejectPinnedLimit();
            else if (err?.code === "PIECE_SLOT_OCCUPIED") respondError(409, { code: err.code, error: err.message });
            else fail(res, err);
          }));
      });
      return;
    }
    const unpin = url.pathname.match(/^\/api\/config\/pinned\/([^/]+)$/);
    if (unpin && req.method === "DELETE") {
      let app;
      try { app = decodeURIComponent(unpin[1]); }
      catch {
        res.writeHead(400, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error: "nome inválido" }));
        return;
      }
      app = typeof app === "string" ? app.trim() : "";
      withConfigLock(() => Promise.resolve()
        .then(() => readConfig())
        .then(cfg => {
          const pieces = materializePiecePositions(cfg.pieces)
            .filter(piece => !(piece.type === "app" && piece.name === app));
          const changed = pieces.length !== cfg.pieces.length;
          if (changed) {
            cfg.pieces = pieces;
            cfg.revision += 1;
          }
          return persistConfig(cfg).then(next => ({ cfg: next, changed }));
        })
        .then(result => {
          ok({ ok: true, config: publicCfg(result.cfg), pushed: true });
          if (result.changed && onStatusChange) onStatusChange();
        })
        .catch(err => fail(res, err)));
      return;
    }
    if (url.pathname === "/api/config/pieces" && req.method === "POST") {
      readBody(req, res).then(body => {
        if (body === BODY_TOO_BIG) return;
        if (body === BODY_INVALID || body?.type !== "website") {
          respondError(400, { code: "INVALID_WEBSITE", error: "peça de site inválida" });
          return;
        }
        let piece;
        try { piece = createWebsitePiece(body.title, body.url); }
        catch (err) {
          respondError(400, { code: "INVALID_WEBSITE", error: err?.message || "URL inválida" });
          return;
        }
        const positionResult = readPiecePosition(body);
        if (!positionResult.ok) {
          respondError(400, { code: "INVALID_PIECE_POSITION", error: "posição inválida" });
          return;
        }
        withConfigLock(() => Promise.resolve()
          .then(() => readConfig())
          .then(cfg => {
            const existing = cfg.pieces.find(current => current.id === piece.id);
            if (existing) return { cfg, piece: existing, added: false };
            if (cfg.pieces.length >= MAX_PINNED_PIECES) {
              const err = new Error(PINNED_LIMIT_MESSAGE);
              err.code = PINNED_LIMIT_CODE;
              throw err;
            }
            cfg.pieces = materializePiecePositions(cfg.pieces);
            const position = positionResult.position ?? firstAvailablePiecePosition(cfg.pieces);
            if (position === null || cfg.pieces.some(current => current.position === position)) {
              const err = new Error("posição do dock já está ocupada");
              err.code = "PIECE_SLOT_OCCUPIED";
              throw err;
            }
            piece = { ...piece, position };
            cfg.pieces.push(piece);
            cfg.revision += 1;
            return persistConfig(cfg).then(next => ({ cfg: next, piece, added: true }));
          })
          .then(result => {
            ok(piecesResponse(result.cfg, result.piece, result.added));
            if (result.added && onStatusChange) onStatusChange();
          })
          .catch(err => {
            if (err?.code === PINNED_LIMIT_CODE) rejectPinnedLimit();
            else if (err?.code === "PIECE_SLOT_OCCUPIED") respondError(409, { code: err.code, error: err.message });
            else fail(res, err);
          }));
      });
      return;
    }
    if (url.pathname === "/api/config/pieces/order" && req.method === "PUT") {
      readBody(req, res).then(body => {
        if (body === BODY_TOO_BIG) return;
        if (body === BODY_INVALID || !Number.isInteger(body?.revision) || !Array.isArray(body?.ids)) {
          respondError(400, { code: "INVALID_REQUEST", error: "revisão e ids são obrigatórios" });
          return;
        }
        withConfigLock(() => Promise.resolve()
          .then(() => readConfig())
          .then(cfg => {
            if (body.revision !== cfg.revision) {
              rejectRevision(cfg);
              return null;
            }
            cfg.pieces = materializePiecePositions(cfg.pieces);
            const ids = body.ids;
            const currentIds = cfg.pieces.map(piece => piece.id);
            const unique = new Set(ids);
            if (ids.length !== currentIds.length || unique.size !== ids.length || ids.some(id => !unique.has(id)) ||
                currentIds.some(id => !unique.has(id))) {
              respondError(400, { code: "INVALID_REQUEST", error: "ids não correspondem às peças atuais" });
              return null;
            }
            const requestedPositions = body.positions;
            if (requestedPositions !== undefined &&
                (!requestedPositions || typeof requestedPositions !== "object" || Array.isArray(requestedPositions))) {
              respondError(400, { code: "INVALID_REQUEST", error: "positions devem ser um objeto de posições por ID" });
              return null;
            }
            if (requestedPositions !== undefined) {
              const entries = Object.entries(requestedPositions);
              const values = entries.map(([, position]) => position);
              const positionIds = new Set(entries.map(([id]) => id));
              if (entries.length !== currentIds.length || positionIds.size !== entries.length ||
                  currentIds.some(id => !positionIds.has(id)) ||
                  values.some(position => !Number.isInteger(position) || position < 0 || position >= MAX_DOCK_SLOTS) ||
                  new Set(values).size !== values.length) {
                respondError(400, { code: "INVALID_REQUEST", error: "positions não correspondem às peças atuais" });
                return null;
              }
              if (cfg.pieces.some(piece => piece.position !== requestedPositions[piece.id])) {
                cfg.pieces = cfg.pieces
                  .map(piece => ({ ...piece, position: requestedPositions[piece.id] }))
                  .sort((a, b) => a.position - b.position);
                cfg.revision += 1;
              }
            } else if (!isSameOrder(currentIds, ids)) {
              const byId = new Map(cfg.pieces.map(piece => [piece.id, piece]));
              const positions = cfg.pieces.map(piece => piece.position);
              cfg.pieces = ids.map((id, index) => ({ ...byId.get(id), position: positions[index] }));
              cfg.revision += 1;
            }
            return persistConfig(cfg);
          })
          .then(cfg => { if (cfg) { ok({ ok: true, config: publicCfg(cfg) }); if (onStatusChange) onStatusChange(); } })
          .catch(err => fail(res, err)));
      });
      return;
    }
    const pieceDelete = url.pathname.match(/^\/api\/config\/pieces\/([^/]+)$/);
    if (pieceDelete && req.method === "DELETE") {
      let id;
      try { id = decodeURIComponent(pieceDelete[1]); }
      catch { respondError(400, { error: "ID inválido" }); return; }
      readBody(req, res).then(body => {
        if (body === BODY_TOO_BIG) return;
        if (body === BODY_INVALID || !Number.isInteger(body?.revision)) {
          respondError(400, { code: "INVALID_REQUEST", error: "revisão é obrigatória" });
          return;
        }
        withConfigLock(() => Promise.resolve()
          .then(() => readConfig())
          .then(cfg => {
            if (body.revision !== cfg.revision) { rejectRevision(cfg); return null; }
            cfg.pieces = materializePiecePositions(cfg.pieces);
            const index = cfg.pieces.findIndex(piece => piece.id === id);
            if (index < 0) { respondError(404, { code: "PIECE_NOT_FOUND", error: "peça não encontrada" }); return null; }
            cfg.pieces.splice(index, 1);
            cfg.revision += 1;
            return persistConfig(cfg);
          })
          .then(cfg => { if (cfg) { ok({ ok: true, config: publicCfg(cfg) }); if (onStatusChange) onStatusChange(); } })
          .catch(err => fail(res, err)));
      });
      return;
    }
    const pieceOpen = url.pathname.match(/^\/api\/pieces\/([^/]+)\/open$/);
    if (pieceOpen && req.method === "POST") {
      let id;
      try { id = decodeURIComponent(pieceOpen[1]); }
      catch { respondError(400, { error: "ID inválido" }); return; }
      // Consome o corpo para manter o mesmo limite dos demais POSTs. O
      // conteúdo é deliberadamente ignorado: a URL vem somente da peça
      // persistida no Mac, nunca do cliente remoto.
      readBody(req, res).then(body => {
        if (body === BODY_TOO_BIG) return;
        Promise.resolve()
          .then(() => readConfig())
          .then(cfg => {
            const piece = cfg.pieces.find(current => current.id === id);
            if (!piece) {
              respondError(404, { code: "PIECE_NOT_FOUND", error: "peça não encontrada" });
              return null;
            }
            if (piece.type !== "website") {
              respondError(409, { code: "PIECE_NOT_WEBSITE", error: "a peça não é um site" });
              return null;
            }
            let safe;
            try { safe = createWebsitePiece(piece.title, piece.url); }
            catch (err) { respondError(409, { code: "INVALID_WEBSITE", error: "site inválido" }); return null; }
            return Promise.resolve().then(() => actions.openWebsite(safe.url))
              .then(() => ok({ ok: true, piece: safe }));
          })
          .catch(err => fail(res, err));
      });
      return;
    }
    // Status p/ app Mac: quantos devices escutam o WS + health
    if (url.pathname === "/api/status" && req.method === "GET") {
      Promise.resolve()
        .then(() => readConfig())
        .then(cfg => ok({
          ok: true,
          service: "Dokke",
          devices: typeof getDeviceCount === "function" ? getDeviceCount() : 0,
          pinned: cfg.pinned.length,
          config: {
            schemaVersion: cfg.schemaVersion,
            revision: cfg.revision,
            pieces: cfg.pieces,
            pinned: cfg.pinned,
            limits: pinnedLimits(),
          },
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
        res.writeHead(400, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error: "nome inválido" }));
        return;
      }
      if (req.method === "POST") {
        readBody(req, res).then(body => {
          if (body === BODY_TOO_BIG) return;
          if (body === BODY_INVALID) {
            res.writeHead(400, JSON_HEADERS);
            res.end(JSON.stringify({ ok: false, error: "corpo inválido" }));
            return;
          }
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
        res.writeHead(400, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error: "nome inválido" }));
        return;
      }
      Promise.resolve()
        .then(() => iconService.getIconPng(name))
        .then(buf => {
          if (!buf) {
            res.writeHead(404, JSON_HEADERS);
            res.end(JSON.stringify({ ok: false, error: "app não encontrado" }));
            return;
          }
          res.writeHead(200, {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
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
          res.writeHead(400, JSON_HEADERS);
          res.end(JSON.stringify({ ok: false, error: "corpo inválido" }));
          return;
        }
        if (!(typeof body?.scene === "string" && body.scene.trim() !== "")) {
          res.writeHead(400, JSON_HEADERS);
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
      res.writeHead(403, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: "acesso negado" }));
      return;
    }
    const isUi = url.pathname === "/" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/sw.js");
    readFile(p).then(b => {
      res.writeHead(200, {
        "Content-Type": `${MIME[extname(p)] || "text/plain"}; charset=utf-8`,
        "Cache-Control": isUi ? "no-cache, no-store, must-revalidate" : "public, max-age=86400",
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
  const port = opts.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  const requestedHeartbeat = Number(opts.wsHeartbeatMs);
  const wsHeartbeatMs = Number.isFinite(requestedHeartbeat) && requestedHeartbeat >= 10
    ? requestedHeartbeat
    : WS_HEARTBEAT_MS;
  if (opts.obs === undefined) {
    opts.obs = await connectOBS({
      password: process.env.OBS_WS_PASSWORD,
      host: process.env.OBS_WS_HOST,
      port: process.env.OBS_WS_PORT && Number(process.env.OBS_WS_PORT),
    });
  }
  const configProvided = opts.config !== undefined;
  // pasta de dados do usuário (sobrevive a reinstalação) — config + pin ficam aqui
  function userDataDir() {
    const home = process.env.HOME || process.env.USERPROFILE || ".";
    if (process.platform === "win32") return join(process.env.APPDATA || home, "Dokke");
    if (process.platform === "darwin") return join(home, "Library", "Application Support", "Dokke");
    return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "dokke");
  }
  const dataDir = userDataDir();
  try { mkdirSync(dataDir, { recursive: true }); } catch (e) {}
  const userConfig = join(dataDir, "config.json");
  // migração: versões antigas guardavam config dentro do bundle — se o destino
  // não existe mas o bundle tem dados, copia antes de começar (nunca sobrescreve)
  if (!existsSync(userConfig)) {
    try {
      const seed = JSON.parse(readFileSync(join(import.meta.dirname, "config.json"), "utf8"));
      if (seed && typeof seed === "object" && Object.keys(seed).length > 0) {
        writeFileSync(userConfig, JSON.stringify(seed, null, 2));
      }
    } catch {}
  }
  const configFile = configProvided ? null : (opts.configFile ?? userConfig);
  // pin de acesso (4 dígitos): fixo em .j5-pin, só regenera via POST /api/pin
  const pinRoot = opts.root ?? dataDir;
  if (!existsSync(join(pinRoot, ".j5-pin"))) {
    try {
      const legacy = join(import.meta.dirname, ".j5-pin");
      if (existsSync(legacy)) copyFileSync(legacy, join(pinRoot, ".j5-pin"));
    } catch {}
  }
  let currentPin = await ensurePin(pinRoot);
  // sessões persistem no dataDir: reinício não desloga os kiosks
  const sessionStore = opts.sessionStore ?? createSessionStore({ file: join(dataDir, "j5-sessions.json") });
  opts.auth = {
    getPin: () => currentPin,
    setPin: async (p) => {
      currentPin = p;
      await writePinFile(p, pinRoot);
      // pin novo = pareamento novo: nenhuma sessão antiga sobrevive
      await sessionStore.revokeAll();
    },
    issueSession: () => sessionStore.issue(),
    checkSession: (t) => sessionStore.check(t),
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
    configFile: configFile ?? undefined,
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
      if (!sameOrigin(info.req)) return false;
      if (opts.trustLoopback && isLoopback(info.req.socket.remoteAddress)) return true;
      return !!opts.auth?.checkSession?.(tokenFromCookie(info.req.headers.cookie));
    },
  });
  // Mantém os dois EventEmitters protegidos também depois do startup. Sem estes
  // listeners, um erro encaminhado pelo ws pode terminar o processo Node.
  server.on("error", error => console.error("[dokke] HTTP error:", error?.message ?? error));
  wss.on("error", error => console.error("[dokke] WebSocket error:", error?.message ?? error));
  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    let lastPingAt = 0;
    ws.on("message", (raw) => {
      let m = null;
      try { m = JSON.parse(raw.toString("utf8")); } catch (e) {}
      // o feed já empurra sozinho a cada STATUS_POLL_MS; ping de client só
      // adianta o push se respeitar o intervalo mínimo (anti-amplificação)
      if (m && m.type === "ping") {
        const now = Date.now();
        if (now - lastPingAt >= PING_MIN_INTERVAL_MS) {
          lastPingAt = now;
          feed.ping();
        }
      }
    });
    feed.addClient(ws);
  });
  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      if (ws.readyState === 1) {
        try { ws.ping(); } catch (e) {}
      }
    }
  }, wsHeartbeatMs);
  if (heartbeatTimer.unref) heartbeatTimer.unref();
  const stopHeartbeat = () => clearInterval(heartbeatTimer);
  await new Promise((res, rej) => {
    let settled = false;
    const cleanupStartupListeners = () => {
      server.off("error", rejectStartup);
      wss.off("error", rejectStartup);
    };
    const rejectStartup = error => {
      if (settled) return;
      settled = true;
      cleanupStartupListeners();
      stopHeartbeat();
      try { wss.close(); } catch {}
      rej(error);
    };
    const resolveStartup = () => {
      if (settled) return;
      settled = true;
      cleanupStartupListeners();
      res();
    };
    // Registra os dois listeners antes do bind: ws encaminha falhas do servidor
    // HTTP, portanto ambos precisam rejeitar a mesma promessa de inicialização.
    server.once("error", rejectStartup);
    wss.once("error", rejectStartup);
    server.listen(port, resolveStartup);
  });
  let closed = false;
  const close = () => new Promise((resolve, reject) => {
    if (closed) return resolve();
    if (!server.listening) {
      closed = true;
      stopHeartbeat();
      feed.close();
      try { wss.close(); } catch (e) {}
      return resolve();
    }
    closed = true;
    stopHeartbeat();
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
    .then(({ port }) => {
      console.log(`Dokke ouvindo em http://127.0.0.1:${port}`);
      // responder descoberta UDP pra devices Android acharem o IP sozinhos
      startDiscovery(DISCOVERY_PORT, { portHint: port }).unref();
    })
    .catch(err => { console.error(err); process.exitCode = 1; });
}
