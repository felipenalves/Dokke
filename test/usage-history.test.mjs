import test from "node:test";
import assert from "node:assert/strict";
import { createPricingCatalog } from "../usage/pricing.js";
import {
  aggregateUsageEvents,
  buildSpendSummary,
  buildUsageTrend,
} from "../usage/history.js";

const now = new Date("2026-09-01T15:00:00.000Z");
const pricing = createPricingCatalog({
  "claude-sonnet": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
});

test("custa buckets de input, cache e output na fórmula do OpenUsage", () => {
  assert.equal(pricing.costDollars("claude-sonnet", {
    input: 1_000_000,
    cacheWrite5m: 100_000,
    cacheWrite1h: 100_000,
    cacheRead: 200_000,
    output: 100_000,
  }), 5.535);
});

test("agrega tokens por dia e exclui modelo sem preço sem contar como zero", () => {
  const result = aggregateUsageEvents([
    {
      timestamp: "2026-09-01T10:00:00.000Z",
      model: "claude-sonnet",
      tokens: { input: 10, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 5, total: 15 },
    },
    {
      timestamp: "2026-09-01T11:00:00.000Z",
      model: "unknown-model",
      tokens: { input: 20, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 5, total: 25 },
    },
  ], { now, pricing });

  assert.equal(result.series.daily[0].totalTokens, 15);
  assert.deepEqual(result.unknownModelsByDay["2026-09-01"], ["unknown-model"]);
});

test("tendência preserva dias vazios e retorna hoje mais 30 dias", () => {
  const series = { daily: [{ date: "2026-09-01", totalTokens: 15, costUSD: 0.1, models: [] }] };
  const trend = buildUsageTrend(series, now);
  assert.equal(trend.length, 31);
  assert.equal(trend.at(-1).value, 15);
  assert.equal(trend.at(-2).value, 0);
});

test("resumo separa hoje, ontem, 30 dias e breakdown por modelo", () => {
  const series = {
    daily: [
      { date: "2026-09-01", totalTokens: 15, costUSD: 0.1, models: [{ model: "claude-sonnet", totalTokens: 15, costUSD: 0.1 }] },
      { date: "2026-08-31", totalTokens: 20, costUSD: 0.2, models: [{ model: "claude-sonnet", totalTokens: 20, costUSD: 0.2 }] },
    ],
  };
  const summary = buildSpendSummary(series, now);
  assert.equal(summary.today.totalTokens, 15);
  assert.equal(summary.yesterday.totalTokens, 20);
  assert.equal(summary.last30Days.totalTokens, 35);
  assert.equal(summary.byModel[0].model, "claude-sonnet");
});
