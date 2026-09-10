import { join } from "node:path";
import { aggregateUsageEvents, buildSpendSummary, buildUsageTrend } from "./history.js";
import { createIncrementalFileCache } from "./history-cache.js";
import { emptyHistory } from "./models.js";

const DEFAULT_REFRESH_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10 * 1000;
const DEFAULT_BACKOFF_MS = 5 * 60 * 1000;

function isoNow(now) {
  const date = now instanceof Date ? now : new Date(now);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function genericError(providerId, error, phase = "usage") {
  const status = Number(error?.status);
  let code = `${phase}_unavailable`;
  if (status === 401 || status === 403) code = "authentication_required";
  else if (status === 429) code = "rate_limited";
  else if (error?.name === "AbortError" || error?.code === "TIMEOUT") code = "timeout";
  return { providerId, code, message: code === "authentication_required" ? "autenticação necessária" : code === "timeout" ? "fonte demorou demais" : "fonte indisponível" };
}

function hasData(provider) {
  return Boolean(provider && (
    Object.keys(provider.resources || {}).length ||
    provider.trend?.points?.length ||
    provider.history?.today || provider.history?.yesterday || provider.history?.last30Days ||
    provider.history?.byModel?.length
  ));
}

function historyResult(events, { pricing, providerId, now }) {
  const aggregate = aggregateUsageEvents(events, { pricing, providerId, now });
  const summary = buildSpendSummary(aggregate.series, now);
  const trend = buildUsageTrend(aggregate.series, now);
  const unknownModels = [...new Set(Object.values(aggregate.unknownModelsByDay).flat())].sort();
  return {
    events: Array.isArray(events) ? events : [],
    summary,
    trend,
    unknownModels,
    unknownModelsByDay: aggregate.unknownModelsByDay,
    updatedAt: isoNow(now),
  };
}

function emptySnapshot(now) {
  return { ok: true, source: "dokke", sourceState: "unavailable", updatedAt: isoNow(now), providers: {}, errors: [] };
}

function withTimeout(task, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("usage provider timeout");
      error.code = "TIMEOUT";
      controller.abort();
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve().then(() => task(controller.signal)), timeout])
    .finally(() => clearTimeout(timer));
}

