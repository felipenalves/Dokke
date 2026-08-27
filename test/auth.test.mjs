import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";
import { isLoopback, newPin, pinFromCookie, AUTH_COOKIE, ensurePin, writePinFile, readPinFile, pinFilePath, SESSION_COOKIE, sessionCookie, tokenFromCookie, createSessionStore, createPinLocks } from "../auth.js";
import { chmod, mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import WebSocket from "ws";

const PIN = "4321";

// trustLoopback:false simula um cliente da LAN — todo /api/* exige cookie
// root: tmp dir para .j5-pin (não polui o repo real)
async function boot(opts = {}) {
  const root = await mkdtemp(join(tmpdir(), "j5auth-"));
  const server = await startServer({
    port: 0,
    root,
    config: { pinned: [] },
    trustLoopback: false,
    ...opts,
  });
  return { ...server, root };
}

test("unit: isLoopback", () => {
  assert.equal(isLoopback("127.0.0.1"), true);
  assert.equal(isLoopback("::1"), true);
  assert.equal(isLoopback("::ffff:127.0.0.1"), true);
  assert.equal(isLoopback("192.168.1.50"), false);
  assert.equal(isLoopback(null), false);
});

test("unit: newPin gera 4 dígitos", () => {
  assert.match(newPin(), /^\d{4}$/);
});

test("unit: cookie roundtrip (sessão e pin legado)", () => {
  const h = sessionCookie("tok-abc");
  assert.equal(tokenFromCookie(h), "tok-abc");
  assert.equal(pinFromCookie("other=1; j5_pin=9876"), "9876");
  assert.equal(pinFromCookie("j5_pin="), null);
  assert.equal(pinFromCookie(null), null);
  assert.match(h, /SameSite=Strict/);
  assert.doesNotMatch(h, /(?:^|; )Secure(?:;|$)/);
  assert.match(sessionCookie("tok-abc", { secure: true }), /(?:^|; )Secure(?:;|$)/);
  // parser da sessão: fronteira obrigatória (início ou ";"), valor sem ; ou espaço
  assert.equal(tokenFromCookie(`a=1; ${SESSION_COOKIE}=t2`), "t2");
  assert.equal(tokenFromCookie(`x${SESSION_COOKIE}=t3`), null);
  assert.equal(tokenFromCookie(null), null);
});

test("unit: createPinLocks — lock após max falhas, reset no acerto, poda de expirados", () => {
  const t0 = 1_000_000;
  let now = t0;
  const locks = createPinLocks({ maxFails: 3, lockMs: 60_000, now: () => now });
  locks.register("10.0.0.1"); locks.register("10.0.0.1");
  assert.equal(locks.isLocked("10.0.0.1"), false);
  locks.register("10.0.0.1");
  assert.equal(locks.isLocked("10.0.0.1"), true); // 3ª falha → locked
  locks.reset("10.0.0.1");
  assert.equal(locks.isLocked("10.0.0.1"), false);

  for (let i = 0; i < 3; i++) locks.register("10.0.0.2");
  now += 120_000; // lock venceu
  assert.equal(locks.isLocked("10.0.0.2"), false);
  locks.prune(now + 1); // entrada expirada deve sair do mapa
  locks.register("10.0.0.9"); // força varredura
  assert.equal(locks.size(), 1, "entrada velha podada, só a nova fica");
});

test("unit: createSessionStore — emite, valida, persiste, revoga tudo e respeita TTL/cap", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5sess-"));
  const file = join(dir, "sessions.json");
  let now = 50_000;
  try {
    const store = createSessionStore({ file, ttlMs: 1000, now: () => now, maxSessions: 2 });
    const a = await store.issue();
    assert.ok(a && a.length >= 32, "token com entropia decente");
    assert.equal(store.check(a), true);

    await store.issue(); await store.issue(); // 3 tokens com cap 2
    assert.equal(store.check(a), false, "token mais antigo evictado pelo cap");

    const b = await store.issue();
    // persistiu no arquivo: nova instância (reinício do server) ainda valida
    const reopened = createSessionStore({ file, ttlMs: 1000, now: () => now, maxSessions: 2 });
    assert.equal(reopened.check(b), true, "sessão sobrevive a reinício");

    now += 1001; // TTL venceu
    assert.equal(reopened.check(b), false, "token expirado é rejeitado");

    const c = await store.issue();
    await reopened.revokeAll(); // rotação de pin invalida todas as sessões
    assert.equal(reopened.check(c), false, "revokeAll mata sessões vivas");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("unit: ensurePin + writePinFile / readPinFile", async () => {
  const root = await mkdtemp(join(tmpdir(), "j5pin-"));
  try {
    const p1 = await ensurePin(root);
    assert.match(p1, /^\d{4}$/);
    const read = await readPinFile(root);
    assert.equal(read, p1);
    assert.equal((await stat(pinFilePath(root))).mode & 0o777, 0o600);
    await chmod(pinFilePath(root), 0o644);
    const p2 = await ensurePin(root);
    assert.equal(p2, p1); // não regenera
    assert.equal((await stat(pinFilePath(root))).mode & 0o777, 0o600);
    await writePinFile("9999", root);
    assert.equal(await readPinFile(root), "9999");
    assert.equal((await stat(pinFilePath(root))).mode & 0o777, 0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Origin cross-origin bloqueia mutações HTTP, mas a mesma origem e clientes sem Origin passam", async () => {
  const { port, close, root } = await boot();
  const base = `http://127.0.0.1:${port}`;
  try {
    const realPin = await readPinFile(root);
    const deniedLogin = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ pin: realPin }),
    });
    assert.equal(deniedLogin.status, 403);

    const login = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ pin: realPin }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie");
    assert.match(cookie || "", /SameSite=Strict/);
    assert.doesNotMatch(cookie || "", /(?:^|; )Secure(?:;|$)/);

    const deniedMutation = await fetch(`${base}/api/config/pinned`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://evil.example" },
      body: JSON.stringify({ app: "blocked" }),
    });
    assert.equal(deniedMutation.status, 403);

    const allowedMutation = await fetch(`${base}/api/config/pinned`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: base },
      body: JSON.stringify({ app: "allowed" }),
    });
    assert.equal(allowedMutation.status, 200);
    assert.deepEqual((await allowedMutation.json()).config.pinned, ["allowed"]);
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});

