import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createPricingCatalog } from "./pricing.js";

const PRICING_URLS = {
  litellm: "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
  modelsDev: "https://models.dev/api.json",
};

// The Grok CLI writes first-party build slugs that are not stable catalog IDs. These rates and
// aliases mirror OpenUsage's small provider supplement; the public feeds still remain the source
// for every other model and are refreshed independently.
const LOCAL_SUPPLEMENT = {
  pricing: {
    "grok-4.5": {
      input_per_million: 2,
      cache_write_per_million: 2,
      cache_read_per_million: 0.5,
      output_per_million: 6,
    },
    "grok-4.6": {
      input_per_million: 2,
      cache_write_per_million: 2,
      cache_read_per_million: 0.5,
      output_per_million: 6,
    },
  },
  alias_rules: [
    { pattern: "^(?:cursor-)?grok-4[.]5(?:-build)?$", canonical: "grok-4.5" },
    { pattern: "^(?:cursor-)?grok-4[.]6(?:-build)?$", canonical: "grok-4.6" },
  ],
};

function finite(value) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function rates({ input, output, cacheWrite = input, cacheRead = input * 0.1, inputAbove200k = null, outputAbove200k = null, cacheWriteAbove200k = null, cacheReadAbove200k = null, fastMultiplier = 1 } = {}) {
  const values = { inputPerMillion: input, outputPerMillion: output, cacheWritePerMillion: cacheWrite, cacheReadPerMillion: cacheRead, inputAbove200kPerMillion: inputAbove200k, outputAbove200kPerMillion: outputAbove200k, cacheWriteAbove200kPerMillion: cacheWriteAbove200k, cacheReadAbove200kPerMillion: cacheReadAbove200k, fastMultiplier };
  return Object.values(values).every(value => value === null || finite(value) !== null) ? values : null;
}

export function parseLiteLLM(data) {
  const entries = {};
  for (const [model, raw] of Object.entries(data && typeof data === "object" ? data : {})) {
    const input = finite(raw?.input_cost_per_token);
    const output = finite(raw?.output_cost_per_token);
    if (input === null || output === null) continue;
    const value = rates({
      input: input * 1_000_000,
      output: output * 1_000_000,
      cacheWrite: finite(raw.cache_creation_input_token_cost) === null ? input * 1_000_000 : finite(raw.cache_creation_input_token_cost) * 1_000_000,
      cacheRead: finite(raw.cache_read_input_token_cost) === null ? input * 100_000 : finite(raw.cache_read_input_token_cost) * 1_000_000,
      inputAbove200k: finite(raw.input_cost_per_token_above_200k_tokens) === null ? null : finite(raw.input_cost_per_token_above_200k_tokens) * 1_000_000,
      outputAbove200k: finite(raw.output_cost_per_token_above_200k_tokens) === null ? null : finite(raw.output_cost_per_token_above_200k_tokens) * 1_000_000,
      cacheWriteAbove200k: finite(raw.cache_creation_input_token_cost_above_200k_tokens) === null ? null : finite(raw.cache_creation_input_token_cost_above_200k_tokens) * 1_000_000,
      cacheReadAbove200k: finite(raw.cache_read_input_token_cost_above_200k_tokens) === null ? null : finite(raw.cache_read_input_token_cost_above_200k_tokens) * 1_000_000,
    });
    if (value) entries[model] = value;
  }
  return entries;
}

