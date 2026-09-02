# Dokke Usage OpenUsage Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar para o backend do Dokke o comportamento real do OpenUsage para quotas, histórico, tokens, custos e Usage Trend, mantendo os clientes atuais.

**Architecture:** O Node do Dokke terá um catálogo de providers, mappers de quota ao vivo, scanners locais de histórico, pricing e agregação diária. Cada provider produz um snapshot normalizado; um store persistente mantém o último resultado válido e o `/api/usage` projeta esse snapshot para PWA e macOS.

**Tech Stack:** Node.js 20, ES modules, `node:test`, `fs/promises`, `child_process` com argumentos fixos, SQLite via processo `sqlite3` quando necessário, Swift Codable para o cliente macOS.

**Spec:** `docs/superpowers/specs/2026-09-01-dokke-usage-openusage-port-design.md`

## Global Constraints

- A duração da sessão é 5 horas, a semanal é 7 dias e a janela de histórico é hoje mais os 30 dias anteriores.
- `refreshedAt` permanece no payload; `providers` é sempre um objeto; `sourceState: "partial"` é renderizável.
- Tokens de quota, tokens de histórico e custo calculado são dados distintos.
- Modelo sem preço não entra nos totais; deve aparecer em `unknownModels`.
- O refresh periódico é de 5 minutos; timeout individual é de 10 segundos; backoff de falha é de 5 minutos.
- O cache persistido contém somente snapshots normalizados e eventos mínimos; não contém credenciais, prompts ou respostas.
- Processos auxiliares recebem arrays de argumentos fixos; nenhum caminho vindo do usuário é interpolado em shell.
- Preservar as alterações existentes de UI em `public/index.html`, `test/ui.test.mjs` e `test/usage.test.mjs`.
- Após alterações Node/PWA, executar `npm test`; após alterações Swift, executar também `cd mac && swift build`.
- Não fazer commit, push, PR, deploy ou release sem pedido explícito.

### Task 1: Criar o domínio comum de métricas e fixtures reais

**Files:**
- Create: `usage/models.js`
- Create: `test/usage-domain.test.mjs`
- Create: `test/fixtures/usage/claude-usage.json`
- Create: `test/fixtures/usage/codex-usage.json`
- Create: `test/fixtures/usage/antigravity-quota.json`
- Create: `test/fixtures/usage/grok-credits.json`

**Interfaces:**
- Produces `SESSION_PERIOD_MS`, `WEEK_PERIOD_MS`, `HISTORY_DAYS`, `normalizeTimestamp`, `clampPercent`, `createProgressResource`, `createValuesResource` and `createUsageError`.
- Consumes somente objetos JSON sanitizados dos formatos reais dos providers.

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createProgressResource, normalizeTimestamp } from "../usage/models.js";

