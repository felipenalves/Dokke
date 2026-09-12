import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createUsageSource, normalizeOpenUsage } from "../usage.js";
import { startServer } from "../server.js";

test("adapter do OpenUsage preserva providers como mapa e não inventa limites", () => {
  const result = normalizeOpenUsage({
    schema: "openusage.limits.v1",
    generatedAt: "2026-08-31T13:00:00.000Z",
    providers: {
      codex: {
        displayName: "Codex",
        resources: {
          session: { kind: "consumption", unit: "requests", used: 4, limit: 10, remaining: 6, utilization: 0.4 }
        }
      }
    }
  });

  assert.equal(result.sourceState, "available");
  assert.equal(Array.isArray(result.providers), false);
  assert.equal(result.providers.codex.resources.session.remaining, 6);
  assert.equal(result.providers.claude, undefined);
});

test("adapter preserva a duração da janela para projeção de ritmo", () => {
  const result = normalizeOpenUsage({
    schema: "openusage.limits.v1",
    generatedAt: "2026-08-31T13:00:00.000Z",
    providers: {
      codex: {
        displayName: "Codex",
        resources: {
          session: {
            kind: "consumption",
            unit: "percent",
            used: 84,
            limit: 100,
            remaining: 16,
            utilization: 0.84,
            resetsAt: "2026-08-31T23:00:00.000Z",
            windowSeconds: 36000,
          },
        },
      },
    },
  });

  assert.equal(result.providers.codex.resources.session.periodDurationMs, 36000000);
});

test("adapter padroniza qualquer janela weekly como Semana", () => {
  const result = normalizeOpenUsage({
    schema: "openusage.limits.v1",
    generatedAt: "2026-08-31T13:00:00.000Z",
    providers: {
      antigravity: {
        displayName: "Antigravity",
        resources: {
          geminiWeekly: { kind: "consumption", unit: "percent", used: 9, limit: 100, remaining: 91, utilization: 0.09 },
          nonGeminiWeekly: { kind: "consumption", unit: "percent", used: 0, limit: 100, remaining: 100, utilization: 0 },
        },
      },
    },
  });

  assert.equal(result.providers.antigravity.resources.geminiWeekly.label, "Semana");
  assert.equal(result.providers.antigravity.resources.nonGeminiWeekly.label, "Semana");
});

test("adapter preserva a série diária do Usage Trend do endpoint legado", () => {
  const result = normalizeOpenUsage(
    {
      schema: "openusage.limits.v1",
      generatedAt: "2026-08-31T13:00:00.000Z",
      providers: {
        codex: {
          displayName: "Codex",
          resources: {
            session: { kind: "consumption", unit: "percent", used: 4, limit: 10, remaining: 6, utilization: 0.4 }
          }
        }
      }
    },
    [{
      providerId: "codex",
      lines: [{
        type: "barChart",
        label: "Usage Trend",
        points: [
          { label: "Aug 30", value: 1200000, valueLabel: "1.2M tokens" },
          { label: "Aug 31", value: 2400000, valueLabel: "2.4M tokens" }
        ],
        note: "Estimated from local Codex logs."
      }]
    }]
  );

  assert.deepEqual(result.providers.codex.trend, {
    points: [
      { label: "Aug 30", value: 1200000, valueLabel: "1.2M tokens" },
      { label: "Aug 31", value: 2400000, valueLabel: "2.4M tokens" }
    ],
    note: "Estimated from local Codex logs."
  });
});

test("fonte consulta limites e histórico sem derrubar os limites se o histórico faltar", async () => {
  const calls = [];
  const source = createUsageSource({
    fetchImpl: async url => {
      calls.push(String(url));
      if (String(url).endsWith("/v1/limits")) {
        return new Response(JSON.stringify({
          schema: "openusage.limits.v1",
          generatedAt: "2026-08-31T13:00:00.000Z",
          providers: { codex: { resources: { session: { kind: "consumption", unit: "percent", used: 1, limit: 10, remaining: 9, utilization: 0.1 } } } }
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("offline", { status: 503 });
    }
  });

  const result = await source.getUsage();
  assert.equal(result.sourceState, "available");
  assert.equal(result.providers.codex.resources.session.remaining, 9);
  assert.deepEqual(calls.sort(), [
    "http://127.0.0.1:6736/v1/limits",
    "http://127.0.0.1:6736/v1/usage"
  ]);
});

test("PWA v0.2.8 expõe a tela Usage com Claude e Codex", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /id="screenUsage"/);
  assert.match(html, /const SCREEN_NAMES = \["apps", "recents", "usage"\]/);
  assert.match(html, /const SCREEN_STORAGE_KEY = "dokke\.lastScreen"/);
  assert.match(html, /function readPersistedScreen\(\)/);
  assert.match(html, /localStorage\.getItem\(SCREEN_STORAGE_KEY\)/);
  assert.match(html, /localStorage\.setItem\(SCREEN_STORAGE_KEY, name\)/);
  assert.match(html, /const initialScreen\s*=\s*readPersistedScreen\(\)/);
  assert.match(html, /if\s*\(initialScreen\s*!==\s*"apps"\)\s*goScreen\(initialScreen\)/);
  assert.match(html, /goScreen\(name\)[\s\S]*persistScreen\(name\)/);
  assert.match(html, /function screenNames\(\)/);
  assert.match(html, /async function loadUsage\(force\)/);
  assert.match(html, /USAGE_PROVIDER_ORDER = \["claude", "codex", "antigravity", "grok"\]/);
  assert.match(html, /function usageProviderIds\(snapshot\)/, "Usage deve incluir provedores adicionais entregues pelo snapshot");
  assert.match(html, /fetch|req\("\/api\/usage"/);
});

test("PWA carrega a fonte padrão localmente para o WebView", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const regular = await readFile(new URL("../public/fonts/Inter-Regular.otf", import.meta.url));
  const semibold = await readFile(new URL("../public/fonts/Inter-SemiBold.otf", import.meta.url));

  assert.ok(regular.length > 10000, "a fonte regular deve estar empacotada no PWA");
  assert.ok(semibold.length > 10000, "a fonte semibold deve estar empacotada no PWA");
  assert.match(html, /@font-face\s*\{[^}]*font-family:\s*"Inter"[^}]*Inter-Regular\.otf/);
  assert.match(html, /@font-face\s*\{[^}]*font-family:\s*"Inter"[^}]*Inter-SemiBold\.otf/);
});

test("servidor entrega a fonte local com MIME de fonte", async () => {
  const { port, close } = await startServer(0);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/fonts/Inter-Regular.otf`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /^font\/otf/);
  } finally {
    await close();
  }
});

test("servidor entrega os spritesheets WebP com MIME de imagem", async () => {
  const { port, close } = await startServer(0);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/mascot/dokke-mascot-thinking-loop-strip.webp`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /^image\/webp/);

    const coffeeResponse = await fetch(`http://127.0.0.1:${port}/mascot/dokke-mascot-idle-coffee-strip.webp`);
    assert.equal(coffeeResponse.status, 200);
    assert.match(coffeeResponse.headers.get("content-type") || "", /^image\/webp/);
  } finally {
    await close();
  }
});

