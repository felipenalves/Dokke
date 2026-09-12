import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  saveConfig,
  normalizeConfig,
  normalizePinned,
  PINNED_PAGE_SIZE,
  PINNED_MAX_PAGES,
  MAX_PINNED_APPS,
} from "../config.js";

const emptyConfig = {
  schemaVersion: 2,
  revision: 0,
  pieces: [],
  pinned: [],
  usage: { enabled: true, display: "used", reset: "exact", showPace: true },
};

test("limite do dock cabe em cinco páginas completas", () => {
  assert.equal(PINNED_PAGE_SIZE, 8);
  assert.equal(PINNED_MAX_PAGES, 5);
  assert.equal(MAX_PINNED_APPS, 40);
});

test("loadConfig cria com defaults e saveConfig persiste", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5cfg-"));
  const file = join(dir, "config.json");
  try {
    const c = await loadConfig(file);
    assert.deepEqual(c, emptyConfig);
    c.pieces.push({ type: "app", name: "Figma" });
    await saveConfig(file, c);
    assert.deepEqual((await loadConfig(file)).pinned, ["Figma"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("loadConfig com JSON corrupto retorna defaults", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5cfg-"));
  const file = join(dir, "config.json");
  try {
    await writeFile(file, "{isso nao é json válido");
    assert.deepEqual(await loadConfig(file), emptyConfig);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("loadConfig com partial {} preenche defaults e guard de tipo normaliza pinned", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5cfg-"));
  try {
    const parcial = join(dir, "parcial.json");
    await saveConfig(parcial, {});
    assert.deepEqual(await loadConfig(parcial), emptyConfig);
    const guard = join(dir, "guard.json");
    await saveConfig(guard, { pinned: "nao-array" });
    assert.deepEqual(await loadConfig(guard), emptyConfig);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("normalizePinned trim, dedupe e ignora lixo", () => {
  assert.deepEqual(normalizePinned([" A ", "B", "A", "", 1, null]), ["A", "B"]);
});

test("normalizeConfig preserva a última IA selecionada e ignora IDs inválidos", () => {
  assert.equal(normalizeConfig({ usageProvider: " Codex " }).usageProvider, "codex");
  assert.equal(normalizeConfig({ usageProvider: "claude" }).usageProvider, "claude");
  assert.equal(normalizeConfig({ usageProvider: "não é um id" }).usageProvider, undefined);
});

test("normaliza a lista opcional de IAs habilitadas sem quebrar configurações antigas", () => {
  assert.equal(normalizeConfig({}).usage.providers, undefined);
  assert.deepEqual(normalizeConfig({ usage: { providers: [" Grok ", "claude", "grok", "unknown"] } }).usage.providers, ["grok", "claude"]);
  assert.deepEqual(normalizeConfig({ usage: { providers: [] } }).usage.providers, []);
});

test("normaliza a ordem opcional das contas sem confundir ordem com habilitação", () => {
  assert.equal(normalizeConfig({}).usage.providerOrder, undefined);
  assert.deepEqual(
    normalizeConfig({ usage: { providerOrder: [" Grok ", "codex", "grok", "unknown"] } }).usage.providerOrder,
    ["grok", "codex"]
  );
  assert.deepEqual(normalizeConfig({ usage: { providers: ["codex"], providerOrder: ["grok", "codex"] } }).usage.providers, ["codex"]);
});

test("normaliza ritmo de uso sem configuração de anel semanal", () => {
  assert.equal(normalizeConfig({}).usage.showPace, true);
  assert.deepEqual(normalizeConfig({ usage: { showPace: false, weeklyRing: "outside" } }).usage, {
    enabled: true,
    display: "used",
    reset: "exact",
    showPace: false,
  });
  assert.equal(normalizeConfig({ usage: { showPace: "yes", weeklyRing: "invalid" } }).usage.showPace, true);
  assert.equal(Object.hasOwn(normalizeConfig({ usage: { weeklyRing: "invalid" } }).usage, "weeklyRing"), false);
});

test("preserva contagem regressiva do reset nas preferências de uso", () => {
  assert.equal(normalizeConfig({ usage: { reset: "countdown" } }).usage.reset, "countdown");
});
