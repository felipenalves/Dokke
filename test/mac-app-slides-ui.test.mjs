import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dockGrid = await readFile(new URL("../mac/Sources/DockGridView.swift", import.meta.url), "utf8");
const contentView = await readFile(new URL("../mac/Sources/ContentView.swift", import.meta.url), "utf8");

test("slides de apps seguem o carrossel visual da referência", () => {
  assert.match(dockGrid, /@State private var currentPage: Int\? = 0/);
  assert.match(dockGrid, /private func carouselPageWidth/);
  assert.match(dockGrid, /private let pageHeight: CGFloat = 292/);
  assert.match(dockGrid, /DokkeTheme\.canvas/);
  assert.match(dockGrid, /LazyHStack\(alignment: \.center, spacing: 18\)/);
  assert.match(dockGrid, /\.frame\(width: pageWidth, height: cardHeight\)/);
  assert.match(dockGrid, /\.scrollTargetBehavior\(\.viewAligned\)/);
  assert.match(dockGrid, /\.scrollPosition\(id: \$currentPage, anchor: \.leading\)/);
  assert.match(dockGrid, /Button \{\s*selectPage\(index\)/s);
  assert.doesNotMatch(dockGrid, /Text\("Apps fixados"\)/);
  assert.doesNotMatch(dockGrid, /arrow\.clockwise|Atualizar apps/);
  assert.doesNotMatch(dockGrid, /Página anterior|Próxima página|chevron\.left|chevron\.right/);
});

test("Apps e Conectar usam o mesmo canvas visual", () => {
  assert.match(dockGrid, /\.background\(DokkeTheme\.canvas\.ignoresSafeArea\(\)\)/);
  assert.match(contentView, /\.background\(DokkeTheme\.canvas\.ignoresSafeArea\(\)\)/);
});

test("sidebar replica a seleção discreta da referência", () => {
  assert.match(contentView, /ForEach\(SidebarItem\.allCases, id: \\.self\)/);
  assert.match(contentView, /selection == item/);
  assert.match(contentView, /DokkeTheme\.selection/);
  assert.doesNotMatch(contentView, /List\(SidebarItem\.allCases/);
});

test("reordenação fica explícita no modo Reorder Pieces", () => {
  assert.match(dockGrid, /@State private var isReordering = false/);
  assert.match(dockGrid, /Reorder Pieces/);
  assert.match(dockGrid, /Done/);
  assert.match(dockGrid, /if isReordering/);
  assert.match(dockGrid, /\.overlay\(alignment: \.bottomTrailing\)/);
});

test("carrossel fica centralizado verticalmente no canvas", () => {
  assert.match(
    dockGrid,
    /pageDots\(count: pageCount\)\s*\}\s*\.frame\(maxWidth: \.infinity, maxHeight: \.infinity, alignment: \.center\)/s,
  );
});

test("altura do carrossel permanece estável ao redimensionar", () => {
  assert.match(dockGrid, /let cardHeight = pageHeight/);
  assert.doesNotMatch(dockGrid, /let cardHeight = min\(pageHeight, max/);
});

test("barra superior usa o mesmo canvas do conteúdo", () => {
  assert.match(contentView, /\.toolbarBackground\(DokkeTheme\.canvas, for: \.windowToolbar\)/);
});

test("paginação continua baseada em oito apps por slide", () => {
  assert.match(dockGrid, /let pageSize = 8/);
  assert.match(dockGrid, /\(availableWidth - gap - peek\) \/ 2/);
  assert.match(dockGrid, /tileSize: CGFloat = 72/);
  assert.match(dockGrid, /\.scrollTargetBehavior\(\.viewAligned\)/);
  assert.match(dockGrid, /\.scrollPosition\(id: \$currentPage, anchor: \.leading\)/);
});