test("spritesheets mantêm proporção, altura e base comuns entre os status", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/mascot/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.canvas, { width: 256, height: 256 });
  assert.deepEqual(manifest.sourceGrid, { columns: 4, rows: 4, sourceWidth: 1254, sourceHeight: 1254 });
  assert.equal(manifest.normalization, "trimmed-artwork-fixed-height-baseline-preserving-aspect");
  assert.deepEqual(manifest.visualBox, { width: 256, height: 256, visualHeight: 234, baseline: 246 });
  assert.equal(manifest.frameCount, 16);
  for (const name of [
    "workingStart", "workingLoop", "workingEnd",
    "thinkingStart", "thinkingLoop", "thinkingEnd",
    "idlePrincipal", "idleOne", "idleTwo", "idleCoffee"
  ]) {
    assert.equal(manifest.tracks[name].frames, 16);
    assert.match(manifest.tracks[name].output, /\.webp$/);
  }
  assert.equal(manifest.tracks.thinkingLoop.phase, "loop");
  assert.equal(manifest.tracks.idlePrincipal.source, "idle-principal.png");
  assert.equal(manifest.tracks.idleCoffee.source, "idle-coffe.png");
});

test("working-end remove artefato de chão antes de normalizar o frame", async () => {
  const script = await readFile(new URL("../scripts/prepare-mascot-assets.py", import.meta.url), "utf8");

  assert.match(script, /def remove_ground_shadow\(/, "o normalizador deve reconhecer sombra desconectada");
  assert.match(script, /drop_ground_shadows/, "a limpeza deve ser opt-in para não remover acessórios válidos");
  assert.match(script, /key == "workingEnd"/, "somente o track working-end deve descartar esse artefato");
  assert.match(script, /detached ground shadow/, "a regra precisa documentar o artefato tratado");
});

test("PWA usa loading minimalista e tendência legível no mobile", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage(){");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);
  const loadingStart = renderSource.indexOf("if (state.usageLoading && !state.usage)");
  const loadingEnd = renderSource.indexOf("const snapshot", loadingStart);
  const loadingBlock = renderSource.slice(loadingStart, loadingEnd);

  assert.match(html, /function usageLoadingNode\(\)/);
  assert.match(loadingBlock, /usageLoadingNode\(\)/);
  assert.doesNotMatch(loadingBlock, /usage-empty/);
  assert.match(html, /\.usage-state\{/);
  assert.match(html, /\.usage-state-spinner\{/);
  assert.match(html, /@keyframes usageStateSpin/);
  assert.match(html, /prefers-reduced-motion:[^}]*usage-state-spinner/);
  assert.match(html, /\.usage-trend-slide\{[^}]*justify-content:\s*flex-start;/);
  assert.match(html, /\.usage-trend-slide\{[^}]*padding-top:\s*22px;/, "a tendência deve começar na mesma régua vertical do card principal");
  assert.match(html, /\.usage-provider-slider\{[^}]*clip-path:\s*inset\(0\)/, "o pager deve recortar a pintura do slide seguinte no limite da tela ativa");
  assert.match(html, /\.usage-trend\{[^}]*border-radius:\s*32px;[^}]*background:\s*linear-gradient\(180deg, rgba\(22,24,27,\.84\), rgba\(12,14,16,\.89\)\)/, "a tendência deve compartilhar a superfície do card Codex");
  assert.match(html, /\.usage-trend-bars\{[^}]*position:\s*relative;[^}]*height:\s*clamp/);
  assert.match(html, /background-image:\s*linear-gradient/);
  assert.match(html, /\.usage-trend-bar\[data-level="empty"\]/);
  assert.match(html, /background:\s*var\(--ink\)/);
  assert.match(html, /const middleIndex = Math\.floor/);
  assert.match(html, /bar\.dataset\.level/);
  assert.match(html, /bar\.dataset\.peak/);
});

test("PWA diferencia busca de limites da ausência confirmada de dados", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage(){");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);
  const loadingStart = renderSource.indexOf("if (state.usageLoading && !state.usage)");
  const loadingEnd = renderSource.indexOf("const snapshot", loadingStart);
  const loadingBlock = renderSource.slice(loadingStart, loadingEnd);

  assert.match(html, /function usageStatusNode\(state, title, body\)/);
  assert.match(loadingBlock, /usageLoadingNode\(\)/);
  assert.match(html, /function usageLoadingNode\(\)[\s\S]*?usageStatusNode\("loading",/);
  assert.match(renderSource, /usageStatusNode\("warning", t\("usage\.noData"\)/);
  assert.match(html, /\.usage-state\{[^}]*min-height:\s*190px;[^}]*padding:\s*42px 24px 40px;/);
  assert.match(html, /\.usage-state-spinner\{/);
  assert.match(html, /@keyframes usageStateSpin/);
  assert.match(html, /\.usage-state-warning\{/);
  assert.match(html, /prefers-reduced-motion:[^}]*usage-state-spinner/);
});

test("PWA não aplica sombra externa ao card de uso aberto", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const ruleStart = html.indexOf("  .usage-card.is-open{\n    margin: 0; padding: 16px;");
  const ruleEnd = html.indexOf("\n  }", ruleStart);
  const rule = html.slice(ruleStart, ruleEnd);

  assert.notEqual(ruleStart, -1, "a regra visual final do card aberto deve existir");
  assert.match(rule, /box-shadow:\s*none;/);
});

test("PWA desktop preserva a moldura vertical do mobile e invalida o shell", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const desktopStart = html.indexOf("  @media (min-width: 700px){");
  const desktopEnd = html.indexOf("\n  /* ---- landscape", desktopStart);
  const desktopRule = html.slice(desktopStart, desktopEnd);

  assert.notEqual(desktopStart, -1, "o Usage desktop precisa de uma régua própria");
  assert.match(desktopRule, /\.usage-content\{[^}]*width:\s*min\(100%,\s*700px\);/);
  assert.match(desktopRule, /\.usage-provider-track\{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/);
  assert.match(desktopRule, /\.usage-stack\{[^}]*width:\s*100%;[^}]*margin:\s*22px 0 0;/);
  assert.match(desktopRule, /\.usage-card\.is-open\{[^}]*box-shadow:\s*none;[^}]*filter:\s*none;/);
  assert.match(sw, /const CACHE = "dokke-v29"/);
  assert.match(html, /serviceWorker\.register\("\/sw\.js\?rev=dokke-v29"\)/);
});

test("@spec:AC-344 PWA mantém todas as barras da tendência na mesma cor opaca", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /\.usage-trend-bar\{[^}]*background:\s*var\(--ink\);/);
  assert.doesNotMatch(html, /\.usage-trend-bar\{[^}]*opacity:/);
  assert.doesNotMatch(html, /\.usage-trend-bar\[data-level="empty"\]\{[^}]*opacity:/);
  assert.doesNotMatch(html, /\.usage-trend-bar\[data-peak="true"\]\{/);
});

