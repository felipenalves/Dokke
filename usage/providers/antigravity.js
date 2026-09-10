import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { scanFileActivity } from "../activity.js";
import { scanAntigravityHistory } from "./antigravity-history.js";
import {
  createFetchJSON,
  credentialToken,
  homeDirectory,
  nonNegative,
  progressResource,
  providerSnapshot,
  readMacKeychain,
  responseMeta,
  responsePayload,
  resetTimestamp,
} from "./common.js";

const execFileAsync = promisify(execFile);
const CLOUD_CODE_BASES = [
  "https://daily-cloudcode-pa.googleapis.com",
  "https://cloudcode-pa.googleapis.com",
];
const QUOTA_SUMMARY_PATH = "/v1internal:retrieveUserQuotaSummary";
const FETCH_MODELS_PATH = "/v1internal:fetchAvailableModels";

function parseKeychainValue(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let text = raw.trim();
  if (text.startsWith("go-keyring-base64:")) {
    try { text = Buffer.from(text.slice("go-keyring-base64:".length), "base64").toString("utf8"); } catch { return null; }
  }
  try {
    const parsed = JSON.parse(text);
    const source = parsed?.token && typeof parsed.token === "object" ? parsed.token : parsed;
    if (typeof source === "string") return { accessToken: source };
    if (source && typeof source === "object") {
      return {
        accessToken: source.access_token || source.accessToken || source.token || source.id_token || source.idToken,
        refreshToken: source.refresh_token || source.refreshToken,
      };
    }
  } catch {}
  const token = text.replace(/^Bearer\s+/i, "").trim();
  return token ? { accessToken: token } : null;
}

async function readCredentials(options) {
  if (options.credentials && typeof options.credentials === "object") return options.credentials;
  if (typeof options.readCredentials === "function") return options.readCredentials();
  const env = options.env || process.env;
  const envToken = credentialToken({ accessToken: env.ANTIGRAVITY_ACCESS_TOKEN });
  if (envToken) return { accessToken: envToken };
  const keychainRead = options.keychainRead || (() => readMacKeychain({ service: "gemini", account: "antigravity" }));
  try { return parseKeychainValue(await keychainRead()); } catch { return null; }
}

function groupsFrom(live) {
  return live?.response?.groups || live?.groups || null;
}

function mapSummaryResources(live) {
  const known = new Map([
    ["gemini-5h", ["session", "Sessão", 5 * 60 * 60 * 1000]],
    ["gemini-weekly", ["weekly", "Semana", 7 * 24 * 60 * 60 * 1000]],
    ["3p-5h", ["claude", "Claude", 5 * 60 * 60 * 1000]],
    ["3p-weekly", ["claudeWeekly", "Semana", 7 * 24 * 60 * 60 * 1000]],
  ]);
  const resources = {};
  for (const group of groupsFrom(live) || []) {
    for (const bucket of Array.isArray(group?.buckets) ? group.buckets : []) {
      const spec = known.get(bucket?.bucketId);
      const fraction = nonNegative(bucket?.remainingFraction);
      if (!spec || fraction === null || resources[spec[0]]) continue;
      resources[spec[0]] = progressResource({
        id: spec[0], label: spec[1], used: (1 - Math.max(0, Math.min(1, fraction))) * 100,
        resetsAt: resetTimestamp(bucket.resetTime), periodDurationMs: spec[2],
      });
    }
  }
  return resources;
}

function mapLegacyResources(live) {
  const models = live?.models && typeof live.models === "object" ? Object.values(live.models) : [];
  const pooled = new Map();
  for (const model of models) {
    if (model?.isInternal === true) continue;
    const label = String(model?.displayName || model?.label || "").trim();
    const quota = model?.quotaInfo;
    const remaining = nonNegative(quota?.remainingFraction);
    if (!label || remaining === null) continue;
    const key = label.toLowerCase().includes("gemini") ? "session" : "claude";
    const current = pooled.get(key);
    if (!current || remaining < current.remaining) pooled.set(key, { remaining, reset: quota.resetTime });
  }
  return Object.fromEntries([...pooled.entries()].map(([id, value]) => [id, progressResource({
    id, label: id === "session" ? "Sessão" : "Claude",
    used: (1 - Math.max(0, Math.min(1, value.remaining))) * 100,
    resetsAt: resetTimestamp(value.reset), periodDurationMs: 5 * 60 * 60 * 1000,
  })]));
}

