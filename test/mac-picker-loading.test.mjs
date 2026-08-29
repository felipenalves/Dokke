import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const store = await readFile(new URL("../mac/Sources/DockStore.swift", import.meta.url), "utf8");
const picker = await readFile(new URL("../mac/Sources/AppPickerSheet.swift", import.meta.url), "utf8");

test("inventário de apps repete o carregamento até o servidor responder", () => {
  assert.match(store, /@Published private\(set\) var installedReady = false/);
  assert.match(store, /@Published private\(set\) var installedLoading = false/);
  const pingStatus = store.slice(store.indexOf("func pingStatus()"), store.indexOf("private func pingHealthOnly"));
  assert.match(pingStatus, /if !installedReady \{[\s\S]*await loadInstalled\(\)/);
  const loadInstalled = store.slice(store.indexOf("func loadInstalled()"), store.indexOf("func togglePin"));
  assert.match(loadInstalled, /guard !installedLoading else \{ return \}/);
  assert.match(loadInstalled, /installedLoading = true/);
  assert.match(loadInstalled, /installedReady = true/);
});

test("picker não confunde carregamento inicial com inventário vazio", () => {
  assert.match(picker, /ProgressView\(I18n\.text\("picker\.loading", language: languageStore\.selected\)\)/);
  assert.match(picker, /store\.installedLoading && !store\.installedReady/);
});
