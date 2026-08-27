import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dockGrid = await readFile(new URL("../mac/Sources/DockGridView.swift", import.meta.url), "utf8");
const dockStore = await readFile(new URL("../mac/Sources/DockStore.swift", import.meta.url), "utf8");
const appPicker = await readFile(new URL("../mac/Sources/AppPickerSheet.swift", import.meta.url), "utf8");

test("cada slot vazio do dock tem seu próprio Add com hover", () => {
  assert.match(dockGrid, /case add\(Int\)/);
  assert.match(dockGrid, /addButtonModule\(at: index\)/);
  assert.match(dockGrid, /private struct AddSlotButton: View/);
  assert.match(dockGrid, /Text\(isHovered \? "Add"/);
  assert.match(dockGrid, /\.onHover \{ isHovered = \$0 \}/);
  assert.match(dockGrid, /Adicionar app na posição/);
  assert.doesNotMatch(dockGrid, /case \.add:/);
  assert.doesNotMatch(dockGrid, /private func emptySlot/);
});

test("o slot escolhido abre o picker e preserva a posição", () => {
  assert.match(dockGrid, /@State private var pickerInsertIndex: Int\?/);
  assert.match(dockGrid, /pickerInsertIndex = index/);
  assert.match(dockGrid, /AppPickerSheet\(insertAt: pickerInsertIndex\)/);
  assert.match(appPicker, /let insertAt: Int\?/);
  assert.match(appPicker, /if let insertAt \{[\s\S]*?await store\.pin\(app\.name, at: insertAt\)/);
});

test("inserção direcionada salva a ordem inteira no servidor", () => {
  assert.match(dockStore, /func pin\(_ name: String, at index: Int\) async/);
  assert.match(dockStore, /pinned\.insert\(name, at: insertionIndex\)/);
  assert.match(dockStore, /await savePinnedOrder\(\)/);
});
