import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, saveConfig, normalizePinned } from "../config.js";

test("loadConfig cria com defaults e saveConfig persiste", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5cfg-"));
  const file = join(dir, "config.json");
  try {
    const c = await loadConfig(file);
    assert.deepEqual(c, { pinned: [] });
    c.pinned.push("Figma");
    await saveConfig(file, c);
    assert.deepEqual((await loadConfig(file)).pinned, ["Figma"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("loadConfig com JSON corrupto retorna defaults", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5cfg-"));
  const file = join(dir, "config.json");
  try {
    await writeFile(file, "{isso nao é json válido");
    assert.deepEqual(await loadConfig(file), { pinned: [] });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("loadConfig com partial {} preenche defaults e guard de tipo normaliza pinned", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5cfg-"));
  try {
    const parcial = join(dir, "parcial.json");
    await saveConfig(parcial, {});
    assert.deepEqual(await loadConfig(parcial), { pinned: [] });
    const guard = join(dir, "guard.json");
    await saveConfig(guard, { pinned: "nao-array" });
    assert.deepEqual(await loadConfig(guard), { pinned: [] });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("normalizePinned trim, dedupe e ignora lixo", () => {
  assert.deepEqual(normalizePinned([" A ", "B", "A", "", 1, null]), ["A", "B"]);
});
