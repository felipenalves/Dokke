import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dockGrid = await readFile(new URL("../mac/Sources/DockGridView.swift", import.meta.url), "utf8");
const dockIcon = await readFile(new URL("../mac/Sources/DockIcon.swift", import.meta.url), "utf8");
const contentView = await readFile(new URL("../mac/Sources/ContentView.swift", import.meta.url), "utf8");
const dockIconStart = dockIcon.indexOf("struct DockIcon");
const dockRoot = dockGrid.slice(
  dockGrid.indexOf("var body: some View"),
  dockGrid.indexOf(".overlay(alignment: .bottom"),
);
const carouselScrollView = dockGrid.slice(
  dockGrid.indexOf("ScrollView(.horizontal)"),
  dockGrid.indexOf(".scrollTargetBehavior(.viewAligned)"),
);
const appTile = dockGrid.slice(
  dockGrid.indexOf("private func appTile"),
  dockGrid.indexOf("private var reorderButton"),
);
const iconCard = dockIcon.slice(
  dockIcon.indexOf("ZStack(alignment: .topLeading)"),
  dockIcon.indexOf("Text(name)"),
);
const iconCardSurface = dockIcon.slice(
  dockIcon.indexOf("private var iconCardSurface"),
  dockIcon.indexOf("var body: some View", dockIconStart),
);
const dockIconBody = dockIcon.slice(
  dockIcon.indexOf("var body: some View", dockIconStart),
  dockIcon.indexOf("@ViewBuilder\n  private var iconWithEffects", dockIconStart),
);
const appKitHoverTracker = dockIcon.slice(
  dockIcon.indexOf("private struct AppKitHoverTracker"),
  dockIcon.indexOf("struct DockIcon"),
);