test("@spec:AC-345 PWA calcula altura pela proporção dos tokens e preserva o valor do ponto", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const trendStart = html.indexOf("function usageTrendNode(provider){");
  const trendEnd = html.indexOf("function usageTrendValue", trendStart);
  const trendSource = html.slice(trendStart, trendEnd);

  assert.match(trendSource, /const maxValue = Math\.max\(1, \.\.\.points\.map/);
  assert.match(trendSource, /value > 0 \? Math\.max\(1, Math\.round\(\(value \/ maxValue\) \* 100\)\) : 0/);
  assert.match(trendSource, /point\.valueLabel \|\| usageTrendValue\(point\.value\)/);
  assert.doesNotMatch(trendSource, /Math\.max\(5, Math\.round/);
});

test("@spec:AC-347 PWA expõe eixo cronológico e leitura contextual por data", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const trendStart = html.indexOf("function usageTrendNode(provider){");
  const trendEnd = html.indexOf("function usageTrendValue", trendStart);
  const trendSource = html.slice(trendStart, trendEnd);

  assert.match(trendSource, /const middleIndex = Math\.floor/);
  assert.match(trendSource, /points\[index\]\.label/);
  assert.match(trendSource, /bar\.title = point\.label \+ " · " \+ \(point\.valueLabel \|\| usageTrendValue\(point\.value\)\)/);
});

test("@spec:AC-348 PWA usa a cor de status sem transparência no preenchimento semanal", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /\.usage-week-bar i\{[^}]*background:\s*var\(--usage-accent\);/);
  assert.doesNotMatch(html, /\.usage-week-bar i\{[^}]*background:\s*color-mix/);
  assert.doesNotMatch(html, /\.usage-week-bar i\{[^}]*background:\s*rgba\(/);
});

test("PWA e macOS usam os mesmos bytes dos dez strips do mascote", async () => {
  const names = [
    "dokke-mascot-working-start-strip.webp",
    "dokke-mascot-working-loop-strip.webp",
    "dokke-mascot-working-end-strip.webp",
    "dokke-mascot-thinking-start-strip.webp",
    "dokke-mascot-thinking-loop-strip.webp",
    "dokke-mascot-thinking-end-strip.webp",
    "dokke-mascot-idle-principal-strip.webp",
    "dokke-mascot-idle-one-strip.webp",
    "dokke-mascot-idle-two-strip.webp",
    "dokke-mascot-idle-coffee-strip.webp",
  ];
  for (const name of names) {
    const pwa = await readFile(new URL(`../public/mascot/${name}`, import.meta.url));
    const native = await readFile(new URL(`../mac/Sources/Resources/mascot/${name}`, import.meta.url));
    assert.deepEqual(native, pwa, `${name} precisa ser idêntico nos dois runtimes`);
  }
});

test("PWA aplica preferências compartilhadas para visibilidade, porcentagem e reset", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /usageSettings:\s*\{\s*enabled:\s*true,\s*display:\s*"used",\s*reset:\s*"exact",\s*showPace:\s*true\s*\}/);
  assert.match(html, /function normalizeUsageSettings\(raw\)/);
  assert.match(html, /function applyUsageSettings\(raw\)/);
  assert.match(html, /state\.usageSettings\.display === "remaining"/);
  assert.match(html, /state\.usageSettings\.reset === "exact"/);
  assert.match(html, /const providers = Array\.isArray\(source\.providers\)/);
  assert.match(html, /state\.usageSettings\.providers/);
  assert.match(html, /if \(!state\.usageSettings\.enabled && state\.screen === "usage"\)/);
});

test("PWA aplica ritmo de uso sem configuração de anel semanal", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /showPace:\s*typeof source\.showPace === "boolean"/);
  assert.match(html, /const pace = state\.usageSettings\.showPace \? usagePace\(entry\) : null/);
  assert.doesNotMatch(html, /weeklyRing|usagePaintWeeklyRing/);
});

test("PWA respeita a última IA selecionada e não abre provider sem dados", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(html, /usageProviderId/);
  assert.match(html, /function usageProviderHasData\(/);
  assert.match(html, /enabledUsageProviderIds/);
  assert.match(renderSource, /usageProviderHasData\(item\.provider\)/);
  assert.match(renderSource, /state\.usageProviderId/);
  assert.doesNotMatch(renderSource, /providers\.find\(function\(item\)\{ return item\.id === "claude"; \}\)/);
});

test("PWA aplica a ordem das contas e mantém a lista de habilitadas como filtro", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const settingsStart = html.indexOf("function normalizeUsageSettings(raw)");
  const settingsEnd = html.indexOf("function normalizeUsageProviderId", settingsStart);
  const providerStart = html.indexOf("function usageProviderIds(snapshot)");
  const providerEnd = html.indexOf("function usageProvider(snapshot, id)", providerStart);
  const settingsSource = html.slice(settingsStart, settingsEnd);
  const providerSource = html.slice(providerStart, providerEnd);

  assert.match(settingsSource, /providerOrder/);
  assert.match(providerSource, /state\.usageSettings\.providerOrder/);
  assert.match(providerSource, /: USAGE_PROVIDER_ORDER;/);
  assert.doesNotMatch(providerSource, /: enabled;/);
  assert.match(providerSource, /enabled/);
  assert.match(providerSource, /return ids/);
});

test("PWA destaca janela de 5 horas e semanal com gráficos simples", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /function usageFiveHour\(provider\)/);
  assert.match(html, /function usageWeekly\(provider\)/);
  assert.match(html, /normalizedId\.endsWith\("weekly"\)/, "IDs como geminiWeekly devem ser reconhecidos como limite semanal");
  assert.match(html, /if \(normalizedId\.endsWith\("weekly"\)/, "IDs como geminiWeekly devem renderizar apenas semana");
  assert.match(html, /usage-ring/);
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);
  assert.doesNotMatch(renderSource, /usage-more/, "a tela não deve renderizar um sidecar de limites extras");
  assert.doesNotMatch(renderSource, /usage\.moreLimits|usage\.hideLimits/, "a tela não deve oferecer expansão de limites extras");
  assert.doesNotMatch(html, /usage-island-source/);
});

