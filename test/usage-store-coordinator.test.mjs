import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUsageStore } from "../usage/store.js";
import { createUsageCoordinator } from "../usage/coordinator.js";
import { createProgressResource } from "../usage/models.js";

const roots = [];
const now = new Date("2026-09-01T15:00:00.000Z");

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function makeRoot(prefix) {
  const root = await mkdtemp(join(tmpdir(), `dokke-${prefix}-`));
  roots.push(root);
  return root;
}

function provider(id, { fail = false, calls = [], resource = true } = {}) {
  return {
    id,
    name: id,
    async hasCredentials() { calls.push(`${id}:credentials`); return true; },
    async fetchLive() {
      calls.push(`${id}:live`);
      if (fail) throw new Error("offline");
      return { value: id };
    },
    async readHistory() {
      calls.push(`${id}:history`);
      return { events: [] };
    },
    normalize({ now: at }) {
      return {
        id,
        name: id,
        plan: null,
        status: resource ? "normal" : "unknown",
        mascot: resource ? "energized" : "neutral",
        stale: false,
        refreshedAt: at.toISOString(),
        resources: resource ? {
          session: {
            ...createProgressResource({ id: "session", label: "Sessão", used: 25, limit: 100, periodDurationMs: 18000000 }),
            utilization: 0.25,
          },
        } : {},
        trend: null,
        history: { today: null, yesterday: null, last30Days: null, byModel: [] },
        unknownModels: [],
      };
    },
  };
}

test("store persiste somente o snapshot e recarrega com stale", async () => {
  const root = await makeRoot("store");
  const file = join(root, "nested", "usage-cache.json");
  const snapshot = { ok: true, source: "dokke", sourceState: "available", updatedAt: now.toISOString(), providers: { codex: { resources: {} } }, errors: [] };
  const store = createUsageStore({ file });
  await store.save(snapshot);
  const raw = JSON.parse(await readFile(file, "utf8"));
  assert.equal(raw.schema, 1);
  assert.deepEqual(raw.snapshot, snapshot);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const loaded = await createUsageStore({ file }).load({ stale: true });
  assert.equal(loaded.providers.codex.stale, true);
  assert.equal(loaded.source, "dokke");
});

test("coordenador atualiza providers em paralelo e retorna partial sem apagar dados bons", async () => {
  const root = await makeRoot("coordinator");
  const calls = [];
  const good = provider("codex", { calls });
  const bad = provider("claude", { calls, fail: true, resource: false });
  const coordinator = createUsageCoordinator({
    providers: [good, bad],
    store: createUsageStore({ file: join(root, "usage-cache.json") }),
    now: () => now,
    refreshMs: 60_000,
    intervalMs: 0,
  });
  const result = await coordinator.refresh({ force: true });
  assert.equal(result.source, "dokke");
  assert.equal(result.sourceState, "partial");
  assert.equal(result.providers.codex.resources.session.remaining, 75);
  assert.equal(result.providers.claude.status, "unknown");
  assert.equal(result.providers.claude.stale, false);
  assert.equal(result.errors[0].providerId, "claude");
  assert.deepEqual(calls.filter(call => call.endsWith(":live")).sort(), ["claude:live", "codex:live"]);
  coordinator.close();
});

test("coordenador reaproveita cache durante backoff e força nova tentativa", async () => {
  const root = await makeRoot("backoff");
  let fail = false;
  let calls = 0;
  const flaky = {
    ...provider("codex", { resource: true }),
    async fetchLive() { calls += 1; if (fail) throw new Error("offline"); return {}; },
  };
  const coordinator = createUsageCoordinator({
    providers: [flaky],
    store: createUsageStore({ file: join(root, "usage-cache.json") }),
    now: () => now,
    backoffMs: 300_000,
    intervalMs: 0,
  });
  await coordinator.refresh({ force: true });
  fail = true;
  const failed = await coordinator.refresh({ force: true });
  assert.equal(failed.providers.codex.stale, true);
  const duringBackoff = await coordinator.refresh();
  assert.equal(duringBackoff.providers.codex.stale, true);
  assert.equal(calls, 2);
  const forced = await coordinator.refresh({ force: true });
  assert.equal(calls, 3);
  assert.equal(forced.providers.codex.stale, true);
  coordinator.close();
});
