import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDokkeUsageSource } from "../usage.js";
import { classifyActivityLine, createActivityMonitor, scanFileActivity } from "../usage/activity.js";
import { createAntigravityProvider } from "../usage/providers/antigravity.js";
import { createClaudeProvider } from "../usage/providers/claude.js";
import { createCodexProvider } from "../usage/providers/codex.js";
import { createGrokProvider } from "../usage/providers/grok.js";

const NOW = new Date("2026-09-01T15:00:00.000Z");

async function touch(file, content, date = NOW) {
  await writeFile(file, content);
  await utimes(file, date, date);
}

test("atividade local distingue working, waiting e idle pela liveness da sessão", async () => {
  const root = await mkdtemp(join(tmpdir(), "dokke-activity-"));
  const file = join(root, "session.jsonl");
  try {
    await touch(file, JSON.stringify({ type: "task_started" }) + "\n");
    const working = await scanFileActivity({
      providerId: "codex", roots: [root], now: NOW, staleAfterMs: 10_000, waitingAfterMs: 120_000,
    });
    assert.equal(working.state, "working");
    assert.equal(working.sessions, 1);
    assert.equal(working.since, NOW.toISOString());

    await touch(file, JSON.stringify({ type: "approval_requested" }) + "\n", new Date(NOW.getTime() - 30_000));
    const waiting = await scanFileActivity({
      providerId: "codex", roots: [root], now: NOW, staleAfterMs: 10_000, waitingAfterMs: 120_000,
    });
    assert.equal(waiting.state, "waiting");

    await touch(file, JSON.stringify({ type: "task_started" }) + "\n", new Date(NOW.getTime() - 20_000));
    const idle = await scanFileActivity({
      providerId: "codex", roots: [root], now: NOW, staleAfterMs: 10_000, waitingAfterMs: 120_000,
    });
    assert.equal(idle.state, "idle");
    assert.equal(idle.sessions, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("atividade reconhece conclusão no stop_reason aninhado do transcript", () => {
  const result = classifyActivityLine(JSON.stringify({
    type: "assistant",
    message: { role: "assistant", stop_reason: "end_turn" },
  }));
  assert.equal(result.state, "idle");
});

test("monitor de atividade publica estados por provider sem tocar na quota", async () => {
  const monitor = createActivityMonitor({
    providers: [
      { id: "codex", readActivity: async () => ({ state: "working", since: NOW.toISOString(), detail: "processando" }) },
      { id: "claude", readActivity: async () => ({ state: "idle", since: null }) },
    ],
    now: () => NOW,
    intervalMs: 0,
  });
  try {
    const snapshot = await monitor.getActivity();
    assert.equal(snapshot.source, "dokke");
    assert.equal(snapshot.providers.codex.state, "working");
    assert.equal(snapshot.providers.claude.state, "idle");
    assert.equal(snapshot.providers.codex.detail, "processando");
  } finally {
    monitor.close();
  }
});

test("os quatro providers expõem atividade a partir dos próprios arquivos locais", async () => {
  const root = await mkdtemp(join(tmpdir(), "dokke-provider-activity-"));
  try {
    const cases = [
      ["claude", createClaudeProvider({ activityRoots: [root] }), "claude.jsonl"],
      ["codex", createCodexProvider({ activityRoots: [root] }), "codex.jsonl"],
      ["antigravity", createAntigravityProvider({ activityRoots: [root] }), "transcript.jsonl"],
      ["grok", createGrokProvider({ activityRoots: [root] }), "updates.jsonl"],
    ];
    for (const [id, provider, filename] of cases) {
      await touch(join(root, filename), JSON.stringify({ type: "turn_started" }) + "\n");
      const activity = await provider.readActivity({ now: NOW });
      assert.equal(activity.state, "working", id);
      await rm(join(root, filename), { force: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fonte do Dokke anexa atividade viva ao snapshot sem alterar resources", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "dokke-source-activity-"));
  const provider = {
    id: "codex",
    name: "Codex",
    async readActivity() { return { state: "working", since: NOW.toISOString(), detail: "processando" }; },
    normalize({ history, now }) {
      return {
        id: "codex", name: "Codex", plan: null, status: "normal", mascot: "energized", stale: false,
        refreshedAt: now.toISOString(), resources: { session: { used: 20 } }, history, trend: null,
      };
    },
  };
  const source = createDokkeUsageSource({ dataDir, providers: [provider], now: () => NOW, intervalMs: 0 });
  try {
    const snapshot = await source.getUsage({ force: true });
    assert.equal(snapshot.providers.codex.activity.state, "working");
    assert.deepEqual(snapshot.providers.codex.resources, { session: { used: 20 } });
    assert.equal((await source.getActivity()).providers.codex.state, "working");
  } finally {
    source.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
