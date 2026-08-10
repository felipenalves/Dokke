import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";
import { isLoopback, newPin, pinFromCookie, pinCookie, AUTH_COOKIE, ensurePin, writePinFile, readPinFile, pinFilePath } from "../auth.js";
import { mkdtemp, rm } from "node:fs/promises";
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

test("unit: cookie roundtrip", () => {
  const h = pinCookie("9876");
  assert.equal(pinFromCookie(h), "9876");
  assert.equal(pinFromCookie("other=1; " + h), "9876");
  assert.equal(pinFromCookie("j5_pin="), null);
  assert.equal(pinFromCookie(null), null);
});

test("unit: ensurePin + writePinFile / readPinFile", async () => {
  const root = await mkdtemp(join(tmpdir(), "j5pin-"));
  try {
    const p1 = await ensurePin(root);
    assert.match(p1, /^\d{4}$/);
    const read = await readPinFile(root);
    assert.equal(read, p1);
    const p2 = await ensurePin(root);
    assert.equal(p2, p1); // não regenera
    await writePinFile("9999", root);
    assert.equal(await readPinFile(root), "9999");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
    const r = await fetch(`http://127.0.0.1:${port}/api/apps`, { headers: { Cookie: `${AUTH_COOKIE}=9999` } });
    assert.equal(r.status, 401);
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
    assert.ok(sc.includes(`${AUTH_COOKIE}=${realPin}`), `cookie errado: ${sc}`);

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

test("POST /api/pin regenera e invalida cookie antigo", async () => {
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

    // cookie antigo agora é inválido
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

test("WS rejeita sem cookie (LAN) e aceita com cookie", async () => {
  const { port, close, root } = await boot({ appTools: { listAppProcesses: async () => [] } });
  try {
    const denied = await new Promise(res => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      ws.once("error", () => res("denied"));
      ws.once("close", (code) => res(code !== 1000 ? "denied" : "open"));
      ws.once("open", () => res("open"));
    });
    assert.equal(denied, "denied");

    const realPin = await readPinFile(root);
    const cookie = pinCookie(realPin);
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