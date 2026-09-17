import { join } from "node:path";
import { tmpdir } from "node:os";
import { createActivityMonitor } from "./usage/activity.js";
import { createProviderCatalog } from "./usage/catalog.js";
import { createUsageCoordinator } from "./usage/coordinator.js";
import { createUsageStore } from "./usage/store.js";
import { createPricingLoader } from "./usage/pricing-loader.js";
import { createAntigravityProvider } from "./usage/providers/antigravity.js";
import { createClaudeProvider } from "./usage/providers/claude.js";
import { createCodexProvider } from "./usage/providers/codex.js";
import { createGrokProvider } from "./usage/providers/grok.js";
import { TREND_DAYS } from "./usage/models.js";

const OPENUSAGE_URL = "http://127.0.0.1:6736/v1/limits";
const OPENUSAGE_USAGE_URL = "http://127.0.0.1:6736/v1/usage";
const DEFAULT_TIMEOUT_MS = 2500;
const MAX_PROVIDERS = 32;
const MAX_RESOURCES = 32;
const MAX_ERRORS = 32;

const RESOURCE_LABELS = {
  session: "Sessão",
  weekly: "Semana",
  monthly: "Mês",
  sonnet: "Sonnet",
  fable: "Fable",
  spark: "Spark",
  sparkWeekly: "Spark semanal",
  geminiSession: "Gemini · sessão",
  geminiWeekly: "Semana",
  nonGeminiSession: "Outros modelos · sessão",
  nonGeminiWeekly: "Semana",
  premiumCredits: "Créditos premium",
  extraUsage: "Uso extra",
  extraUsageBalance: "Saldo de uso extra",
  totalUsage: "Uso total",
  grokBot: "Grok Bot",
  autoUsage: "Auto",
  apiUsage: "API",
  onDemand: "Sob demanda",
  requests: "Solicitações",
  credits: "Créditos",
  creditValue: "Valor dos créditos",
  rateLimitResets: "Recargas de limite",
  daily: "Diário",
  balance: "Saldo",
  keyLimit: "Limite da chave",
  webSearches: "Pesquisas web",
  chat: "Chat",
  completions: "Completions",
};

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function sourceError(code, message) {
  return { code, message };
}

export function mascotForUtilization(utilization, estimated = false) {
  if (estimated || !Number.isFinite(utilization)) return "neutral";
  if (utilization >= 0.95) return "exhausted";
  if (utilization >= 0.8) return "tired";
  if (utilization >= 0.6) return "attentive";
  return "energized";
}

export function statusForUtilization(utilization, estimated = false) {
  if (estimated || !Number.isFinite(utilization)) return "unknown";
  if (utilization >= 0.95) return "exhausted";
  if (utilization >= 0.8) return "attention";
  return "normal";
}

function normalizeError(error) {
  if (!error || typeof error !== "object") return null;
  const providerId = typeof error.providerId === "string" ? error.providerId.slice(0, 120) : null;
  const message = typeof error.message === "string" ? error.message.slice(0, 240) : null;
  if (!providerId && !message) return null;
  return {
    ...(providerId ? { providerId } : {}),
    ...(message ? { message } : {}),
  };
}

function normalizeResource(id, raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = raw.kind === "consumption" || raw.kind === "balance" ? raw.kind : null;
  const unit = typeof raw.unit === "string" && raw.unit ? raw.unit : null;
  if (!kind || !unit) return null;

  const used = finiteNumber(raw.used);
  const limit = finiteNumber(raw.limit);
  const remaining = finiteNumber(raw.remaining);
  const available = finiteNumber(raw.available);
  const utilization = finiteNumber(raw.utilization);
  const estimated = raw.estimated === true;
  const directPeriodDurationMs = finiteNumber(raw.periodDurationMs);
  const windowSeconds = finiteNumber(raw.windowSeconds);
  const periodDurationMs = directPeriodDurationMs !== null && directPeriodDurationMs > 0
    ? Math.round(directPeriodDurationMs)
    : windowSeconds !== null && windowSeconds > 0 ? Math.round(windowSeconds * 1000) : null;

  if (kind === "consumption" && (limit === null || remaining === null || utilization === null)) return null;
  if (kind === "balance" && available === null) return null;
  if (kind === "consumption" &&
      (limit < 0 || remaining < 0 || utilization < 0 || utilization > 1)) return null;

  return {
    id,
    label: RESOURCE_LABELS[id] || id,
    kind,
    unit,
    used,
    limit,
    remaining,
    available: kind === "balance" ? available : null,
    utilization,
    resetsAt: validDate(raw.resetsAt),
    periodDurationMs,
    estimated,
  };
}

function normalizeTrendPoints(points) {
  if (!Array.isArray(points)) return [];
  return points.slice(-(TREND_DAYS + 1)).map(point => {
    if (!point || typeof point !== "object") return null;
    const value = finiteNumber(point.value);
    const label = typeof point.label === "string" ? point.label.trim().slice(0, 40) : "";
    if (value === null || value < 0 || !label) return null;
    const valueLabel = typeof point.valueLabel === "string" && point.valueLabel.trim()
      ? point.valueLabel.trim().slice(0, 80)
      : null;
    const date = typeof point.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(point.date.trim())
      ? point.date.trim()
      : null;
    return { ...(date ? { date } : {}), label, value, valueLabel };
  }).filter(Boolean);
}

