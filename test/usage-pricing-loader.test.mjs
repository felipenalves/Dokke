import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseLiteLLM, parseModelsDev, parseSupplement, loadPricingCatalog } from "../usage/pricing-loader.js";

test("pricing loader converte LiteLLM e models.dev para a mesma unidade", () => {
  assert.equal(parseLiteLLM({ "claude-sonnet": { input_cost_per_token: 0.000003, output_cost_per_token: 0.000015, cache_read_input_token_cost: 0.0000003 } })["claude-sonnet"].inputPerMillion, 3);
  assert.equal(parseModelsDev({ models: { "grok-4": { i: 3, o: 15, cr: 0.3, cw: 3 } } })["grok-4"].outputPerMillion, 15);
  assert.equal(parseModelsDev({ anthropic: { models: { "claude-sonnet": { cost: { input: 3, output: 15 } } } } })["claude-sonnet"].outputPerMillion, 15);
});

test("pricing supplement preserva alias e multiplicador fast", () => {
  const result = parseSupplement({
    pricing: { "gpt-5": { input_per_million: 1, output_per_million: 2 } },
    fast_multipliers: { "gpt-5": 2 },
    alias_rules: [{ pattern: "^gpt-5\\.1$", canonical: "gpt-5" }],
  });
  assert.equal(result.entries["gpt-5"].fastMultiplier, 2);
  assert.equal(result.aliases[0].canonical, "gpt-5");
});

test("pricing loader usa cache quando os feeds ficam indisponíveis", async () => {
  const root = await mkdtemp(join(tmpdir(), "dokke-pricing-"));
  try {
    const file = join(root, "pricing.json");
    const fetchImpl = async () => new Response("offline", { status: 503 });
    const first = await loadPricingCatalog({ cacheFile: file, fetchImpl });
    assert.equal(first.resolve("claude-sonnet"), null);
    await import("node:fs/promises").then(({ writeFile }) => writeFile(file, JSON.stringify({ schema: 1, entries: { "grok-4": { inputPerMillion: 1, outputPerMillion: 2, cacheWritePerMillion: 1, cacheReadPerMillion: 0.1 } } })));
    const second = await loadPricingCatalog({ cacheFile: file, fetchImpl });
    assert.equal(second.resolve("grok-4").outputPerMillion, 2);
    assert.ok((await readFile(file, "utf8")).length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pricing loader padrão não consulta o OpenUsage", async () => {
  const calls = [];
  const result = await loadPricingCatalog({
    fetchImpl: async url => {
      calls.push(String(url));
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(result.resolve("missing-model"), null);
  assert.equal(calls.some(url => url.includes("openusage")), false);
});
