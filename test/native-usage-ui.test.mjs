import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = name => readFile(new URL(`../mac/Sources/${name}`, import.meta.url), "utf8");

test("macOS não oferece Uso na sidebar nem abre suas preferências", async () => {
  const content = await source("ContentView.swift");
  assert.doesNotMatch(content, /case usage\b|UsageSettingsView|sidebar\.usage/);
});

test("DockStore não consulta Uso nem mantém seu estado", async () => {
  const store = await source("DockStore.swift");
  assert.doesNotMatch(store, /\/api\/usage|usageSettings|usageActivity|loadUsage|pollUsageActivity|usageProvider/);
});