test("GET /api/apps sem cookie (LAN) → 401", async () => {
  const { port, close, root } = await boot();
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/apps`);
    assert.equal(r.status, 401);
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});

test("cookie errado → 401; /health e /api/auth seguem públicos", async () => {
  const { port, close, root } = await boot();
  try {
    const realPin = await readPinFile(root);
    const r = await fetch(`http://127.0.0.1:${port}/api/apps`, { headers: { Cookie: `${SESSION_COOKIE}=9999` } });
    assert.equal(r.status, 401);
    // PIN cru no cookie antigo NÃO autentica mais (A7)
    const legacy = await fetch(`http://127.0.0.1:${port}/api/apps`, { headers: { Cookie: `${AUTH_COOKIE}=${realPin}` } });
    assert.equal(legacy.status, 401, "cookie com pin bruto deve ser rejeitado");
    const h = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(h.status, 200);
    const a = await fetch(`http://127.0.0.1:${port}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: realPin }),
    });
    assert.equal(a.status, 200);
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});

test("login correto → Set-Cookie → acesso liberado, pin não vaza em /api/config", async () => {
  const { port, close, root } = await boot();
  try {
    // pin real do servidor vem do .j5-pin (gerado no boot)
    const realPin = await readPinFile(root);
    assert.match(realPin, /^\d{4}$/);

    const a = await fetch(`http://127.0.0.1:${port}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: realPin }),
    });
    assert.equal(a.status, 200);
    const sc = a.headers.get("set-cookie") || "";
    assert.ok(sc.includes(`${SESSION_COOKIE}=`), `cookie de sessão ausente: ${sc}`);
    assert.doesNotMatch(sc, new RegExp(`${AUTH_COOKIE}=${realPin}`), "PIN cru não pode ir pro cookie");
    // cookie legado (instâncias antigas) precisa ser apagado no login
    assert.match(sc, new RegExp(`${AUTH_COOKIE}=;`), "cookie legado j5_pin deve ser invalidado");

    const apps = await fetch(`http://127.0.0.1:${port}/api/apps`, { headers: { cookie: sc } });
    assert.equal(apps.status, 200);
    const body = await apps.json();
    assert.ok(body.pinned !== undefined && body.running !== undefined);

    const cfg = await fetch(`http://127.0.0.1:${port}/api/config`, { headers: { cookie: sc } });
    const cbody = await cfg.json();
    assert.equal(cbody.config.pin, undefined); // pin nunca vaza pro cliente
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});

