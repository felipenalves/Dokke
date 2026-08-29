import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { startServer } from "../server.js";
import WebSocket from "ws";
import { pinnedLimits } from "../config.js";

const serverSource = await readFile(new URL("../server.js", import.meta.url), "utf8");

// Coletor persistente: um listener único acumula tudo (imune a ordem/rajada —
// o front real usa um ws.onmessage único, então também não tem esse problema).
function connect(port) {
  const q = [];
  const waits = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  ws.on("message", (raw) => {
    let d = null;
    try { d = JSON.parse(String(raw)); } catch { return; }
    if (!d) return;
    q.push(d);
    const done = [];
    for (const w of waits) {
      if (w.pred(d)) { clearTimeout(w.t); done.push(w); }
    }
    for (const w of done) {
      const i = waits.indexOf(w);
      if (i >= 0) waits.splice(i, 1);
      w.resolve(d);
    }
  });
  function waitFor(pred, ms = 2000) {
    const hit = q.filter(pred)[0];
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const w = {
        pred, resolve,
        t: setTimeout(() => {
          const i = waits.indexOf(w);
          if (i >= 0) waits.splice(i, 1);
          reject(new Error("timeout aguardando msg"));
        }, ms),
      };
      waits.push(w);
    });
  }
  return { ws, waitFor };
}

test("@spec:AC-336 HTTP e WebSocket registram erro antes de listen", () => {
  const startup = serverSource.slice(
    serverSource.indexOf("const server = makeServer()"),
    serverSource.indexOf("let closed = false"),
  );
  assert.match(startup, /const rejectStartup =/);
  assert.match(startup, /server\.once\("error", rejectStartup\)/);
  assert.match(startup, /wss\.once\("error", rejectStartup\)/);
  assert.match(startup, /wss\.on\("error",/);
  assert.ok(startup.indexOf('server.once("error", rejectStartup)') < startup.indexOf("server.listen("));
  assert.ok(startup.indexOf('wss.once("error", rejectStartup)') < startup.indexOf("server.listen("));
});

test("@spec:AC-337 bind ocupado rejeita uma tentativa sem derrubar o host existente", async () => {
  const occupied = createServer((req, res) => res.end("occupied"));
  await new Promise((resolve, reject) => {
    occupied.once("error", reject);
    occupied.listen(0, resolve);
  });
  const port = occupied.address().port;
  try {
    await assert.rejects(
      startServer({ port, config: { pinned: [] } }),
      error => error?.code === "EADDRINUSE",
    );
    assert.equal(occupied.listening, true, "o host que já ocupava a porta continua ativo");
  } finally {
    occupied.closeAllConnections?.();
    await new Promise(resolve => occupied.close(resolve));
  }
});

test("WS /ws empurra online + apps com pinned e running mock", async () => {
  const { port, close } = await startServer({
    port: 0,
    config: { pinned: ["Figma"] },
    appTools: { listAppProcesses: async () => [{ name: "Chrome", pid: 9, type: "Foreground" }] },
  });
  let c = null;
  try {
    c = connect(port);
    const online = await c.waitFor((d) => d.type === "online" && d.online === true);
    assert.equal(online.online, true);
    const apps = await c.waitFor((d) => d.type === "apps");
    assert.deepEqual(apps.pinned, ["Figma"]);
    assert.deepEqual(apps.limits, pinnedLimits());
    assert.equal(apps.running.some((a) => a.name === "Chrome"), true);
  } finally {
    if (c) { try { c.ws.close(); } catch (e) {} }
    await close();
  }
});

test("WS envia ping protocolar e mantém cliente saudável", async () => {
  const { port, close } = await startServer({
    port: 0,
    wsHeartbeatMs: 25,
    config: { pinned: [] },
    appTools: { listAppProcesses: async () => [] },
  });
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout aguardando abertura do WebSocket")), 1000);
      ws.once("open", () => { clearTimeout(timer); resolve(); });
      ws.once("error", error => { clearTimeout(timer); reject(error); });
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout aguardando ping protocolar")), 1000);
      ws.once("ping", () => { clearTimeout(timer); resolve(); });
      ws.once("error", error => { clearTimeout(timer); reject(error); });
    });
    assert.equal(ws.readyState, WebSocket.OPEN);
  } finally {
    try { ws.close(); } catch (e) {}
    await close();
  }
});

test("WS encerra cliente que não responde ao ping protocolar", async () => {
  const { port, close } = await startServer({
    port: 0,
    wsHeartbeatMs: 25,
    config: { pinned: [] },
    appTools: { listAppProcesses: async () => [] },
  });
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { autoPong: false });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout aguardando encerramento do WebSocket morto")), 1000);
      ws.once("close", () => { clearTimeout(timer); resolve(); });
      ws.once("error", () => {});
    });
    assert.equal(ws.readyState, WebSocket.CLOSED);
  } finally {
    try { ws.close(); } catch (e) {}
    await close();
  }
});

