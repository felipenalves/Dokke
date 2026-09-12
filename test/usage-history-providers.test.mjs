import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIncrementalFileCache } from "../usage/history-cache.js";
import { scanClaudeHistory } from "../usage/providers/claude-history.js";
import { parseClaudeFile } from "../usage/providers/claude-history.js";
import { scanCodexHistory } from "../usage/providers/codex-history.js";
import { parseCodexFile } from "../usage/providers/codex-history.js";
import { scanGrokHistory } from "../usage/providers/grok-history.js";
import { scanAntigravityHistory, generationSQL } from "../usage/providers/antigravity-history.js";
import { createAntigravityProvider } from "../usage/providers/antigravity.js";
import { createGrokProvider } from "../usage/providers/grok.js";

const roots = [];
const now = new Date("2026-09-01T15:00:00.000Z");
const since = new Date("2026-08-01T00:00:00.000Z");
const pricing = {
  resolve: model => model === "claude-sonnet" || model === "gpt-5" || model === "grok-4" || model === "gemini-pro"
    ? { inputPerMillion: 1, outputPerMillion: 2, cacheWritePerMillion: 1, cacheReadPerMillion: 0.1 }
    : null,
  costDollars: () => 0.01,
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function makeRoot(prefix) {
  const root = await mkdtemp(join(tmpdir(), `dokke-${prefix}-`));
  roots.push(root);
  return root;
}

async function writeJsonl(root, name, records) {
  const path = join(root, name);
  await writeFile(path, records.map(record => JSON.stringify(record)).join("\n") + "\n");
  return path;
}

function concatBytes(...parts) {
  return Uint8Array.from(parts.flatMap(part => [...part]));
}

function varint(value) {
  const bytes = [];
  let remaining = BigInt(value);
  do {
    let byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    if (remaining > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > 0n);
  return Uint8Array.from(bytes);
}

function protobufVarint(number, value) {
  return concatBytes(varint((number << 3) | 0), varint(value));
}

function protobufBytes(number, value) {
  return concatBytes(varint((number << 3) | 2), varint(value.length), value);
}

function utf8(value) {
  return new TextEncoder().encode(value);
}

function generationHex({ modelID = null, label = null, timestampSeconds = null } = {}) {
  const usage = concatBytes(
    protobufVarint(1, 2),
    protobufVarint(2, 10),
    protobufVarint(3, 5),
    protobufVarint(5, 3),
  );
  const fields = [
    modelID ? protobufBytes(19, utf8(modelID)) : new Uint8Array(),
    label ? protobufBytes(21, utf8(label)) : new Uint8Array(),
    protobufBytes(4, usage),
  ];
  if (timestampSeconds !== null) {
    const timestamp = protobufBytes(4, protobufVarint(1, timestampSeconds));
    fields.push(protobufBytes(9, timestamp));
  }
  return Buffer.from(protobufBytes(1, concatBytes(...fields))).toString("hex");
}

function stepMetadataHex(timestampSeconds) {
  const timestamp = protobufBytes(1, protobufVarint(1, timestampSeconds));
  return Buffer.from(timestamp).toString("hex");
}

test("cache incremental reutiliza arquivo inalterado", async () => {
  const root = await makeRoot("cache");
  const file = await writeJsonl(root, "events.jsonl", [{ ok: true }]);
  let parses = 0;
  const cache = createIncrementalFileCache({ maxBytes: 1024 * 1024 });
  const parse = data => { parses += 1; return JSON.parse(data.trim()).ok; };
  assert.equal(await cache.read(file, parse), true);
  assert.equal(await cache.read(file, parse), true);
  assert.equal(parses, 1);
});

test("Claude prefere a entrada pai quando sidechain e pai colidem", async () => {
  const root = await makeRoot("claude");
  await writeJsonl(root, "session.jsonl", [
    { timestamp: "2026-09-01T10:00:00.000Z", requestId: "r1", isSidechain: true, message: { id: "m1", model: "claude-sonnet", usage: { input_tokens: 20, output_tokens: 5 } } },
    { timestamp: "2026-09-01T10:00:01.000Z", requestId: "r1", isSidechain: false, message: { id: "m1", model: "claude-sonnet", usage: { input_tokens: 10, output_tokens: 5 } } },
    { timestamp: "2026-09-01T10:00:02.000Z", requestId: "bad", message: { model: "claude-sonnet", usage: null } },
  ]);
  const events = await scanClaudeHistory({ roots: [root], since, cache: createIncrementalFileCache(), pricing });
  assert.equal(events.length, 1);
  assert.equal(events[0].tokens.total, 15);
});

test("Claude preserva speed para precificar chamadas fast e rejeita speed desconhecido", () => {
  const valid = parseClaudeFile(JSON.stringify({
    timestamp: "2026-09-01T10:00:00.000Z",
    message: { id: "m1", model: "claude-sonnet", usage: { input_tokens: 10, output_tokens: 5, speed: "fast" } },
  }));
  const invalid = parseClaudeFile(JSON.stringify({
    timestamp: "2026-09-01T10:00:00.000Z",
    message: { id: "m2", model: "claude-sonnet", usage: { input_tokens: 10, output_tokens: 5, speed: "turbo" } },
  }));
  assert.equal(valid[0].isFast, true);
  assert.equal(valid[0].hasSpeed, true);
  assert.deepEqual(invalid, []);
});

test("Codex usa delta do total_token_usage e não duplica snapshot reemitido", async () => {
  const root = await makeRoot("codex");
  await writeJsonl(root, "rollout.jsonl", [
    { timestamp: "2026-09-01T10:00:00.000Z", type: "turn_context", payload: { model: "gpt-5" } },
    { timestamp: "2026-09-01T10:00:01.000Z", type: "token_count", payload: { info: { total_token_usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } } } },
    { timestamp: "2026-09-01T10:00:02.000Z", type: "token_count", payload: { info: { total_token_usage: { input_tokens: 15, output_tokens: 10, total_tokens: 25 } } } },
    { timestamp: "2026-09-01T10:00:03.000Z", type: "token_count", payload: { info: { total_token_usage: { input_tokens: 15, output_tokens: 10, total_tokens: 25 } } } },
  ]);
  const events = await scanCodexHistory({ homes: [root], since, cache: createIncrementalFileCache(), pricing });
  assert.deepEqual(events.map(event => event.tokens.total), [15, 10]);
});

test("Codex calcula o delta de cache e input sem cobrar cache duas vezes", () => {
  const events = parseCodexFile([
    { timestamp: "2026-09-01T10:00:00.000Z", type: "event_msg", payload: { type: "thread_settings_applied", thread_settings: { service_tier: "priority" } } },
    { timestamp: "2026-09-01T10:00:01.000Z", type: "token_count", payload: { info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 50, total_tokens: 150 } } } },
    { timestamp: "2026-09-01T10:00:02.000Z", type: "token_count", payload: { info: { total_token_usage: { input_tokens: 160, cached_input_tokens: 60, output_tokens: 60, total_tokens: 185 } } } },
  ].map(record => JSON.stringify(record)).join("\n"));
  assert.deepEqual(events.map(event => event.tokens), [
    { input: 60, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 40, output: 50, total: 150 },
    { input: 40, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 20, output: 10, total: 35 },
  ]);
  assert.equal(events[0].isFast, true);
});

