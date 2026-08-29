import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";
import { createWebsitePiece, MAX_PINNED_PIECES } from "../config.js";
import WebSocket from "ws";

const site = createWebsitePiece("Dokke", "dokke.app");
const app = { id: "app:Safari", type: "app", name: "Safari" };

async function startTemp(options = {}) {
  return startServer({
    port: 0,
    config: { pieces: [app, site], revision: 4 },
    appTools: { listAppProcesses: async () => [{ name: "Safari", pid: 9 }] },
    ...options,
  });
}

const urlFor = server => `http://127.0.0.1:${server.port}`;
async function request(server, path, init = {}) {
  const response = await fetch(`${urlFor(server)}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const body = await response.json();
  return { response, body };
}

test("@spec:AC-308 API entrega pieces, revision e pinned como projeção", async () => {
  const server = await startTemp();
  try {
    const apps = await request(server, "/api/apps");
    assert.equal(apps.response.status, 200);
    assert.deepEqual(apps.body.pieces, [app, site]);
    assert.equal(apps.body.revision, 4);
    assert.deepEqual(apps.body.pinned, ["Safari"]);
    assert.deepEqual(apps.body.running, [{ name: "Safari", pid: 9 }]);

    const config = await request(server, "/api/config");
    assert.deepEqual(config.body.config.pieces, [app, site]);
    assert.equal(config.body.config.revision, 4);
    assert.deepEqual(config.body.config.pinned, ["Safari"]);
  } finally { await server.close(); }
});

test("@spec:AC-306 mutações legadas preservam sites e projetam apenas apps", async () => {
  const server = await startTemp();
  try {
    const added = await request(server, "/api/config/pinned", {
      method: "POST",
      body: JSON.stringify({ app: "Figma" }),
    });
    assert.equal(added.response.status, 200);
    assert.deepEqual(added.body.config.pinned, ["Safari", "Figma"]);
    assert.deepEqual(added.body.config.pieces.map(piece => [piece.id, piece.position]), [
      [app.id, 0], [site.id, 1], ["app:Figma", 2],
    ]);

    const removed = await request(server, "/api/config/pinned/Figma", { method: "DELETE" });
    assert.equal(removed.response.status, 200);
    assert.deepEqual(removed.body.config.pieces.map(piece => [piece.id, piece.position]), [
      [app.id, 0], [site.id, 1],
    ]);
  } finally { await server.close(); }
});

test("@spec:AC-307 PUT legado recusa configuração mista sem mutar", async () => {
  const server = await startTemp();
  try {
    const result = await request(server, "/api/config/pinned", {
      method: "PUT",
      body: JSON.stringify({ apps: ["Chrome"] }),
    });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.code, "MIXED_PIECES_REQUIRES_NEW_CLIENT");
    const current = await request(server, "/api/config");
    assert.deepEqual(current.body.config.pieces, [app, site]);
    assert.equal(current.body.config.revision, 4);
  } finally { await server.close(); }
});

test("@spec:AC-309 WebSocket envia snapshot misto atualizado após criação", async () => {
  const server = await startTemp({ config: { pieces: [], revision: 0 } });
  const ws = new WebSocket(`${urlFor(server).replace("http", "ws")}/ws`);
  const messages = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout abrindo WS")), 1500);
      ws.once("open", () => { clearTimeout(timer); resolve(); });
      ws.once("error", error => { clearTimeout(timer); reject(error); });
    });
    ws.on("message", raw => { try { messages.push(JSON.parse(String(raw))); } catch {} });
    await new Promise(resolve => setTimeout(resolve, 80));
    const created = await request(server, "/api/config/pieces", {
      method: "POST",
      body: JSON.stringify({ type: "website", title: "Dokke", url: "dokke.app" }),
    });
    assert.equal(created.response.status, 200);
    await new Promise(resolve => setTimeout(resolve, 80));
    const snapshot = messages.find(m => m.type === "apps" && m.pieces?.length === 1);
    assert.ok(snapshot, "esperava snapshot apps com a peça criada");
    assert.equal(snapshot.revision, 1);
    assert.deepEqual(snapshot.pinned, []);
    assert.ok(Array.isArray(snapshot.running));
    assert.deepEqual(snapshot.limits.maxPinnedPieces, MAX_PINNED_PIECES);
  } finally {
    try { ws.close(); } catch {}
    await server.close();
  }
});

test("@spec:AC-312 abertura resolve URL persistida e chama ação do host", async () => {
  let opened = null;
  const server = await startTemp({ actions: { openWebsite: async url => { opened = url; } } });
  try {
    const result = await request(server, `/api/pieces/${encodeURIComponent(site.id)}/open`, {
      method: "POST",
      body: JSON.stringify({ url: "https://evil.example", command: "rm -rf /" }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(opened, site.url);
  } finally { await server.close(); }
});

test("@spec:AC-313 abertura ignora URL e comando arbitrários do cliente", async () => {
  let opened = [];
  const server = await startTemp({ actions: { openWebsite: async url => { opened.push(url); } } });
  try {
    const result = await request(server, `/api/pieces/${encodeURIComponent(site.id)}/open`, {
      method: "POST",
      body: JSON.stringify({ url: "javascript:alert(1)", exec: ["open", "evil"] }),
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(opened, [site.url]);
  } finally { await server.close(); }
});

test("@spec:AC-314 ID ausente ou peça app não abre", async () => {
  let calls = 0;
  const server = await startTemp({ actions: { openWebsite: async () => { calls++; } } });
  try {
    const missing = await request(server, "/api/pieces/website%3Amissing/open", { method: "POST" });
    const wrongType = await request(server, `/api/pieces/${encodeURIComponent(app.id)}/open`, { method: "POST" });
    assert.equal(missing.response.status, 404);
    assert.equal(wrongType.response.status, 409);
    assert.equal(calls, 0);
    assert.equal((await fetch(`${urlFor(server)}/health`)).status, 200);
  } finally { await server.close(); }
});

test("@spec:AC-315 falha do open retorna erro genérico e mantém health", async () => {
  const server = await startTemp({ actions: { openWebsite: async () => { throw new Error("segredo do processo"); } } });
  try {
    const result = await request(server, `/api/pieces/${encodeURIComponent(site.id)}/open`, { method: "POST" });
    assert.equal(result.response.status, 500);
    assert.equal(result.body.ok, false);
    assert.match(result.body.error, /erro interno/);
    assert.doesNotMatch(result.body.error, /segredo/);
    assert.equal((await fetch(`${urlFor(server)}/health`)).status, 200);
  } finally { await server.close(); }
});

test("@spec:AC-316 reordenação mista persiste e incrementa revisão uma vez", async () => {
  const server = await startTemp();
  try {
    const result = await request(server, "/api/config/pieces/order", {
      method: "PUT",
      body: JSON.stringify({ revision: 4, ids: [site.id, app.id] }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.config.revision, 5);
    assert.deepEqual(result.body.config.pieces.map(p => p.id), [site.id, app.id]);
    const current = await request(server, "/api/config");
    assert.equal(current.body.config.revision, 5);
    assert.deepEqual(current.body.config.pieces.map(p => p.id), [site.id, app.id]);
  } finally { await server.close(); }
});

test("reordenação persiste movimento para slot vazio sem compactar", async () => {
  const first = { ...app, position: 0 };
  const last = { ...site, position: 2 };
  const server = await startServer({
    port: 0,
    config: { pieces: [first, last], revision: 4 },
    appTools: { listAppProcesses: async () => [] },
  });
  try {
    const result = await request(server, "/api/config/pieces/order", {
      method: "PUT",
      body: JSON.stringify({
        revision: 4,
        ids: [last.id, first.id],
        positions: { [first.id]: 3, [last.id]: 2 },
      }),
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.config.pieces.map(piece => [piece.id, piece.position]), [
      [last.id, 2], [first.id, 3],
    ]);
  } finally { await server.close(); }
});

test("@spec:AC-317 escrita obsoleta responde conflito com snapshot atual", async () => {
  const server = await startTemp();
  try {
    const result = await request(server, "/api/config/pieces/order", {
      method: "PUT",
      body: JSON.stringify({ revision: 3, ids: [site.id, app.id] }),
    });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.code, "REVISION_CONFLICT");
    assert.equal(result.body.config.revision, 4);
    assert.deepEqual(result.body.config.pieces.map(p => p.id), [app.id, site.id]);
  } finally { await server.close(); }
});

test("@spec:AC-318 DELETE remove somente o site e preserva apps", async () => {
  const server = await startTemp();
  try {
    const result = await request(server, `/api/config/pieces/${encodeURIComponent(site.id)}`, {
      method: "DELETE",
      body: JSON.stringify({ revision: 4 }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.config.revision, 5);
    assert.deepEqual(result.body.config.pieces.map(piece => [piece.id, piece.position]), [[app.id, 0]]);
  } finally { await server.close(); }
});

test("@spec:AC-319 limite físico recusa a 40a peça sem mutar", async () => {
  const pieces = Array.from({ length: MAX_PINNED_PIECES }, (_, i) => ({
    id: `app:App-${i}`, type: "app", name: `App-${i}`,
  }));
  const server = await startTemp({ config: { pieces, revision: 8 } });
  try {
    const result = await request(server, "/api/config/pieces", {
      method: "POST",
      body: JSON.stringify({ type: "website", url: "new.example" }),
    });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.code, "PINNED_LIMIT_REACHED");
    const current = await request(server, "/api/config");
    assert.equal(current.body.config.revision, 8);
    assert.equal(current.body.config.pieces.length, MAX_PINNED_PIECES);
  } finally { await server.close(); }
});

test("remoção preserva os slots das demais peças", async () => {
  const first = { id: "app:Safari", type: "app", name: "Safari", position: 0 };
  const middle = createWebsitePiece("Docs", "docs.example.com");
  middle.position = 1;
  const last = { id: "app:Finder", type: "app", name: "Finder", position: 2 };
  const server = await startTemp({ config: { pieces: [first, middle, last], revision: 4 } });
  try {
    const result = await request(server, `/api/config/pieces/${encodeURIComponent(middle.id)}`, {
      method: "DELETE",
      body: JSON.stringify({ revision: 4 }),
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.config.pieces.map(piece => [piece.id, piece.position]), [
      [first.id, 0],
      [last.id, 2],
    ]);
  } finally { await server.close(); }
});

test("adição direcionada ocupa o slot solicitado sem mover os demais", async () => {
  const first = { id: "app:Safari", type: "app", name: "Safari", position: 0 };
  const last = { id: "app:Finder", type: "app", name: "Finder", position: 2 };
  const server = await startTemp({ config: { pieces: [first, last], revision: 4 } });
  try {
    const result = await request(server, "/api/config/pinned", {
      method: "POST",
      body: JSON.stringify({ app: "Figma", position: 1 }),
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.config.pieces.map(piece => [piece.name, piece.position]), [
      ["Safari", 0],
      ["Figma", 1],
      ["Finder", 2],
    ]);
  } finally { await server.close(); }
});

test("adição de website direcionada ocupa o slot solicitado", async () => {
  const first = { id: "app:Safari", type: "app", name: "Safari", position: 0 };
  const server = await startTemp({ config: { pieces: [first], revision: 4 } });
  try {
    const result = await request(server, "/api/config/pieces", {
      method: "POST",
      body: JSON.stringify({ type: "website", title: "Docs", url: "docs.example.com", position: 3 }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.piece.position, 3);
    assert.deepEqual(result.body.config.pieces.map(piece => [piece.id, piece.position]), [
      [first.id, 0], [result.body.piece.id, 3],
    ]);
  } finally { await server.close(); }
});
