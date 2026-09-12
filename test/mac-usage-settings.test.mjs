import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = name => readFile(new URL(`../mac/Sources/${name}`, import.meta.url), "utf8");

test("modelo de preferências de uso cobre tela, porcentagem e reset", async () => {
  const models = await source("UsageSettings.swift");

  assert.match(models, /enum UsageDisplayMode/);
  assert.match(models, /case used/);
  assert.match(models, /case remaining/);
  assert.match(models, /enum UsageResetMode/);
  assert.match(models, /case countdown/);
  assert.match(models, /case exact/);
  assert.match(models, /struct DokkeUsageSettings/);
  assert.match(models, /enabled:\s*Bool/);
  assert.match(models, /providers:\s*\[String\]\?/);
  assert.match(models, /providerOrder:\s*\[String\]\?/);
  assert.match(models, /init\(json:/);
});

test("DockStore lê e salva a configuração compartilhada sem estado otimista", async () => {
  const store = await source("DockStore.swift");

  assert.match(store, /@Published private\(set\) var usageSettings:\s*DokkeUsageSettings/);
  assert.match(store, /cfg\["usage"\]/);
  assert.match(store, /if let usage = cfg\["usage"\] as\? \[String: Any\]/);
  assert.match(store, /if let rawUsageProvider = cfg\["usageProvider"\] as\? String/);
  assert.match(store, /func updateUsageSettings\(_ settings:\s*DokkeUsageSettings\) async/);
  assert.match(store, /baseURL \+ "\/api\/config\/usage"/);
  assert.match(store, /req\.httpMethod = "PUT"/);
  assert.match(store, /JSONSerialization\.data/);
  assert.match(store, /applyConfig\(cfg\)/);
});

test("tela Mac usa a primeira conta habilitada como principal e persiste a ordem", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /providerOrder/);
  assert.match(settings, /private var orderedAccountKinds/);
  assert.match(settings, /private func moveAccount\(_ movedID: String, onto targetID: String\)/);
  assert.match(settings, /UsageAccountDropDelegate/);
  assert.match(settings, /onDrag/);
  assert.match(settings, /onDrop\([\s\S]*of: \[\.text\]/);
  assert.match(settings, /accountToggle\(_ kind: UsageProviderOrder\)/);
  assert.match(settings, /case \.codex, \.antigravity, \.grok/);
  assert.match(settings, /hasUsableUsageData/);
  assert.doesNotMatch(settings, /primaryAccountMenu|providerSelection|scheduleProviderSave/);
});

test("DockStore serializa seleções rápidas antes de aplicar a preferência", async () => {
  const store = await source("DockStore.swift");

  assert.match(store, /private var usageProviderUpdateTail: Task<Bool, Never>\?/);
  assert.match(store, /let previous = usageProviderUpdateTail/);
  assert.match(store, /await previous\?\.value/);
  assert.match(store, /usageProviderUpdateTail = update/);
  assert.match(store, /private func performUsageProviderUpdate\(_ providerId: String\) async -> Bool/);
});

test("tela Mac oferece controles nativos de preferência, não cards do painel", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /struct UsageSettingsView:\s*View/);
  assert.match(settings, /Toggle\(/);
  assert.match(settings, /Picker\(/);
  assert.match(settings, /usage\.settingsDisplay/);
  assert.match(settings, /usage\.settingsReset/);
  assert.match(settings, /UsageSettingsView/);
  assert.doesNotMatch(settings, /UsageProviderCard|UsageLimitPanel|UsageTrendChart/);
});

test("tela Mac organiza as configurações por contas conectadas e não conectadas", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /private var connectedAccountKinds/);
  assert.match(settings, /private var disconnectedAccountKinds/);
  assert.match(settings, /private func isAccountEnabledForSettings\(_ kind: UsageProviderOrder\)/);
  const connectedStart = settings.indexOf("private var connectedAccountKinds");
  const connectedEnd = settings.indexOf("private var disconnectedAccountKinds", connectedStart);
  const connectedSource = settings.slice(connectedStart, connectedEnd);
  assert.match(connectedSource, /isAccountEnabledForSettings\(\$0\)/);
  assert.doesNotMatch(connectedSource, /hasUsableUsageData/);
  assert.match(settings, /isAvailable: provider\(for: kind\)\?\.hasUsableUsageData == true/);
  assert.match(settings, /UsageAccountRow\(/);
  assert.match(settings, /usage\.settingsConnected/);
  assert.match(settings, /usage\.settingsNotConnected/);
  assert.match(settings, /usage\.settingsAccountUnavailable/);
});

