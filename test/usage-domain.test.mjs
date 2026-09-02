import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createProgressResource, normalizeTimestamp } from "../usage/models.js";

test("normaliza uma janela de 5 horas sem perder reset e duração", () => {
  const resource = createProgressResource({
    id: "session",
    label: "Session",
    used: 32,
    limit: 100,
    resetsAt: "2026-09-01T23:10:00.000Z",
    periodDurationMs: 5 * 60 * 60 * 1000,
  });

  assert.deepEqual(resource, {
    id: "session",
    label: "Session",
    kind: "consumption",
    unit: "percent",
    used: 32,
    limit: 100,
    remaining: 68,
    utilization: 32,
    resetsAt: "2026-09-01T23:10:00.000Z",
    periodDurationMs: 18000000,
    estimated: false,
  });
  assert.equal(normalizeTimestamp(1778022600000), "2026-05-05T23:10:00.000Z");
});

test("não cria uma quota válida quando o valor está ausente ou inválido", () => {
  const resource = createProgressResource({
    id: "weekly",
    label: "Weekly",
    used: "61",
    limit: 0,
    resetsAt: "not-a-date",
  });

  assert.equal(resource.used, null);
  assert.equal(resource.limit, null);
  assert.equal(resource.remaining, null);
  assert.equal(resource.utilization, null);
  assert.equal(resource.resetsAt, null);
});

test("fixtures dos quatro providers são objetos JSON sanitizados", async () => {
  for (const name of ["claude-usage", "codex-usage", "antigravity-quota", "grok-credits"]) {
    const raw = await readFile(new URL(`./fixtures/usage/${name}.json`, import.meta.url), "utf8");
    const value = JSON.parse(raw);
    assert.equal(typeof value, "object");
    assert.equal(value.credentials, undefined);
    assert.equal(value.accessToken, undefined);
  }
});
