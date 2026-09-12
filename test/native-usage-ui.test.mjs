import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = name => readFile(new URL(`../mac/Sources/${name}`, import.meta.url), "utf8");

test("sidebar nativa expõe Uso e roteia para as configurações SwiftUI", async () => {
  const content = await source("ContentView.swift");
  const settings = await source("UsageSettings.swift");

  assert.match(content, /case usage\s*=\s*"Usage"/);
  assert.match(content, /case \.usage:\s*UsageSettingsView\(store:\s*store\)/);
  assert.match(content, /case \.usage:\s*return "chart\.bar\.xaxis"/);
  assert.doesNotMatch(content, /case \.usage:\s*return "gearshape/);
  assert.match(content, /sidebar\.usageSettings/);
  assert.doesNotMatch(content, /case \.usage:\s*UsageView\(store:\s*store\)/);
  assert.match(settings, /struct UsageSettingsView:\s*View/);
  assert.match(settings, /Toggle\(/);
  assert.match(settings, /Picker\(/);
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

test("tela nativa mostra todas as IAs suportadas com gráficos e Token", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /struct UsageView:\s*View/);
  assert.match(usage, /UsageProviderOrder/);
  assert.match(usage, /case claude/);
  assert.match(usage, /case codex/);
  assert.match(usage, /case antigravity/);
  assert.match(usage, /case grok/);
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
  const glyphs = await source("ProviderGlyph.swift");
  const i18n = await source("LanguageStore.swift");

  assert.match(usage, /ProviderGlyphView/);
  assert.match(usage, /UsageConnectionIndicator/);
  assert.match(usage, /case \.codex/);
  assert.match(glyphs, /case grok/);
  assert.match(glyphs, /case openai/);
  assert.match(usage, /usage\.sync/);
  assert.doesNotMatch(usage, /usage\.localData/);
  assert.match(i18n, /"usage\.title": "Painel de Uso"/);
  assert.match(i18n, /"usage\.offline"/);
  assert.match(i18n, /"usage\.online"/);
});

test("cards nativos deixam somente os limites com fundo próprio", async () => {
  const usage = await source("UsageView.swift");
  const cardStart = usage.indexOf("private struct UsageProviderCard");
  const cardEnd = usage.indexOf("private struct UsageConnectionIndicator", cardStart);
  const cardSource = usage.slice(cardStart, cardEnd);

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

test("selector nativo ignora clique no provider que já está selecionado", async () => {
  const usage = await source("UsageView.swift");
  const selectorStart = usage.indexOf("private struct UsageProviderSelector");
  const selectorEnd = usage.indexOf("private struct UsageProviderDots", selectorStart);
  const selectorSource = usage.slice(selectorStart, selectorEnd);

  assert.match(usage, /guard providers\.indices\.contains\(index\), selection != index else \{ return \}/);
  assert.match(selectorSource, /private func providerButton\(index: Int, item: VisibleUsageProvider\)/);
  assert.match(selectorSource, /providerButton\(index: index, item: item\)/);
  assert.match(selectorSource, /withAnimation\(\.smooth\(duration: 0\.24\)\) \{[\s\S]*select\(index\)/);
  assert.match(selectorSource, /private func select\(_ index: Int\)[\s\S]*onSelectionChange\(index\)/);
});

test("tela nativa filtra providers pela lista habilitada pelo usuário", async () => {
  const settings = await source("UsageSettings.swift");
  const usage = await source("UsageView.swift");
  const glyphs = await source("ProviderGlyph.swift");

  assert.match(settings, /providers:\s*\[String\]\?/);
  assert.match(settings, /UsageProviderOrder\.allCases/);
  assert.match(settings, /accountToggle\(_ kind: UsageProviderOrder\)/);
  assert.match(settings, /providers/);
  assert.match(usage, /isProviderEnabled/);
  assert.match(usage, /case \.antigravity/);
  assert.match(glyphs, /case \.grok/);
});

test("logos nativos usam os glyphs vetoriais do Codenotch", async () => {
  const glyphs = await source("ProviderGlyph.swift");
  const usage = await source("UsageView.swift");

  assert.match(glyphs, /struct ProviderGlyphView: View/);
  assert.match(glyphs, /GlyphShape\(outline: glyph\.outline\)/);
  assert.match(glyphs, /case claude/);
  assert.match(glyphs, /case openai/);
  assert.match(glyphs, /case antigravity/);
  assert.match(glyphs, /case grok/);
  assert.match(usage, /ProviderGlyphView\(glyph:/);
  assert.doesNotMatch(usage, /anthropic-logo\.svg|fallbackSymbol/);
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
  assert.match(usage, /MascotVisualActivity\(activity: activity\)/);
  assert.match(usage, /case "waiting": self = \.thinking/);
  assert.match(usage, /PhasedMascotAnimation\(activity: activity, reduceMotion: reduceMotion\)/);
});

test("working e thinking usam spritesheets inteiros, não overlay de caneta", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /private struct PhasedMascotAnimation/);
  assert.match(usage, /SpriteMascotFrame/);
  assert.match(usage, /dokke-mascot-working-start-strip/);
  assert.match(usage, /dokke-mascot-working-loop-strip/);
  assert.match(usage, /dokke-mascot-thinking-start-strip/);
  assert.match(usage, /dokke-mascot-thinking-loop-strip/);
  assert.match(usage, /Image\(nsImage:/);
  assert.doesNotMatch(usage, /WritingHand|Canvas/);
});

test("working troca start, loop e end em vez de animar apenas a mão", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /case \.workingStart:/);
  assert.match(usage, /case \.workingLoop:/);
  assert.match(usage, /case \.workingEnd/);
  assert.match(usage, /restart\(with: \.workingLoop\)/);
  assert.match(usage, /\.offset\(x: -geometry\.size\.width \* CGFloat\(frame\)\)/);
  assert.doesNotMatch(usage, /MascotWorkingMotion/);
  assert.doesNotMatch(usage, /StaticWritingEyes|WritingHand/);
});

test("idle prioriza o comportamento principal e usa pausas ocasionais em tracks separados", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /private static let ambientPhases: \[MascotPhase\] = \[\.idlePrincipal, \.idlePrincipal, \.idleCoffee, \.idlePrincipal, \.idleOne, \.idlePrincipal\]/);
  assert.match(usage, /case idlePrincipal/);
  assert.match(usage, /dokke-mascot-idle-principal-strip/);
  assert.match(usage, /dokke-mascot-idle-one-strip/);
  assert.doesNotMatch(usage, /idleTwo|dokke-mascot-idle-two-strip/, "o idleTwo removido não pode voltar ao runtime nativo");
  assert.match(usage, /dokke-mascot-idle-coffee-strip/);
  assert.match(usage, /CGImageSourceCreateImageAtIndex/);
  assert.match(usage, /NSImage\(cgImage: image/);
  assert.match(usage, /PhasedMascotAnimation\(activity: activity, reduceMotion: reduceMotion\)/);
  assert.match(usage, /private enum MascotLayout/);
  assert.match(usage, /MascotLayout\.tokenSize/);
  assert.match(usage, /private enum MascotPhase/);
  assert.match(usage, /frameCount = 16/);
  assert.match(usage, /case \.idleCoffee/);
});

test("todos os tracks do mascote usam escala de 16 frames e reducao de movimento proporcional", async () => {
  const usage = await source("UsageView.swift");

  assert.match(usage, /private static let frameCount = 16/);
  assert.match(usage, /private static let frameDuration: TimeInterval = 0\.18/);
  assert.match(usage, /return loops \? index % frameCount : min\(index, frameCount - 1\)/);
  assert.match(usage, /reduceMotion \? 0\.5 : 1\.0/);
  assert.match(usage, /track\.duration \/ motionRate/);
});

test("texto da Usage existe nos dois idiomas do app v0.2.8", async () => {
  const i18n = await source("LanguageStore.swift");

  assert.match(i18n, /"sidebar\.usage"/);
  assert.match(i18n, /"usage\.title"/);
  assert.match(i18n, /"usage\.unavailable"/);
  assert.match(i18n, /"usage\.pet\.exhausted"/);
});
