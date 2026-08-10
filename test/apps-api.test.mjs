import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";

test("GET /api/apps retorna fixas + abertas", async () => {
  const { port, close } = await startServer({
    port: 0,
    config: { pinned: ["Figma"] },
    appTools: { listAppProcesses: async () => [{ name: "Chrome", pid: 9 }] },
  });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/apps`);
    const d = await r.json();
    assert.equal(r.status, 200);
    assert.deepEqual(d.pinned, ["Figma"]);
    assert.equal(d.running.some(a => a.name === "Chrome"), true);
  } finally { await close(); }
});

test("GET /api/apps com defaults reais retorna arrays", async () => {
  const { port, close } = await startServer({ port: 0, config: { pinned: [] } });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/apps`);
    const d = await r.json();
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(d.pinned));
    assert.ok(Array.isArray(d.running));
  } finally { await close(); }
});

test("GET /api/apps/installed retorna { ok, apps } da lista instalada", async () => {
  const installed = [{ name: "Chrome", path: "/Applications/Google Chrome.app", icon: true }];
  const { port, close } = await startServer({
    port: 0,
    config: {},
    appTools: { listAppProcesses: async () => [], listInstalledApps: async () => installed },
  });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/apps/installed`);
    const d = await r.json();
    assert.equal(r.status, 200);
    assert.equal(d.ok, true);
    assert.deepEqual(d.apps, installed);
  } finally { await close(); }
});

test("GET /api/apps/Chrome/icon retorna 200 image/png com bytes", async () => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const { port, close } = await startServer({
    port: 0,
    config: {},
    iconService: { getIconPng: async () => bytes },
  });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/apps/Chrome/icon`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "image/png");
    assert.match(r.headers.get("cache-control") || "", /max-age=86400/, "ícone com cache HTTP");
    assert.deepEqual([...Buffer.from(await r.arrayBuffer())], [...bytes]);
  } finally { await close(); }
});

test("GET /api/apps/Chrome/icon retorna 404 quando não existe ícone", async () => {
  const { port, close } = await startServer({
    port: 0,
    config: {},
    iconService: { getIconPng: async () => null },
  });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/apps/Chrome/icon`);
    const d = await r.json();
    assert.equal(r.status, 404);
    assert.equal(d.ok, false);
  } finally { await close(); }
});

test("GET /api/apps/%ZZ/icon com nome malformado retorna 400 sem crash", async () => {
  const { port, close } = await startServer({ port: 0, config: {} });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/apps/%ZZ/icon`);
    const d = await r.json();
    assert.equal(r.status, 400);
    assert.equal(d.ok, false);
    const h = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(h.status, 200);
  } finally { await close(); }
});