test("ativar conta não conectada só salva a preferência e não abre site externo", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /private func accountToggle\(_ kind: UsageProviderOrder\)/);
  assert.match(settings, /private func setAccountEnabled\(_ kind: UsageProviderOrder, enabled: Bool\)/);
  const start = settings.indexOf("private func setAccountEnabled");
  const end = settings.indexOf("private func moveAccount", start);
  const toggleSource = settings.slice(start, end);
  assert.match(toggleSource, /var ids = draft\.providers \?\? connectedAccountKinds\.map\(\\\.rawValue\)/);
  assert.doesNotMatch(toggleSource, /draft\.providers \?\? UsageProviderOrder\.allCases/);
  assert.match(toggleSource, /draft\.providers = ids/);
  assert.doesNotMatch(toggleSource, /manageURL|NSWorkspace\.shared\.open/);
  assert.match(settings, /await store\.loadUsage\(force: true\)/);
  assert.match(settings, /let isAvailable: Bool/);
  assert.doesNotMatch(settings, /Toggle\("", isOn: \$isEnabled\)[\s\S]*?\.disabled\(!isAvailable\)/);
});

test("nova conta ativada entra no fim das contas conectadas", async () => {
  const settings = await source("UsageSettings.swift");
  const start = settings.indexOf("private func setAccountEnabled");
  const end = settings.indexOf("private func moveAccount", start);
  const toggleSource = settings.slice(start, end);

  assert.match(toggleSource, /var order = orderedAccountKinds\.map\(\\\.rawValue\)/);
  assert.match(toggleSource, /order\.removeAll \{ \$0 == kind\.rawValue \}/);
  assert.match(toggleSource, /let activeIDs = order\.filter \{ ids\.contains\(\$0\) \}/);
  assert.match(toggleSource, /let inactiveIDs = order\.filter \{ !ids\.contains\(\$0\) \}/);
  assert.match(toggleSource, /draft\.providerOrder = activeIDs \+ \[kind\.rawValue\] \+ inactiveIDs/);
});

test("resposta do servidor não substitui uma alteração de conta pendente", async () => {
  const settings = await source("UsageSettings.swift");
  const start = settings.indexOf(".onChange(of: store.usageSettings)");
  const end = settings.indexOf(".task {", start);
  const syncSource = settings.slice(start, end);

  assert.match(syncSource, /guard draft != next, !saving else \{ return \}/);
  assert.match(syncSource, /saveTask\?\.cancel\(\)/);
  assert.match(syncSource, /pendingSave = nil/);
  assert.match(syncSource, /draft = next/);
  assert.doesNotMatch(syncSource, /pendingSave = next/);
});

test("drop de conta não reaplica a movimentação no fim", async () => {
  const settings = await source("UsageSettings.swift");
  const start = settings.indexOf("func performDrop(info: DropInfo)");
  const end = settings.indexOf("\n  }\n}", start);
  const dropSource = settings.slice(start, end);

  assert.match(dropSource, /draggedAccountID = nil/);
  assert.doesNotMatch(dropSource, /return onMove\(/);
});

test("logos das contas usam os glyphs do Codenotch, não fallback SF Symbol", async () => {
  const glyphs = await source("ProviderGlyph.swift");
  const settings = await source("UsageSettings.swift");
  const usage = await source("UsageView.swift");

  assert.match(glyphs, /enum ProviderGlyph/);
  assert.match(glyphs, /case claude/);
  assert.match(glyphs, /case openai/);
  assert.match(glyphs, /case antigravity/);
  assert.match(glyphs, /case grok/);
  assert.match(glyphs, /struct ProviderGlyphView: View/);
  assert.match(glyphs, /Grok's mark, flattened from grok\.com/);
  assert.doesNotMatch(glyphs, /Z\.ai mark/);
  assert.match(settings, /ProviderGlyphView\(glyph: kind\.providerGlyph/);
  assert.match(usage, /ProviderGlyphView\(glyph: .*providerGlyph/);
  assert.doesNotMatch(usage, /anthropic-logo\.svg|fallbackSymbol/);
});

test("switches das contas mantêm nome acessível mesmo com o rótulo visual oculto", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /\.labelsHidden\(\)[\s\S]*?\.accessibilityLabel\(name\)/);
});

test("linhas conectadas oferecem o link nativo para a conta do provedor", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /var manageURL: URL\?/);
  assert.match(settings, /kind\.manageURL\?\.host/);
  assert.match(settings, /Button\(manageTitle\)/);
  assert.match(settings, /NSWorkspace\.shared\.open\(url\)/);
  assert.match(settings, /\.buttonStyle\(\.link\)/);
});

