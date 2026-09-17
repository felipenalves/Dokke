import { HISTORY_DAYS, TREND_DAYS } from "./models.js";

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  if (![year, month, day].every(Number.isInteger)) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function normalizeUsageDayKey(value) {
  if (value instanceof Date) return localDateKey(value);
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const canonical = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (canonical) {
    const date = dateFromKey(`${canonical[1]}-${canonical[2]}-${canonical[3]}`);
    return date ? localDateKey(date) : null;
  }
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (compact) {
    const date = dateFromKey(`${compact[1]}-${compact[2]}-${compact[3]}`);
    return date ? localDateKey(date) : null;
  }
  return localDateKey(new Date(raw));
}

function normalizeTokens(tokens = {}) {
  const value = key => Math.max(0, Number(tokens[key]) || 0);
  const normalized = {
    input: value("input"),
    cacheWrite5m: value("cacheWrite5m"),
    cacheWrite1h: value("cacheWrite1h"),
    cacheRead: value("cacheRead"),
    output: value("output"),
  };
  normalized.total = Number.isFinite(Number(tokens.total))
    ? Math.max(0, Number(tokens.total))
    : normalized.input + normalized.cacheWrite5m + normalized.cacheWrite1h
      + normalized.cacheRead + normalized.output;
  return normalized;
}

function eventKey(event) {
  const tokens = normalizeTokens(event.tokens);
  return [event.timestamp, event.model, tokens.input, tokens.cacheWrite5m,
    tokens.cacheWrite1h, tokens.cacheRead, tokens.output, tokens.total].join("\u0000");
}

function compactTokenLabel(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B tokens`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M tokens`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K tokens`;
  return `${Math.round(value)} tokens`;
}

function formatTrendLabel(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function addModelTotals(target, model, tokens, costUSD, estimated) {
  const existing = target.get(model) || { model, totalTokens: 0, costUSD: null, estimated: false };
  existing.totalTokens += tokens;
  if (costUSD !== null) existing.costUSD = (existing.costUSD || 0) + costUSD;
  existing.estimated ||= estimated;
  target.set(model, existing);
}

export function aggregateUsageEvents(events, { now = new Date(), pricing, daysBack = HISTORY_DAYS, providerId = "*" } = {}) {
  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const daily = new Map();
  const unknownModelsByDay = new Map();
  const seen = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    const timestamp = new Date(event?.timestamp);
    if (Number.isNaN(timestamp.getTime()) || timestamp < since) continue;
    const model = typeof event.model === "string" ? event.model.trim() : "";
    const tokens = normalizeTokens(event.tokens);
    if (tokens.total <= 0 || !model || seen.has(eventKey(event))) continue;
    seen.add(eventKey(event));
    const day = localDateKey(timestamp);
    const carriedCost = Number.isFinite(Number(event.costUSD)) ? Number(event.costUSD) : null;
    const rates = carriedCost === null && pricing?.resolve ? pricing.resolve(event.pricingModel || model, providerId) : null;
    const estimatedCost = carriedCost === null && rates ? pricing.costDollars(event.pricingModel || model, tokens, {
      providerId, fast: event.isFast === true, fastMultiplier: rates.fastMultiplier || 1,
    }) : null;
    const costUSD = carriedCost ?? estimatedCost;
    if (costUSD === null) {
      const unknown = unknownModelsByDay.get(day) || new Set();
      unknown.add(model);
      unknownModelsByDay.set(day, unknown);
      continue;
    }
    const entry = daily.get(day) || { date: day, totalTokens: 0, costUSD: 0, estimated: false, models: new Map() };
    entry.totalTokens += tokens.total;
    entry.costUSD += costUSD;
    entry.estimated ||= carriedCost === null;
    addModelTotals(entry.models, model, tokens.total, costUSD, carriedCost === null);
    daily.set(day, entry);
  }
  const dailyEntries = [...daily.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(entry => ({
      date: entry.date,
      totalTokens: entry.totalTokens,
      costUSD: Number(entry.costUSD.toFixed(8)),
      estimated: entry.estimated,
      models: [...entry.models.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    }));
  return {
    series: { daily: dailyEntries },
    modelUsage: { daily: dailyEntries.map(entry => ({ date: entry.date, models: entry.models })) },
    unknownModelsByDay: Object.fromEntries([...unknownModelsByDay.entries()]
      .map(([day, models]) => [day, [...models].sort()])),
  };
}

function periodSummary(entries) {
  if (!entries.length) return null;
  const totalTokens = entries.reduce((sum, entry) => sum + entry.totalTokens, 0);
  const costs = entries.map(entry => entry.costUSD).filter(Number.isFinite);
  if (totalTokens <= 0 && costs.length === 0) return null;
  return {
    totalTokens,
    costUSD: costs.length ? Number(costs.reduce((sum, value) => sum + value, 0).toFixed(8)) : null,
    estimated: entries.some(entry => entry.estimated === true),
  };
}

export function buildSpendSummary(series, now = new Date()) {
  const entries = Array.isArray(series?.daily) ? series.daily : [];
  const today = localDateKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate);
  const byModel = new Map();
  for (const entry of entries) {
    for (const model of Array.isArray(entry.models) ? entry.models : []) {
      addModelTotals(byModel, model.model, model.totalTokens, model.costUSD, model.estimated === true);
    }
  }
  const withinWindow = entries.filter(entry => {
    const date = dateFromKey(entry.date);
    return date && Math.abs(now.getTime() - date.getTime()) <= (HISTORY_DAYS + 1) * 24 * 60 * 60 * 1000;
  });
  return {
    today: periodSummary(entries.filter(entry => entry.date === today)),
    yesterday: periodSummary(entries.filter(entry => entry.date === yesterday)),
    last30Days: periodSummary(withinWindow),
    byModel: [...byModel.values()].sort((a, b) => b.totalTokens - a.totalTokens),
  };
}

export function buildUsageTrend(series, now = new Date()) {
  const entries = new Map();
  for (const entry of Array.isArray(series?.daily) ? series.daily : []) {
    const day = normalizeUsageDayKey(entry?.date);
    const tokens = Number(entry?.totalTokens);
    if (!day || !Number.isFinite(tokens) || tokens < 0) continue;
    entries.set(day, (entries.get(day) || 0) + tokens);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const points = [];
  for (let offset = TREND_DAYS; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = localDateKey(date);
    const value = entries.get(key) || 0;
    points.push({ date: key, label: formatTrendLabel(date), value, valueLabel: compactTokenLabel(value) });
  }
  return points.some(point => point.value > 0) ? points : [];
}

export { localDateKey, normalizeTokens };
