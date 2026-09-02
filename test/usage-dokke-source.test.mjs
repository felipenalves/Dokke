import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDokkeUsageSource } from "../usage.js";

const roots = [];

test.afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

test("fonte nativa do Dokke não consulta o loopback do OpenUsage", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "dokke-source-"));
  roots.push(dataDir);
  const calls = [];
  const provider = {
    id: "codex",
    name: "Codex",
    async hasCredentials() { return true; },
    async fetchLive() {
      calls.push("live");
      return { body: { rate_limit: { primary_window: { used_percent: 32, limit_window_seconds: 18000, reset_at: 1788304200 } } } };
    },
    async readHistory() { return { events: [] }; },
    normalize({ live, history, now }) {
      const window = live.body.rate_limit.primary_window;
      return {
        id: "codex", name: "Codex", plan: "Plus", status: "normal", mascot: "energized", stale: false,
        refreshedAt: now.toISOString(),
        resources: { session: { kind: "consumption", unit: "percent", used: window.used_percent, limit: 100, remaining: 68, utilization: 0.32, resetsAt: "2026-09-01T20:00:00.000Z", periodDurationMs: 18000000, estimated: false } },
        trend: history.trend?.length ? { points: history.trend } : null,
        history: history.summary,
        unknownModels: [],
      };
    },
  };
  const source = createDokkeUsageSource({ dataDir, providers: [provider], intervalMs: 0, fetchImpl: async url => { calls.push(String(url)); throw new Error("não deveria usar fetch global"); } });
  const result = await source.getUsage({ force: true });
  assert.equal(result.source, "dokke");
  assert.equal(result.sourceState, "available");
  assert.equal(result.providers.codex.resources.session.used, 32);
  assert.deepEqual(calls, ["live"]);
  source.close();
});
