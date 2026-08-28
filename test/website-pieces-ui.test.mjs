import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pwa = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const picker = await readFile(new URL("../mac/Sources/AppPickerSheet.swift", import.meta.url), "utf8");
const grid = await readFile(new URL("../mac/Sources/DockGridView.swift", import.meta.url), "utf8");
const icon = await readFile(new URL("../mac/Sources/DockIcon.swift", import.meta.url), "utf8");
const store = await readFile(new URL("../mac/Sources/DockStore.swift", import.meta.url), "utf8");

test("@spec:AC-310 PWA monta site a partir de pieces sem inventário de apps", () => {
  const render = pwa.slice(pwa.indexOf("function renderLaunchpad"), pwa.indexOf("function renderDots"));
  assert.match(render, /state\.pieces\.length/);
  assert.match(render, /piece\.type === "website"/);
  assert.match(render, /piece\.type === "website"\) byPosition\.set\(position, piece\)/);
  assert.doesNotMatch(render, /if \(!state\.installedReady\)/);
});

test("@spec:AC-311 companion abre site somente por ID remoto e permanece no Dokke", () => {
  const action = pwa.slice(pwa.indexOf("async function activatePiece"), pwa.indexOf("async function pinApp"));
  assert.match(action, /\/api\/pieces\/" \+ encodeURIComponent\(piece\.id\) \+ "\/open/);
  assert.doesNotMatch(action, /window\.open|location\.(assign|replace)|href/);
  const tile = pwa.slice(pwa.indexOf("function buildTile"), pwa.indexOf("function replaceChildren"));
  assert.match(tile, /t\.dataset\.id = a\.id/);
  assert.match(tile, /t\.dataset\.type = a\.type/);
  assert.doesNotMatch(tile, /<a|href/);
});

test("@spec:AC-320 picker mantém Apps e adiciona exatamente Website Links", () => {
  assert.match(picker, /Text\("Apps"\)\.tag\("Apps"\)/);
  assert.match(picker, /Text\("Website Links"\)\.tag\("Website Links"\)/);
  assert.match(picker, /pickerStyle\(\.segmented\)/);
  assert.match(picker, /labelsHidden\(\)/);
  assert.match(picker, /frame\(maxWidth: \.infinity\)/);
  assert.match(picker, /websiteSuggestions/);
  assert.match(picker, /\("Pinterest", "https:\/\/pinterest\.com"\)/);
  assert.match(picker, /\("Threads", "https:\/\/threads\.net"\)/);
  assert.match(picker, /websiteIconPlate\(url: websiteFaviconURL\(for: suggestion\.1\)\)/);
  assert.match(picker, /private func websiteFaviconURL\(for rawURL: String\)/);
  assert.match(picker, /LazyVStack\(spacing: 0\)/);
  assert.match(picker, /Button\("Adicionar"\)/);
  assert.doesNotMatch(picker, /Apple Shortcuts/);
});

test("picker Apps usa a mesma linguagem de cards e ações azuis", () => {
  assert.match(picker, /Text\("App Library"\)/);
  assert.match(picker, /private func appRow\(_ app: InstalledApp\)/);
  assert.match(picker, /frame\(maxWidth: \.infinity, minHeight: 50\)/);
  assert.match(picker, /DokkeTheme\.page\.opacity\(0\.68\)/);
  assert.match(picker, /\.buttonStyle\(\.borderedProminent\)/);
  const appRow = picker.slice(picker.indexOf("private func appRow"));
  assert.match(appRow, /\.buttonStyle\(\.borderedProminent\)/);
});

test("Website Links pede o nome somente depois de iniciar a adição", () => {
  assert.match(picker, /@State private var showWebsiteNamePrompt = false/);
  assert.match(picker, /beginWebsiteAdd\(url: websiteURL\)/);
  assert.match(picker, /beginWebsiteAdd\(url: suggestion\.1, suggestedTitle: suggestion\.0\)/);
  assert.match(picker, /Text\("Vamos dar um nome curto para o seu weblink\."\)/);
  assert.doesNotMatch(picker, /Let's give it a catchy and short name/);
  assert.match(picker, /confirmWebsiteAdd\(\)/);
  assert.doesNotMatch(picker, /TextField\("Título \(opcional\)"/);
  assert.match(picker, /localizedCapitalized/);
});

test("@spec:AC-321 tile de site reutiliza o card externo e tem favicon ou monograma", () => {
  assert.match(grid, /DockIcon\(piece: piece/);
  assert.match(icon, /case \.website/);
  assert.match(icon, /favicon\.ico/);
  assert.match(icon, /fallbackIcon\(phase: phase/);
  assert.match(icon, /private var iconCardBorder/);
  assert.match(icon, /strokeBorder/);
  const tile = pwa.slice(pwa.indexOf("function buildTile"), pwa.indexOf("function replaceChildren"));
  assert.match(tile, /className = "aglass"/);
  assert.match(tile, /websiteFaviconPath\(a\.url\)/);
  assert.match(tile, /a\.title/);
});

test("PWA busca favicon de website com fallback resiliente", () => {
  const favicon = pwa.slice(pwa.indexOf("function websiteFaviconPath"), pwa.indexOf("function loadIcon"));
  const tile = pwa.slice(pwa.indexOf("function buildTile"), pwa.indexOf("function replaceChildren"));
  assert.match(favicon, /www\.google\.com/);
  assert.match(favicon, /s2\/favicons/);
  assert.match(favicon, /domain/);
  assert.match(favicon, /sz/);
  assert.match(pwa, /function websiteFaviconFallbackPath/);
  assert.match(tile, /a\.type === "website" && img\.dataset\.faviconFallback !== "1"/);
  assert.match(tile, /websiteFaviconFallbackPath\(a\.url\)/);
});

test("PWA e APK usam a mesma placa branca para favicon de website", () => {
  const tile = pwa.slice(pwa.indexOf("function buildTile"), pwa.indexOf("function replaceChildren"));
  assert.match(pwa, /\.website-plate\{[\s\S]*background: rgba\(255,255,255,\.96\)/);
  assert.match(pwa, /\.website-plate img\.aicon[\s\S]*object-fit: cover;/);
  assert.match(tile, /const websitePlate = a\.type === "website"/);
  assert.match(tile, /websitePlate\.appendChild\(img\)/);
  assert.match(tile, /websitePlate \|\| glass/);
});

test("@spec:AC-322 dock vazio preserva grade e slots de adição", () => {
  assert.match(grid, /let byPosition = Dictionary/);
  assert.match(grid, /case \.add\(let index\)/);
  assert.match(grid, /addButtonModule\(at: index\)/);
  assert.match(grid, /if !store\.online \{[\s\S]*offlineView[\s\S]*\} else \{[\s\S]*dockPages/s);
  assert.doesNotMatch(grid, /private var emptyDock/);
  assert.doesNotMatch(grid, /Nenhum app fixado/);
  assert.match(store, /@Published private\(set\) var pieces: \[DockPiece\]/);
});

test("PWA mantém o vazio no mesmo slot persistido", () => {
  const render = pwa.slice(pwa.indexOf("function renderLaunchpad"), pwa.indexOf("function renderDots"));
  assert.match(render, /piece\.position/);
  assert.match(render, /buildEmptyTile\(\)/);
  assert.match(pwa, /\.atile\.empty/);
  const statuses = pwa.slice(pwa.indexOf("function updateStatuses"), pwa.indexOf("// tela 2:"));
  assert.match(statuses, /if \(!st\) continue/);
});