test("glyph adaptado mantém o aviso completo da licença MIT do Codenotch", async () => {
  const glyphs = await source("ProviderGlyph.swift");

  assert.match(glyphs, /Permission is hereby granted/);
  assert.match(glyphs, /THE SOFTWARE IS PROVIDED "AS IS"/);
  assert.match(glyphs, /Copyright \(c\) 2026 Vinz/);
});

test("a primeira conta habilitada é o card principal e a ordem é reconciliada", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /private var orderedAccountKinds/);
  assert.match(settings, /providerOrder \?\?/);
  assert.match(settings, /orderedAccountKinds\.first/);
  assert.match(settings, /private func moveAccount\(_ movedID: String, onto targetID: String\)/);
});

test("filtro de contas não altera a ordem padrão", async () => {
  const settings = await source("UsageSettings.swift");
  const usage = await source("UsageView.swift");

  assert.match(settings, /let preferredIDs = draft\.providerOrder \?\? \[\]/);
  assert.match(usage, /let preferredIDs = store\.usageSettings\.providerOrder \?\? \[\]/);
  assert.doesNotMatch(settings, /draft\.providerOrder \?\? draft\.providers/);
  assert.doesNotMatch(usage, /store\.usageSettings\.providerOrder \?\? store\.usageSettings\.providers/);
});

test("configurações não exibem seletor redundante de conta principal", async () => {
  const settings = await source("UsageSettings.swift");

  assert.doesNotMatch(settings, /private var primaryAccountMenu: some View/);
  assert.doesNotMatch(settings, /usage\.settingsProvider/);
  assert.doesNotMatch(settings, /updateUsageProvider\(/);
});

test("contas exibem retry quando o carregamento de uso falha", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /if let error = store\.usageError/);
  assert.match(settings, /Button\(I18n\.text\("usage\.settingsRetry"/);
  assert.match(settings, /Task \{ await store\.loadUsage\(force: true\) \}/);
});

test("tela Mac separa contas de preferências de aparência", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /private var accountsGroup/);
  assert.match(settings, /private var appearanceGroup/);
  assert.match(settings, /usage\.settingsAppearance/);
  assert.match(settings, /usage\.settingsDisplay/);
  assert.match(settings, /usage\.settingsReset/);
});

test("grupo de contas não repete o título da página", async () => {
  const settings = await source("UsageSettings.swift");
  const groupStart = settings.indexOf("private var accountsGroup");
  const groupEnd = settings.indexOf("private var appearanceGroup", groupStart);
  const groupSource = settings.slice(groupStart, groupEnd);

  assert.doesNotMatch(groupSource, /usage\.settingsProviders/);
  assert.doesNotMatch(groupSource, /usage\.settingsProvidersDescription/);
});