test("Grok lê turn_completed por modelo e mantém custo carregado", async () => {
  const root = await makeRoot("grok");
  await writeJsonl(root, "updates.jsonl", [
    {
      timestamp: 1788256800,
      params: {
        _meta: { eventId: "e1", agentTimestampMs: 1788256800000 },
        update: {
          sessionUpdate: "turn_completed",
          usage: {
            costUsdTicks: 100000000,
            modelUsage: { "grok-4": { inputTokens: 10, cachedReadTokens: 2, outputTokens: 5, costUsdTicks: 100000000 } },
          },
        },
      },
    },
  ]);
  const events = await scanGrokHistory({ roots: [root], since, cache: createIncrementalFileCache(), pricing });
  assert.equal(events.length, 1);
  assert.equal(events[0].tokens.total, 15);
  assert.equal(events[0].costUSD, 0.01);
});

test("Grok usa GROK_HOME, inclui sessões filhas e deduplica por evento e modelo @spec:AC-349 @spec:AC-352", async () => {
  const home = await makeRoot("grok-home");
  const parent = join(home, "sessions", "parent");
  const child = join(home, "sessions", "child");
  await mkdir(parent, { recursive: true });
  await mkdir(child, { recursive: true });
  const turn = model => ({
    timestamp: 1788256800,
    params: {
      _meta: { eventId: "same-event", agentTimestampMs: 1788256800000 },
      update: {
        sessionUpdate: "turn_completed",
        usage: { modelUsage: { [model]: { inputTokens: 10, outputTokens: 5 } } },
      },
    },
  });
  await writeJsonl(parent, "updates.jsonl", [turn("grok-4")]);
  await writeJsonl(child, "updates.jsonl", [turn("grok-4"), turn("grok-4.1")]);
  await writeFile(join(child, "summary.json"), JSON.stringify({ session_kind: "subagent" }));

  const provider = createGrokProvider({ env: { HOME: home, GROK_HOME: home } });
  const result = await provider.readHistory({ since, cache: createIncrementalFileCache() });

  assert.deepEqual(result.events.map(event => event.model), ["grok-4", "grok-4.1"]);
});

