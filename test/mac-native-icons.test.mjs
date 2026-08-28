import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const store = readFileSync(
  fileURLToPath(new URL("../mac/Sources/DockStore.swift", import.meta.url)),
  "utf8"
);
const dockIcon = readFileSync(
  fileURLToPath(new URL("../mac/Sources/DockIcon.swift", import.meta.url)),
  "utf8"
);
const picker = readFileSync(
  fileURLToPath(new URL("../mac/Sources/AppPickerSheet.swift", import.meta.url)),
  "utf8"
);

test("macOS usa o NSImage vivo do bundle para preservar o estilo dos ícones", () => {
  assert.match(store, /import AppKit/);
  assert.match(store, /private var nativeIconCache: \[String: NSImage\]/);
  assert.match(store, /func nativeIcon\(for name: String\) -> NSImage\?/);
  assert.match(store, /NSWorkspace\.shared\.icon\(forFile:/);
  assert.match(store, /resolvingSymlinksInPath\(\)/);
  assert.match(store, /iconPath/);
  assert.match(store, /nativeIconCache\[name\] = icon/);
  assert.match(store, /invalidateNativeIcons\(\)/);
  assert.match(store, /NSWorkspaceIconAppearanceConfigurationDidChangeNotification/);
  assert.match(store, /effectiveAppearance/);
});

test("grid e seletor priorizam o ícone nativo e só usam o endpoint como fallback", () => {
  assert.match(dockIcon, /if let native = store\.nativeIcon\(for: name\)/);
  assert.match(dockIcon, /Image\(nsImage: native\)/);
  assert.match(picker, /if let native = store\.nativeIcon\(for: app\.name\)/);
  assert.match(picker, /Image\(nsImage: native\)/);
  assert.match(dockIcon, /AsyncImage\(url: store\.iconURL\(for: name\)\)/);
  assert.match(picker, /AsyncImage\(url: store\.iconURL\(for: app\.name\)\)/);
});

test("web link diferencia o favicon com uma moldura branca interna", () => {
  assert.match(dockIcon, /private var websiteIconImage: some View/);
  assert.match(dockIcon, /case \.website:\s*websiteIconImage/);
  assert.match(dockIcon, /Color\.white\.opacity\(0\.96\)/);
  assert.match(dockIcon, /RoundedRectangle\(cornerRadius: 16, style: \.continuous\)/);
  assert.match(dockIcon, /clipShape\(RoundedRectangle\(cornerRadius: 12, style: \.continuous\)\)/);
  assert.match(dockIcon, /frame\(width: 40, height: 40\)[\s\S]*?clipShape\(RoundedRectangle\(cornerRadius: 10, style: \.continuous\)\)/);
  assert.match(dockIcon, /s2\/favicons/);
  assert.match(dockIcon, /URLQueryItem\(name: "sz", value: "128"\)/);
  assert.match(dockIcon, /private var websiteFaviconFallbackURL/);
  assert.match(picker, /s2\/favicons/);
  assert.match(picker, /URLQueryItem\(name: "sz", value: "128"\)/);
  assert.match(picker, /private func websiteIconPlate/);
  assert.match(picker, /Color\.white\.opacity\(0\.96\)/);
  assert.match(picker, /RoundedRectangle\(cornerRadius: 10, style: \.continuous\)/);
});

test("preload não achata em PNG um ícone que o AppKit já fornece nativamente", () => {
  assert.match(store, /if nativeIcon\(for: name\) != nil \{ continue \}/);
});
