const MODEL_ALIASES = new Map([
  ["claude-3-5-sonnet", "claude-sonnet"],
  ["claude-3.5-sonnet", "claude-sonnet"],
  ["claude-sonnet-4", "claude-sonnet"],
]);

function normalizeModel(value) {
  if (typeof value !== "string") return null;
  const model = value.trim();
  return model === "" ? null : model;
}

function normalizeRates(value) {
  if (!value || typeof value !== "object") return null;
  const rates = {};
  for (const key of [
    "inputPerMillion",
    "outputPerMillion",
    "cacheWritePerMillion",
    "cacheReadPerMillion",
  ]) {
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number < 0) return null;
    rates[key] = number;
  }
  for (const key of [
    "inputAbove200kPerMillion",
    "outputAbove200kPerMillion",
    "cacheWriteAbove200kPerMillion",
    "cacheReadAbove200kPerMillion",
  ]) {
    const number = value[key] == null ? null : Number(value[key]);
    if (number !== null && (!Number.isFinite(number) || number < 0)) return null;
    rates[key] = number;
  }
  rates.cacheReadIsExplicit = value.cacheReadIsExplicit !== false;
  rates.longContextThresholdTokens = Number.isInteger(value.longContextThresholdTokens)
    ? value.longContextThresholdTokens : 200_000;
  rates.fastMultiplier = Number.isFinite(value.fastMultiplier) ? value.fastMultiplier : 1;
  return rates;
}

export function costDollars(rates, tokens, {
  fast = false,
  fastMultiplier = 1,
  applyLongContextRates = true,
} = {}) {
  if (!rates || !tokens) return null;
  const input = Math.max(0, Number(tokens.input) || 0);
  const cacheWrite5m = Math.max(0, Number(tokens.cacheWrite5m) || 0);
  const cacheWrite1h = Math.max(0, Number(tokens.cacheWrite1h) || 0);
  const cacheRead = Math.max(0, Number(tokens.cacheRead) || 0);
  const output = Math.max(0, Number(tokens.output) || 0);
  const promptTokens = input + cacheWrite5m + cacheWrite1h + cacheRead;
  const longContext = applyLongContextRates && promptTokens > (rates.longContextThresholdTokens ?? 200_000);
  const inputRate = longContext && rates.inputAbove200kPerMillion != null
    ? rates.inputAbove200kPerMillion : rates.inputPerMillion;
  const outputRate = longContext && rates.outputAbove200kPerMillion != null
    ? rates.outputAbove200kPerMillion : rates.outputPerMillion;
  const cacheWriteRate = longContext && rates.cacheWriteAbove200kPerMillion != null
    ? rates.cacheWriteAbove200kPerMillion : rates.cacheWritePerMillion;
  const cacheReadRate = longContext && rates.cacheReadAbove200kPerMillion != null
    ? rates.cacheReadAbove200kPerMillion : rates.cacheReadPerMillion;
  const value = input * inputRate
    + cacheWrite5m * cacheWriteRate
    + cacheWrite1h * inputRate * 2
    + cacheRead * cacheReadRate
    + output * outputRate;
  return value / 1_000_000 * (fast ? fastMultiplier : 1);
}

export function createPricingCatalog(entries = {}, { aliases = [] } = {}) {
  const byProvider = new Map();
  const aliasRules = Array.isArray(aliases) ? aliases.flatMap(rule => {
    if (!rule || typeof rule.pattern !== "string" || typeof rule.canonical !== "string") return [];
    try { return [[new RegExp(rule.pattern), rule.canonical]]; } catch { return []; }
  }) : [];
  const add = (providerId, model, rates) => {
    const normalized = normalizeRates(rates);
    const name = normalizeModel(model);
    if (!normalized || !name) return;
    const provider = String(providerId || "*").toLowerCase();
    if (!byProvider.has(provider)) byProvider.set(provider, new Map());
    byProvider.get(provider).set(name.toLowerCase(), normalized);
  };

  for (const [model, rates] of Object.entries(entries || {})) add("*", model, rates);

  function resolve(model, providerId = "*") {
    const original = normalizeModel(model);
    if (!original) return null;
    const provider = String(providerId || "*").toLowerCase();
    const dynamicAlias = aliasRules.find(([pattern]) => pattern.test(original))?.[1];
    const candidates = [original, MODEL_ALIASES.get(original.toLowerCase()), dynamicAlias].filter(Boolean);
    for (const candidate of candidates) {
      const providerRates = byProvider.get(provider)?.get(candidate.toLowerCase());
      if (providerRates) return providerRates;
      const sharedRates = byProvider.get("*")?.get(candidate.toLowerCase());
      if (sharedRates) return sharedRates;
    }
    return null;
  }

  return {
    resolve,
    costDollars(model, tokens, options) {
      const providerId = options?.providerId || "*";
      const rates = resolve(model, providerId);
      return rates ? costDollars(rates, tokens, options) : null;
    },
    add(providerId, model, rates) {
      add(providerId, model, rates);
    },
  };
}