function normalizeUsageHistory(payload) {
  const snapshots = Array.isArray(payload) ? payload : [];
  const trends = {};
  for (const snapshot of snapshots.slice(0, MAX_PROVIDERS)) {
    if (!snapshot || typeof snapshot !== "object") continue;
    const providerId = typeof snapshot.providerId === "string" ? snapshot.providerId.trim().slice(0, 120) : "";
    if (!providerId || !Array.isArray(snapshot.lines)) continue;
    const line = snapshot.lines.find(candidate => candidate &&
      (candidate.type === "barChart" || candidate.type === "chart") &&
      (candidate.label === "Usage Trend" || candidate.label === "Tendência de uso"));
    const points = normalizeTrendPoints(line && line.points);
    if (!points.length) continue;
    trends[providerId] = {
      points,
      note: typeof line.note === "string" && line.note.trim() ? line.note.trim().slice(0, 240) : null,
    };
  }
  return trends;
}

function normalizeProvider(id, raw, trend = null) {
  if (!raw || typeof raw !== "object" || !raw.resources || typeof raw.resources !== "object") return null;
  const resources = Object.fromEntries(Object.entries(raw.resources).slice(0, MAX_RESOURCES)
    .map(([resourceId, resource]) => [resourceId, normalizeResource(resourceId, resource)])
    .filter(([, resource]) => resource));
  const resourceValues = Object.values(resources);
  const reliable = resourceValues
    .filter(resource => resource.kind === "consumption" && !resource.estimated && Number.isFinite(resource.utilization))
    .map(resource => resource.utilization);
  const highest = reliable.length ? Math.max(...reliable) : null;
  const displayName = typeof raw.displayName === "string" && raw.displayName.trim()
    ? raw.displayName.trim().slice(0, 120)
    : id;
  return {
    id,
    name: displayName,
    plan: typeof raw.plan === "string" && raw.plan.trim() ? raw.plan.trim().slice(0, 120) : null,
    status: statusForUtilization(highest),
    mascot: mascotForUtilization(highest),
    stale: raw.stale === true,
    refreshedAt: validDate(raw.fetchedAt),
    resources,
    trend,
  };
}

function hasUsableUsageData(snapshot) {
  const providers = snapshot?.providers && typeof snapshot.providers === "object"
    ? Object.values(snapshot.providers)
    : [];
  return providers.some(provider => Object.values(provider?.resources || {}).some(resource =>
    ["used", "limit", "remaining", "available", "utilization"].some(key => finiteNumber(resource?.[key]) !== null)
  ));
}

function asDokkeUsageSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const errors = Array.isArray(snapshot.errors) ? snapshot.errors : [];
  return {
    ...snapshot,
    source: "dokke",
    sourceState: snapshot.sourceState === "available" && errors.length ? "partial" : snapshot.sourceState,
  };
}

function unavailableResult() {
  return {
    ok: true,
    source: "openusage",
    sourceState: "unavailable",
    updatedAt: null,
    providers: [],
    errors: [sourceError("unavailable", "OpenUsage indisponível")],
  };
}

export function normalizeOpenUsage(payload, historyPayload = null) {
  if (!payload || typeof payload !== "object" || payload.schema !== "openusage.limits.v1" ||
      !payload.providers || typeof payload.providers !== "object" || Array.isArray(payload.providers)) {
    return {
      ok: true,
      source: "openusage",
      sourceState: "invalid",
      updatedAt: null,
      providers: [],
      errors: [sourceError("invalid_response", "fonte de uso inválida")],
    };
  }

  const trends = normalizeUsageHistory(historyPayload);
  const providers = Object.fromEntries(Object.entries(payload.providers).slice(0, MAX_PROVIDERS)
    .map(([id, provider]) => {
      const trend = trends[id] || (id === "anthropic" ? trends.claude : null);
      return [id, normalizeProvider(id, provider, trend || null)];
    })
    .filter(([, provider]) => provider));
  const errors = Array.isArray(payload.errors)
    ? payload.errors.slice(0, MAX_ERRORS).map(normalizeError).filter(Boolean)
    : [];
  return {
    ok: true,
    source: "openusage",
    sourceState: "available",
    updatedAt: validDate(payload.generatedAt),
    providers,
    errors,
  };
}

