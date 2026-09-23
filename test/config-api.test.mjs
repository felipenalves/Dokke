import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server.js";
import { MAX_PINNED_APPS, pinnedLimits } from "../config.js";

async function startTemp(extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), "j5api-"));
  const { port, close } = await startServer({
    port: 0,
    configFile: join(dir, "config.json"),
    appTools: { listAppProcesses: async () => [{ name: "Chrome", pid: 9 }] },
    ...extra,
  });
  return { dir, port, close };
}

const base = s => `http://127.0.0.1:${s.port}`;

test("respostas públicas omitem Uso e seus endpoints não existem", async () => {
  const s = await startTemp({ configFile: null, config: { usage: { enabled: true }, usageProvider: "codex" } });
  try {
    for (const path of ["/api/config", "/api/apps", "/api/status"]) {
      const response = await fetch(`${base(s)}${path}`);
      assert.equal(response.status, 200, path);
      const body = await response.json();
      const payload = path === "/api/config" || path === "/api/status" ? body.config : body;
      assert.equal(Object.hasOwn(payload, "usage"), false, path);
      assert.equal(Object.hasOwn(payload, "usageProvider"), false, path);
    }
    for (const path of ["/api/usage", "/api/usage/activity", "/api/usage/activity/event", "/api/config/usage", "/api/config/usage/provider"]) {
      const method = path.endsWith("/event") ? "POST" : path.startsWith("/api/config/") ? "PUT" : "GET";
      const response = await fetch(`${base(s)}${path}`, { method });
      assert.equal(response.status, 404, path);
    }
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("pin preserva preferências antigas no disco sem expô-las na API", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5api-"));
  const configFile = join(dir, "config.json");
  const usage = { enabled: false, display: "remaining", reset: "countdown", showPace: false };
  await writeFile(configFile, JSON.stringify({ pieces: [], pinned: [], usage, usageProvider: "claude" }));
  const server = await startServer({ port: 0, configFile, appTools: { listAppProcesses: async () => [] } });
  try {
    const origin = `http://127.0.0.1:${server.port}`;
    const pin = await fetch(`${origin}/api/config/pinned`, {
      method: "POST", body: JSON.stringify({ app: "Figma" }),
    });
    assert.equal(pin.status, 200);
    assert.equal(Object.hasOwn((await pin.json()).config, "usage"), false);

    const stored = JSON.parse(await readFile(configFile, "utf8"));
    assert.deepEqual(stored.usage, usage);
    assert.equal(stored.usageProvider, "claude");
    assert.deepEqual(stored.pinned, ["Figma"]);
    for (const path of ["/api/config", "/api/apps", "/api/status"]) {
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 200);
      const body = await response.json();
      const payload = path === "/api/apps" ? body : body.config;
      assert.equal(Object.hasOwn(payload, "usage"), false, path);
      assert.equal(Object.hasOwn(payload, "usageProvider"), false, path);
    }
  } finally { await server.close(); await rm(dir, { recursive: true, force: true }); }
});

test("GET /api/config vazio retorna pinned vazio", async () => {
  const s = await startTemp();
  try {
    const r = await fetch(`${base(s)}/api/config`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {
      ok: true,
      config: { schemaVersion: 2, revision: 0, pieces: [], pinned: [], limits: pinnedLimits() },
    });
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});


test("POST /api/config/pinned adiciona app fixa", async () => {
  const s = await startTemp();
  try {
    const r = await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Figma" }) });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.deepEqual(j.config.pinned, ["Figma"]);
    assert.equal(j.pushed, true);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("PUT /api/config/pinned substitui lista inteira", async () => {
  const s = await startTemp();
  try {
    await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "A" }) });
    const r = await fetch(`${base(s)}/api/config/pinned`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apps: ["Safari", "  Chrome  ", "Safari", ""] }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.deepEqual(j.config.pinned, ["Safari", "Chrome"]);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("GET /api/status retorna devices e pinned", async () => {
  const s = await startTemp({
    configFile: null,
    config: {
      usage: { enabled: false, display: "remaining", reset: "exact", showPace: true },
      usageProvider: "codex",
    },
  });
  try {
    await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Notes" }) });
    const r = await fetch(`${base(s)}/api/status`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(typeof j.devices, "number");
    assert.equal(j.pinned, 1);
    assert.deepEqual(j.config.pinned, ["Notes"]);
    assert.equal(Object.hasOwn(j.config, "usage"), false);
    assert.equal(Object.hasOwn(j.config, "usageProvider"), false);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("POST /api/config/pinned com duplicada e idempotente", async () => {
  const s = await startTemp();
  try {
    await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Figma" }) });
    const r = await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Figma" }) });
    assert.deepEqual((await r.json()).config.pinned, ["Figma"]);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("POST /api/config/pinned acumula apps distintas em ordem", async () => {
  const s = await startTemp();
  try {
    await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Figma" }) });
    const r = await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Chrome" }) });
    assert.deepEqual((await r.json()).config.pinned, ["Figma", "Chrome"]);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("DELETE /api/config/pinned/:app remove app fixa", async () => {
  const s = await startTemp();
  try {
    await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Figma" }) });
    await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Chrome" }) });
    const r = await fetch(`${base(s)}/api/config/pinned/Figma`, { method: "DELETE" });
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).config.pinned, ["Chrome"]);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("DELETE /api/config/pinned/:app com app ausente e idempotente", async () => {
  const s = await startTemp();
  try {
    await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Figma" }) });
    const r = await fetch(`${base(s)}/api/config/pinned/Xyz`, { method: "DELETE" });
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).config.pinned, ["Figma"]);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("DELETE /api/config/pinned com URI malformada responde 400 sem cair", async () => {
  const s = await startTemp();
  try {
    const r = await fetch(`${base(s)}/api/config/pinned/%E0%A4%A`, { method: "DELETE" });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).ok, false);
    const h = await fetch(`${base(s)}/health`);
    assert.equal(h.status, 200);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("config persiste em arquivo real: novo server le a app adicionada", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5api-"));
  const configFile = join(dir, "config.json");
  const a = await startServer({ port: 0, configFile, appTools: { listAppProcesses: async () => [] } });
  try {
    const r = await fetch(`http://127.0.0.1:${a.port}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Figma" }) });
    assert.equal(r.status, 200);
  } finally { await a.close(); }
  const b = await startServer({ port: 0, configFile, appTools: { listAppProcesses: async () => [] } });
  try {
    const r = await fetch(`http://127.0.0.1:${b.port}/api/config`);
    assert.deepEqual((await r.json()).config.pinned, ["Figma"]);
  } finally { await b.close(); await rm(dir, { recursive: true, force: true }); }
});

test("GET /api/apps reflete fixa adicionada pela API", async () => {
  const s = await startTemp();
  try {
    await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app: "Figma" }) });
    const r = await fetch(`${base(s)}/api/apps`);
    const d = await r.json();
    assert.deepEqual(d.pinned, ["Figma"]);
    assert.equal(d.running.some(a => a.name === "Chrome"), true);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("POST /api/config/pinned com corpo invalido responde 400", async () => {
  const s = await startTemp();
  try {
    for (const body of [JSON.stringify({ app: 123 }), JSON.stringify({ app: "" }), JSON.stringify({}), "isso nao e json{"]) {
      const r = await fetch(`${base(s)}/api/config/pinned`, { method: "POST", body });
      assert.equal(r.status, 400, `esperava 400 para ${body}`);
      assert.equal((await r.json()).ok, false);
    }
    const g = await fetch(`${base(s)}/api/config`);
    assert.deepEqual((await g.json()).config.pinned, []);
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("POSTs concorrentes não perdem updates nem deixam tmp para trás", async () => {
  const s = await startTemp();
  try {
    const apps = Array.from({ length: 24 }, (_, i) => `App-${String(i).padStart(2, "0")}`);
    const rs = await Promise.all(apps.map(app =>
      fetch(`${base(s)}/api/config/pinned`, { method: "POST", body: JSON.stringify({ app }) })
    ));
    for (const r of rs) assert.equal(r.status, 200);
    const g = await fetch(`${base(s)}/api/config`);
    const got = (await g.json()).config.pinned;
    assert.deepEqual(got.sort(), apps.sort(), "todas as 24 apps devem sobreviver à concorrência");
    const { readdir } = await import("node:fs/promises");
    const leftovers = (await readdir(s.dir)).filter(f => f.includes(".tmp"));
    assert.deepEqual(leftovers, [], "nenhum arquivo .tmp pode sobrar");
  } finally { await s.close(); await rm(s.dir, { recursive: true, force: true }); }
});

test("POST bloqueia o app que passaria do limite de cinco páginas", async () => {
  const pinned = Array.from({ length: MAX_PINNED_APPS }, (_, i) => `App-${i}`);
  const s = await startServer({
    port: 0,
    config: { pinned },
    appTools: { listAppProcesses: async () => [] },
  });
  try {
    const r = await fetch(`${base(s)}/api/config/pinned`, {
      method: "POST",
      body: JSON.stringify({ app: "App-extra" }),
    });
    const body = await r.json();
    assert.equal(r.status, 409);
    assert.equal(body.ok, false);
    assert.equal(body.code, "PINNED_LIMIT_REACHED");
    assert.deepEqual(body.limits, pinnedLimits());

    const current = await fetch(`${base(s)}/api/config`);
    assert.deepEqual((await current.json()).config.pinned, pinned);
  } finally { await s.close(); }
});

test("PUT rejeita uma lista acima do limite sem truncar nem alterar a ordem atual", async () => {
  const current = ["Figma"];
  const s = await startServer({
    port: 0,
    config: { pinned: current },
    appTools: { listAppProcesses: async () => [] },
  });
  try {
    const tooMany = Array.from({ length: MAX_PINNED_APPS + 1 }, (_, i) => `App-${i}`);
    const r = await fetch(`${base(s)}/api/config/pinned`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: tooMany }),
    });
    const body = await r.json();
    assert.equal(r.status, 409);
    assert.equal(body.code, "PINNED_LIMIT_REACHED");

    const after = await fetch(`${base(s)}/api/config`);
    assert.deepEqual((await after.json()).config.pinned, current);
  } finally { await s.close(); }
});
