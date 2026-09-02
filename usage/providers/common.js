import { createProgressResource, createValuesResource, emptyHistory } from "../models.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function responsePayload(live) {
  if (live && typeof live === "object" && live.body && typeof live.body === "object") return live.body;
  return live && typeof live === "object" ? live : {};
}

export function responseMeta(live) {
  return live && typeof live === "object" && live.metadata && typeof live.metadata === "object"
    ? live.metadata : {};
}

export function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function nonNegative(value) {
  const result = number(value);
  return result === null ? null : Math.max(0, result);
}

export function resetTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1e10 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function progressResource({ id, label, used, limit = 100, format = "percent", resetsAt = null, periodDurationMs = null }) {
  const resource = createProgressResource({ id, label, used, limit, format, resetsAt, periodDurationMs });
  return {
    ...resource,
    // The public Dokke contract uses a fraction for utilization, like OpenUsage's WidgetData export.
    utilization: resource.utilization === null ? null : resource.utilization / 100,
  };
}

export function valuesResource({ id, label, values = [], estimated = false }) {
  const resource = createValuesResource({ id, label, values, estimated });
  const first = Array.isArray(values) ? values.find(value => Number.isFinite(Number(value?.number))) : null;
  return {
    ...resource,
    // OpenUsage exports non-metered values as a balance-like resource so the existing
    // clients can render the available number without inventing a percentage.
    kind: "balance",
    unit: first?.kind === "dollars" ? "usd" : first?.kind === "credits" ? "credits" : "count",
    available: first ? Number(first.number) : null,
  };
}

function highestUtilization(resources) {
  const values = Object.values(resources || {})
    .filter(resource => resource?.kind === "consumption" && resource.estimated !== true)
    .map(resource => number(resource.utilization))
    .filter(value => value !== null);
  return values.length ? Math.max(...values) : null;
}

export function statusForUtilization(utilization) {
  if (utilization === null || !Number.isFinite(utilization)) return "unknown";
  if (utilization >= 0.95) return "exhausted";
  if (utilization >= 0.8) return "attention";
  return "normal";
}

export function mascotForUtilization(utilization) {
  if (utilization === null || !Number.isFinite(utilization)) return "neutral";
  if (utilization >= 0.95) return "exhausted";
  if (utilization >= 0.8) return "tired";
  if (utilization >= 0.6) return "attentive";
  return "energized";
}

export function normalizeHistory(history, now = new Date()) {
  const source = history && typeof history === "object" ? history : {};
  const summary = source.summary && typeof source.summary === "object" ? source.summary : emptyHistory();
  return {
    trend: Array.isArray(source.trend) && source.trend.length ? { points: source.trend } : null,
    history: {
      today: summary.today || null,
      yesterday: summary.yesterday || null,
      last30Days: summary.last30Days || null,
      byModel: Array.isArray(summary.byModel) ? summary.byModel : [],
    },
    unknownModels: Array.isArray(source.unknownModels) ? source.unknownModels : [],
    historyUpdatedAt: source.updatedAt || now.toISOString(),
  };
}

export function providerSnapshot({ id, name, plan = null, resources = {}, history = null, now = new Date(), stale = false }) {
  const normalizedHistory = normalizeHistory(history, now);
  const utilization = highestUtilization(resources);
  return {
    id,
    name,
    plan: typeof plan === "string" && plan.trim() ? plan.trim() : null,
    status: statusForUtilization(utilization),
    mascot: mascotForUtilization(utilization),
    stale: stale === true,
    refreshedAt: now.toISOString(),
    resources,
    trend: normalizedHistory.trend,
    history: normalizedHistory.history,
    unknownModels: normalizedHistory.unknownModels,
  };
}

export function emptyProviderHistory() {
  return { events: [], summary: emptyHistory(), trend: [], unknownModels: [] };
}

export function createFetchJSON(fetchImpl = globalThis.fetch) {
  return async function fetchJSON(url, options = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch indisponível");
    const response = await fetchImpl(url, options);
    if (!response || response.ok !== true || typeof response.json !== "function") {
      const error = new Error(`fonte respondeu HTTP ${response?.status || 0}`);
      error.status = response?.status || 0;
      throw error;
    }
    return response.json();
  };
}

export function homeDirectory(env = process.env) {
  return env.HOME || env.USERPROFILE || ".";
}

export function credentialToken(credentials) {
  if (!credentials || typeof credentials !== "object") return null;
  for (const key of ["accessToken", "access_token", "token", "key"]) {
    if (typeof credentials[key] === "string" && credentials[key].trim()) return credentials[key].trim();
  }
  return null;
}

export async function readMacKeychain({ service, account = null, exec = execFileAsync } = {}) {
  if (process.platform !== "darwin" || typeof service !== "string" || !service.trim()) return null;
  const args = ["find-generic-password", "-s", service.trim()];
  if (account) args.push("-a", account);
  args.push("-w");
  try {
    const result = await exec("security", args, { timeout: 3000, maxBuffer: 1024 * 1024, windowsHide: true });
    return typeof result?.stdout === "string" && result.stdout.trim() ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

export { emptyHistory };