test("PWA aplica o esboço com gauge radial e semântica visível da porcentagem", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(html, /function usagePaintGauge\(/, "o limite principal deve usar o gauge radial do esboço");
  assert.match(html, /if \(status === "attention"\) return "#ff8a38";/, "o gauge de Claude deve usar o laranja do esboço");
  assert.match(html, /usage-gauge-caption/, "o gauge deve dizer se a porcentagem é usada ou restante");
  assert.match(html, /\.usage-card\.is-open \.usage-gauge-copy \.usage-limit-value\{[^}]*font-size:\s*30px;/, "o percentual do gauge deve manter o tamanho do esboço");
  assert.match(html, /\.usage-card\.is-open \.usage-gauge-caption\{[^}]*display:\s*none;/, "o gauge não deve repetir a legenda usado no esboço");
  assert.match(html, /usage-week-caption/, "o semanal deve carregar a mesma semântica");
  assert.match(html, /\.usage-card\.is-open \.usage-week-value \.usage-limit-value\{[^}]*font-size:\s*18px;/, "o percentual semanal não deve herdar o tamanho do limite principal");
  assert.match(html, /\.usage-content\{[^}]*width:\s*min\(100%,\s*350px\);/, "o painel deve preservar a largura ampliada do frame do esboço");
  assert.match(html, /\.usage-provider-slide\{[^}]*padding:\s*0;/, "o slide não deve criar recuo lateral extra");
  assert.match(html, /\.usage-stack\{[^}]*margin:\s*22px 8px 0 0;/, "os cards devem alinhar no frame com folga mínima dos dots");
  assert.match(html, /\.usage-scroll\{[^}]*padding-top:\s*28px;/, "o cabeçalho deve preservar o respiro superior do esboço");
  assert.match(html, /\.usage-head\{[^}]*margin-bottom:\s*0;/, "o card deve respeitar o espaçamento definido pela régua do esboço");
  assert.match(html, /\.usage-card\.is-open\{[^}]*padding:\s*16px 16px 14px;/, "o card aberto deve usar o padding do esboço");
  assert.match(html, /\.usage-five-copy \.usage-limit-reset-label\{[^}]*display:\s*none;/, "o reset exato não deve ocupar espaço no card");
  assert.match(html, /\.usage-week-caption\{[^}]*display:\s*none;/, "o semanal não deve repetir a palavra usado");
  assert.match(html, /\.usage-provider-plan\{[^}]*display:\s*inline;[^}]*margin-left:/, "o plano deve ficar na mesma linha do provedor");
  assert.match(html, /\.usage-sync\{[^}]*display:\s*flex;[^}]*gap:\s*6px;[^}]*margin-top:\s*4px;[^}]*min-height:\s*12px;/, "o status deve ficar compacto abaixo do título");
  assert.match(html, /\.usage-title\{[^}]*font-size:\s*36px;[^}]*font-weight:\s*700;[^}]*line-height:\s*\.95;/, "o título deve seguir a escala tipográfica da Usage");
  assert.match(html, /\.usage-card\.is-open\{[^}]*border-radius:\s*32px;/, "o card aberto deve seguir o raio do esboço");
  assert.match(html, /\.usage-card\.is-open\{[^}]*box-shadow:\s*none;/, "o card principal não deve projetar sombra externa");
  assert.match(html, /\.usage-card\.is-open \.usage-card-head\{[^}]*min-height:\s*28px;[^}]*margin-bottom:\s*0;/, "o cabeçalho do card deve encostar no conteúdo como no esboço");
  assert.match(html, /\.usage-card\.is-open \.usage-featured\{[^}]*margin-top:\s*0;/, "o conteúdo principal não deve ganhar espaço vertical extra");
  assert.match(html, /\.usage-card\.is-open \.usage-limits\{[^}]*gap:\s*0;/, "os dois limites devem manter o intervalo do esboço");
  assert.match(html, /\.usage-metric-week\{[^}]*min-height:\s*57px;/, "a régua semanal deve preservar a altura do esboço");
  assert.match(html, /\.usage-provider-name\{[^}]*font-weight:\s*700;/, "o nome do provedor deve usar o peso padrão da Usage");
  assert.match(html, /\.usage-provider-plan\{[^}]*font-weight:\s*600;/, "o plano deve usar o peso secundário da fonte padrão");
  assert.match(html, /\.usage-five-copy \.usage-limit-label\{[^}]*font-weight:\s*700;/, "o rótulo de cinco horas deve acompanhar a referência");
  assert.match(html, /\.usage-five-copy \.usage-limit-reset-value\{[^}]*font-weight:\s*600;/, "o valor do reset deve acompanhar a referência");
  assert.match(html, /\.usage-five-caption\{[^}]*font-weight:\s*500;/, "a legenda de reset deve ser mais leve");
  assert.doesNotMatch(html, /\.usage-head-mascot \.usage-token-dock\{[^}]*border:\s*1px solid[^}]*border-radius:\s*22px;[^}]*background:\s*rgba\(0,0,0,\.2\);/, "o mascote do cabeçalho não deve ficar dentro de uma caixa");
  assert.match(html, /\.usage-provider-logo\[data-provider="claude"\]\{[^}]*background:\s*#f4e6d8;[^}]*color:\s*#d97757;/, "Claude deve usar a marca clara do esboço");
  assert.match(html, /\.usage-card\.is-open\[data-status="attention"\]\{[^}]*--usage-accent:\s*#ff8a38;/, "o estado de atenção deve usar o laranja do esboço");
  assert.match(html, /I18N\["pt-BR"\]\["usage\.fiveHourShort"\]\s*=\s*"5 horas"/);
  assert.match(html, /I18N\["pt-BR"\]\["usage\.weekShort"\]\s*=\s*"semana"/);
  assert.match(renderSource, /const preferredId = state\.usageProviderId \|\| state\.usageOpenId/, "a preferência compartilhada deve decidir o provedor aberto");
  assert.match(html, /Math\.max\(0,\s*Math\.min\(100,\s*remainingPct\)/, "o gauge deve aceitar zero sem forçar um traço");
  assert.doesNotMatch(html, /Math\.max\(1,\s*Math\.round\(\(Math\.max\(0,\s*Math\.min\(100,\s*remainingPct\)/, "0% não pode acender um segmento artificial");
});

test("PWA torna o card fechado um controle acessível para trocar o provedor", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(renderSource, /card\.setAttribute\("role",\s*"button"\)/);
  assert.match(renderSource, /card\.setAttribute\("tabindex",\s*"0"\)/);
  assert.match(renderSource, /card\.setAttribute\("aria-expanded",\s*"false"\)/);
  assert.match(renderSource, /card\.addEventListener\("keydown"/);
  assert.match(html, /\.usage-card\.is-closed:focus-visible\{/);
});

test("PWA coloca o Usage Trend no segundo slide", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(html, /function usageTrendNode\(provider\)/);
  assert.match(html, /usage-trend-bars/);
  assert.match(html, /usage-trend-peak/);
  assert.match(html, /usageTrendNode\(provider\)/);
  assert.match(html, /I18N\["pt-BR"\]\["usage\.trendPeak"\]\s*=\s*"\{value\}"/);
  assert.match(html, /I18N\["en"\]\["usage\.trendPeak"\]\s*=\s*"\{value\}"/);
  assert.doesNotMatch(html, /usage\.trendPeak"\]\s*=\s*"(?:pico|peak) \{value\}"/);
  assert.match(renderSource, /const trendItem = ordered\.find/);
  assert.match(renderSource, /trendSlide\.className = "usage-provider-slide usage-trend-slide"/);
  assert.match(renderSource, /track\.appendChild\(trendSlide\)/, "a tendência deve ficar no segundo slide");
  assert.doesNotMatch(renderSource, /card\.appendChild\(trend\)/, "a tendência não deve ocupar o card do provedor");
});

test("PWA transforma o status em balão e mantém a animação normal dos olhos por estado", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(renderSource, /usage-mascot-wrap/);
  assert.match(renderSource, /usage-mood-bubble/);
  assert.doesNotMatch(renderSource, /cardHead\.appendChild\(statusNode\)/, "o status não deve ficar solto no cabeçalho");
  assert.match(html, /@keyframes usageBlink/);
  assert.match(html, /@keyframes usageTiredEyes/);
  assert.doesNotMatch(html, /@keyframes usageMascotBreathe/, "o mascote não deve flutuar por uma animação separada");
  assert.match(html, /@keyframes usageTokenIdle/);
  assert.match(html, /@keyframes usageTokenAttentive/);
  assert.match(html, /@keyframes usageStatusChange/);
  assert.match(html, /\.usage-token\[data-mascot="energized"\]\{[^}]*animation:\s*usageTokenIdle/);
  assert.match(html, /\.usage-mascot-wrap\.is-status-changing \.usage-token\{[^}]*animation:\s*usageStatusChange/);
  assert.match(html, /--dokke-orange:\s*#f08737/);
  assert.match(html, /\.usage-mascot-wrap\{[^}]*justify-content:\s*flex-end;[^}]*width:\s*36px;/, "o mascote deve ocupar mais presença no cabeçalho");
  assert.match(html, /\.usage-mascot-wrap \.usage-token\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*background:\s*linear-gradient\(145deg,\s*rgba\(255,255,255,\.84\),\s*rgba\(255,255,255,\.28\)\)/, "o mascote deve usar branco translúcido no estado normal");
  assert.match(html, /\.usage-mascot-wrap\[data-status="attention"\]\{[^}]*--usage-mascot-accent:\s*var\(--amber\)/);
  assert.match(html, /\.usage-mascot-wrap\[data-status="exhausted"\]\{[^}]*--usage-mascot-accent:\s*var\(--red\)/);
  assert.doesNotMatch(html, /\.usage-mascot-wrap\[data-mascot="energized"\]\{[^}]*animation-duration:/, "o wrapper não deve reintroduzir flutuação independente");
  assert.match(html, /\.usage-mascot-wrap \.usage-token\{[^}]*background:\s*linear-gradient\(145deg,\s*rgba\(255,255,255,\.84\),\s*rgba\(255,255,255,\.28\)\)/, "o mascote deve usar branco translúcido");
  assert.match(html, /\.usage-mascot-sprite-layer, \.usage-mascot-idle-layer\{[^}]*width:\s*1600%;/);
  assert.match(html, /--usage-mascot-scale:\s*1\.36;/);
  assert.match(html, /\.usage-mascot-sprite, \.usage-mascot-idle\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*transform:\s*scale\(var\(--usage-mascot-scale\)\)/);
  assert.match(html, /const USAGE_MASCOT_TRACKS/);
  assert.match(html, /const MASCOT_FRAME_DURATION = 180;/, "a cadência do mascote deve ser legível, sem parecer 2x");
  assert.match(html, /working:\s*\{\s*start:/);
  assert.match(html, /thinking:\s*\{\s*start:/);
  assert.match(html, /idle:\s*\{\s*idlePrincipal:/);
  assert.match(html, /idleOne:/);
  assert.match(html, /dokke-mascot-working-start-strip\.webp/);
  assert.match(html, /dokke-mascot-working-loop-strip\.webp/);
  assert.match(html, /dokke-mascot-thinking-start-strip\.webp/);
  assert.match(html, /dokke-mascot-thinking-loop-strip\.webp/);
  assert.match(html, /dokke-mascot-thinking-end-strip\.webp/);
  assert.match(html, /dokke-mascot-idle-coffee-strip\.webp/);
  assert.match(html, /frameCount:\s*16/);
  assert.match(html, /function usageMascotActivityType\(activity\)/);
  assert.match(html, /if \(activity === "waiting"\) return "thinking"/);
  assert.match(html, /function usageMascotEnsureAnimation\(providerId, requestedActivity\)/);
  assert.match(html, /function usageMascotAdvance\(providerId, controller, token, sprite\)/);
  assert.match(html, /function usageMascotFrameAtElapsed\(animation, elapsedMs\)/);
  assert.match(html, /function usageMascotPaintFrame\(sprite, layer, animation, startedAt, now\)/);
  assert.match(html, /translate3d\(-" \+ position \+ "%/);
  assert.match(html, /will-change:\s*transform, opacity; transition:\s*opacity/);
  assert.match(html, /const MASCOT_FRAME_CROSSFADE_MS = 90;/, "a troca de frame deve ter crossfade curto, sem acelerar a cadencia");
  assert.match(html, /function usageMascotAssetReady\(asset\)/);
  assert.match(html, /function usageMascotPreparePhase\(sprite, animation, preserveVisible\)/);
  assert.match(html, /const assetChanged = active\.dataset\.asset !== animation\.asset;/);
  assert.match(html, /if \(!assetChanged\)\{/);
  assert.match(html, /data-active/);
  assert.match(html, /opacity:\s*0/);
  assert.doesNotMatch(html, /usageMascotWorkingMotion/);
  assert.doesNotMatch(html, /usage-mascot-wrap\[data-activity="working"\]\{[^}]*animation:/);
  assert.match(html, /\.usage-mascot-wrap\[data-activity="working"\] \.usage-token-eyes i\{[^}]*animation:\s*none !important/);
  assert.doesNotMatch(html, /usageWritingEye/);
  assert.match(html, /@keyframes usageBubblePop/);
  assert.match(html, /\.usage-mascot-wrap\.is-reacting \.usage-mood-bubble\[data-reaction\]\{[^}]*animation:\s*usageBubblePop/);
  assert.match(html, /@keyframes usageMascotChartReaction/);
  assert.match(html, /@keyframes usageMascotProviderReaction/);
  assert.match(html, /\.usage-mascot-wrap\[data-reaction="chart"\] \.usage-token\{[^}]*animation:\s*usageTokenChartReaction/);
  assert.match(html, /\.usage-mascot-wrap\[data-reaction="provider"\] \.usage-token\{[^}]*animation:\s*usageTokenProviderReaction/);
  assert.match(html, /\.usage-trend-bar\{[^}]*background:\s*var\(--ink\)/, "a tendência deve usar uma cor neutra única");
  assert.match(html, /\.usage-token\[data-mascot="energized"\] \.usage-token-eyes i\{[^}]*animation:\s*usageBlink/);
  assert.match(html, /\.usage-token\[data-mascot="tired"\] \.usage-token-eyes i\{[^}]*animation:\s*usageTiredEyes/);
  assert.doesNotMatch(html, /\.usage-mood-bubble::after\{[^}]*content:/, "o balão não deve ter bolinhas auxiliares");
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)\{[^}]*\.usage-token-eyes i\{[^}]*animation-duration:/, "em redução de movimento o piscar deve ficar mais lento, não desaparecer");
});

test("PWA working troca o mascote inteiro por frames do spritesheet", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(renderSource, /usageMascotEnsureAnimation\(item\.id, mascotActivity\)/);
  assert.match(renderSource, /usageMascotNode\(item\.id, mascotAnimation\)/);
  assert.match(html, /\.usage-token\[data-mascot-sprite="true"\]\{[^}]*background:\s*transparent/);
  assert.doesNotMatch(html, /usageWritingHand|usage-writing-hand|usageWritingEye/);
});

test("PWA diferencia sincronização de atividade real do modelo", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(renderSource, /const manualSyncing = state\.usageLoading/);
  assert.match(renderSource, /manualSyncing \? "syncing"/);
  assert.match(renderSource, /usage\.activitySyncing/);
  assert.match(html, /\.usage-mascot-wrap\[data-activity="syncing"\]/);
});

test("PWA working usa spritesheet sem overlay procedural", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /function usageMascotRun\(sprite, layer, animation, startedAt, onComplete\)/);
  assert.match(html, /usageMascotRequestFrame\(function\(now\)/);
  assert.match(html, /setTimeout\(function\(\)[\s\S]*usageMascotRequestFrame/);
  assert.match(html, /\.usage-mascot-wrap\[data-activity="working"\] \.usage-token\{[^}]*animation:\s*none !important/);
  assert.match(html, /function usageMascotNode\(providerId, controller\)/);
  assert.match(html, /sprite\.setAttribute\("aria-hidden", "true"\)/);
});

test("PWA working usa strips de 16 frames sem overlay procedural", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /dokke-mascot-working-start-strip\.webp/);
  assert.match(html, /dokke-mascot-working-loop-strip\.webp/);
  assert.match(html, /dokke-mascot-working-end-strip\.webp/);
  assert.match(html, /\.usage-mascot-sprite-layer, \.usage-mascot-idle-layer\{[^}]*width:\s*1600%;/);
  assert.match(html, /\.usage-mascot-sprite-layer, \.usage-mascot-idle-layer\{[^}]*background-size:\s*100% 100%/);
  assert.match(html, /data-asset-error="true"/);
  assert.match(html, /if \(!ready\)\{[\s\S]*dataset\.assetError = "true"/);
  assert.doesNotMatch(html, /usage-writing-pen|usage-writing-line|usage-writing-tool/);
});

test("PWA reserva a reação do mascote ao gráfico e à troca de IA", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.doesNotMatch(renderSource, /mascotWrap\.type\s*=\s*"button"/);
  assert.doesNotMatch(renderSource, /mascotWrap\.addEventListener\("click"/);
  assert.match(renderSource, /usageMascotStates\[item\.id\]/);
  assert.match(renderSource, /mascotWrap\.classList\.add\("is-status-changing"\)/);
  assert.match(html, /\.usage-mood-bubble\{[^}]*opacity:\s*0;[^}]*visibility:\s*hidden;/, "o balão deve iniciar oculto");
  assert.match(html, /\.usage-mascot-wrap\.is-reacting \.usage-mood-bubble\[data-reaction\]/, "o balão deve acompanhar a reação do mascote");
  assert.match(html, /\.usage-mascot-wrap\{[^}]*justify-content:\s*flex-end;[^}]*width:\s*36px;/, "o mascote deve ficar alinhado à borda do card");
  assert.match(html, /\.usage-mood-bubble\{[^}]*right:\s*calc\(100%\s*\+\s*6px\);[^}]*width:\s*max-content;/, "o balão deve ficar à esquerda e ajustar à mensagem");
  assert.match(renderSource, /queueUsageMascotReaction\(item\.id, "provider"\)/);
  assert.match(html, /queueUsageMascotReaction\(providerId, "chart"\)/);
  assert.match(html, /@keyframes usageMascotChartReaction/);
  assert.match(html, /@keyframes usageMascotProviderReaction/);
});

test("PWA usa a altura da terceira tela e dá prioridade extra ao limite principal", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /\.usage-scroll\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/, "a tela de uso deve ocupar o fluxo vertical disponível");
  assert.match(html, /\.usage-content\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*min-height:\s*100%;/, "o conteúdo deve preencher a altura útil da tela");
  assert.match(html, /\.usage-stack\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*flex:\s*1\s+0\s+auto;/, "os cards devem distribuir o conteúdo na coluna");
  assert.match(html, /\.usage-limit\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/, "os dois cards devem usar a altura inteira em coluna");
  assert.match(html, /\.usage-limit\.primary\{[^}]*min-height:\s*clamp\(190px,\s*27vh,\s*244px\);/, "o limite primário de 5 horas deve aproveitar altura sem estourar a viewport");
  assert.match(html, /\.usage-limit\.primary\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*justify-content:\s*flex-start;/, "o card primário deve manter percentual e barra próximos");
  assert.match(html, /\.usage-limit\{[^}]*padding:\s*16px;/, "os cards devem ter respiro interno padronizado");
  assert.match(html, /\.usage-limit\.primary\{[^}]*padding:\s*16px;/, "o card principal deve compartilhar o mesmo padding");
  assert.match(html, /\.usage-limit\.primary \.usage-limit-value\{[^}]*font-size:\s*clamp\(58px,\s*16vw,\s*82px\);[^}]*font-weight:\s*700;[^}]*margin-top:\s*14px;/, "o percentual de 5 horas deve ficar próximo do rótulo");
  assert.match(html, /\.usage-limit\.primary \.usage-limit-meter\{[^}]*height:\s*8px;[^}]*margin-top:\s*6px;/, "a barra deve ficar próxima do percentual principal");
  assert.match(html, /\.usage-limit \.usage-limit-reset-label\{[^}]*margin-top:\s*auto;/, "o reset dos dois cards deve ficar preso ao rodapé");
  assert.match(html, /\.usage-limit:not\(.primary\) \.usage-limit-value\{[^}]*margin-top:\s*14px;/, "o percentual semanal deve ficar próximo do rótulo");
});

