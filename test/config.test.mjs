import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("configuração obsoleta de atalhos locais não afeta mais os defaults", () => {
  assert.deepEqual(normalizeConfig({ allowLocalNetworkShortcuts: false }), emptyConfig);
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

test("normaliza a configuração sem incluir campos de Uso", () => {
  const config = normalizeConfig({ usage: { enabled: true }, usageProvider: "codex" });
  assert.equal(Object.hasOwn(config, "usage"), false);
  assert.equal(Object.hasOwn(config, "usageProvider"), false);
});

test("saveConfig mantém preferências antigas de Uso no arquivo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5cfg-"));
  const file = join(dir, "config.json");
  const usage = { enabled: false, display: "remaining", providers: ["codex"] };
  try {
    await writeFile(file, JSON.stringify({ pieces: [], pinned: [], usage, usageProvider: "codex" }));
    const current = await loadConfig(file);
    current.pieces.push({ type: "app", name: "Figma" });
    await saveConfig(file, current);

    const stored = JSON.parse(await readFile(file, "utf8"));
    assert.deepEqual(stored.usage, usage);
    assert.equal(stored.usageProvider, "codex");
    assert.deepEqual((await loadConfig(file)).pinned, ["Figma"]);
    assert.equal(Object.hasOwn(await loadConfig(file), "usage"), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
