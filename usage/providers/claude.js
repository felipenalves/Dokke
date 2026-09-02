import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { scanFileActivity } from "../activity.js";
import { scanClaudeHistory } from "./claude-history.js";
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
  valuesResource,
} from "./common.js";

const DEFAULT_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const DEFAULT_REFRESH_URL = "https://platform.claude.com/v1/oauth/token";

function credentialsPath(options) {
  const env = options.env || process.env;
  const configDir = options.configDir || env.CLAUDE_CONFIG_DIR || join(homeDirectory(env), ".claude");
  return join(configDir, ".credentials.json");
}

async function readCredentials(options) {
  if (options.credentials && typeof options.credentials === "object") return options.credentials;
  if (typeof options.readCredentials === "function") return options.readCredentials();
  const keychainRead = options.keychainRead || (service => readMacKeychain({ service }));
  for (const service of options.keychainServices || ["Claude Code-credentials"]) {
    try {
      const raw = await keychainRead(service);
      if (!raw) continue;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const credentials = parsed?.claudeAiOauth || parsed?.oauth || parsed;
      if (credentialToken(credentials)) return credentials;
    } catch {}
  }
  const env = options.env || process.env;
  const envToken = credentialToken({ accessToken: env.CLAUDE_CODE_OAUTH_TOKEN });
  if (envToken) return { accessToken: envToken, inferenceOnly: true };
  try {
    const parsed = JSON.parse(await readFile(credentialsPath(options), "utf8"));
    return parsed.claudeAiOauth || parsed.oauth || parsed;
  } catch {
    return null;
  }
}

function planFrom(credentials, live) {
  const value = live.plan || live.subscription_type || credentials?.subscriptionType || credentials?.subscription_type;
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function mapResources(live) {
  const resources = {};
  const session = live.five_hour;
  const weekly = live.seven_day;
  if (session && nonNegative(session.utilization) !== null) {
    resources.session = progressResource({
      id: "session", label: "Sessão", used: session.utilization,
      resetsAt: resetTimestamp(session.resets_at), periodDurationMs: 5 * 60 * 60 * 1000,
    });
  }
  if (weekly && nonNegative(weekly.utilization) !== null) {
    resources.weekly = progressResource({
      id: "weekly", label: "Semana", used: weekly.utilization,
      resetsAt: resetTimestamp(weekly.resets_at), periodDurationMs: 7 * 24 * 60 * 60 * 1000,
    });
  }
  if (live.seven_day_sonnet && nonNegative(live.seven_day_sonnet.utilization) !== null) {
    resources.sonnet = progressResource({
      id: "sonnet", label: "Sonnet", used: live.seven_day_sonnet.utilization,
      resetsAt: resetTimestamp(live.seven_day_sonnet.resets_at), periodDurationMs: 7 * 24 * 60 * 60 * 1000,
    });
  }
  const scopedLimits = Array.isArray(live.limits) ? live.limits : [];
  const fable = scopedLimits.find(entry => entry?.kind === "weekly_scoped"
    && entry?.scope?.model?.display_name === "Fable");
  if (fable && nonNegative(fable.percent) !== null) {
    resources.fable = progressResource({
      id: "fable", label: "Fable", used: fable.percent,
      resetsAt: resetTimestamp(fable.resets_at), periodDurationMs: 7 * 24 * 60 * 60 * 1000,
    });
  }
  const extra = live.extra_usage;
  if (extra?.is_enabled === true && nonNegative(extra.used_credits) !== null) {
    const used = nonNegative(extra.used_credits) / 100;
    const limit = nonNegative(extra.monthly_limit);
    if (limit !== null && limit > 0) {
      resources.extraUsage = progressResource({
        id: "extraUsage", label: "Uso extra", used, limit, format: "dollars",
      });
    } else if (used > 0) {
      resources.extraUsage = valuesResource({ id: "extraUsage", label: "Uso extra", values: [{ number: used, kind: "dollars" }] });
    }
  }
  return resources;
}

export function createClaudeProvider(options = {}) {
  const fetchJSON = options.fetchJSON || createFetchJSON(options.fetchImpl);
  const provider = {
    id: "claude",
    name: "Claude",
    async getCredentials() {
      return readCredentials(options);
    },
    async hasCredentials() {
      return Boolean(credentialToken(await this.getCredentials()));
    },
    async fetchLive({ signal } = {}) {
      const credentials = await this.getCredentials();
      const token = credentialToken(credentials);
      if (!token) throw new Error("Claude não está autenticado");
      const live = await fetchJSON(options.usageUrl || DEFAULT_USAGE_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "anthropic-beta": "oauth-2025-04-20",
          "User-Agent": "claude-code/2.1.69",
        },
        signal,
      });
      return { body: live, metadata: { plan: planFrom(credentials, live) } };
    },
    async readHistory({ since, cache, pricing } = {}) {
      const root = options.historyRoot || join(options.configDir || (options.env || process.env).CLAUDE_CONFIG_DIR || join(homeDirectory(options.env || process.env), ".claude"), "projects");
      const events = await scanClaudeHistory({ roots: [root], since, cache, pricing });
      return { events };
    },
    async readActivity({ now } = {}) {
      const env = options.env || process.env;
      const configDir = options.configDir || env.CLAUDE_CONFIG_DIR || join(homeDirectory(env), ".claude");
      const roots = options.activityRoots || [
        options.activityRoot || join(configDir, "projects"),
        join(configDir, "sessions"),
      ];
      return scanFileActivity({ providerId: provider.id, roots, now });
    },
    normalize({ live, history, now = new Date() } = {}) {
      const payload = responsePayload(live);
      const metadata = responseMeta(live);
      return providerSnapshot({
        id: provider.id,
        name: provider.name,
        plan: metadata.plan || planFrom({}, payload),
        resources: mapResources(payload),
        history,
        now,
      });
    },
  };
  return provider;
}

export { DEFAULT_REFRESH_URL, DEFAULT_USAGE_URL };