export function createUsageCoordinator({
  providers = [],
  catalog = providers,
  store,
  pricing = null,
  pricingLoader = null,
  now = () => new Date(),
  refreshMs = DEFAULT_REFRESH_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  backoffMs = DEFAULT_BACKOFF_MS,
  intervalMs = refreshMs,
  historyCacheFile = null,
  historyCache = null,
} = {}) {
  if (!store || typeof store.load !== "function" || typeof store.save !== "function") throw new TypeError("store de uso é obrigatório");
  const providerList = Array.isArray(catalog) ? catalog.filter(provider => provider && typeof provider.id === "string") : [];
  const cache = historyCache || createIncrementalFileCache({ cacheFile: historyCacheFile });
  let current = null;
  let loaded = false;
  let inFlight = null;
  let lastRefreshAt = 0;
  let retryAt = 0;
  let timer = null;

  async function loadCache() {
    if (loaded) return current;
    loaded = true;
    current = await store.load({ stale: true });
    return current;
  }

  async function refreshProvider(provider, at, activePricing) {
    const errors = [];
    let live = null;
    let history = { events: [] };
    let credentials = true;
    try {
      credentials = typeof provider.hasCredentials === "function" ? await withTimeout(() => provider.hasCredentials(), timeoutMs) : true;
    } catch (error) {
      credentials = false;
    }
    const historyTask = typeof provider.readHistory === "function"
      ? withTimeout(signal => provider.readHistory({ since: new Date(at.getTime() - 30 * 24 * 60 * 60 * 1000), cache, pricing: activePricing, signal }), timeoutMs)
      : Promise.resolve({ events: [] });
    const liveTask = credentials && typeof provider.fetchLive === "function"
      ? withTimeout(signal => provider.fetchLive({ signal, now: at }), timeoutMs)
      : Promise.resolve(null);
    const [historyResult, liveResult] = await Promise.allSettled([historyTask, liveTask]);
    if (historyResult.status === "fulfilled") history = historyResult.value || { events: [] };
    else errors.push(genericError(provider.id, historyResult.reason, "history"));
    if (liveResult.status === "fulfilled") live = liveResult.value;
    else errors.push(genericError(provider.id, liveResult.reason, "live"));

    const events = Array.isArray(history?.events) ? history.events : [];
    const computedHistory = historyResult.status === "fulfilled"
      ? historyResult.value?.summary ? historyResult.value : historyResult.value?.events ? historyResult.value : { events }
      : { events };
    const normalizedHistory = computedHistory.summary
      ? computedHistory
      : historyResult.status === "fulfilled" || events.length ? historyResultFn(events, provider, at, activePricing) : { events: [], summary: emptyHistory(), trend: [], unknownModels: [] };
    let snapshot;
    try {
      snapshot = provider.normalize({ live, history: normalizedHistory, now: at });
    } catch (error) {
      errors.push(genericError(provider.id, error, "normalize"));
      snapshot = null;
    }
    return { provider, snapshot, errors };
  }

  function historyResultFn(events, provider, at, activePricing) {
    return historyResult(events, { pricing: activePricing, providerId: provider.id, now: at });
  }

  async function runRefresh() {
    const at = new Date(now());
    let activePricing = pricing;
    if (typeof pricingLoader === "function") {
      try { activePricing = await pricingLoader(); } catch { activePricing = pricing; }
    }
    const results = await Promise.all(providerList.map(provider => refreshProvider(provider, at, activePricing)));
    const providersById = {};
    const errors = [];
    let anyFailure = false;
    for (const result of results) {
      const previous = current?.providers?.[result.provider.id];
      let snapshot = result.snapshot;
      if (!snapshot && previous) snapshot = { ...previous, stale: true };
      if (snapshot && result.errors.some(error => error.code !== "history_unavailable")) {
        // A provider can still render a newly scanned local history while its live endpoint is down.
        // Keep the source marker explicit without discarding the measured history.
        if (result.errors.some(error => error.code === "live_unavailable" || error.code === "timeout" || error.code === "authentication_required" || error.code === "rate_limited")) {
          snapshot = { ...snapshot, stale: Boolean(previous) || snapshot.stale === true };
        }
      }
      if (!snapshot && previous) snapshot = { ...previous, stale: true };
      if (snapshot) providersById[result.provider.id] = snapshot;
      if (result.errors.length) {
        anyFailure = true;
        errors.push(...result.errors);
      }
    }
    const usable = Object.values(providersById).some(hasData);
    const snapshot = {
      ok: true,
      source: "dokke",
      sourceState: usable ? (anyFailure ? "partial" : "available") : "unavailable",
      updatedAt: at.toISOString(),
      providers: providersById,
      errors,
    };
    current = await store.save(snapshot);
    lastRefreshAt = at.getTime();
    retryAt = anyFailure ? at.getTime() + backoffMs : 0;
    await cache.persist();
    return current;
  }

  async function refresh({ force = false } = {}) {
    await loadCache();
    const at = new Date(now()).getTime();
    if (inFlight) return inFlight;
    if (!force && retryAt > at) return current || emptySnapshot(new Date(at));
    if (!force && current && at - lastRefreshAt < refreshMs) return current;
    inFlight = runRefresh();
    try { return await inFlight; }
    finally { inFlight = null; }
  }

  async function getUsage({ force = false } = {}) {
    await loadCache();
    if (!current || force) return refresh({ force });
    const at = new Date(now()).getTime();
    if (retryAt <= at && at - lastRefreshAt >= refreshMs && !inFlight) {
      // Stale-while-revalidate: the kiosk keeps rendering the last good snapshot while the refresh runs.
      void refresh({ force: false }).catch(() => {});
    }
    return current;
  }

  if (Number.isFinite(intervalMs) && intervalMs > 0) {
    timer = setInterval(() => { void refresh().catch(() => {}); }, intervalMs);
    if (timer.unref) timer.unref();
  }

  return {
    getUsage,
    refresh,
    load: loadCache,
    close() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export { DEFAULT_BACKOFF_MS, DEFAULT_REFRESH_MS, DEFAULT_TIMEOUT_MS };