export function parseModelsDev(data) {
  const entries = {};
  const models = data?.models && typeof data.models === "object" ? data.models : {};
  for (const [model, raw] of Object.entries(models)) {
    // The live API is provider-nested (`{ provider: { models: { id: { cost }}}}`),
    // while OpenUsage's bundled snapshot is already compact (`{ models: { id: { i, o }}}`).
    const cost = raw?.cost && typeof raw.cost === "object" ? raw.cost : raw;
    const input = finite(cost?.i ?? cost?.input);
    const output = finite(cost?.o ?? cost?.output);
    if (input === null || output === null) continue;
    const value = rates({
      input,
      output,
      cacheWrite: finite(cost.cw ?? cost.cache_write) ?? input,
      cacheRead: finite(cost.cr ?? cost.cache_read) ?? input * 0.1,
    });
    if (value) entries[model] = value;
  }
  for (const provider of Object.values(data && typeof data === "object" ? data : {})) {
    const nested = provider?.models && typeof provider.models === "object" ? provider.models : null;
    if (!nested) continue;
    for (const [model, raw] of Object.entries(nested)) {
      const cost = raw?.cost && typeof raw.cost === "object" ? raw.cost : {};
      const input = finite(cost.input);
      const output = finite(cost.output);
      if (input === null || output === null || entries[model]) continue;
      const value = rates({
        input,
        output,
        cacheWrite: finite(cost.cache_write) ?? input,
        cacheRead: finite(cost.cache_read) ?? input * 0.1,
      });
      if (value) entries[model] = value;
    }
  }
  return entries;
}

export function parseSupplement(data) {
  const entries = {};
  for (const [model, raw] of Object.entries(data?.pricing && typeof data.pricing === "object" ? data.pricing : {})) {
    const input = finite(raw?.input_per_million);
    const output = finite(raw?.output_per_million);
    if (input === null || output === null) continue;
    const value = rates({ input, output, cacheWrite: finite(raw.cache_write_per_million) ?? input, cacheRead: finite(raw.cache_read_per_million) ?? input * 0.1, fastMultiplier: finite(data.fast_multipliers?.[model]) ?? 1 });
    if (value) entries[model] = value;
  }
  return { entries, aliases: Array.isArray(data?.alias_rules) ? data.alias_rules : [] };
}

async function fetchJSON(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response?.ok || typeof response.json !== "function") throw new Error(`pricing HTTP ${response?.status || 0}`);
    return response.json();
  } finally { clearTimeout(timer); }
}

async function loadCache(cacheFile) {
  if (!cacheFile) return null;
  try {
    const value = JSON.parse(await readFile(cacheFile, "utf8"));
    if (value?.schema !== 1 || !value.entries || typeof value.entries !== "object") return null;
    return value;
  } catch { return null; }
}

async function saveCache(cacheFile, payload) {
  if (!cacheFile) return;
  const temporary = `${cacheFile}.tmp-${process.pid}`;
  await mkdir(dirname(cacheFile), { recursive: true });
  await writeFile(temporary, JSON.stringify(payload), { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, cacheFile);
}

export async function loadPricingCatalog({ fetchImpl = globalThis.fetch, cacheFile = null, timeoutMs = 5000 } = {}) {
  const cached = await loadCache(cacheFile);
  const responses = await Promise.allSettled([
    fetchJSON(fetchImpl, PRICING_URLS.litellm, timeoutMs),
    fetchJSON(fetchImpl, PRICING_URLS.modelsDev, timeoutMs),
  ]);
  const parsedSupplement = parseSupplement(LOCAL_SUPPLEMENT);
  const entries = {
    // OpenUsage resolution order: LiteLLM first, models.dev as exact-id gap filler,
    // supplement last for provider-specific models and aliases.
    ...(cached?.entries || {}),
    ...(responses[1].status === "fulfilled" ? parseModelsDev(responses[1].value) : {}),
    ...(responses[0].status === "fulfilled" ? parseLiteLLM(responses[0].value) : {}),
    ...parsedSupplement.entries,
  };
  const catalog = createPricingCatalog(entries, { aliases: parsedSupplement.aliases });
  if (Object.keys(entries).length && (responses.some(response => response.status === "fulfilled") || !cached)) {
    await saveCache(cacheFile, { schema: 1, updatedAt: new Date().toISOString(), entries });
  }
  return catalog;
}

export function createPricingLoader(options = {}) {
  let loaded = null;
  let inFlight = null;
  return async function getPricing() {
    if (loaded) return loaded;
    if (!inFlight) {
      inFlight = loadPricingCatalog(options).then(value => {
        loaded = value;
        return value;
      }).finally(() => { inFlight = null; });
    }
    return inFlight;
  };
}

export { PRICING_URLS };
