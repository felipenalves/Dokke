import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";
import WebSocket from "ws";

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
    assert.equal(apps.running.some((a) => a.name === "Chrome"), true);
  } finally {
    if (c) { try { c.ws.close(); } catch (e) {} }
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
