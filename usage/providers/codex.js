import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { scanFileActivity } from "../activity.js";
import { scanCodexHistory } from "./codex-history.js";
import {
  createFetchJSON,
  credentialToken,
  homeDirectory,
  nonNegative,
  progressResource,
  providerSnapshot,
  responseMeta,
  responsePayload,
  resetTimestamp,
  valuesResource,
} from "./common.js";

const DEFAULT_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const DEFAULT_RESET_CREDITS_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";

function authPaths(options) {
  const env = options.env || process.env;
  if (options.authFile) return [options.authFile];
  if (env.CODEX_HOME) return [join(env.CODEX_HOME, "auth.json")];
  const home = homeDirectory(env);
  return [join(home, ".config", "codex", "auth.json"), join(home, ".codex", "auth.json")];
}

async function readCredentials(options) {
  if (options.credentials && typeof options.credentials === "object") return options.credentials;
  if (typeof options.readCredentials === "function") return options.readCredentials();
  for (const path of authPaths(options)) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8"));
      if (parsed?.tokens?.access_token || parsed?.tokens?.accessToken || parsed?.access_token) return parsed;
    } catch {}
  }
  return null;
}

function accessToken(credentials) {
  return credentialToken(credentials?.tokens || credentials);
}

function accountId(credentials) {
  const value = credentials?.tokens?.account_id || credentials?.tokens?.accountID || credentials?.account_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function periodKind(window, fallback) {
  const seconds = nonNegative(window?.limit_window_seconds ?? window?.window_seconds);
  if (seconds === 5 * 60 * 60) return "session";
  if (seconds === 7 * 24 * 60 * 60) return "weekly";
  return fallback;
}

function resetAt(window, now = new Date()) {
  if (window?.reset_after_seconds !== undefined) {
    const seconds = nonNegative(window.reset_after_seconds);
    const base = now instanceof Date ? now : new Date(now);
    return seconds === null || Number.isNaN(base.getTime()) ? null : new Date(base.getTime() + seconds * 1000).toISOString();
  }
  return resetTimestamp(window?.reset_at ?? window?.resets_at);
}

function windowResource(id, label, window, fallback, now) {
  const used = nonNegative(window?.used_percent);
  if (used === null) return null;
  const kind = periodKind(window, fallback);
  return progressResource({
    id, label, used,
    resetsAt: resetAt(window, now),
    periodDurationMs: kind === "session" ? 5 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
  });
}

function mapResources(live, now = new Date()) {
  const resources = {};
  const windows = [
    [live.rate_limit?.primary_window, "session"],
    [live.rate_limit?.secondary_window, "weekly"],
  ];
  for (const [window, fallback] of windows) {
    const kind = periodKind(window, fallback);
    const resource = windowResource(kind, kind === "session" ? "Sessão" : "Semana", window, fallback, now);
    if (resource && !resources[kind]) resources[kind] = resource;
  }
  const extra = Array.isArray(live.additional_rate_limits) ? live.additional_rate_limits : [];
  const spark = extra.find(entry => {
    const value = `${entry?.limit_name || ""} ${entry?.metered_feature || ""}`.toLowerCase();
    return value.includes("spark");
  });
  if (spark?.rate_limit) {
    const primary = spark.rate_limit.primary_window;
    const secondary = spark.rate_limit.secondary_window;
    const sparkSession = windowResource("spark", "Spark", primary, "session", now);
    const sparkWeekly = windowResource("sparkWeekly", "Semana", secondary, "weekly", now);
    if (sparkSession) resources.spark = sparkSession;
    if (sparkWeekly) resources.sparkWeekly = sparkWeekly;
  }
  const balance = nonNegative(live.credits?.balance ?? live.credits?.remaining ?? live.credit_balance);
  const measuredBalance = balance !== null ? balance : live.credits?.has_credits === false ? 0 : null;
  if (measuredBalance !== null) {
    resources.credits = valuesResource({
      id: "credits", label: "Créditos", values: [{ number: measuredBalance, kind: "count", label: "disponível" }],
    });
    resources.credits.available = measuredBalance;
    resources.credits.unit = "credits";
  }
  const resetCredits = live.rate_limit_reset_credits;
  const resetCount = nonNegative(resetCredits?.available_count ?? resetCredits?.count);
  if (resetCount !== null) {
    resources.rateLimitResets = valuesResource({
      id: "rateLimitResets", label: "Recargas de limite",
      values: [{ number: resetCount, kind: "count", label: "disponíveis" }],
    });
  }
  return resources;
}

export function createCodexProvider(options = {}) {
  const fetchJSON = options.fetchJSON || createFetchJSON(options.fetchImpl);
  const provider = {
    id: "codex",
    name: "Codex",
    async getCredentials() {
      return readCredentials(options);
    },
    async hasCredentials() {
      return Boolean(accessToken(await provider.getCredentials()));
    },
    async fetchLive({ signal } = {}) {
      const credentials = await provider.getCredentials();
      const token = accessToken(credentials);
      if (!token) throw new Error("Codex não está autenticado");
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "Codex",
      };
      const id = accountId(credentials);
      if (id) headers["ChatGPT-Account-Id"] = id;
      const body = await fetchJSON(options.usageUrl || DEFAULT_USAGE_URL, { method: "GET", headers, signal });
      let resetCredits = null;
      try {
        resetCredits = await fetchJSON(options.resetCreditsUrl || DEFAULT_RESET_CREDITS_URL, {
          method: "GET",
          headers: { ...headers, "OpenAI-Beta": "codex-1", originator: "Codex Desktop" },
          signal,
        });
      } catch {}
      const merged = resetCredits && typeof resetCredits === "object"
        ? { ...body, rate_limit_reset_credits: resetCredits }
        : body;
      return { body: merged, metadata: { plan: body.plan_type || null } };
    },
    async readHistory({ since, cache, pricing } = {}) {
      const env = options.env || process.env;
      const home = options.historyRoot || env.CODEX_HOME || join(homeDirectory(env), ".config", "codex");
      return { events: await scanCodexHistory({ homes: [home], since, cache, pricing }) };
    },
    async readActivity({ now } = {}) {
      const env = options.env || process.env;
      const home = homeDirectory(env);
      const roots = options.activityRoots || [
        options.activityRoot || env.CODEX_HOME || join(home, ".codex"),
        join(home, ".config", "codex"),
      ];
      return scanFileActivity({ providerId: provider.id, roots, now });
    },
    normalize({ live, history, now = new Date() } = {}) {
      const payload = responsePayload(live);
      const metadata = responseMeta(live);
      return providerSnapshot({
        id: provider.id,
        name: provider.name,
        plan: metadata.plan || payload.plan_type || null,
        resources: mapResources(payload, now),
        history,
        now,
      });
    },
  };
  return provider;
}

export { DEFAULT_RESET_CREDITS_URL, DEFAULT_USAGE_URL };