test("GET /api/pin só loopback (sem auth mesmo na LAN) → correto aqui", async () => {
  const { port, close, root } = await boot();
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/pin`);
    assert.equal(r.status, 200);
    const body = await r.json();
    const realPin = await readPinFile(root);
    assert.equal(body.pin, realPin);
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});

test("POST /api/pin regenera e invalida sessão antiga", async () => {
  const { port, close, root } = await boot();
  try {
    const oldPin = await readPinFile(root);

    const a = await fetch(`http://127.0.0.1:${port}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: oldPin }),
    });
    const sc = a.headers.get("set-cookie") || "";

    const r = await fetch(`http://127.0.0.1:${port}/api/pin`, { method: "POST" });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.match(body.pin, /^\d{4}$/);
    assert.notEqual(body.pin, oldPin);

    // sessão antiga agora é inválida
    const old = await fetch(`http://127.0.0.1:${port}/api/apps`, { headers: { cookie: sc } });
    assert.equal(old.status, 401);

    // novo pin funciona
    const nb = await fetch(`http://127.0.0.1:${port}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: body.pin }),
    });
    assert.equal(nb.status, 200);
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});

test("WS rejeita sem cookie, aceita com sessão e recusa pin cru no cookie", async () => {
  const { port, close, root } = await boot({ appTools: { listAppProcesses: async () => [] } });
  try {
    const denied = await new Promise(res => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      ws.once("error", () => res("denied"));
      ws.once("close", (code) => res(code !== 1000 ? "denied" : "open"));
      ws.once("open", () => res("open"));
    });
    assert.equal(denied, "denied");

    // login real → cookie de sessão
    const realPin = await readPinFile(root);
    const login = await fetch(`http://127.0.0.1:${port}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: realPin }),
    });
    const cookie = login.headers.get("set-cookie") || "";

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { cookie } });
    const online = await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout")), 3000);
      ws.on("message", (raw) => {
        let d = null;
        try { d = JSON.parse(String(raw)); } catch {}
        if (d && d.type === "online") { clearTimeout(t); res(d); }
      });
      ws.on("error", (e) => { clearTimeout(t); rej(e); });
    });
    assert.equal(online.online, true);
    ws.close();

    // pin bruto no cookie não abre WS mais
    const rawRejected = await new Promise(res => {
      const w2 = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { cookie: `${AUTH_COOKIE}=${realPin}` } });
      w2.once("error", () => res("denied"));
      w2.once("close", (code) => res(code !== 1000 ? "denied" : "open"));
      w2.once("open", () => res("open"));
    });
    assert.equal(rawRejected, "denied");
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});

// último: locka o 127.0.0.1 compartilhado por 60s — nada pode logar depois dele
test("5 falhas → lockout 60s (429), mesmo com pin certo", async () => {
  const { port, close, root } = await boot();
  try {
    const realPin = await readPinFile(root);
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`http://127.0.0.1:${port}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "0000" }),
      });
      assert.equal(r.status, 401);
    }
    const locked = await fetch(`http://127.0.0.1:${port}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: realPin }),
    });
    assert.equal(locked.status, 429);
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});