test("PWA distribui o espaço vertical entre os limites no retrato", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const portraitStart = html.indexOf("@media (max-width: 699px) and (orientation: portrait)");
  const portraitEnd = html.indexOf("@media (min-height: 781px) and (max-width: 699px) and (orientation: portrait)", portraitStart);
  const tallPortraitEnd = html.indexOf("@media (max-height: 780px) and (orientation: portrait)", portraitEnd);
  const portraitCss = html.slice(portraitStart, portraitEnd);
  const tallPortraitCss = html.slice(portraitEnd, tallPortraitEnd);

  assert.ok(portraitStart >= 0 && portraitEnd > portraitStart, "o retrato deve ter uma régua estrutural");
  assert.match(html, /\.usage-stack\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/, "os provedores devem empilhar no retrato");
  assert.match(portraitCss, /\.usage-featured\{[^}]*flex:\s*1\s+1\s+auto;[^}]*display:\s*flex;[^}]*width:\s*100%;[^}]*flex-direction:\s*column;/, "a área dos limites deve crescer com o card");
  assert.match(portraitCss, /\.usage-limits\{[^}]*flex:\s*1\s+1\s+auto;[^}]*width:\s*100%;[^}]*grid-template-rows:\s*minmax\(0, 1\.18fr\) minmax\(0, 1fr\);/, "o principal deve continuar maior sem ocupar altura excessiva");
  assert.match(portraitCss, /\.usage-limit\{[^}]*min-height:\s*0;/, "os cards devem poder usar o espaço distribuído");
  assert.match(tallPortraitCss, /\.usage-scroll\{[^}]*padding-top:\s*14px;/, "telas retrato altas devem reduzir a sobra superior");
  assert.match(tallPortraitCss, /\.usage-head\{[^}]*margin-bottom:\s*8px;/, "o cabeçalho deve ficar mais próximo dos cards");
});

