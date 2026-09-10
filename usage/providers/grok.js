import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { scanFileActivity } from "../activity.js";
import { scanGrokHistory } from "./grok-history.js";
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

const DEFAULT_CREDITS_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
const DEFAULT_SETTINGS_URL = "https://cli-chat-proxy.grok.com/v1/settings";

async function readCredentials(options) {
  if (options.credentials && typeof options.credentials === "object") return options.credentials;
  if (typeof options.readCredentials === "function") return options.readCredentials();
  const env = options.env || process.env;
  const envToken = credentialToken({ accessToken: env.GROK_ACCESS_TOKEN });
  if (envToken) return { accessToken: envToken };
  try {
    const parsed = JSON.parse(await readFile(options.authFile || join(homeDirectory(env), ".grok", "auth.json"), "utf8"));
    const entries = Object.entries(parsed || {}).filter(([, value]) => credentialToken(value));
    return entries.length ? { ...entries[0][1], entryKey: entries[0][0] } : null;
  } catch { return null; }
}

function periodDuration(period) {
  const start = Date.parse(period?.start || "");
  const end = Date.parse(period?.end || period?.periodEnd || "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 7 * 24 * 60 * 60 * 1000;
}

function mapResources(live) {
  const resources = {};
  const weekly = live.weekly;
  const actualConfig = live.config;
  const actualPeriod = actualConfig?.currentPeriod;
  const actualIsWeekly = actualPeriod?.type === "USAGE_PERIOD_TYPE_WEEKLY";
  const usedPercent = nonNegative(weekly?.used_percent ?? actualConfig?.creditUsagePercent);
  if (usedPercent !== null && (weekly || actualIsWeekly)) {
    resources.weekly = progressResource({
      id: "weekly", label: "Semana", used: usedPercent,
      resetsAt: resetTimestamp(weekly?.reset_at ?? actualPeriod?.end),
      periodDurationMs: weekly ? 7 * 24 * 60 * 60 * 1000 : periodDuration(actualPeriod),
    });
  }
  const extra = live.pay_as_you_go;
  if (extra && extra.enabled === true) {
    const used = nonNegative(extra.used_credits);
    const limit = nonNegative(extra.monthly_limit);
    if (used !== null && limit !== null && limit > 0) {
      resources.extraUsage = progressResource({ id: "extraUsage", label: "Uso extra", used, limit, format: "credits" });
    }
  }
  if (actualConfig?.onDemandCap?.val !== undefined) {
    const cap = nonNegative(actualConfig.onDemandCap.val);
    if (cap !== null) {
      resources.extraUsage = valuesResource({ id: "extraUsage", label: "Uso extra", values: [{ number: cap, kind: "credits", label: "cap" }] });
    }
  }
  return resources;
}

export function createGrokProvider(options = {}) {
  const fetchJSON = options.fetchJSON || createFetchJSON(options.fetchImpl);
  const provider = {
    id: "grok",
    name: "Grok",
    async getCredentials() {
      return readCredentials(options);
    },
    async hasCredentials() {
      return Boolean(credentialToken(await provider.getCredentials()));
    },
    async fetchLive({ signal } = {}) {
      const credentials = await provider.getCredentials();
      const token = credentialToken(credentials);
      if (!token) throw new Error("Grok não está autenticado");
      const headers = {
        Authorization: `Bearer ${token}`,
        "X-XAI-Token-Auth": "xai-grok-cli",
        Accept: "application/json",
        "User-Agent": "grok",
      };
      const body = await fetchJSON(options.creditsUrl || DEFAULT_CREDITS_URL, { method: "GET", headers, signal });
      return { body, metadata: { plan: null } };
    },
    async readHistory({ since, cache, pricing } = {}) {
      const env = options.env || process.env;
      const root = options.historyRoot || join(homeDirectory(env), ".grok");
      return { events: await scanGrokHistory({ roots: [root], since, cache, pricing }) };
    },
    async readActivity({ now } = {}) {
      const env = options.env || process.env;
      const roots = options.activityRoots || [options.activityRoot || join(homeDirectory(env), ".grok")];
      return scanFileActivity({
        providerId: provider.id,
        roots,
        now,
        match: (_file, name) => name === "updates.jsonl",
      });
    },
    normalize({ live, history, now = new Date() } = {}) {
      const payload = responsePayload(live);
      const metadata = responseMeta(live);
      return providerSnapshot({ id: provider.id, name: provider.name, plan: metadata.plan || payload.plan || null, resources: mapResources(payload), history, now });
    },
  };
  return provider;
}

export { DEFAULT_CREDITS_URL, DEFAULT_SETTINGS_URL };
