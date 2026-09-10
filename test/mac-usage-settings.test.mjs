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

test("tela Mac escolhe apenas uma IA com dados e persiste a preferência do topo", async () => {
  const store = await source("DockStore.swift");
  const settings = await source("UsageSettings.swift");

  assert.match(store, /@Published private\(set\) var usageProviderId:\s*String\?/);
  assert.match(store, /func updateUsageProvider\(_ providerId:\s*String\) async/);
  assert.match(settings, /availableProviderIds/);
  assert.match(settings, /hasUsableUsageData/);
  assert.match(settings, /updateUsageProvider\(/);
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

test("preferências de uso estão traduzidas em português e inglês", async () => {
  const i18n = await source("LanguageStore.swift");

  for (const key of [
    "sidebar.usageSettings",
    "usage.settingsTitle",
    "usage.settingsDescription",
    "usage.settingsEnabled",
    "usage.settingsProvider",
    "usage.settingsProviderDescription",
    "usage.settingsDisplay",
    "usage.settingsDisplayUsed",
    "usage.settingsDisplayRemaining",
    "usage.settingsReset",
    "usage.settingsResetCountdown",
    "usage.settingsResetExact",
    "usage.settingsSaveError",
  ]) {
    const occurrences = i18n.split("\"" + key + "\"").length - 1;
    assert.equal(occurrences, 2, key);
  }
});