test("PWA usa data relativa sem prefixo RESET no rótulo dos limites", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /function usageResetParts\(value\)/);
  assert.match(html, /hoje às/);
  assert.match(html, /amanhã às/);
  assert.doesNotMatch(html, /I18N\["pt-BR"\]\["usage\.resetLabel"\]/);
});

test("PWA alinha o mascote maior na mesma linha do título da Usage", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(renderSource, /const headMascot = document\.createElement\("div"\)/, "o cabeçalho deve ter um espaço próprio para o mascote");
  assert.match(renderSource, /headMascot\.appendChild\(mascotWrap\)/, "o mascote deve ser anexado ao cabeçalho");
  assert.match(html, /\.usage-head-mascot\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/, "o mascote deve compartilhar a linha do título");
  assert.match(html, /\.usage-head-mascot \.usage-mascot-wrap\{[^}]*width:\s*64px;[^}]*height:\s*64px;/, "o mascote deve seguir a escala do esboço");
  assert.match(html, /\.usage-head-mascot \.usage-mascot-wrap \.usage-token\{[^}]*width:\s*50px;[^}]*height:\s*50px;/, "o token deve crescer junto com o mascote");
});

test("PWA alinha o título à borda dos cards de limite", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /\.usage-card\.is-open\{[^}]*padding:\s*0;/, "o wrapper transparente não deve recuar os cards em relação ao título");
});

