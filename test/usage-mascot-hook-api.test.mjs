import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startServer } from "../server.js";
import { createDokkeUsageSource } from "../usage.js";

test("endpoint de atividade aceita somente payload normalizado do loopback", async () => {
  const root = await mkdtemp(join(tmpdir(), "dokke-mascot-api-"));
  const events = [];
  const usage = {
    getActivity: async () => ({ ok: true, source: "dokke", sourceState: "available", providers: {}, errors: [] }),
    ingestActivityEvent(event) { events.push(event); return true; },
    close() {},
  };
  const server = await startServer({ port: 0, root, config: { pinned: [] }, obs: null, usage });
  try {
    const accepted = await fetch(`http://127.0.0.1:${server.port}/api/usage/activity/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "claude",
        sessionId: "session-1",
        state: "working",
        prompt: "não deve ser encaminhado",
      }),
    });
    assert.equal(accepted.status, 204);
    assert.deepEqual(events, [{
      providerId: "claude",
      sessionId: "session-1",
      state: "working",
      observedAt: events[0].observedAt,
    }]);
    assert.equal("prompt" in events[0], false);

    const rejected = await fetch(`http://127.0.0.1:${server.port}/api/usage/activity/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: "random-ai", sessionId: "x", state: "working" }),
    });
    assert.equal(rejected.status, 400);
    assert.equal(events.length, 1);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("evento publicado no endpoint chega ao monitor nativo do Dokke", async () => {
  const root = await mkdtemp(join(tmpdir(), "dokke-mascot-runtime-"));
  const dataDir = await mkdtemp(join(tmpdir(), "dokke-mascot-data-"));
  const source = createDokkeUsageSource({
    dataDir,
    intervalMs: 0,
    activityIntervalMs: 0,
    providers: [{ id: "codex", readActivity: async () => ({ state: "idle" }) }],
  });
  const server = await startServer({ port: 0, root, config: { pinned: [] }, obs: null, usage: source });
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/api/usage/activity/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: "codex", sessionId: "terminal-1", state: "working" }),
    });
    assert.equal(response.status, 204);
    const activity = await fetch(`http://127.0.0.1:${server.port}/api/usage/activity`).then(result => result.json());
    assert.equal(activity.providers.codex.state, "working");
    assert.equal(activity.providers.codex.sessions, 1);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
    await rm(dataDir, { recursive: true, force: true });
  }
});