test("normaliza uma janela de 5 horas sem perder reset e duracao", () => {
  const resource = createProgressResource({
    id: "session", label: "Session", used: 32, limit: 100,
    resetsAt: "2026-09-01T23:10:00.000Z", periodDurationMs: 5 * 60 * 60 * 1000
  });
  assert.deepEqual(resource, {
    id: "session", label: "Session", kind: "consumption", unit: "percent",
    used: 32, limit: 100, remaining: 68, utilization: 32,
    resetsAt: "2026-09-01T23:10:00.000Z", periodDurationMs: 18000000,
    estimated: false
  });
  assert.equal(normalizeTimestamp(1778022600000), "2026-05-05T23:10:00.000Z");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/usage-domain.test.mjs`

Expected: FAIL because `usage/models.js` and its normalization functions do not exist.

- [ ] **Step 3: Write minimal implementation**

```js
export const SESSION_PERIOD_MS = 5 * 60 * 60 * 1000;
export const WEEK_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
export const HISTORY_DAYS = 30;

export function normalizeTimestamp(value) {
  const date = typeof value === "number"
    ? new Date(Math.abs(value) < 1e10 ? value * 1000 : value)
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function createProgressResource(input) {
  const limit = Number.isFinite(input.limit) && input.limit > 0 ? input.limit : null;
  const used = Number.isFinite(input.used) && limit !== null
    ? Math.max(0, Math.min(limit, input.used)) : null;
  const remaining = used === null ? null : limit - used;
  return {
    id: String(input.id), label: String(input.label), kind: "consumption", unit: input.format || "percent",
    used, limit, remaining, utilization: used === null ? null : used / limit * 100,
    resetsAt: normalizeTimestamp(input.resetsAt),
    periodDurationMs: Number.isFinite(input.periodDurationMs) ? input.periodDurationMs : null,
    estimated: input.estimated === true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/usage-domain.test.mjs`

Expected: PASS.

- [ ] **Step 5: Add provider fixtures and format tests**

Add sanitized response bodies copied from the OpenUsage test shapes, with tokens and credentials removed. Assert that the fixture keys used by each mapper are present before adding provider code:

```js
for (const fixture of [claude, codex, antigravity, grok]) {
  assert.equal(typeof fixture, "object");
}
```

Run: `node --test test/usage-domain.test.mjs`

Expected: all domain and fixture assertions PASS.

### Task 2: Port pricing, token buckets, daily aggregation and trend

**Files:**
- Create: `usage/pricing.js`
- Create: `usage/history.js`
- Create: `test/usage-history.test.mjs`

**Interfaces:**
- `createPricingCatalog(entries)` returns `resolve(model, providerId)`; the named `costDollars(rates, tokens, options)` function prices one normalized event.
- `aggregateUsageEvents(events, { now, pricing, daysBack })` returns `{ series, modelUsage, unknownModelsByDay }`.
- `buildSpendSummary(series, now)` returns `{ today, yesterday, last30Days, byModel }`.
- `buildUsageTrend(series, now)` returns 31 oldest-first points with zero-filled days.

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createPricingCatalog, costDollars } from "../usage/pricing.js";
import { aggregateUsageEvents, buildSpendSummary, buildUsageTrend } from "../usage/history.js";

const now = new Date("2026-09-01T15:00:00.000Z");
const pricing = createPricingCatalog({ "claude-sonnet": {
  inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 3.75, cacheReadPerMillion: .3
}});

test("custa buckets de input, cache e output na formula do OpenUsage", () => {
  assert.equal(costDollars(pricing.resolve("claude-sonnet"), {
    input: 1_000_000, cacheWrite5m: 100_000, cacheWrite1h: 100_000, cacheRead: 200_000, output: 100_000
  }), 5.535);
});

test("agrega tokens por dia e exclui modelo sem preco sem contar como zero", () => {
  const result = aggregateUsageEvents([
    { timestamp: "2026-09-01T10:00:00.000Z", model: "claude-sonnet", tokens: { input: 10, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 5, total: 15 } },
    { timestamp: "2026-09-01T11:00:00.000Z", model: "unknown-model", tokens: { input: 20, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 5, total: 25 } }
  ], { now, pricing });
  assert.equal(result.series.daily[0].totalTokens, 15);
  assert.deepEqual(result.unknownModelsByDay["2026-09-01"], ["unknown-model"]);
});

test("tendencia preserva dias vazios e retorna hoje mais 30 dias", () => {
  const series = { daily: [{ date: "2026-09-01", totalTokens: 15, costUSD: 0.1, models: [] }] };
  const trend = buildUsageTrend(series, now);
  assert.equal(trend.length, 31);
  assert.equal(trend.at(-1).value, 15);
  assert.equal(trend.at(-2).value, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/usage-history.test.mjs`

Expected: FAIL because pricing, aggregation and trend functions do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `costDollars` with the five buckets, cache-write de uma hora em `2x input`, and optional fast/long-context multipliers only when the event carries the required metadata. Implement `aggregateUsageEvents` with a `Map` keyed by local `YYYY-MM-DD` and model; deduplicate exact `(timestamp, model, token buckets)` keys; skip unresolved prices and record their model. Implement `buildUsageTrend` over `(now - 30 days)...now`, with one point per calendar day.

```js
export function costDollars(rates, tokens, { fast = false, fastMultiplier = 1 } = {}) {
  const value = tokens.input * rates.inputPerMillion
    + tokens.cacheWrite5m * rates.cacheWritePerMillion
    + tokens.cacheWrite1h * rates.inputPerMillion * 2
    + tokens.cacheRead * rates.cacheReadPerMillion
    + tokens.output * rates.outputPerMillion;
  return value / 1_000_000 * (fast ? fastMultiplier : 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/usage-history.test.mjs`

Expected: PASS, including unknown-model exclusion and 31 trend points.

- [ ] **Step 5: Refactor only after green**

Move date-key and model-total helpers into `usage/history.js`, keep the public result shape stable, and rerun `node --test test/usage-history.test.mjs`.

### Task 3: Port incremental local history readers

**Files:**
- Create: `usage/history-cache.js`
- Create: `usage/providers/claude-history.js`
- Create: `usage/providers/codex-history.js`
- Create: `usage/providers/grok-history.js`
- Create: `usage/providers/antigravity-history.js`
- Create: `test/usage-history-providers.test.mjs`

**Interfaces:**
- `createIncrementalFileCache({ cacheFile, fs, now })` indexes a file by resolved path, byte size and mtime, and returns cached parsed rows for unchanged files.
- `scanClaudeHistory({ roots, since, cache, pricing })` returns normalized events and unknown models.
- `scanCodexHistory({ homes, since, cache, pricing })` returns normalized events and ignores cumulative re-emits and child-session replays.
- `scanGrokHistory({ roots, since, cache, pricing })` returns normalized events using carried `costUSD` first.
- `scanAntigravityHistory({ databases, since, sqlite, pricing })` returns only valid generation events.

- [ ] **Step 1: Write the failing tests**

Create fixtures with one valid event, one duplicate, one cumulative re-emission, one unknown model and one malformed row. Assert the provider-specific rules:

```js
test("Codex usa o delta do total_token_usage e nao duplica snapshot reemitido", async () => {
  const events = await scanCodexHistory({ homes: [fixtureHome], since, cache: memoryCache, pricing });
  assert.deepEqual(events.map(event => event.tokens.total), [15]);
});

test("Claude prefere a entrada pai quando sidechain e pai colidem", async () => {
  const events = await scanClaudeHistory({ roots: [fixtureRoot], since, cache: memoryCache, pricing });
  assert.equal(events[0].tokens.total, 15);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/usage-history-providers.test.mjs`

Expected: FAIL because the four scanners and incremental cache do not exist.

- [ ] **Step 3: Write minimal implementation**

Use `fs.readdir`/`fs.stat` with allowlisted roots. Claude parses `usage`, timestamp, message/request IDs and model, then applies the sidechain/total/speed collision order. Codex tracks the current model from `turn_context`, computes deltas from cumulative token counts, ignores replayed child history until the first live task, and deduplicates identical events across files. Grok and Antigravity map only fields present in their OpenUsage formats. The scanner functions return normalized event arrays; pricing and daily aggregation remain in Task 2.

The cache record is limited to parsed normalized events and the source fingerprint:

```js
{
  schema: 1,
  files: { [absolutePath]: { size, mtimeMs, events: [] } }
}
```

Reject files above the configured byte limit, reject symlinks outside the provider root, and cap rows/events before aggregation.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/usage-history-providers.test.mjs`

Expected: PASS for all four scanners, duplicate handling, malformed input and cache reuse.

- [ ] **Step 5: Run focused regression**

Run: `node --test test/usage-domain.test.mjs test/usage-history.test.mjs test/usage-history-providers.test.mjs`

Expected: all focused tests PASS.

### Task 4: Port live quota adapters

**Files:**
- Create: `usage/providers/claude.js`
- Create: `usage/providers/codex.js`
- Create: `usage/providers/antigravity.js`
- Create: `usage/providers/grok.js`
- Create: `test/usage-provider-adapters.test.mjs`

**Interfaces:**
- Every adapter exposes `id`, `name`, `async hasCredentials()`, `async fetchLive({ signal })`, `async readHistory({ since })`, and `normalize({ live, history, now })`.
- `createProviderCatalog({ providers })` returns providers in the Dokke order and does not fabricate a provider without a source.

- [ ] **Step 1: Write the failing tests**

```js
test("Claude mapeia five_hour e seven_day para session e weekly", async () => {
  const result = claude.normalize({ live: claudeFixture, history: emptyHistory, now });
  assert.equal(result.resources.session.used, 32);
  assert.equal(result.resources.weekly.used, 61);
  assert.equal(result.resources.session.periodDurationMs, 5 * 60 * 60 * 1000);
});

test("Codex classifica janelas pela duracao real", () => {
  const result = codex.normalize({ live: codexFixture, history: emptyHistory, now });
  assert.equal(result.resources.session.periodDurationMs, 5 * 60 * 60 * 1000);
  assert.equal(result.resources.weekly.periodDurationMs, 7 * 24 * 60 * 60 * 1000);
});

test("Antigravity aceita somente os quatro buckets conhecidos", () => {
  const result = antigravity.normalize({ live: antigravityFixture, history: emptyHistory, now });
  assert.deepEqual(Object.keys(result.resources), ["session", "weekly", "claude", "claudeWeekly"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/usage-provider-adapters.test.mjs`

Expected: FAIL because provider adapters and catalog do not exist.

- [ ] **Step 3: Write minimal implementation**

Port the mappers without converting missing values into zeros. Claude reads `five_hour`, `seven_day`, `extra_usage`; Codex reads `rate_limit` windows, `additional_rate_limits` and credits; Antigravity reads the authoritative quota summary before legacy pooling; Grok reads its credits endpoint and plan. Auth readers are injected so tests never access the real keychain. Production readers may use the provider's existing local credential files or the macOS `security` executable with fixed arguments, but never expose the secret to the API.

```js
function mapWindow(id, label, window, periodDurationMs, now) {
  if (!window || !Number.isFinite(window.usedPercent)) return null;
  const resetsAt = window.resetAt
    || (Number.isFinite(window.resetAfterSeconds)
      ? new Date(now.getTime() + window.resetAfterSeconds * 1000).toISOString()
      : null);
  return createProgressResource({
    id, label, used: window.usedPercent, limit: 100,
    format: "percent", resetsAt,
    periodDurationMs
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/usage-provider-adapters.test.mjs`

Expected: PASS, including missing fields, rate-limit response and unknown provider data.

- [ ] **Step 5: Run adapter plus history regression**

Run: `node --test test/usage-provider-adapters.test.mjs test/usage-history-providers.test.mjs`

Expected: all provider tests PASS.

### Task 5: Build persistent store and coordinator

**Files:**
- Create: `usage/store.js`
- Create: `usage/coordinator.js`
- Create: `test/usage-store.test.mjs`

**Interfaces:**
- `createUsageStore({ file, fs, now })` exposes `load()`, `getSnapshot()`, `save(snapshot)`, `markStale(snapshot)` and atomic persistence.
- `createUsageCoordinator({ catalog, store, now, timeoutMs, ttlMs, backoffMs })` exposes `getUsage({ force })`, `refresh({ force })` and `close()`.

- [ ] **Step 1: Write the failing tests**

```js
test("store preserva last-good quando um provider falha", async () => {
  const fixedNow = () => new Date("2026-09-01T15:00:00.000Z");
  const memoryStore = { load() {}, getSnapshot() { return null; }, save() {} };
  const validSnapshot = { id: "codex", name: "Codex", resources: {}, history: null, trend: null, stale: false, refreshedAt: fixedNow().toISOString() };
  const failingSecondProviderCatalog = [
    { id: "codex", async refresh() { return validSnapshot; } },
    { id: "claude", async refresh() { throw new Error("fixture failure"); } }
  ];
  const coordinator = createUsageCoordinator({ catalog: failingSecondProviderCatalog, store: memoryStore, now: fixedNow });
  const result = await coordinator.refresh({ force: true });
  assert.equal(result.providers.codex.stale, false);
  assert.equal(result.providers.claude.stale, true);
  assert.equal(result.sourceState, "partial");
});

test("refresh manual ignora TTL e backoff, mas o periodico nao duplica provider", async () => {
  let calls = 0;
  const fixedNow = () => new Date("2026-09-01T15:00:00.000Z");
  const memoryStore = { load() {}, getSnapshot() { return null; }, save() {} };
  const validSnapshot = { id: "codex", name: "Codex", resources: {}, history: null, trend: null, stale: false, refreshedAt: fixedNow().toISOString() };
  const provider = { id: "codex", async refresh() { calls += 1; return validSnapshot; } };
  const coordinator = createUsageCoordinator({ catalog: [provider], store: memoryStore, ttlMs: 300000, now: fixedNow });
  await Promise.all([coordinator.getUsage(), coordinator.getUsage()]);
  assert.equal(calls, 1);
  await coordinator.getUsage({ force: true });
  assert.equal(calls, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/usage-store.test.mjs`

Expected: FAIL because store and coordinator do not exist.

- [ ] **Step 3: Write minimal implementation**

Use one in-flight promise per provider, `Promise.all` for independent providers, `AbortController` for 10-second provider deadlines, and a five-minute failure retry timestamp. Write JSON to a sibling temporary file and rename it into the target. Load disk snapshots at construction, mark them stale for the first refresh, and never persist error snapshots.

```js
const writeAtomic = async (file, data, fs) => {
  const temp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temp, JSON.stringify(data), { mode: 0o600 });
  await fs.rename(temp, file);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/usage-store.test.mjs`

Expected: PASS for last-good, stale, partial, timeout, deduplication and atomic persistence.

- [ ] **Step 5: Run focused domain/provider/store regression**

Run: `node --test test/usage-domain.test.mjs test/usage-history.test.mjs test/usage-history-providers.test.mjs test/usage-provider-adapters.test.mjs test/usage-store.test.mjs`

Expected: all focused tests PASS.

### Task 6: Integrate `/api/usage` without breaking clients

**Files:**
- Modify: `usage.js`
- Modify: `server.js:300-480`
- Modify: `test/usage.test.mjs`
- Modify: `test/smoke.test.mjs`

**Interfaces:**
- Preserve `createUsageSource()` as the injected test seam.
- Default `createUsageSource()` creates the Dokke coordinator and uses the existing Dokke Application Support directory.
- Keep `normalizeOpenUsage` only for old fixture tests until the final removal step; no production request calls OpenUsage after this task.

- [ ] **Step 1: Write the failing integration tests**

```js
test("source padrao do Dokke nao chama OpenUsage e retorna source dokke", async () => {
  const fixtureCatalog = [{ id: "codex", async refresh() {
    return { id: "codex", name: "Codex", resources: {}, history: null, trend: null, stale: false, refreshedAt: "2026-09-01T15:00:00.000Z" };
  } }];
  const memoryStore = { load() {}, getSnapshot() { return null; }, save() {} };
  const source = createUsageSource({ catalog: fixtureCatalog, store: memoryStore, fetchImpl: undefined });
  const result = await source.getUsage({ force: true });
  assert.equal(result.source, "dokke");
  assert.equal(typeof result.providers, "object");
  assert.notEqual(Array.isArray(result.providers), true);
});

test("API aceita partial sem apagar o provider valido", async () => {
  const partialUsageSource = { async getUsage() {
    return { ok: true, source: "dokke", sourceState: "partial", updatedAt: "2026-09-01T15:00:00.000Z", providers: {
      codex: { id: "codex", name: "Codex", resources: {}, history: null, trend: null, stale: false, refreshedAt: "2026-09-01T15:00:00.000Z" }
    }, errors: [{ code: "provider_failed", message: "Claude indisponível" }] };
  } };
  const { port, close } = await startServer(0, { usage: partialUsageSource });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/usage`);
    const body = await response.json();
    assert.equal(body.sourceState, "partial");
    assert.ok(body.providers.codex);
  } finally { await close(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/usage.test.mjs test/smoke.test.mjs`

Expected: FAIL because the default source still calls `127.0.0.1:6736` and the API/client contract is still OpenUsage-shaped.

- [ ] **Step 3: Write minimal integration**

Replace only the production default inside `createUsageSource`; retain dependency injection for existing tests. Pass the server's `dataDir` to the source factory so the usage cache lands under `~/Library/Application Support/Dokke`, and add a `close()` call from `startServer` to stop the refresh timer. Return `providers: {}` for unavailable results and keep `refreshedAt` on every provider snapshot.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/usage.test.mjs test/smoke.test.mjs`

Expected: PASS, including authenticated API access and no OpenUsage request.

- [ ] **Step 5: Run the full Node suite**

Run: `npm test`

Expected: PASS with no regressions outside Usage.

### Task 7: Update native/PWA consumers and retire the OpenUsage contract

**Files:**
- Modify: `mac/Sources/UsageModels.swift`
- Modify: `mac/Sources/DockStore.swift`
- Modify: `public/index.html`
- Modify: `test/native-usage-ui.test.mjs`
- Modify: `test/usage.test.mjs`

**Interfaces:**
- `UsageProvider` decodes additive `history` and `trend.days` fields while keeping existing `resources`, `trend.points` and `refreshedAt` behavior.
- `DockStore.loadUsage(force:)` keeps the existing endpoint and accepts `sourceState == "partial"`.
- PWA renders the existing 5-hour/weekly card and second-slide trend from the normalized resources/history; it does not compute quota or cost.

- [ ] **Step 1: Write the failing contract tests**

```js
test("Swift aceita sourceState partial e history sem perder refreshedAt", async () => {
  const swift = await readFile(new URL("../mac/Sources/UsageModels.swift", import.meta.url), "utf8");
  assert.match(swift, /sourceState/);
  assert.match(swift, /refreshedAt/);
  assert.match(swift, /history/);
});

test("PWA usa somente activity local e nao transforma quota em gasto", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /usageTrendNode/);
  assert.doesNotMatch(html, /resources\.[^;]+totalTokens/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/native-usage-ui.test.mjs test/usage.test.mjs`

Expected: FAIL because the Swift model has no history field and the client still treats only `available` as usable.

- [ ] **Step 3: Write minimal client changes**

Add optional Codable fields for history and activity metadata without changing the existing resource lookup helpers. Change the Swift render gate from `sourceState == "available"` to `sourceState != "unavailable"` when providers are present. Keep mascot activity separate from quota until a verified event source is implemented. Remove visible OpenUsage copy from the Usage source/unavailable strings because the backend is now Dokke-owned.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/native-usage-ui.test.mjs test/usage.test.mjs`

Expected: PASS.

- [ ] **Step 5: Compile native client**

Run: `cd mac && swift build`

Expected: successful Swift build.

- [ ] **Step 6: Run complete verification**

Run: `npm test && (cd mac && swift build)`

Expected: all Node tests and Swift compilation PASS. Inspect `git diff --check` and `git status --short`; do not include unrelated visual changes or generated artifacts in a future commit.

## Coverage Check

- Live 5-hour and weekly quota: Task 4.
- Reset timestamp and period duration: Tasks 1 and 4.
- Tokens, cache buckets and cost: Tasks 2 and 3.
- Today/Yesterday/Last 30 Days and model breakdown: Task 2.
- 31-point Usage Trend with zero-fill: Task 2.
- Incremental local parsing and deduplication: Task 3.
- Persistent last-good cache, stale, timeout, backoff and refresh: Task 5.
- Dokke API compatibility and `partial`: Task 6.
- macOS/PWA compatibility: Task 7.
- Credential, path, process, cache and payload protections: Tasks 3–6.