test("PWA compacta o Painel de Uso em telas baixas sem remover informações", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  const compactStart = html.indexOf("@media (max-height: 780px) and (orientation: portrait)");
  const compactEnd = html.indexOf("@media (prefers-reduced-motion: reduce)", compactStart);
  const compactCss = html.slice(compactStart, compactEnd);

  assert.ok(compactStart >= 0 && compactEnd > compactStart, "a tela baixa deve ter uma régua compacta");
  assert.match(compactCss, /\.usage-scroll\{[^}]*padding-top:\s*8px;/, "o cabeçalho deve liberar espaço vertical");
  assert.match(compactCss, /\.usage-head\{[^}]*margin-bottom:\s*8px;/, "o cabeçalho compacto não deve criar sobra");
  assert.match(compactCss, /\.usage-limit\.primary\{[^}]*min-height:\s*160px;/, "o card principal deve caber em telas de 640px");
  assert.match(compactCss, /\.usage-limit\.primary \.usage-limit-value\{[^}]*font-size:\s*clamp\(58px,\s*17vw,\s*78px\);[^}]*font-weight:\s*700;/, "o percentual deve preencher melhor o bloco superior na tela baixa");
  assert.match(compactCss, /\.usage-trend-bars\{[^}]*height:\s*clamp\(150px,\s*31vh,\s*210px\);/, "a tendência deve continuar legível em telas baixas");
});

test("PWA economiza espaço superior no Usage em landscape baixo", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const compactStart = html.indexOf("@media (orientation: landscape) and (max-height: 520px)");
  const compactEnd = html.indexOf("@media (prefers-reduced-motion: reduce){ .usage-live-dot", compactStart);
  const compactCss = html.slice(compactStart, compactEnd);

  assert.ok(compactStart >= 0 && compactEnd > compactStart, "o landscape baixo deve ter uma régua compacta");
  assert.match(html, /copy\.className\s*=\s*"usage-head-copy"/, "o cabeçalho deve ter uma área própria para compactação");
  assert.match(compactCss, /\.usage-head-copy\{[^}]*display:\s*block;[^}]*min-width:\s*0;/, "o cabeçalho deve empilhar o status abaixo do título");
  assert.match(compactCss, /\.usage-sync\{[^}]*gap:\s*5px;[^}]*margin-top:\s*4px;[^}]*min-height:\s*0;/, "o status deve ficar logo abaixo do título no landscape");
  assert.match(compactCss, /\.usage-scroll\{[^}]*padding:\s*4px 10px calc\(3px \+ env\(safe-area-inset-bottom, 0px\)\);/, "o padding vertical superior deve ser reduzido");
  assert.match(compactCss, /\.usage-head\{[^}]*margin:\s*0 8px 3px;/, "o cabeçalho não deve reservar espaço extra");
  assert.match(compactCss, /\.usage-card\{[^}]*padding:\s*8px 10px 10px;/, "o card do provedor deve manter respiro interno");
  assert.match(compactCss, /\.usage-card-head\{[^}]*margin:\s*0 2px 4px;/, "o cabeçalho do provedor deve ficar compacto");
  assert.match(compactCss, /\.usage-limit\.primary\{[^}]*height:\s*clamp\(144px,\s*47vh,\s*172px\);[^}]*min-height:\s*0;/, "o limite principal deve aproveitar melhor a altura horizontal");
  assert.match(compactCss, /\.usage-limit\{[^}]*height:\s*clamp\(144px,\s*47vh,\s*172px\);[^}]*min-height:\s*0;[^}]*padding:\s*12px 14px 11px;/, "os dois limites devem compartilhar a nova altura e o padding horizontal");
  assert.match(compactCss, /\.usage-limit\.primary\{[^}]*padding:\s*12px 14px 11px;/, "o card principal deve compartilhar o padding do semanal");
  assert.match(compactCss, /\.usage-limit\.primary \.usage-limit-value\{[^}]*font-size:\s*clamp\(46px,\s*11vw,\s*64px\);[^}]*font-weight:\s*700;[^}]*margin-top:\s*6px;/, "a porcentagem principal deve crescer com peso maior");
  assert.match(compactCss, /\.usage-limit:not\(.primary\) \.usage-limit-value\{[^}]*font-size:\s*clamp\(28px,\s*6\.6vw,\s*38px\);[^}]*font-weight:\s*700;[^}]*margin-top:\s*6px;/, "a porcentagem semanal deve crescer com peso maior");
  assert.match(html, /\.usage-limit \.usage-limit-reset-label\{[^}]*margin-top:\s*auto;/, "o reset deve continuar preso ao rodapé dos cards");
  assert.match(compactCss, /\.usage-trend\{[^}]*margin-top:\s*0;[^}]*padding:\s*14px 13px 11px;[^}]*border-radius:\s*32px;/, "a tendência deve manter o card padronizado");
  assert.match(compactCss, /\.usage-trend-bars\{[^}]*height:\s*clamp\(34px,\s*12vh,\s*48px\);/, "as barras devem caber no landscape");
  assert.match(html, /\.usage-stack\{[^}]*gap:\s*12px;/, "os cards empilhados devem manter o respiro no landscape");
});

