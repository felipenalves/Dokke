import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [pwa, model, picker, store, icon, language, grid] = await Promise.all([
  read("../public/index.html"),
  read("../mac/Sources/DockPiece.swift"),
  read("../mac/Sources/AppPickerSheet.swift"),
  read("../mac/Sources/DockStore.swift"),
  read("../mac/Sources/DockIcon.swift"),
  read("../mac/Sources/LanguageStore.swift"),
  read("../mac/Sources/DockGridView.swift"),
]);

test("picker inclui uma aba Atalhos ao lado de Apps e Website Links", () => {
  assert.match(picker, /picker\.shortcuts/);
  assert.match(picker, /selection: "Apps"/);
  assert.match(picker, /selection: "Website Links"/);
  assert.match(picker, /selection: "Shortcuts"/);
  assert.match(picker, /private var pickerTabSelector/);
  assert.match(picker, /store\.loadShortcuts\(\)/);
  assert.match(picker, /store\.addShortcut\(/);
});

test("lista de atalhos usa o ícone instalado do app Atalhos da Apple", () => {
  assert.match(picker, /com\.apple\.shortcuts/);
  assert.match(picker, /NSWorkspace\.shared\.urlForApplication/);
  assert.match(picker, /Image\(nsImage: appIcon\)/);
});

test("aba Shortcuts também usa o ícone oficial do app", () => {
  const tabs = picker.slice(picker.indexOf("private var pickerTabSelector"), picker.indexOf("private func pickerTabButton"));
  assert.match(tabs, /icon: Self\.shortcutsAppIcon/);
});

test("abas Apps e Website Links usam os ícones nativos do Mac e do Safari", () => {
  const tabs = picker.slice(picker.indexOf("private var pickerTabSelector"), picker.indexOf("private func pickerTabButton"));
  assert.match(picker, /appsAppIcon = applicationIcon\(forBundleIdentifier: "com\.apple\.apps\.launcher"\)/);
  assert.match(picker, /safariAppIcon = applicationIcon\(forBundleIdentifier: "com\.apple\.Safari"\)/);
  assert.match(tabs, /icon: Self\.appsAppIcon/);
  assert.match(tabs, /icon: Self\.safariAppIcon/);
  assert.match(tabs, /fallbackSystemName: "square\.grid\.2x2\.fill"/);
  assert.match(tabs, /fallbackSystemName: "safari\.fill"/);
});

test("Adicionar abre a escolha de emoji e só fixa após confirmação", () => {
  const row = picker.slice(picker.indexOf("private func shortcutRow"), picker.indexOf("private var websiteLinksView"));
  const prompt = picker.slice(picker.indexOf("private var shortcutEmojiPrompt"), picker.indexOf("private func appRow"));
  assert.match(row, /beginShortcutAdd\(shortcut\)/);
  assert.match(picker, /NSApp\.orderFrontCharacterPalette/);
  assert.match(prompt, /action: confirmShortcutAdd/);
  assert.match(picker, /store\.addShortcut\(name, emoji:/);
  assert.match(picker, /\.accessibilityHidden\(showWebsiteNamePrompt \|\| showShortcutEmojiPrompt\)/);
  assert.match(picker, /\.disabled\(showWebsiteNamePrompt \|\| showShortcutEmojiPrompt\)/);
  assert.match(picker, /isShortcutEmojiFocused = true/);
  assert.match(prompt, /disabled: store\.busyName == pendingShortcutName/);
  assert.match(picker, /guard store\.busyName != pendingShortcutName else \{ return \}/);
});

test("emoji abre o seletor ao clicar e mouse é o padrão", () => {
  const prompt = picker.slice(picker.indexOf("private var shortcutEmojiPrompt"), picker.indexOf("private func appRow"));
  assert.match(picker, /@State private var pendingShortcutEmoji = "🖱️"/);
  assert.match(picker, /pendingShortcutEmoji = "🖱️"/);
  assert.match(prompt, /\.simultaneousGesture\(TapGesture\(\)\.onEnded \{ openShortcutEmojiPalette\(\) \}\)/);
  assert.match(picker, /firstResponder as\? NSTextView\)\?\.selectAll\(nil\)/);
  assert.match(model, /json\["emoji"\] as\? String \?\? "🖱️"/);
  assert.match(icon, /Text\(piece\.emoji \?\? "🖱️"\)/);
  assert.match(pwa, /emoji \|\| "🖱️"/);
});

test("botões do prompt de emoji mantêm cápsulas em tamanho compacto", () => {
  const prompt = picker.slice(picker.indexOf("private var shortcutEmojiPrompt"), picker.indexOf("private func appRow"));
  const button = picker.slice(picker.indexOf("private func shortcutEmojiActionButton"), picker.indexOf("private func appRow"));
  assert.match(prompt, /shortcutEmojiActionButton\([\s\S]*?confirm\.cancel/);
  assert.match(prompt, /shortcutEmojiActionButton\([\s\S]*?picker\.add/);
  assert.match(prompt, /minWidth: 70/);
  assert.match(prompt, /minWidth: 54/);
  assert.match(button, /\.font\(\.system\(size: 14, weight: \.semibold\)\)/);
  assert.match(button, /\.frame\(height: 30\)/);
  assert.match(button, /\.background\(prominent \? Color\.accentColor : Color\.white\.opacity\(0\.10\), in: Capsule\(\)\)/);
  assert.match(button, /minWidth: CGFloat/);
});

test("modelo Swift decodifica e preserva o emoji das peças de atalho", () => {
  assert.match(model, /case shortcut/);
  assert.match(model, /case \.shortcut:[\s\S]*?emoji: json\["emoji"\]/);
  assert.match(model, /case \.shortcut: return name/);
  assert.match(model, /let emoji: String\?/);
});

test("tile nativo e celular acionam o mesmo ID salvo no Mac", () => {
  assert.match(icon, /case \.shortcut:/);
  assert.match(icon, /store\.openShortcut\(piece\.id\)/);
  const action = pwa.slice(pwa.indexOf("async function activatePiece"), pwa.indexOf("async function pinApp"));
  assert.match(action, /piece\.type === "app"/);
  assert.match(action, /\/api\/pieces\/" \+ encodeURIComponent\(piece\.id\) \+ "\/open/);
});

test("tile de atalho oferece ação padrão acessível além do clique do mouse", () => {
  const tile = icon.slice(icon.indexOf("var body: some View", icon.indexOf("struct DockIcon: View")), icon.indexOf("@ViewBuilder\n  private var iconWithEffects"));
  const accessibility = icon.slice(icon.indexOf("private struct DockPieceActivationAccessibility"), icon.indexOf("struct DockIcon: View"));
  assert.match(tile, /DockPieceActivationAccessibility\([\s\S]*?action: activatePiece/);
  assert.match(accessibility, /\.accessibilityAddTraits\(\.isButton\)/);
  assert.match(accessibility, /\.accessibilityAction\(\.default\)\s*\{\s*action\(\)\s*\}/);
  assert.match(tile, /\.onTapGesture\s*\{\s*activatePiece\(\)\s*\}/);
  assert.match(icon, /private func activatePiece\(\)/);
});

test("erro ao acionar peça aparece temporariamente na grade do Dock Mac", () => {
  assert.match(store, /@Published var pieceActionError: String\?/);
  assert.match(store, /pieceActionErrorRevision/);
  assert.match(store, /pieceActionError = message/);
  assert.match(grid, /if let error = store\.pieceActionError/);
  assert.match(grid, /accessibilityIdentifier\("pieceActionError"\)/);
  assert.match(grid, /\.task\(id: store\.pieceActionErrorRevision\)/);
  assert.match(grid, /AccessibilityNotification\.Announcement\(error\)\.post\(\)/);
  assert.match(grid, /Task\.sleep\(nanoseconds:/);
});

test("busca da aba Atalhos usa o estado de foco do contorno", () => {
  const shortcutSearch = picker.slice(picker.indexOf("TextField(I18n.text(\"picker.shortcutSearch\""), picker.indexOf("if store.isPinnedLimitReached", picker.indexOf("private var shortcutsView")));
  assert.match(shortcutSearch, /\.focused\(\$isSearchFocused\)/);
});

test("PWA renderiza e remove atalhos sem tratá-los como apps instalados", () => {
  const render = pwa.slice(pwa.indexOf("function renderLaunchpad"), pwa.indexOf("function renderDots"));
  assert.match(render, /piece\.type === "shortcut"/);
  const hold = pwa.slice(pwa.indexOf("function tileLong"), pwa.indexOf("\/\/ ---------- rendering: launchpad"));
  assert.match(hold, /piece\.type === "shortcut"/);
  assert.match(pwa, /isShortcut/);
});

test("store usa endpoints autenticados do host para listar, fixar e acionar atalhos", () => {
  assert.match(store, /\/api\/shortcuts/);
  assert.match(store, /func addShortcut\(_ name: String, emoji: String, at index: Int\? = nil\) async -> Bool/);
  assert.match(store, /"emoji": emoji/);
  assert.match(store, /func openShortcut\(/);
  assert.match(store, /\/api\/pieces\//);
});

test("prompt fecha pelo resultado da própria requisição e mantém erro local", () => {
  const confirm = picker.slice(picker.indexOf("private func confirmShortcutAdd"), picker.indexOf("private func cancelShortcutAdd"));
  assert.match(confirm, /let added = await store\.addShortcut/);
  assert.match(confirm, /if added \{/);
  assert.doesNotMatch(confirm, /store\.lastError == nil/);
  assert.match(picker, /shortcutAddError = store\.lastError \?\? I18n\.text\("error\.addShortcut"/);
});

test("ícones fixados mostram o emoji escolhido sobre a base roxa", () => {
  assert.match(icon, /piece\.emoji/);
  assert.match(icon, /LinearGradient/);
  assert.doesNotMatch(icon.slice(icon.indexOf("private var shortcutIconImage"), icon.indexOf("@ViewBuilder", icon.indexOf("private var shortcutIconImage"))), /bolt\.fill/);
  assert.match(pwa, /shortcutIconDataURL\(piece\.emoji\)/);
  assert.match(pwa, /shortcutIconDataURL\(a\.emoji\)/);
});

test("atalhos têm rótulos e erros em português e inglês", () => {
  assert.match(language, /"picker\.shortcuts": "Atalhos"/);
  assert.match(language, /"picker\.shortcuts": "Shortcuts"/);
  assert.match(language, /"picker\.shortcutEmojiHint": "Escolha um emoji para o atalho"/);
  assert.match(language, /"icon\.removeShortcut"/);
  assert.match(language, /"error\.SHORTCUT_NOT_FOUND"/);
  assert.match(pwa, /"error\.SHORTCUT_ALREADY_RUNNING": "Este atalho já está em execução no Mac\."/);
  assert.match(pwa, /"error\.SHORTCUT_ALREADY_RUNNING": "This shortcut is already running on the Mac\."/);
  assert.match(language, /"error\.SHORTCUT_ALREADY_RUNNING": "Este atalho já está em execução no Mac\."/);
  assert.match(language, /"error\.SHORTCUT_ALREADY_RUNNING": "This shortcut is already running on the Mac\."/);
});
