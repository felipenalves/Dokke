import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = name => readFile(new URL(`../mac/Sources/${name}`, import.meta.url), "utf8");

test("sidebar nativa expõe Uso e roteia para as preferências SwiftUI", async () => {
  const content = await source("ContentView.swift");

  assert.match(content, /case usage\s*=\s*"Usage"/);
  assert.match(content, /case \.usage:\s*UsageSettingsView\(store:\s*store\)/);
  assert.match(content, /gearshape/);
  assert.match(content, /sidebar\.usageSettings/);
});

test("modelo nativo lê o contrato público do OpenUsage sem zerar campos ausentes", async () => {
  const models = await source("UsageModels.swift");
  const store = await source("DockStore.swift");

  assert.match(models, /struct UsageSnapshot:\s*Decodable,\s*Equatable/);
  assert.match(models, /resources:\s*\[String:\s*UsageResource\]/);
  assert.match(models, /let remaining:\s*Double\?/);
  assert.match(models, /let utilization:\s*Double\?/);
  assert.match(store, /@Published private\(set\) var usage:\s*UsageSnapshot\?/);
  assert.match(store, /func loadUsage\(/);
  assert.match(store, /baseURL \+ "\/api\/usage"/);
});

test("tela nativa mantém somente Claude e Codex com gráficos e Token", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /struct UsageView:\s*View/);
  assert.match(usage, /UsageProviderOrder/);
  assert.match(usage, /case claude/);
  assert.match(usage, /case codex/);
  assert.match(usage, /TokenMascot/);
  assert.match(usage, /UsageLimitChart/);
  assert.match(usage, /accessibilityReduceMotion/);
  assert.match(usage, /resetsAt/);
});

test("tela nativa prioriza janela de 5 horas e semanal sem sidecar extra", async () => {
  const models = await source("UsageModels.swift");
  const usage = await source("UsageView.swift");

  assert.match(models, /var fiveHourResource:\s*UsageResourceEntry\?/);
  assert.match(models, /var weeklyResource:\s*UsageResourceEntry\?/);
  assert.match(models, /fiveHourResource\s*\?\?\s*weeklyResource/);
  assert.match(usage, /UsageLimitChart/);
  assert.match(usage, /provider\.primaryResource/);
  assert.match(usage, /provider\.weeklyResource/);
  assert.doesNotMatch(usage, /usage\.moreLimits|usage\.hideLimits/, "a tela nativa não deve oferecer limites extras");
});

test("tela nativa do Painel de Uso usa marcas dos provedores e estado de sincronização", async () => {
  const usage = await source("UsageView.swift");
  const i18n = await source("LanguageStore.swift");

  assert.match(usage, /UsageProviderLogo/);
  assert.match(usage, /UsageConnectionIndicator/);
  assert.match(usage, /case \.codex/);
  assert.match(usage, /OpenAI/);
  assert.match(usage, /usage\.sync/);
  assert.doesNotMatch(usage, /usage\.localData/);
  assert.match(i18n, /"usage\.title": "Painel de Uso"/);
  assert.match(i18n, /"usage\.offline"/);
  assert.match(i18n, /"usage\.online"/);
});

test("cards nativos deixam somente os limites com fundo próprio", async () => {
  const usage = await source("UsageView.swift");
  const cardStart = usage.indexOf("private struct UsageProviderCard");
  const logoStart = usage.indexOf("private struct UsageProviderLogo", cardStart);
  const cardSource = usage.slice(cardStart, logoStart);

  assert.doesNotMatch(cardSource, /\.background\(/, "o card do provedor não deve criar uma moldura adicional");
  assert.match(usage, /UsageLimitPanel[\s\S]*?\.background\(/, "cada limite continua com o próprio card visual");
});

test("tela nativa pagina Claude e Codex com dots do SwiftUI", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /UsageProviderPager/);
  assert.match(usage, /UsageProviderDots/);
  assert.match(usage, /DragGesture\(minimumDistance: 24\)/);
  assert.match(usage, /accessibilityAddTraits\(index == selection \? \.isSelected/);
  assert.match(usage, /fill\(index == selection \? Color\.white : Color\.white\.opacity\(0\.35\)\)/);
  assert.match(usage, /frame\(width: index == selection \? 14 : 6, height: 6\)/);
  assert.match(usage, /Spacer\(minLength: 0\)[\s\S]*UsageProviderDots/, "os dots nativos devem ser empurrados para a base do pager");
  assert.match(usage, /frame\(maxWidth: \.infinity, minHeight: 430, alignment: \.top\)/);
  assert.match(usage, /minHeight: isPrimary \? 220 : 170/);
});

test("tela nativa compartilha a IA selecionada e evita provider sem dados no topo", async () => {
  const models = await source("UsageModels.swift");
  const store = await source("DockStore.swift");
  const usage = await source("UsageView.swift");

  assert.match(models, /var hasUsableUsageData:\s*Bool/);
  assert.match(store, /usageProviderId/);
  assert.match(store, /func updateUsageProvider\(/);
  assert.match(usage, /store\.usageProviderId/);
  assert.match(usage, /onSelectionChange/);
  assert.match(usage, /hasUsableUsageData/);
});

test("logo nativa do Codex resolve o SVG diretamente no bundle", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /Bundle\.module\.url\(forResource: assetName, withExtension: "svg"\)/);
  assert.match(usage, /NSImage\(contentsOf: url\)/);
  assert.match(usage, /Image\(nsImage: assetImage\)/);
});

