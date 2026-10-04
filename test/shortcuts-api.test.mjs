import test from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { startServer } from "../server.js";
import { createShortcutPiece } from "../config.js";

const savedShortcut = createShortcutPiece("Criar nota de reunião", "📝");

async function startTemp(options = {}) {
  return startServer({
    port: 0,
    config: { pieces: [], revision: 0 },
    actions: {
      listShortcuts: async () => ["Criar nota de reunião", "Abrir agenda"],
      runShortcut: async () => {},
    },
    ...options,
  });
}

async function request(server, path, init = {}) {
  const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  return { response, body: await response.json() };
}

async function requestWithHost(server, path, { method = "GET", body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1",
      port: server.port,
      path,
      method,
      headers: {
        Host: `attacker.test:${server.port}`,
        Origin: `http://attacker.test:${server.port}`,
        ...headers,
      },
    }, response => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { raw += chunk; });
      response.on("end", () => resolve({
        response,
        body: raw ? JSON.parse(raw) : null,
      }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("API lista os atalhos disponíveis no Mac host", async () => {
  const server = await startTemp();
  try {
    const result = await request(server, "/api/shortcuts", {
      headers: { "X-Dokke-Client": "dokke-macos-picker" },
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.shortcuts, ["Criar nota de reunião", "Abrir agenda"]);
  } finally { await server.close(); }
});

test("API de atalhos recusa requests de outras origens antes de iniciar a CLI", async () => {
  let listCalls = 0;
  const server = await startTemp({
    actions: {
      listShortcuts: async () => { listCalls += 1; return ["Abrir agenda"]; },
      runShortcut: async () => {},
    },
  });
  try {
    const host = `127.0.0.1:${server.port}`;
    const origin = `http://${host}`;
    for (const extraHeaders of [
      { Origin: "https://attacker.example", "X-Dokke-Client": "dokke-macos-picker" },
      { "Sec-Fetch-Site": "cross-site" },
      { "Sec-Fetch-Site": "same-site" },
      { "Sec-Fetch-Mode": "no-cors" },
      {},
    ]) {
      const result = await requestWithHost(server, "/api/shortcuts", {
        headers: { Host: host, Origin: origin, ...extraHeaders },
      });
      assert.equal(result.response.statusCode, 403);
    }
    assert.equal(listCalls, 0);
  } finally { await server.close(); }
});

test("API salva apenas um atalho que existe no Mac e preserva o slot pedido", async () => {
  const server = await startTemp();
  try {
    const result = await request(server, "/api/config/pieces", {
      method: "POST",
      body: JSON.stringify({ type: "shortcut", name: "Abrir agenda", emoji: "📅", position: 3 }),
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.piece, {
      id: createShortcutPiece("Abrir agenda").id,
      type: "shortcut",
      name: "Abrir agenda",
      emoji: "📅",
      position: 3,
    });
    assert.deepEqual(result.body.config.pinned, []);
  } finally { await server.close(); }
});

test("API recusa emoji inválido e não altera a configuração", async () => {
  const server = await startTemp();
  try {
    const result = await request(server, "/api/config/pieces", {
      method: "POST",
      body: JSON.stringify({ type: "shortcut", name: "Abrir agenda", emoji: "AB" }),
    });
    assert.equal(result.response.status, 400);
    assert.equal(result.body.code, "INVALID_SHORTCUT");
    const config = await request(server, "/api/config");
    assert.deepEqual(config.body.config.pieces, []);
  } finally { await server.close(); }
});

test("API recusa atalho que não consta no Mac", async () => {
  const server = await startTemp();
  try {
    const result = await request(server, "/api/config/pieces", {
      method: "POST",
      body: JSON.stringify({ type: "shortcut", name: "Atalho inventado" }),
    });
    assert.equal(result.response.status, 404);
    assert.equal(result.body.code, "SHORTCUT_NOT_FOUND");
    const config = await request(server, "/api/config");
    assert.deepEqual(config.body.config.pieces, []);
  } finally { await server.close(); }
});

test("toque remoto executa o nome salvo no Mac, ignorando nome enviado pelo cliente", async () => {
  let executed;
  const server = await startTemp({
    config: { pieces: [savedShortcut], revision: 2 },
    actions: {
      listShortcuts: async () => ["Criar nota de reunião", "Abrir agenda"],
      runShortcut: async name => { executed = name; },
    },
  });
  try {
    const result = await request(server, `/api/pieces/${encodeURIComponent(savedShortcut.id)}/open`, {
      method: "POST",
      body: JSON.stringify({ name: "Abrir agenda" }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.piece.emoji, "📝");
    assert.equal(executed, "Criar nota de reunião");
  } finally { await server.close(); }
});

test("API informa conflito quando o atalho solicitado já está em execução", async () => {
  const server = await startTemp({
    config: { pieces: [savedShortcut], revision: 2 },
    actions: {
      listShortcuts: async () => ["Criar nota de reunião"],
      runShortcut: async () => {
        throw Object.assign(new Error("atalho já está em execução"), { code: "SHORTCUT_ALREADY_RUNNING" });
      },
    },
  });
  try {
    const result = await request(server, `/api/pieces/${encodeURIComponent(savedShortcut.id)}/open`, {
      method: "POST",
      body: "{}",
    });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.code, "SHORTCUT_ALREADY_RUNNING");
  } finally { await server.close(); }
});

test("rota de execução de atalhos continua protegida pela autenticação", async () => {
  const server = await startTemp({ trustLoopback: false });
  try {
    const result = await request(server, "/api/shortcuts");
    assert.equal(result.response.status, 401);
  } finally { await server.close(); }
});

test("Host externo não usa a exceção de loopback para listar ou executar atalhos", async () => {
  let executions = 0;
  const server = await startTemp({
    config: { pieces: [savedShortcut], revision: 0 },
    actions: {
      listShortcuts: async () => ["Criar nota de reunião"],
      runShortcut: async () => { executions += 1; },
    },
  });
  try {
    const listed = await requestWithHost(server, "/api/shortcuts");
    assert.equal(listed.response.statusCode, 401);

    const opened = await requestWithHost(server, `/api/pieces/${savedShortcut.id}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(opened.response.statusCode, 401);
    assert.equal(executions, 0);
  } finally { await server.close(); }
});

test("PUT legado recusa substituir uma configuração que contém atalhos", async () => {
  const server = await startTemp({
    config: { pieces: [savedShortcut], revision: 4 },
  });
  try {
    const replaced = await request(server, "/api/config/pinned", {
      method: "PUT",
      body: JSON.stringify({ apps: ["Chrome"] }),
    });
    assert.equal(replaced.response.status, 409);
    assert.equal(replaced.body.code, "MIXED_PIECES_REQUIRES_NEW_CLIENT");

    const current = await request(server, "/api/config");
    assert.deepEqual(current.body.config.pieces, [savedShortcut]);
    assert.equal(current.body.config.revision, 4);
  } finally { await server.close(); }
});
