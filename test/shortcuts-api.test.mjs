import test from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server.js";
import { createShortcutPiece } from "../config.js";
import { readPinFile } from "../auth.js";

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
      headers: { "X-Dokke-Client": "dokke-macos-picker" },
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
      headers: { "X-Dokke-Client": "dokke-macos-picker" },
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
      headers: { "X-Dokke-Client": "dokke-macos-picker" },
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

test("HTTP remoto não pode executar atalhos mesmo com uma sessão válida", async () => {
  const root = await mkdtemp(join(tmpdir(), "dokke-shortcut-http-"));
  let executions = 0;
  const server = await startTemp({
    root,
    trustLoopback: false,
    config: { pieces: [savedShortcut], revision: 1 },
    actions: {
      listShortcuts: async () => [savedShortcut.name],
      runShortcut: async () => { executions += 1; },
    },
  });
  try {
    const pin = await readPinFile(root);
    const login = await request(server, "/api/auth", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    assert.equal(login.response.status, 200);
    const cookie = (login.response.headers.get("set-cookie") || "").split(";")[0];

    const result = await requestWithHost(server, `/api/pieces/${savedShortcut.id}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: "{}",
    });
    assert.equal(result.response.statusCode, 403);
    assert.equal(result.body.code, "HTTPS_REQUIRED");
    assert.equal(executions, 0);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("HTTPS de proxy local protege a sessão e permite executar atalhos", async () => {
  const root = await mkdtemp(join(tmpdir(), "dokke-shortcut-proxy-"));
  let executions = 0;
  const server = await startTemp({
    root,
    trustLoopback: false,
    config: { pieces: [savedShortcut], revision: 1 },
    actions: {
      listShortcuts: async () => [savedShortcut.name],
      runShortcut: async () => { executions += 1; },
    },
  });
  const host = `dokke.example.test:${server.port}`;
  const proxyHeaders = {
    Host: host,
    Origin: `https://${host}`,
    "X-Forwarded-Proto": "https",
    "Content-Type": "application/json",
  };
  try {
    const pin = await readPinFile(root);
    const login = await requestWithHost(server, "/api/auth", {
      method: "POST",
      headers: proxyHeaders,
      body: JSON.stringify({ pin }),
    });
    assert.equal(login.response.statusCode, 200);
    const setCookie = login.response.headers["set-cookie"] || [];
    const sessionHeader = setCookie.find(value => value.startsWith("j5_session=")) || "";
    assert.match(sessionHeader, /(?:^|; )Secure(?:;|$)/);
    const cookie = sessionHeader.split(";")[0];

    const opened = await requestWithHost(server, `/api/pieces/${savedShortcut.id}/open`, {
      method: "POST",
      headers: { ...proxyHeaders, Cookie: cookie },
      body: "{}",
    });
    assert.equal(opened.response.statusCode, 200);
    assert.equal(executions, 1);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
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

test("sessão autenticada da LAN não pode adicionar atalho fora do picker local", async () => {
  const root = await mkdtemp(join(tmpdir(), "dokke-shortcut-picker-"));
  let listCalls = 0;
  const server = await startTemp({
    root,
    trustLoopback: false,
    actions: {
      listShortcuts: async () => { listCalls += 1; return ["Abrir agenda"]; },
      runShortcut: async () => {},
    },
  });
  try {
    const pin = await readPinFile(root);
    const login = await request(server, "/api/auth", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    assert.equal(login.response.status, 200);
    const cookie = (login.response.headers.get("set-cookie") || "").split(";")[0];
    assert.match(cookie, /^j5_session=/);

    const result = await requestWithHost(server, "/api/config/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-Dokke-Client": "dokke-macos-picker",
      },
      body: JSON.stringify({ type: "shortcut", name: "Abrir agenda" }),
    });
    assert.equal(result.response.statusCode, 403);
    assert.equal(listCalls, 0);

    const config = await request(server, "/api/config", {
      headers: { Cookie: cookie },
    });
    assert.deepEqual(config.body.config.pieces, []);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
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