test("aparência usa seletores compactos nativos para escolhas binárias", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /private var appearanceGroup/);
  assert.match(settings, /Picker\("", selection: \$draft\.display\)[\s\S]*?\.pickerStyle\(\.menu\)/);
  assert.match(settings, /Picker\("", selection: \$draft\.reset\)[\s\S]*?\.pickerStyle\(\.menu\)/);
  assert.doesNotMatch(settings, /Picker\(I18n\.text\("usage\.settingsDisplay"/);
  assert.doesNotMatch(settings, /Picker\(I18n\.text\("usage\.settingsReset"/);
});

test("seletores compactos mantêm rótulo para VoiceOver", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /Picker\("", selection: \$draft\.display\)[\s\S]*?\.accessibilityLabel\(I18n\.text\("usage\.settingsDisplay"/);
  assert.match(settings, /Picker\("", selection: \$draft\.reset\)[\s\S]*?\.accessibilityLabel\(I18n\.text\("usage\.settingsReset"/);
});

test("layout das contas não cria subcards nem engrenagem decorativa", async () => {
  const settings = await source("UsageSettings.swift");
  const rowStart = settings.indexOf("private struct UsageAccountRow");
  const rowSource = settings.slice(rowStart);

  assert.doesNotMatch(rowSource, /RoundedRectangle\(cornerRadius: 10/);
  assert.doesNotMatch(rowSource, /Divider\(\)/);
  assert.doesNotMatch(settings, /gearshape\.fill/);
  assert.match(settings, /Toggle\("", isOn: \$isEnabled\)/);
});

test("divisão de contas coloca a orientação depois das ativas e usa um único separador", async () => {
  const settings = await source("UsageSettings.swift");
  const groupStart = settings.indexOf("private var accountsGroup");
  const groupEnd = settings.indexOf("private var appearanceGroup", groupStart);
  const groupSource = settings.slice(groupStart, groupEnd);
  const hintIndex = groupSource.indexOf("usage.settingsOrderHint");
  const dividerIndex = groupSource.indexOf("Divider()");
  const disconnectedIndex = groupSource.indexOf("usage.settingsNotConnected");

  assert.notEqual(hintIndex, -1);
  assert.notEqual(dividerIndex, -1);
  assert.ok(hintIndex < dividerIndex, "a orientação deve separar as ativas das não conectadas");
  assert.ok(dividerIndex < disconnectedIndex, "o separador deve vir antes do título de não conectadas");
  assert.equal((groupSource.match(/Divider\(\)/g) ?? []).length, 1);
});

test("aparência oferece apenas ritmo de uso real do dispositivo", async () => {
  const settings = await source("UsageSettings.swift");

  assert.match(settings, /var showPace:\s*Bool/);
  assert.match(settings, /Toggle\("", isOn: \$draft\.showPace\)/);
  assert.match(settings, /usage\.settingsPace/);
  assert.doesNotMatch(settings, /UsageWeeklyRing|weeklyRing|settingsWeeklyRing/);
});

test("switches de preferência usam o mesmo tamanho compacto", async () => {
  const settings = await source("UsageSettings.swift");

  for (const binding of ["$draft.enabled", "$draft.showPace"]) {
    const start = settings.indexOf(`Toggle("", isOn: ${binding})`);
    assert.notEqual(start, -1, `toggle ausente: ${binding}`);
    assert.match(settings.slice(start, start + 320), /\.controlSize\(\.small\)/);
  }
});

test("título e switch ficam na linha e a descrição abaixo", async () => {
  const settings = await source("UsageSettings.swift");
  const visibility = settings.slice(
    settings.indexOf("private var visibilityGroup"),
    settings.indexOf("private var appearanceGroup")
  );
  const appearance = settings.slice(
    settings.indexOf("private var appearanceGroup"),
    settings.indexOf("private func accountSectionTitle")
  );

  assert.match(visibility, /VStack\(alignment: \.leading, spacing: 3\)\s*\{\s*HStack\(spacing: 12\)/);
  assert.match(visibility, /HStack\(spacing: 12\)[\s\S]*?Toggle\("", isOn: \$draft\.enabled\)[\s\S]*?\}\s*Text\(I18n\.text\("usage\.settingsEnabledDescription"/);
  assert.match(appearance, /VStack\(alignment: \.leading, spacing: 3\)\s*\{\s*HStack\(spacing: 12\)/);
  assert.match(appearance, /HStack\(spacing: 12\)[\s\S]*?Toggle\("", isOn: \$draft\.showPace\)[\s\S]*?\}\s*Text\(I18n\.text\("usage\.settingsPaceDescription"/);
});

test("puxador de contas oferece reordenação acessível", async () => {
  const settings = await source("UsageSettings.swift");
  const rowStart = settings.indexOf("private struct UsageAccountRow");
  const rowEnd = settings.indexOf("private struct UsageAccountDropDelegate", rowStart);
  const rowSource = settings.slice(rowStart, rowEnd);

  assert.match(rowSource, /accessibilityAdjustableAction/);
  assert.match(rowSource, /previousAccountID/);
  assert.match(rowSource, /nextAccountID/);
});

test("reordenação anima o deslocamento e o estado do item arrastado", async () => {
  const settings = await source("UsageSettings.swift");
  const moveStart = settings.indexOf("private func moveAccount");
  const moveEnd = settings.indexOf("\n  }", moveStart);
  const moveSource = settings.slice(moveStart, moveEnd);
  const rowStart = settings.indexOf("private struct UsageAccountRow");
  const rowEnd = settings.indexOf("private struct UsageAccountDropDelegate", rowStart);
  const rowSource = settings.slice(rowStart, rowEnd);

  assert.match(settings, /@Environment\(\\.accessibilityReduceMotion\) private var reduceMotion/);
  assert.match(moveSource, /withAnimation\(reduceMotion \? nil : \.snappy\(duration: 0\.24\)\)/);
  assert.match(rowSource, /private var isDragging: Bool/);
  assert.match(rowSource, /\.scaleEffect\(isDragging/);
  assert.match(rowSource, /\.zIndex\(isDragging/);
  assert.match(rowSource, /\.animation\(reorderAnimation, value: draggedAccountID\)/);
});

test("preferências de uso estão traduzidas em português e inglês", async () => {
  const i18n = await source("LanguageStore.swift");

  for (const key of [
    "sidebar.usageSettings",
    "usage.settingsTitle",
    "usage.settingsDescription",
    "usage.settingsOrderHint",
    "usage.settingsAppearance",
    "usage.settingsConnected",
    "usage.settingsNotConnected",
    "usage.settingsAccountAvailable",
    "usage.settingsAccountUnavailable",
    "usage.settingsEnabled",
    "usage.settingsEnabledDescription",
    "usage.settingsDisplay",
    "usage.settingsDisplayUsed",
    "usage.settingsDisplayRemaining",
    "usage.settingsReset",
    "usage.settingsResetCountdown",
    "usage.settingsResetExact",
    "usage.settingsPace",
    "usage.settingsPaceDescription",
    "usage.settingsSaveError",
  ]) {
    const occurrences = i18n.split("\"" + key + "\"").length - 1;
    assert.equal(occurrences, 2, key);
  }

  assert.match(i18n, /"usage\.settingsProviders": "Contas"/);
  assert.match(i18n, /"usage\.settingsProviders": "Accounts"/);
  assert.doesNotMatch(i18n, /IAs habilitadas|Enabled AIs/);
  assert.doesNotMatch(i18n, /aparecem no PWA|appear in the PWA|Enabled in the PWA|Mostrar limites no PWA/);
});

test("Contas pinta o cabeçalho com o mesmo fundo de Conectar", async () => {
  const settings = await source("UsageSettings.swift");
  const content = await source("ContentView.swift");

  assert.match(settings, /\.background\(DokkeTheme\.canvas\.ignoresSafeArea\(\)\)/);
  assert.match(content, /\.background\(DokkeTheme\.canvas\.ignoresSafeArea\(\)\)/);
});

test("Uso aplica o fundo na mesma camada externa de Conectar", async () => {
  const settings = await source("UsageSettings.swift");
  const body = settings.slice(
    settings.indexOf("var body: some View"),
    settings.indexOf(".onChange(of: store.usageSettings)")
  );

  assert.match(
    body,
    /\.scrollIndicators\(\.hidden\)\s*\.padding\(\.top, 58\)\s*\.frame\(maxWidth: \.infinity, maxHeight: \.infinity, alignment: \.topLeading\)\s*\.background\(DokkeTheme\.canvas\.ignoresSafeArea\(\)\)/
  );
});
