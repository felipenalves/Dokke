import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";

function fakeObs(overrides = {}) {
  const calls = { switch: [], toggleRecord: 0, toggleStream: 0, stopAll: 0 };
  const obs = {
    getState: async () => ({ scenes: ["A", "B"], scene: "A", recording: false, streaming: false }),
    switchScene: async n => { calls.switch.push(n); },
    toggleRecord: async () => { calls.toggleRecord++; },
    toggleStream: async () => { calls.toggleStream++; },
    stopAll: async () => { calls.stopAll++; },
    ...overrides,
  };
  return { obs, calls };
}

test("GET /api/obs/state retorna estado quando obs conectado", async () => {
  const { obs } = fakeObs();
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/state`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {
      ok: true,
      connected: true,
      state: { scenes: ["A", "B"], scene: "A", recording: false, streaming: false },
    });
  } finally { await close(); }
});

test("GET /api/obs/state sem obs conectado responde connected:false sem state", async () => {
  const { port, close } = await startServer({ port: 0 });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/state`);
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.ok, true);
    assert.equal(d.connected, false);
    assert.equal("state" in d, false);
  } finally { await close(); }
});

test("POST /api/obs/scene troca a cena", async () => {
  const { obs, calls } = fakeObs();
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/scene`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene: "B" }),
    });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.deepEqual(calls.switch, ["B"]);
  } finally { await close(); }
});

test("POST /api/obs/scene sem cena valida responde 400", async () => {
  const { obs, calls } = fakeObs();
  const { port, close } = await startServer({ port: 0, obs });
  try {
    for (const body of [JSON.stringify({}), JSON.stringify({ scene: "" }), JSON.stringify({ scene: "   " }), JSON.stringify({ scene: 5 })]) {
      const r = await fetch(`http://127.0.0.1:${port}/api/obs/scene`, { method: "POST", body });
      assert.equal(r.status, 400);
      assert.equal((await r.json()).ok, false);
    }
    assert.deepEqual(calls.switch, []);
  } finally { await close(); }
});

test("POST /api/obs/record alterna a gravacao", async () => {
  const { obs, calls } = fakeObs();
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/record`, { method: "POST" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.equal(calls.toggleRecord, 1);
  } finally { await close(); }
});

test("POST /api/obs/stream alterna a transmissao", async () => {
  const { obs, calls } = fakeObs();
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/stream`, { method: "POST" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.equal(calls.toggleStream, 1);
  } finally { await close(); }
});

test("POST /api/obs/stop-all encerra tudo", async () => {
  const { obs, calls } = fakeObs();
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/stop-all`, { method: "POST" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.equal(calls.stopAll, 1);
  } finally { await close(); }
});

test("POST /api/obs/* sem obs responde ok:false connected:false sem cair", async () => {
  const { port, close } = await startServer({ port: 0 });
  try {
    for (const path of ["/api/obs/record", "/api/obs/stream", "/api/obs/stop-all", "/api/obs/scene"]) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: "POST",
        body: JSON.stringify({ scene: "B" }),
      });
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { ok: false, connected: false });
    }
    const h = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(h.status, 200);
  } finally { await close(); }
});

test("GET /api/obs/state com getState rejeitando responde ok:false connected:true", async () => {
  const { obs } = fakeObs({ getState: async () => { throw new Error("obs caiu"); } });
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/state`);
    assert.equal(r.status, 500);
    const d = await r.json();
    assert.equal(d.ok, false);
    assert.equal(d.connected, true);
    assert.match(d.error, /erro interno/, "cliente recebe mensagem genérica");
    assert.doesNotMatch(d.error, /obs caiu/, "detalhe interno não vaza pro cliente");
  } finally { await close(); }
});

test("POST /api/obs/scene com corpo malformado responde 400", async () => {
  const { obs, calls } = fakeObs();
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/scene`, { method: "POST", body: "isso nao e json{" });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).ok, false);
    assert.deepEqual(calls.switch, []);
  } finally { await close(); }
});

test("POST /api/obs/stop-all sem metodo no obs responde 500 e o servidor segue vivo", async () => {
  const { obs } = fakeObs();
  delete obs.stopAll;
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/stop-all`, { method: "POST" });
    assert.equal(r.status, 500);
    const d = await r.json();
    assert.equal(d.ok, false);
    assert.match(d.error, /erro interno/);
    assert.doesNotMatch(d.error, /not a function/);
    const h = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(h.status, 200);
  } finally { await close(); }
});

test("POST /api/obs/scene com switchScene throw sincrono responde 500 e o servidor segue vivo", async () => {
  const { obs } = fakeObs({ switchScene() { throw new Error("falha sincrona"); } });
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/scene`, { method: "POST", body: JSON.stringify({ scene: "B" }) });
    assert.equal(r.status, 500);
    const d = await r.json();
    assert.equal(d.ok, false);
    assert.match(d.error, /erro interno/);
    assert.doesNotMatch(d.error, /falha sincrona/);
    const h = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(h.status, 200);
  } finally { await close(); }
});

test("POST /api/obs/scene trima espacos da cena antes de trocar", async () => {
  const { obs, calls } = fakeObs();
  const { port, close } = await startServer({ port: 0, obs });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/obs/scene`, { method: "POST", body: JSON.stringify({ scene: "  Cena B  " }) });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.deepEqual(calls.switch, ["Cena B"]);
  } finally { await close(); }
});