async function discoverDatabases(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter(entry => entry.isFile() && entry.name.endsWith(".db")).map(entry => join(root, entry.name)).sort();
  } catch { return []; }
}

async function sqliteQuery(database, sql, exec = execFileAsync) {
  const result = await exec("sqlite3", ["-json", database, sql], { timeout: 10000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  try { return JSON.parse(result.stdout || "[]"); } catch { return []; }
}

export function createAntigravityProvider(options = {}) {
  const fetchJSON = options.fetchJSON || createFetchJSON(options.fetchImpl);
  const provider = {
    id: "antigravity",
    name: "Antigravity",
    async getCredentials() {
      return readCredentials(options);
    },
    async hasCredentials() {
      return Boolean(credentialToken(await provider.getCredentials()));
    },
    async fetchLive({ signal } = {}) {
      const credentials = await provider.getCredentials();
      const token = credentialToken(credentials);
      if (!token) throw new Error("Antigravity não está autenticado");
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", "User-Agent": "antigravity" };
      let lastError = null;
      for (const base of CLOUD_CODE_BASES) {
        try {
          const summary = await fetchJSON(base + QUOTA_SUMMARY_PATH, { method: "POST", headers, body: "{}", signal });
          if (groupsFrom(summary)) return { body: summary, metadata: { plan: null } };
        } catch (error) { lastError = error; }
      }
      // Older Antigravity builds have no quota summary RPC. Keep the OpenUsage fallback: use the
      // per-model quotas, pooled by Gemini/non-Gemini, and do not manufacture weekly data.
      for (const base of CLOUD_CODE_BASES) {
        try {
          const models = await fetchJSON(base + FETCH_MODELS_PATH, { method: "POST", headers, body: "{}", signal });
          if (models?.models) return { body: { legacyModels: models.models }, metadata: { plan: null } };
        } catch (error) { lastError = error; }
      }
      throw lastError || new Error("Antigravity indisponível");
    },
    async readHistory({ since, cache } = {}) {
      const env = options.env || process.env;
      const root = options.historyRoot || join(homeDirectory(env), ".gemini", "antigravity-cli", "conversations");
      const databases = options.databases || await discoverDatabases(root);
      const sqlite = options.sqlite || { query: (database, sql) => sqliteQuery(database, sql, options.exec || execFileAsync) };
      return { events: await scanAntigravityHistory({ databases, since, sqlite, maxBytes: 1024 * 1024 }) };
    },
    async readActivity({ now } = {}) {
      const env = options.env || process.env;
      const home = homeDirectory(env);
      const roots = options.activityRoots || [
        options.activityRoot || join(home, ".gemini", "antigravity", "brain"),
        join(home, ".gemini", "antigravity-cli", "conversations"),
      ];
      return scanFileActivity({ providerId: provider.id, roots, now });
    },
    normalize({ live, history, now = new Date() } = {}) {
      const payload = responsePayload(live);
      const metadata = responseMeta(live);
      const resources = groupsFrom(payload) ? mapSummaryResources(payload) : mapLegacyResources(payload.legacyModels ? { models: payload.legacyModels } : payload);
      const plan = metadata.plan || payload.plan || payload.paidTier?.name || payload.currentTier?.name || null;
      return providerSnapshot({ id: provider.id, name: provider.name, plan, resources, history, now });
    },
  };
  return provider;
}

export { CLOUD_CODE_BASES, QUOTA_SUMMARY_PATH, sqliteQuery };