test("PWA reorganiza o Usage em duas colunas no landscape mobile", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const landscapeUsageStart = html.indexOf("@media (orientation: landscape) and (max-height: 760px) and (pointer: coarse)");
  const landscapeUsageEnd = html.indexOf("/* ---- landscape: grade 4x2", landscapeUsageStart);
  const landscapeUsageCss = html.slice(landscapeUsageStart, landscapeUsageEnd);

  assert.ok(landscapeUsageStart >= 0 && landscapeUsageEnd > landscapeUsageStart, "o Usage deve ter uma régua própria para landscape mobile de viewport alto");
  assert.match(landscapeUsageCss, /\.usage-content\{[^}]*max-width:\s*620px;/, "o painel deve aproveitar a largura horizontal");
  assert.match(landscapeUsageCss, /\.usage-stack\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,1fr\) minmax\(0,1fr\);/, "os provedores devem formar duas colunas");
  assert.match(landscapeUsageCss, /\.usage-card\.is-open\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1 \/ span 3;/, "o provedor aberto deve ocupar a coluna esquerda");
  assert.match(landscapeUsageCss, /\.usage-card\.is-closed\{[^}]*grid-column:\s*2;/, "os provedores fechados devem ocupar a coluna direita");
});

test("PWA encosta os dots verticais no canto direito em landscape", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const landscapeStart = html.indexOf("@media (orientation: landscape){");
  const landscapeEnd = html.indexOf("@media (orientation: landscape) and (pointer: coarse)", landscapeStart);
  const landscapeCss = html.slice(landscapeStart, landscapeEnd);

  assert.ok(landscapeStart >= 0 && landscapeEnd > landscapeStart, "o landscape deve ter uma régua própria");
  assert.match(landscapeCss, /\.vdots\{[^}]*right:\s*calc\(4px \+ env\(safe-area-inset-right, 0px\)\);/, "os dots de navegação devem ficar mais próximos do canto");
});

test("PWA mantém marca e plano do provedor no cabeçalho do card", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.match(renderSource, /const primaryLimit = primary \? usageLimitNode\(primary, status, true, item\.id\) : null;/, "o limite principal deve ser criado separadamente");
  assert.match(renderSource, /cardHead\.appendChild\(usageProviderLogo\(item\.id\)\)/, "cada card deve identificar seu provedor");
  assert.match(renderSource, /if \(provider\.plan\) providerName\.appendChild\(usageTextNode\("span", "usage-provider-plan", provider\.plan\)\)/, "o plano deve aparecer no cabeçalho quando a fonte o informar");
  assert.match(renderSource, /document\.createTextNode\("Claude"\)/, "Claude deve manter a identificação curta do esboço");
  assert.match(renderSource, /providerName\.appendChild\(document\.createTextNode\(item\.provider\.name \|\| item\.id\)\)/, "o nome do Codex deve acompanhar o logo");
  assert.doesNotMatch(renderSource, /primaryLimit\.appendChild\(usageProviderLogo/, "o logo não deve ficar duplicado dentro do limite");
  assert.match(renderSource, /const weeklyLimit = weeklyEntry \? usageLimitNode\(weeklyEntry, status, false, item\.id\) : null;/, "o limite semanal deve ser criado separadamente");
  assert.match(renderSource, /limits\.appendChild\(primaryLimit\)/);
  assert.match(html, /\.usage-provider-logo\[data-provider="codex"\]\{[^}]*background:\s*transparent;/, "o logo do Codex deve ser renderizado sem cápsula de fundo");
  assert.match(html, /image\.setAttribute\("fill-rule",\s*"evenodd"\)/, "o logo do Codex deve declarar a regra de preenchimento do SVG");
  assert.match(html, /path\.setAttribute\("clip-rule",\s*"evenodd"\)/, "o logo do Codex deve declarar o recorte do SVG");
});

test("PWA aumenta e reforça o percentual dos dois limites", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /\.usage-limit-value\{[^}]*font-weight:\s*700;/, "os percentuais devem ter mais peso visual");
  assert.match(html, /\.usage-limit\.primary \.usage-limit-value\{[^}]*font-size:\s*clamp\(58px,\s*16vw,\s*82px\);[^}]*font-weight:\s*700;/, "o limite de 5 horas deve crescer");
  assert.match(html, /\.usage-limit:not\(.primary\) \.usage-limit-value\{[^}]*font-size:\s*clamp\(34px,\s*8\.5vw,\s*46px\);[^}]*font-weight:\s*700;/, "o limite semanal deve crescer");
});

test("PWA não atualiza a cota pelo mascote", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const renderStart = html.indexOf("function renderUsage()");
  const renderEnd = html.indexOf("async function loadUsage", renderStart);
  const renderSource = html.slice(renderStart, renderEnd);

  assert.doesNotMatch(renderSource, /usage-refresh/, "a tela Usage não deve renderizar botão de atualizar");
  assert.doesNotMatch(renderSource, /state\.usageMascotRefreshPending/);
  assert.doesNotMatch(renderSource, /state\.usageMascotNextAction/);
  assert.doesNotMatch(renderSource, /state\.usageMascotFeedback/);
  assert.doesNotMatch(renderSource, /loadUsage\(true\)/, "a reação do mascote não deve disparar uma leitura atualizada");
  assert.match(html, /queueUsageMascotReaction\(providerId, "chart"\)/);
  assert.match(renderSource, /queueUsageMascotReaction\(item\.id, "provider"\)/);
});

test("PWA embute a marca do OpenAI para WebViews que falham ao decodificar SVG", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const logoStart = html.indexOf("function usageProviderLogo");
  const logoEnd = html.indexOf("function usageSyncState", logoStart);
  const logoSource = html.slice(logoStart, logoEnd);

  assert.match(logoSource, /id === "codex"/);
  assert.match(logoSource, /claude\.svg/);
  assert.match(logoSource, /createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "svg"\)/, "o logo do Codex deve ser SVG inline");
  assert.match(logoSource, /createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "path"\)/);
  assert.match(logoSource, /image\.setAttribute\("width", "18"\)/, "o SVG deve ter tamanho explícito no WebView");
  assert.match(logoSource, /image\.setAttribute\("height", "18"\)/, "o SVG deve ter altura explícita no WebView");
  assert.match(logoSource, /image\.setAttribute\("preserveAspectRatio", "xMidYMid meet"\)/, "o símbolo não deve ser deformado no card");
});

test("mascote de token usa loop do spritesheet no standby", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /function usageMascotNextIdlePhase\(controller\)/);
  assert.match(html, /usage-mascot-idle-layer/);
  assert.match(html, /dokke-mascot-idle-coffee-strip\.webp/);
  assert.match(html, /idleCoffee:/);
  assert.match(html, /idleOne:/);
  assert.doesNotMatch(html, /idleTwo:/, "o idleTwo removido não pode voltar ao runtime por engano");
  assert.match(html, /const MASCOT_AMBIENT_PHASES = \["idlePrincipal", "idlePrincipal", "idleCoffee", "idlePrincipal", "idleOne", "idlePrincipal"\]/);
  assert.match(html, /function usageMascotRun\(sprite, layer, animation, startedAt, onComplete\)/);
  assert.match(html, /animation:\s*none !important/);
  assert.match(html, /function attachMascot\(item, status\)/);
  assert.doesNotMatch(html, /usageMascotEyes\(\)/, "nenhum caminho da Usage deve voltar ao mascote antigo");
});