test("slides de apps seguem o carrossel visual da referência", () => {
  assert.match(dockGrid, /@State private var currentPage: Int\? = 0/);
  assert.match(dockGrid, /private func carouselPageWidth/);
  assert.match(dockGrid, /private let pageHeight: CGFloat = 288/);
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

test("nomes longos dos apps usam reticências no final e têm leitura reforçada", () => {
  assert.match(
    dockIcon,
    /Text\(piece\.displayTitle\)[\s\S]*?\.font\(\.system\(size: 12, weight: \.semibold\)\)[\s\S]*?\.lineLimit\(1\)[\s\S]*?\.truncationMode\(\.tail\)/,
  );
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

test("reordenação fica explícita no modo Reorganizar apps", () => {
  assert.match(dockGrid, /@State private var isReordering = false/);
  assert.match(dockGrid, /Reorganizar apps/);
  assert.match(dockGrid, /Concluir/);
  assert.match(dockGrid, /if isReordering/);
  assert.match(dockGrid, /\.overlay\(alignment: \.bottom/);
  assert.match(dockGrid, /Arraste para mover um ícone de posição\./);
});

test("carrossel preserva o centro e ganha o respiro superior da referência", () => {
  assert.match(
    dockGrid,
    /pageDots\(count: pageCount\)\s*\}\s*\.frame\(maxWidth: \.infinity, maxHeight: \.infinity, alignment: \.center\)/s,
  );
  assert.match(dockGrid, /private let carouselVerticalOffset: CGFloat = 22/);
  assert.match(dockGrid, /\.offset\(y: carouselVerticalOffset\)/);
});

test("altura do carrossel permanece estável ao redimensionar", () => {
  assert.match(dockGrid, /let cardHeight = pageHeight/);
  assert.doesNotMatch(dockGrid, /let cardHeight = min\(pageHeight, max/);
});

test("conteúdo ocupa o topo sem barra nativa e preserva os semáforos", () => {
  assert.doesNotMatch(contentView, /NavigationSplitView/);
  assert.doesNotMatch(contentView, /toolbar\(\.hidden, for: \.windowToolbar\)/);
  assert.match(contentView, /ZStack\(alignment: \.topLeading\)/);
  assert.match(contentView, /\.overlay\(alignment: \.topLeading\) \{\s*header\s*\}/s);
  assert.match(contentView, /private var header: some View/);
  assert.match(contentView, /Image\(systemName: "sidebar\.left"\)/);
  assert.match(
    contentView,
    /Text\("Dokke"\)[\s\S]*?\.frame\(maxWidth: \.infinity, alignment: \.leading\)[\s\S]*?\.padding\(\.leading, 6\)/,
  );
  assert.match(contentView, /private var header:[\s\S]*?\.allowsHitTesting\(false\)/);
});

test("paginação continua baseada em oito apps por slide", () => {
  assert.match(dockGrid, /let pageSize = 8/);
  assert.match(dockGrid, /private let maxPageCount = 5/);
  assert.match(dockGrid, /pageSize \* maxPageCount/);
  assert.match(dockGrid, /tileSize: CGFloat = 80/);
  assert.match(dockGrid, /\.scrollTargetBehavior\(\.viewAligned\)/);
  assert.match(dockGrid, /\.scrollPosition\(id: \$currentPage, anchor: \.leading\)/);
});

test("geometria do canvas, tiles e páginas segue a captura", () => {
  assert.match(dockRoot, /\.padding\(\.leading, 20\)/);
  assert.doesNotMatch(dockRoot, /\.padding\(\.horizontal, 20\)/);
  assert.doesNotMatch(dockRoot, /\.padding\(\.trailing, 20\)/);
  assert.match(dockGrid, /\.padding\(\.top, 8\)/);
  assert.match(dockGrid, /\.padding\(\.bottom, 18\)/);
  assert.match(dockGrid, /private let tileSize: CGFloat = 80/);
  assert.match(dockGrid, /private let tileSpacing: CGFloat = 22/);
  assert.match(dockGrid, /private let pageHeight: CGFloat = 288/);
  assert.match(dockGrid, /private let carouselGap: CGFloat = 24/);
  assert.match(dockGrid, /private let carouselPeekRatio: CGFloat = 0\.55/);
  assert.match(dockGrid, /private let carouselMaxPageWidth: CGFloat = 458/);
  assert.match(dockGrid, /private let carouselMinPageWidth: CGFloat = 450/);
  assert.match(dockGrid, /LazyHStack\(alignment: \.center, spacing: carouselGap\)/);

  const pageContent = dockGrid.slice(
    dockGrid.indexOf("private func pageContent"),
    dockGrid.indexOf("private func appGrid"),
  );
  assert.match(pageContent, /\.padding\(\.horizontal, 32\)/);
  assert.match(pageContent, /\.padding\(\.vertical, 29\)/);
  assert.match(pageContent, /RoundedRectangle\(cornerRadius: 40/);
  assert.match(pageContent, /\.fill\(DokkeTheme\.page\)/);
  assert.match(pageContent, /cornerRadius: 40/);
});

test("slides mantêm separação visível entre cards arredondados", () => {
  assert.match(dockGrid, /LazyHStack\(alignment: \.center, spacing: carouselGap\)/);
  assert.doesNotMatch(dockGrid, /\.frame\(width: pageWidth, height: cardHeight\)\s*\.padding\(\.horizontal, 12\)/s);
});

test("ScrollView mantém somente 12pt à esquerda sem gutter à direita", () => {
  assert.match(carouselScrollView, /\.padding\(\.leading, 12\)/);
  assert.doesNotMatch(carouselScrollView, /\.padding\(\.horizontal, 12\)/);
  assert.doesNotMatch(carouselScrollView, /\.padding\(\.trailing, 12\)/);
});

test("carrossel aplica fade sutil diretamente nos últimos 16pt", () => {
  assert.match(dockGrid, /let trailingFadeStart = max\(0, 1 - 16 \/ max\(geo\.size\.width, 1\)\)/);
  assert.match(dockGrid, /\.mask\(/);
  assert.match(dockGrid, /LinearGradient/);
  assert.match(dockGrid, /\.init\(color: \.black, location: trailingFadeStart\)/);
  assert.match(dockGrid, /\.init\(color: \.clear, location: 1\)/);
  assert.doesNotMatch(dockGrid, /\.overlay\(alignment: \.trailing\)/);
  assert.doesNotMatch(dockGrid, /\.fill\(\.ultraThinMaterial\)/);
});

test("slide principal domina a viewport com peek de 55%", () => {
  assert.match(dockGrid, /carouselPeekRatio: CGFloat = 0\.55/);
  assert.match(dockGrid, /\(availableWidth - carouselGap\) \/ \(1 \+ carouselPeekRatio\)/);
  assert.match(dockGrid, /min\(carouselMaxPageWidth, max\(carouselMinPageWidth, dominant\)\)/);
  assert.doesNotMatch(dockGrid, /\(availableWidth - gap - peek\) \/ 2/);
});

test("cálculo do carrossel sem gutter direito: page 458 e peek 270", () => {
  const gap = Number(dockGrid.match(/carouselGap: CGFloat = (\d+)/)?.[1] ?? "NaN");
  const ratio = Number(dockGrid.match(/carouselPeekRatio: CGFloat = ([\d.]+)/)?.[1] ?? "NaN");
  const cap = Number(dockGrid.match(/carouselMaxPageWidth: CGFloat = (\d+)/)?.[1] ?? "NaN");
  const minimum = Number(dockGrid.match(/carouselMinPageWidth: CGFloat = (\d+)/)?.[1] ?? "NaN");
  assert.ok(
    Number.isFinite(gap) && Number.isFinite(ratio) && Number.isFinite(cap) && Number.isFinite(minimum),
    "constantes do carrossel extraídas",
  );

  const available = 752; // 980 (janela padrão) - 208 (sidebar) - 20 (padding esquerdo)
  const dominant = (available - gap) / (1 + ratio);
  const page = Math.min(cap, Math.max(minimum, dominant));
  const peek = available - gap - page;

  assert.ok(
    Math.abs(page - 458) < 0.1,
    `slide principal esperado 458pt, obtido ${page.toFixed(1)}pt`,
  );
  assert.ok(
    Math.abs(peek - 270) < 0.1,
    `peek esperado 270pt, obtido ${peek.toFixed(1)}pt`,
  );
  assert.ok(page >= minimum && page <= cap, "page respeita mínimo e máximo");
});

test("janela mínima preserva os quatro cards e mantém a página dentro da viewport", () => {
  const gap = Number(dockGrid.match(/carouselGap: CGFloat = (\d+)/)?.[1] ?? "NaN");
  const ratio = Number(dockGrid.match(/carouselPeekRatio: CGFloat = ([\d.]+)/)?.[1] ?? "NaN");
  const cap = Number(dockGrid.match(/carouselMaxPageWidth: CGFloat = (\d+)/)?.[1] ?? "NaN");
  const minimum = Number(dockGrid.match(/carouselMinPageWidth: CGFloat = (\d+)/)?.[1] ?? "NaN");
  const requiredGridWidth = 32 * 2 + 80 * 4 + 22 * 3;
  const available = 840 - 208 - 20;
  const dominant = (available - gap) / (1 + ratio);
  const page = Math.min(cap, Math.max(minimum, dominant));

  assert.equal(requiredGridWidth, 450);
  assert.equal(minimum, requiredGridWidth);
  assert.ok(page >= 450, `página mínima esperada >=450pt, obtida ${page.toFixed(1)}pt`);
  assert.ok(page <= available, `página deve caber em ${available}pt, obtida ${page.toFixed(1)}pt`);
});

test("ícone preserva respiro visível dentro do card glass e label legível", () => {
  assert.match(dockIcon, /private let iconSize: CGFloat = 68/);
  assert.match(dockIcon, /private let iconCardSize: CGFloat = 80/);
  assert.match(dockIcon, /RoundedRectangle\(cornerRadius: 28/);
  assert.match(iconCardSurface, /\.fill\(Color\.white\.opacity\(0\.07\)\)/);
  assert.match(iconCardSurface, /\.fill\(DokkeTheme\.page\.opacity\(0\.26\)\)/);
  assert.match(iconCardSurface, /\.overlay\(iconCardBorder\)/);
  assert.match(dockIcon, /\.strokeBorder\(Color\.white\.opacity\(0\.08\), lineWidth: 1\)/);
  assert.doesNotMatch(iconCardSurface, /\.shadow\(/);
  assert.match(dockIcon, /\.padding\(6\)/);
  assert.match(dockIcon, /\.frame\(width: iconCardSize, height: iconCardSize \+ 24\)/);
  assert.match(dockIcon, /\.font\(\.system\(size: 12, weight: \.semibold\)\)/);
  assert.match(dockIcon, /\.lineLimit\(1\)/);
  assert.match(dockIcon, /\.truncationMode\(\.tail\)/);
});

test("ícone do app fica nítido acima da superfície do card", () => {
  const iconSurface = dockIcon.slice(
    dockIcon.indexOf("ZStack(alignment: .topLeading)"),
    dockIcon.indexOf("if allowsRemoval")
  );
  assert.doesNotMatch(iconSurface, /\.glassEffect\(/);
  assert.match(iconSurface, /iconWithEffects[\s\S]*?\.zIndex\(1\)/);
});

test("hover do app mostra remoção direta sem alterar o modo de reorder", () => {
  assert.match(dockIcon, /let allowsRemoval: Bool/);
  assert.match(dockIcon, /@State private var isHovered = false/);
  assert.doesNotMatch(dockIcon, /isCardHovered|isRemovalHovered/);
  assert.doesNotMatch(dockIcon, /private var isHovered: Bool/);
  assert.match(iconCard, /if allowsRemoval && isHovered \{\s*Button \{\s*Task \{ await store\.unpin\(name\) \}/s);
  assert.doesNotMatch(iconCard, /if isHovered && allowsRemoval/);
  assert.match(iconCard, /Capsule\(\)/);
  assert.match(iconCard, /HoverControlGlassModifier/);
  assert.match(
    iconCard,
    /if allowsRemoval && isHovered \{[\s\S]*?\.fill\(Color\.black\.opacity\(0\.10\)\)[\s\S]*?iconCardBorder[\s\S]*?\.modifier\(HoverControlGlassModifier\(isInteractive: true\)\)/,
  );
  assert.match(dockIcon, /private struct HoverControlGlassModifier: ViewModifier/);
  assert.match(dockIcon, /if #available\(macOS 26, \*\)/);
  assert.match(dockIcon, /\.glassEffect\(\.clear\.interactive\(\), in: Circle\(\)\)/);
  assert.match(dockIcon, /\.glassEffect\(\.clear, in: Circle\(\)\)/);
  assert.match(
    iconCard,
    /if isReordering && isHovered \{[\s\S]*?\.fill\(Color\.black\.opacity\(0\.10\)\)[\s\S]*?iconCardBorder[\s\S]*?\.modifier\(HoverControlGlassModifier\(isInteractive: false\)\)/,
  );
  assert.doesNotMatch(iconCard, /\.contentShape\(Rectangle\(\)\)\s*\.modifier\(HoverControlGlassModifier/);
  assert.match(dockIcon, /private var iconCardBorder: some View/);
  assert.match(dockIcon, /private let hoverBlurRadius: CGFloat = 4/);
  assert.match(dockIcon, /\.blur\(radius: isHovered \? hoverBlurRadius : 0\)/);
  assert.match(iconCard, /RoundedRectangle\(cornerRadius: 28/);
  assert.match(iconCard, /Text\("Remover"\)/);
  assert.doesNotMatch(iconCard, /\.opacity\(isHovered \? 1 : 0\)/);
  assert.match(iconCard, /if isReordering && isHovered \{\s*ZStack[\s\S]*?\.allowsHitTesting\(false\)/);
  assert.match(iconCard, /Text\("Mover"\)/);
  assert.match(iconCard, /arrow\.up\.left\.and\.arrow\.down\.right/);
  assert.match(
    iconCard,
    /\.frame\(width: iconCardSize, height: iconCardSize\)\s*\.zIndex\(5\)/,
  );
  assert.doesNotMatch(iconCard, /\.onHover \{/);
  assert.match(
    iconCard,
    /\}\s*\.frame\(width: iconCardSize, height: iconCardSize\)\s*\.contentShape\(Rectangle\(\)\)\s*\.overlay \{\s*if allowsRemoval \|\| isReordering \{\s*AppKitHoverTracker\(isHovered: \$isHovered\)\s*\.frame\(width: iconCardSize, height: iconCardSize\)\s*\}\s*\}/,
  );
  assert.doesNotMatch(
    dockIconBody,
    /\.frame\(width: iconCardSize, height: iconCardSize \+ 24\)\s*\.contentShape\(Rectangle\(\)\)\s*\.overlay/,
  );
  assert.doesNotMatch(dockIconBody, /\.onContinuousHover\(/);
  assert.doesNotMatch(dockIconBody, /\.onHover \{/);
  assert.match(iconCard, /\.zIndex\(5\)/);
  assert.doesNotMatch(iconCard, /\.transition\(/);
  assert.match(iconCard, /Text\("Remover"\)[\s\S]*?\.contentShape\(Rectangle\(\)\)[\s\S]*?\.buttonStyle\(\.plain\)/);
  assert.match(iconCard, /Remover app fixado/);
});

test("tracker AppKit atualiza o hover sem interceptar o botão", () => {
  assert.match(dockIcon, /import AppKit/);
  assert.match(appKitHoverTracker, /NSViewRepresentable/);
  assert.match(appKitHoverTracker, /@Binding var isHovered: Bool/);
  assert.match(appKitHoverTracker, /override func updateTrackingAreas\(\)/);
  assert.match(appKitHoverTracker, /NSTrackingArea\(/);
  assert.match(
    appKitHoverTracker,
    /NSTrackingArea\(\s*rect: bounds,\s*options: \[\.mouseEnteredAndExited, \.activeAlways\]/,
  );
  assert.match(
    appKitHoverTracker,
    /override func mouseEntered[\s\S]*?refreshHoverFromCursor\(\)/,
  );
  assert.match(appKitHoverTracker, /override func mouseExited[\s\S]*?onHoverChanged\?\(false\)/);
  assert.match(
    appKitHoverTracker,
    /func setHovered\(_ hovered: Bool\) \{\s*DispatchQueue\.main\.async \{[\s\S]*?isHovered\.wrappedValue = hovered\s*\}\s*\}/,
  );
  assert.match(appKitHoverTracker, /override func hitTest[\s\S]*?nil/);
});

test("@spec:AC-342 hover sobrevive a scroll e sweeps sem exit perdido", () => {
  assert.match(appKitHoverTracker, /override func viewDidMoveToWindow\(\)/);
  assert.match(appKitHoverTracker, /DockHoverCoordinator\.shared\.register\(self\)/);
  assert.match(appKitHoverTracker, /DockHoverCoordinator\.shared\.unregister\(self\)/);
  assert.match(appKitHoverTracker, /func refreshHoverFromCursor\(\)/);
  assert.match(
    appKitHoverTracker,
    /window\.convertPoint\(fromScreen: NSEvent\.mouseLocation\)/,
  );
  assert.match(appKitHoverTracker, /let localPoint = convert\(windowPoint, from: nil\)/);
  assert.match(appKitHoverTracker, /bounds\.contains\(localPoint\)/);
  assert.doesNotMatch(appKitHoverTracker, /convert\(bounds, to: nil\)\.contains\(cursor\)/);
  assert.match(dockIcon, /addLocalMonitorForEvents/);
  assert.match(dockIcon, /\.scrollWheel/);
  assert.match(dockIcon, /Timer\.scheduledTimer\(withTimeInterval: 1\.0 \/ 30\.0/);
});

test("label do hover ocupa explicitamente todo o card antes da área clicável", () => {
  assert.match(
    iconCard,
    /\} label: \{\s*ZStack \{[\s\S]*?Text\("Remover"\)[\s\S]*?\}\s*\.frame\(width: iconCardSize, height: iconCardSize\)\s*\.contentShape\(Rectangle\(\)\)\s*\}/,
  );
});

test("appTile desativa remoção durante reorder e ativa no modo normal", () => {
  assert.match(appTile, /if isReordering \{\s*DockIcon\(name: name, allowsRemoval: false, isReordering: true\)/s);
  assert.match(appTile, /\} else \{\s*DockIcon\(name: name, allowsRemoval: true, isReordering: false\)/s);
  assert.doesNotMatch(appTile, /DockIcon\(name: name\)(?!,)/);
  assert.match(iconCard, /if allowsRemoval && isHovered/);
  assert.match(dockIcon, /JiggleModifier/);
  assert.match(dockIcon, /isReordering/);
  assert.match(dockIcon, /isReordering && isHovered/);
  assert.doesNotMatch(dockIcon, /\.scaleEffect\(isReordering && isHovered \? 1\.06 : 1\.0\)/);
  assert.match(
    iconCard,
    /AppKitHoverTracker\(isHovered: \$isHovered\)\s*\.frame\(width: iconCardSize, height: iconCardSize\)/,
  );
});