test("logo nativa do Codex não recebe cápsula de fundo", async () => {
  const usage = await source("UsageView.swift");
  const logoStart = usage.indexOf("private struct UsageProviderLogo");
  const logoEnd = usage.indexOf("private struct UsageConnectionIndicator", logoStart);
  const logoSource = usage.slice(logoStart, logoEnd);

  assert.match(logoSource, /if kind == \.claude \{[\s\S]*RoundedRectangle/, "somente Claude pode manter o fundo de marca");
  assert.match(logoSource, /Image\(nsImage: assetImage\)[\s\S]*?interpolation\(\.high\)/, "o SVG deve ser rasterizado com qualidade alta");
});

test("tela nativa mostra o Usage Trend abaixo dos limites", async () => {
  const models = await source("UsageModels.swift");
  const usage = await source("UsageView.swift");

  assert.match(models, /struct UsageTrendPoint: Decodable, Equatable/);
  assert.match(models, /let trend: UsageTrend\?/);
  assert.match(usage, /UsageTrendChart/);
  assert.match(usage, /provider\.trend/);
});

test("tela nativa acompanha atividade real e anima o Token enquanto trabalha", async () => {
  const models = await source("UsageModels.swift");
  const store = await source("DockStore.swift");
  const usage = await source("UsageView.swift");

  assert.match(models, /struct UsageActivitySnapshot:\s*Decodable,\s*Equatable/);
  assert.match(models, /struct UsageActivityState:\s*Decodable,\s*Equatable/);
  assert.match(store, /@Published private\(set\) var usageActivity:\s*UsageActivitySnapshot\?/);
  assert.match(store, /baseURL \+ "\/api\/usage\/activity"/);
  assert.match(store, /func pollUsageActivity\(\)/);
  assert.match(usage, /pollUsageActivity\(\)/);
  assert.match(usage, /activityState/);
  assert.match(usage, /let activity:\s*String/);
  assert.match(usage, /TimelineView\(\.animation/);
  assert.match(usage, /let writing = activity == "working"/);
  assert.match(usage, /activity == "working"/);
});

test("working usa a sequência de escrita com mão e caneta, não deformação dos olhos", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /private struct WorkingMascotAnimation/);
  assert.match(usage, /Canvas/);
  assert.match(usage, /WritingHand/);
  assert.match(usage, /writingPhase/);
  assert.doesNotMatch(usage, /let leftEye = writing \?/);
  assert.doesNotMatch(usage, /let rightEye = writing \?/);
});

test("working mantém os olhos fixos e anima somente a mão", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /StaticWritingEyes/);
  assert.match(usage, /WritingHand\(progress: pose\.handProgress\)/);
  assert.doesNotMatch(usage, /pose\.leftWidth|pose\.leftHeight|pose\.leftAngle|pose\.leftX/);
  assert.doesNotMatch(usage, /pose\.rightWidth|pose\.rightHeight|pose\.rightAngle|pose\.rightX|pose\.eyeY/);
});

test("texto da Usage existe nos dois idiomas do app v0.2.8", async () => {
  const i18n = await source("LanguageStore.swift");

  assert.match(i18n, /"sidebar\.usage"/);
  assert.match(i18n, /"usage\.title"/);
  assert.match(i18n, /"usage\.unavailable"/);
  assert.match(i18n, /"usage\.pet\.exhausted"/);
});
