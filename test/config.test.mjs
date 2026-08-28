import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  saveConfig,
  normalizePinned,
  PINNED_PAGE_SIZE,
  PINNED_MAX_PAGES,
  MAX_PINNED_APPS,
} from "../config.js";

const emptyConfig = { schemaVersion: 2, revision: 0, pieces: [], pinned: [] };

test("limite do dock cabe em cinco páginas e reserva o botão Adicionar", () => {
  assert.equal(PINNED_PAGE_SIZE, 8);
  assert.equal(PINNED_MAX_PAGES, 5);
  assert.equal(MAX_PINNED_APPS, 39);
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
