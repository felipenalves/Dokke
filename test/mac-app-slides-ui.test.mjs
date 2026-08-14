import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dockGrid = await readFile(new URL("../mac/Sources/DockGridView.swift", import.meta.url), "utf8");
const dockIcon = await readFile(new URL("../mac/Sources/DockIcon.swift", import.meta.url), "utf8");
const contentView = await readFile(new URL("../mac/Sources/ContentView.swift", import.meta.url), "utf8");

test("slides de apps seguem o carrossel visual da referência", () => {
  assert.match(dockGrid, /@State private var currentPage: Int\? = 0/);
  assert.match(dockGrid, /private func carouselPageWidth/);
  assert.match(dockGrid, /private let pageHeight: CGFloat = 244/);
  assert.match(dockGrid, /DokkeTheme\.canvas/);
  assert.match(dockGrid, /LazyHStack\(alignment: \.center, spacing: carouselGap\)/);
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
  assert.match(dockGrid, /tileSize: CGFloat = 64/);
  assert.match(dockGrid, /\.scrollTargetBehavior\(\.viewAligned\)/);
  assert.match(dockGrid, /\.scrollPosition\(id: \$currentPage, anchor: \.leading\)/);
});

test("geometria do canvas, tiles e páginas segue a captura", () => {
  assert.match(dockGrid, /\.padding\(\.horizontal, 20\)/);
  assert.match(dockGrid, /\.padding\(\.top, 8\)/);
  assert.match(dockGrid, /\.padding\(\.bottom, 18\)/);
  assert.match(dockGrid, /private let tileSize: CGFloat = 64/);
  assert.match(dockGrid, /private let tileSpacing: CGFloat = 22/);
  assert.match(dockGrid, /private let pageHeight: CGFloat = 244/);
  assert.match(dockGrid, /private let carouselGap: CGFloat = 24/);
  assert.match(dockGrid, /private let carouselPeekRatio: CGFloat = 0\.60/);
  assert.match(dockGrid, /private let carouselMaxPageWidth: CGFloat = 444/);
  assert.match(dockGrid, /private let carouselMinPageWidth: CGFloat = 360/);
  assert.match(dockGrid, /LazyHStack\(alignment: \.center, spacing: carouselGap\)/);

  const pageContent = dockGrid.slice(
    dockGrid.indexOf("private func pageContent"),
    dockGrid.indexOf("private func appGrid"),
  );
  assert.match(pageContent, /\.padding\(\.horizontal, 24\)/);
  assert.match(pageContent, /\.padding\(\.vertical, 24\)/);
  assert.match(pageContent, /cornerRadius: 24/);
});

test("slide principal domina a viewport com peek de 60%", () => {
  assert.match(dockGrid, /carouselPeekRatio: CGFloat = 0\.60/);
  assert.match(dockGrid, /\(availableWidth - carouselGap\) \/ \(1 \+ carouselPeekRatio\)/);
  assert.match(dockGrid, /min\(carouselMaxPageWidth, max\(carouselMinPageWidth, dominant\)\)/);
  assert.doesNotMatch(dockGrid, /\(availableWidth - gap - peek\) \/ 2/);
});

test("cálculo do carrossel na largura padrão (732pt): page ~442.5 e peek ~265.5", () => {
  const gap = Number(dockGrid.match(/carouselGap: CGFloat = (\d+)/)?.[1] ?? "NaN");
  const ratio = Number(dockGrid.match(/carouselPeekRatio: CGFloat = ([\d.]+)/)?.[1] ?? "NaN");
  const cap = Number(dockGrid.match(/carouselMaxPageWidth: CGFloat = (\d+)/)?.[1] ?? "NaN");
  const minimum = Number(dockGrid.match(/carouselMinPageWidth: CGFloat = (\d+)/)?.[1] ?? "NaN");
  assert.ok(
    Number.isFinite(gap) && Number.isFinite(ratio) && Number.isFinite(cap) && Number.isFinite(minimum),
    "constantes do carrossel extraídas",
  );

  const available = 732; // 980 (janela padrão) - 208 (sidebar ideal) - 40 (padding externo)
  const page = (available - gap) / (1 + ratio);
  const peek = available - gap - page;

  assert.ok(
    Math.abs(page - 442.5) < 0.01,
    `slide principal esperado 442.5pt, obtido ${page.toFixed(1)}pt`,
  );
  assert.ok(
    Math.abs(peek - 265.5) < 0.01,
    `peek esperado 265.5pt, obtido ${peek.toFixed(1)}pt`,
  );
  assert.ok(Math.abs(peek / page - ratio) < 0.01, "peek/page deve ser 0.60");
  assert.ok(page >= minimum && page <= cap, "page respeita mínimo e máximo");
});

test("ícone e item preservam 64x88 com label legível e truncado", () => {
  assert.match(dockIcon, /private let iconSize: CGFloat = 64/);
  assert.match(dockIcon, /\.frame\(width: iconSize, height: iconSize \+ 24\)/);
  assert.match(dockIcon, /\.lineLimit\(1\)/);
  assert.match(dockIcon, /\.truncationMode\(\.middle\)/);
});
