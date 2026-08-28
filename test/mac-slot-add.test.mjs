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

test("slots vazios ficam levemente mais claros que a página", () => {
  assert.match(dockGrid, /\.fill\(Color\.white\.opacity\(isHovered \? 0\.12 : 0\.05\)\)/);
  assert.match(dockGrid, /\.strokeBorder\(Color\.white\.opacity\(isHovered \? 0\.18 : 0\.08\), lineWidth: 1\)/);
  assert.doesNotMatch(dockGrid, /\.fill\(Color\.black\.opacity\(isHovered \? 0\.38 : 0\.30\)\)/);
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
  assert.match(dockStore, /"position": position/);
});

test("grade usa posição persistida e não compacta depois da remoção", () => {
  assert.match(dockGrid, /let byPosition = Dictionary/);
  assert.match(dockGrid, /\.position/);
  assert.match(dockGrid, /case \.add\(let index\)/);
  assert.doesNotMatch(dockGrid, /displayedPieces\.count \/ pageSize/);
});

test("modo reorganizar aceita mover um app para slot vazio", () => {
  assert.match(dockGrid, /private var draftPositions: \[String: Int\]\?/);
  assert.match(dockGrid, /addButtonModule\(at: index\)[\s\S]*?DropDelegate\(position: index/);
  assert.match(dockGrid, /struct DropDelegate: SwiftUI\.DropDelegate/);
  assert.match(dockGrid, /let position: Int/);
  assert.match(dockGrid, /moveDragged\(to: position, dragged:/);
  assert.match(dockStore, /"positions": positions/);
});