export function createUsageSource({
  fetchImpl = globalThis.fetch,
  url = OPENUSAGE_URL,
  usageUrl = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  let cached = null;
  let cachedAt = 0;
  let inFlight = null;
  return {
    async getUsage() {
      if (cached && Date.now() - cachedAt < 5000) return cached;
      if (inFlight) return inFlight;
      if (typeof fetchImpl !== "function") return unavailableResult();
      inFlight = (async () => {
        const fetchJSON = async endpoint => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const response = await fetchImpl(endpoint, {
              method: "GET",
              headers: { Accept: "application/json" },
              signal: controller.signal,
            });
            if (!response || response.ok !== true || typeof response.json !== "function") return null;
            return await response.json();
          } catch {
            return null;
          } finally {
            clearTimeout(timer);
          }
        };
        const historyEndpoint = usageUrl || (() => {
          try {
            const parsed = new URL(url);
            if (parsed.pathname.endsWith("/v1/limits")) parsed.pathname = parsed.pathname.replace(/\/v1\/limits$/, "/v1/usage");
            return parsed.toString();
          } catch {
            return OPENUSAGE_USAGE_URL;
          }
        })();
        try {
          const [limitsPayload, historyPayload] = await Promise.all([
            fetchJSON(url),
            fetchJSON(historyEndpoint),
          ]);
          if (!limitsPayload) return unavailableResult();
          return normalizeOpenUsage(limitsPayload, historyPayload);
        } catch {
          return unavailableResult();
        }
      })();
      try {
        cached = await inFlight;
        cachedAt = Date.now();
        return cached;
      } finally {
        inFlight = null;
      }
    },
  };
}

/**
 * Fonte nativa do Dokke. Os adapters leem as mesmas fontes que o OpenUsage lia,
 * mas o snapshot, histórico, cache e refresh pertencem ao processo do Dokke.
 */
export function createDokkeUsageSource({
  dataDir = join(tmpdir(), `dokke-usage-${process.pid}`),
  providers = null,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  pricing = null,
  timeoutMs = 10_000,
  refreshMs = 5 * 60 * 1000,
  backoffMs = 5 * 60 * 1000,
  intervalMs = refreshMs,
  activityIntervalMs = 1_000,
  pricingLoader = null,
  openUsageSource = null,
  openUsageUrl = OPENUSAGE_URL,
  openUsageUsageUrl = OPENUSAGE_USAGE_URL,
  openUsageTimeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const hasInjectedProviders = Array.isArray(providers);
  const providerList = providers || createProviderCatalog({ providers: [
    createClaudeProvider({ fetchImpl }),
    createCodexProvider({ fetchImpl }),
    createAntigravityProvider({ fetchImpl }),
    createGrokProvider({ fetchImpl }),
  ] });
  const store = createUsageStore({ file: join(dataDir, "usage-cache.json") });
  const coordinator = createUsageCoordinator({
    providers: providerList,
    catalog: providerList,
    store,
    pricing,
    pricingLoader: pricingLoader || (!hasInjectedProviders ? createPricingLoader({ fetchImpl, cacheFile: join(dataDir, "pricing-cache.json") }) : null),
    now,
    timeoutMs,
    refreshMs,
    backoffMs,
    intervalMs,
    historyCacheFile: join(dataDir, "usage-history-cache.json"),
  });
  const fallbackSource = openUsageSource && typeof openUsageSource.getUsage === "function"
    ? openUsageSource
    : !hasInjectedProviders
      ? createUsageSource({ fetchImpl, url: openUsageUrl, usageUrl: openUsageUsageUrl, timeoutMs: openUsageTimeoutMs })
      : null;
  const activityMonitor = createActivityMonitor({ providers: providerList, now, intervalMs: activityIntervalMs });
  function attachActivity(snapshot, activity) {
    if (!snapshot || typeof snapshot !== "object") return snapshot;
    const activityProviders = activity?.providers || {};
    const providers = Object.fromEntries(Object.entries(snapshot.providers || {}).map(([id, provider]) => [
      id,
      provider && typeof provider === "object"
        ? { ...provider, activity: activityProviders[id] || null }
        : provider,
    ]));
    return { ...snapshot, providers };
  }
  async function loadUsageWithFallback(options, load) {
    const snapshot = await load(options);
    if (hasUsableUsageData(snapshot) || !fallbackSource) return snapshot;
    try {
      const fallback = await fallbackSource.getUsage(options);
      return hasUsableUsageData(fallback) ? asDokkeUsageSnapshot(fallback) : snapshot;
    } catch {
      return snapshot;
    }
  }
  return {
    async getUsage(options) {
      const [snapshot, activity] = await Promise.all([
        loadUsageWithFallback(options, value => coordinator.getUsage(value)),
        activityMonitor.getActivity(options),
      ]);
      return attachActivity(snapshot, activity);
    },
    getActivity: options => activityMonitor.getActivity(options),
    ingestActivityEvent: event => activityMonitor.ingestActivityEvent(event),
    async refresh(options) {
      const [snapshot, activity] = await Promise.all([
        loadUsageWithFallback(options, value => coordinator.refresh(value)),
        activityMonitor.getActivity(options),
      ]);
      return attachActivity(snapshot, activity);
    },
    close: () => { coordinator.close(); activityMonitor.close(); },
  };
}

export { OPENUSAGE_URL, OPENUSAGE_USAGE_URL, RESOURCE_LABELS };
