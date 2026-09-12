import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClaudeProvider } from "../usage/providers/claude.js";
import { createCodexProvider } from "../usage/providers/codex.js";
import { createAntigravityProvider } from "../usage/providers/antigravity.js";
import { createGrokProvider } from "../usage/providers/grok.js";
import { createProviderCatalog } from "../usage/catalog.js";

const now = new Date("2026-09-01T15:00:00.000Z");
const fixtures = {};
for (const name of ["claude-usage", "codex-usage", "antigravity-quota", "grok-credits"]) {
  fixtures[name] = JSON.parse(await readFile(new URL(`./fixtures/usage/${name}.json`, import.meta.url), "utf8"));
}
const emptyHistory = { events: [], summary: { today: null, yesterday: null, last30Days: null, byModel: [] }, trend: [] };

test("Claude mapeia five_hour e seven_day para session e weekly", () => {
  const provider = createClaudeProvider();
  const result = provider.normalize({ live: fixtures["claude-usage"], history: emptyHistory, now });
  assert.equal(result.resources.session.used, 32);
  assert.equal(result.resources.weekly.used, 61);
  assert.equal(result.resources.session.periodDurationMs, 5 * 60 * 60 * 1000);
  assert.equal(result.resources.session.utilization, 0.32);
  assert.equal(result.resources.extraUsage.used, 12.5);
});

test("Codex classifica janelas pela duração real", () => {
  const provider = createCodexProvider();
  const result = provider.normalize({ live: fixtures["codex-usage"], history: emptyHistory, now });
  assert.equal(result.resources.session.periodDurationMs, 5 * 60 * 60 * 1000);
  assert.equal(result.resources.weekly.periodDurationMs, 7 * 24 * 60 * 60 * 1000);
  assert.equal(result.resources.session.used, 32);
  assert.equal(result.resources.weekly.used, 61);
  assert.equal(result.resources.credits.available, 12.5);
});

test("Codex usa o Keychain do macOS quando não há auth.json", async () => {
  const provider = createCodexProvider({
    authFile: "/__dokke_test__/missing-codex-auth.json",
    keychainRead: async () => JSON.stringify({ tokens: { access_token: "secret", account_id: "acct" } }),
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer secret");
      assert.equal(options.headers["ChatGPT-Account-Id"], "acct");
      return new Response(JSON.stringify(fixtures["codex-usage"]), { status: 200 });
    },
  });
  const result = await provider.fetchLive({ signal: new AbortController().signal });
  assert.equal(result.body.rate_limit.primary_window.used_percent, 32);
});

test("Antigravity aceita somente os quatro buckets conhecidos", () => {
  const provider = createAntigravityProvider();
  const result = provider.normalize({ live: fixtures["antigravity-quota"], history: emptyHistory, now });
  assert.deepEqual(Object.keys(result.resources), ["session", "weekly", "claude", "claudeWeekly"]);
  assert.equal(result.resources.session.remaining, 68);
  assert.equal(result.resources.claudeWeekly.resetsAt, "2026-09-07T18:00:00.000Z");
});

test("Grok só cria a semana quando o billing reporta weekly", () => {
  const provider = createGrokProvider();
  const result = provider.normalize({ live: fixtures["grok-credits"], history: emptyHistory, now });
  assert.equal(result.resources.weekly.used, 21);
  assert.equal(result.resources.weekly.periodDurationMs, 7 * 24 * 60 * 60 * 1000);
  assert.equal(result.resources.extraUsage.used, 250);
  assert.equal(result.resources.extraUsage.limit, 1000);
});

test("Grok lê o plano autenticado sem tornar a cota dependente do endpoint de settings @spec:AC-354", async () => {
  const calls = [];
  const provider = createGrokProvider({
    credentials: { accessToken: "secret" },
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).endsWith("/v1/settings")) return new Response(JSON.stringify({ subscription_tier_display: "SuperGrok" }), { status: 200 });
      return new Response(JSON.stringify(fixtures["grok-credits"]), { status: 200 });
    },
  });
  const result = await provider.fetchLive({ signal: new AbortController().signal });
  assert.equal(result.metadata.plan, "SuperGrok");
  assert.equal(calls.length, 2);

  const withoutSettings = createGrokProvider({
    credentials: { accessToken: "secret" },
    fetchImpl: async (url) => String(url).endsWith("/v1/settings")
      ? new Response("offline", { status: 503 })
      : new Response(JSON.stringify(fixtures["grok-credits"]), { status: 200 }),
  });
  const fallback = await withoutSettings.fetchLive({ signal: new AbortController().signal });
  assert.equal(fallback.body.weekly.used_percent, 21);
  assert.equal(fallback.metadata.plan, null);
});

test("Antigravity expõe o plano vindo do payload autenticado", () => {
  const provider = createAntigravityProvider();
  const result = provider.normalize({
    live: { body: { groups: [], userTier: { name: "Google AI Pro" } } },
    history: emptyHistory,
    now,
  });
  assert.equal(result.plan, "Pro");
});

test("Antigravity consulta o tier do Cloud Code como chamada complementar @spec:AC-354", async () => {
  const calls = [];
  const provider = createAntigravityProvider({
    credentials: { accessToken: "secret" },
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).includes("retrieveUserQuotaSummary")) {
        return new Response(JSON.stringify(fixtures["antigravity-quota"]), { status: 200 });
      }
      if (String(url).includes("loadCodeAssist")) {
        return new Response(JSON.stringify({ paidTier: { name: "Gemini Code Assist in Google One AI Pro" } }), { status: 200 });
      }
      return new Response("missing", { status: 404 });
    },
  });
  const result = await provider.fetchLive({ signal: new AbortController().signal });
  assert.equal(result.metadata.plan, "Pro");
  assert.equal(calls.length, 2);
});

test("adaptadores consultam somente a própria fonte e catálogo preserva a ordem", async () => {
  const calls = [];
  const provider = createClaudeProvider({
    credentials: { accessToken: "secret" },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), authorization: options.headers.Authorization });
      return new Response(JSON.stringify(fixtures["claude-usage"]), { status: 200 });
    },
  });
  const result = await provider.fetchLive({ signal: new AbortController().signal });
  assert.equal(result.body.five_hour.utilization, 32);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\.anthropic\.com\/api\/oauth\/usage$/);
  assert.equal(calls[0].authorization, "Bearer secret");

  const catalog = createProviderCatalog({ providers: [createGrokProvider(), provider, createCodexProvider(), createAntigravityProvider()] });
  assert.deepEqual(catalog.map(item => item.id), ["claude", "codex", "antigravity", "grok"]);
});
