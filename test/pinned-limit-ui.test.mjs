import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const store = await readFile(new URL("../mac/Sources/DockStore.swift", import.meta.url), "utf8");
const picker = await readFile(new URL("../mac/Sources/AppPickerSheet.swift", import.meta.url), "utf8");
const grid = await readFile(new URL("../mac/Sources/DockGridView.swift", import.meta.url), "utf8");

test("PWA e Android usam o limite anunciado pela API e informam quando ele foi atingido", () => {
  assert.match(html, /maxPinnedApps/);
  assert.match(html, /PINNED_LIMIT_REACHED/);
  assert.match(html, /pinnedLimitMessage/);
  assert.match(html, /m\.limits/);
});

test("Mac mantém o limite no estado local e desabilita novos pins no picker", () => {
  assert.match(store, /@Published var maxPinnedApps: Int = 40/);
  assert.match(store, /@Published var maxPinnedPieces: Int = 40/);
  assert.match(store, /var isPinnedLimitReached: Bool/);
  assert.match(store, /PINNED_LIMIT_REACHED/);
  assert.match(picker, /store\.isPinnedLimitReached/);
  assert.match(grid, /store\.isPinnedLimitReached/);
});