test("Antigravity aceita geração injetada e ignora linha sem tokens", async () => {
  const events = await scanAntigravityHistory({
    databases: ["fixture.db"],
    since,
    sqlite: { async query() { return [
      { index: 1, timestamp: "2026-09-01T10:00:00.000Z", model: "gemini-pro", inputTokens: 10, cacheReadTokens: 2, outputTokens: 5 },
      { index: 2, timestamp: "2026-09-01T10:00:01.000Z", model: "gemini-pro", inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 },
    ]; } },
    pricing,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].tokens.total, 17);
});

test("Antigravity consulta gen_metadata em lotes com cursor crescente", async () => {
  const calls = [];
  const events = await scanAntigravityHistory({
    databases: ["fixture.db"],
    since,
    sqlite: { async query(database, sql) {
      calls.push({ database, sql });
      return [{ index: 4, timestamp: "2026-09-01T10:00:00.000Z", model: "gemini-pro", inputTokens: 1, outputTokens: 1 }];
    } },
  });
  assert.equal(events.length, 1);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /pragma_table_info/);
  assert.match(calls[1].sql, /FROM gen_metadata/);
  assert.match(calls[1].sql, /WHERE idx > -1 AND data IS NOT NULL/);
  assert.match(generationSQL(42), /WHERE idx > 42 AND data IS NOT NULL/);
});

test("Antigravity descobre todos os stores e não duplica diretório por symlink @spec:AC-350 @spec:AC-352", async () => {
  const home = await makeRoot("antigravity-home");
  const gemini = join(home, ".gemini");
  const cliConversations = join(gemini, "antigravity-cli", "conversations");
  const ideConversations = join(gemini, "antigravity-ide", "conversations");
  await mkdir(cliConversations, { recursive: true });
  await mkdir(ideConversations, { recursive: true });
  await writeFile(join(cliConversations, "cli.db"), "");
  await writeFile(join(ideConversations, "ide.db"), "");
  await symlink(join(gemini, "antigravity-ide"), join(gemini, "antigravity-copy"));
  const calls = [];
  const provider = createAntigravityProvider({
    env: { HOME: home },
    sqlite: { async query(database, sql) {
      calls.push({ database, sql });
      if (sql.includes("pragma_table_info")) return [{ name: "metadata" }];
      return [{ index: 1, timestamp: "2026-09-01T10:00:00.000Z", model: "gemini-pro", inputTokens: 1, outputTokens: 1 }];
    } },
  });
  const result = await provider.readHistory({ since });

  assert.equal(result.events.length, 2);
  assert.equal(new Set(calls.map(call => call.database)).size, 2);
  assert.deepEqual([...new Set(calls.map(call => call.database))].sort(), [
    await realpath(join(cliConversations, "cli.db")),
    await realpath(join(ideConversations, "ide.db")),
  ].sort());
});

test("Antigravity usa steps.metadata quando a geração não carrega timestamp @spec:AC-351", async () => {
  const generation = generationHex({ modelID: "gemini-pro-default", label: "gemini-pro" });
  const stepMetadata = stepMetadataHex(1788256800);
  const events = await scanAntigravityHistory({
    databases: ["fixture.db"],
    since,
    sqlite: { async query(_database, sql) {
      if (sql.includes("pragma_table_info")) return [{ name: "metadata" }];
      return [{ index: 1, hex: generation, step_hex: stepMetadata }];
    } },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].timestamp, "2026-09-01T10:00:00.000Z");
  assert.equal(events[0].model, "gemini-pro");
  assert.deepEqual(events[0].tokens, {
    input: 12, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 3, output: 5, total: 20,
  });
});