test("WS rejeita Origin cross-origin mesmo em loopback", async () => {
  const { port, close } = await startServer({
    port: 0,
    config: { pinned: [] },
    appTools: { listAppProcesses: async () => [] },
  });
  try {
    const result = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/arbitrary-path`, {
        origin: "https://evil.example",
      });
      const timer = setTimeout(() => {
        try { ws.close(); } catch (e) {}
        reject(new Error("timeout aguardando rejeição do WebSocket"));
      }, 3000);
      const finish = value => {
        clearTimeout(timer);
        try { ws.close(); } catch (e) {}
        resolve(value);
      };
      ws.once("open", () => finish("open"));
      ws.once("error", () => finish("denied"));
      ws.once("unexpected-response", () => finish("denied"));
      ws.once("close", () => finish("denied"));
    });
    assert.equal(result, "denied");
  } finally { await close(); }
});

test("POST pin empurra pinned novo no WS (Mac → device)", async () => {
  const dir = await (await import("node:fs/promises")).mkdtemp(
    (await import("node:path")).join((await import("node:os")).tmpdir(), "j5ws-")
  );
  const configFile = (await import("node:path")).join(dir, "config.json");
  const { port, close } = await startServer({
    port: 0,
    configFile,
    appTools: { listAppProcesses: async () => [] },
  });
  let c = null;
  try {
    c = connect(port);
    await c.waitFor((d) => d.type === "online");
    await c.waitFor((d) => d.type === "apps");
    const r = await fetch(`http://127.0.0.1:${port}/api/config/pinned`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: "Ghostty" }),
    });
    assert.equal(r.status, 200);
    const apps = await c.waitFor((d) => d.type === "apps" && Array.isArray(d.pinned) && d.pinned.includes("Ghostty"), 3000);
    assert.deepEqual(apps.pinned, ["Ghostty"]);
  } finally {
    if (c) { try { c.ws.close(); } catch (e) {} }
    await close();
    await (await import("node:fs/promises")).rm(dir, { recursive: true, force: true });
  }
});

test("WS /ws responde ao ping reenviando o estado atual", async () => {
  let running = [{ name: "Notes", pid: 3, type: "Foreground" }];
  const { port, close } = await startServer({
    port: 0,
    config: { pinned: [] },
    appTools: { listAppProcesses: async () => running },
  });
  let c = null;
  try {
    c = connect(port);
    await c.waitFor((d) => d.type === "online");
    await c.waitFor((d) => d.type === "apps");
    running = [
      { name: "Notes", pid: 3, type: "Foreground" },
      { name: "Mail", pid: 7, type: "Foreground" },
    ];
    c.ws.send(JSON.stringify({ type: "ping" }));
    const apps = await c.waitFor((d) => d.type === "apps" && d.running.length === 2);
    assert.equal(apps.running.some((a) => a.name === "Mail"), true);
  } finally {
    if (c) { try { c.ws.close(); } catch (e) {} }
    await close();
  }
});

test("WS ping em rajada é limitado — não vira amplificador de broadcast", async () => {
  let running = [{ name: "Notes", pid: 3, type: "Foreground" }];
  const { port, close } = await startServer({
    port: 0,
    config: { pinned: [] },
    appTools: { listAppProcesses: async () => running },
  });
  let c = null;
  try {
    c = connect(port);
    await c.waitFor((d) => d.type === "online");
    await c.waitFor((d) => d.type === "apps");
    // espera o estado assentar (sem frames por ~300ms)
    await new Promise(r => setTimeout(r, 400));

    let pushes = 0;
    const onMsg = raw => {
      try { if (JSON.parse(String(raw)).type === "apps") pushes++; } catch {}
    };
    c.ws.on("message", onMsg);
    // janela < STATUS_POLL_MS para o poll não contaminar a contagem
    for (let i = 0; i < 20; i++) {
      c.ws.send(JSON.stringify({ type: "ping" }));
      await new Promise(r => setTimeout(r, 5));
    }
    await new Promise(r => setTimeout(r, 300));
    assert.ok(pushes <= 2, `rajada de 20 pings gerou ${pushes} broadcasts; esperava <= 2`);
    c.ws.removeListener("message", onMsg);
  } finally {
    if (c) { try { c.ws.close(); } catch (e) {} }
    await close();
  }
});

test("WS remove app fechado sem esperar vários segundos", async () => {
  let running = [{ name: "Notes", pid: 3, type: "Foreground" }];
  const { port, close } = await startServer({
    port: 0,
    config: { pinned: [] },
    appTools: { listAppProcesses: async () => running },
  });
  let c = null;
  try {
    c = connect(port);
    await c.waitFor((d) => d.type === "apps" && d.running.length === 1);
    running = [];
    const started = Date.now();
    const apps = await c.waitFor((d) => d.type === "apps" && d.running.length === 0, 3500);
    assert.ok(Date.now() - started < 3000, "app fechado deve desaparecer em até 3s");
    assert.deepEqual(apps.running, []);
  } finally {
    if (c) { try { c.ws.close(); } catch (e) {} }
    await close();
  }
});
