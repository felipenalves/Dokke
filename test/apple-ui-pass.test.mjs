import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pwa = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const grid = await readFile(new URL("../mac/Sources/DockGridView.swift", import.meta.url), "utf8");
const dockIcon = await readFile(new URL("../mac/Sources/DockIcon.swift", import.meta.url), "utf8");
const picker = await readFile(new URL("../mac/Sources/AppPickerSheet.swift", import.meta.url), "utf8");

test("login do PWA revela as instruções somente quando solicitado", () => {
  assert.match(pwa, /<details class="login-help">/);
  assert.match(pwa, /<summary[^>]*data-i18n="login.help"/);
  assert.match(pwa, /<ol class="lsteps">/);
});

test("login do PWA mantém foco dentro do diálogo e devolve foco ao fechar", () => {
  assert.doesNotMatch(pwa, /:focus\{\s*outline:\s*none;/);
  assert.match(pwa, /:focus-visible\{/);
  assert.match(pwa, /let loginPreviousFocus = null/);
  assert.match(pwa, /loginPreviousFocus = document\.activeElement/);
  assert.match(pwa, /loginScrim\.addEventListener\("keydown"/);
  assert.match(pwa, /const previousFocus = loginPreviousFocus/);
  assert.match(pwa, /previousFocus\.focus\(\)/);
  assert.match(pwa, /if \(loginOpen && pin\.isConnected\) pin\.focus\(\)/, "foco agendado não deve voltar ao PIN depois de fechar o login");
});

test("navegação lateral do PWA tem controles nomeados e estado atual", () => {
  const navStart = pwa.indexOf("function renderVDots()");
  const navEnd = pwa.indexOf("function goScreen", navStart);
  const navSource = pwa.slice(navStart, navEnd);
  assert.match(navSource, /document\.createElement\("button"\)/);
  assert.match(navSource, /d\.type = "button"/);
  assert.match(navSource, /d\.setAttribute\("aria-label"/);
  assert.match(navSource, /d\.setAttribute\("aria-current"/);
  assert.match(navSource, /d\.style\.setProperty\("--vdot-y"/);
  assert.match(navSource, /function syncVDots\(\)[\s\S]*setAttribute\("aria-current"/);
  assert.match(pwa, /\.vdots \.d\.on\{[^}]*width:\s*44px;[^}]*height:\s*44px;/);
});

test("paginação horizontal do PWA preserva seu espaçamento", () => {
  const dotsStyle = pwa.slice(0, pwa.indexOf("  /* ---- vdots"));
  assert.match(dotsStyle, /\.dots \.d\{[\s\S]*margin:\s*0 5px;/);
  assert.doesNotMatch(pwa.slice(pwa.lastIndexOf("  /* Apple pass")), /\.dots \.d\{[^}]*margin:/);
});

test("slots vazios do PWA são visíveis, mas não oferecem adicionar", () => {
  assert.match(pwa, /\.atile\.empty \.aglass\{[^}]*background:\s*rgba\(255,255,255,\.05\);[^}]*border-color:\s*rgba\(255,255,255,\.08\);/);
  assert.match(pwa, /\.atile\.empty\{\s*cursor:\s*default;\s*pointer-events:\s*none;/);
  const emptyStart = pwa.indexOf("function buildEmptyTile()");
  const emptyEnd = pwa.indexOf("function replaceChildren", emptyStart);
  assert.doesNotMatch(pwa.slice(emptyStart, emptyEnd), /makeBtn|picker\.add|grid\.add/);
});

test("slots vazios do Mac mostram a ação de adicionar sem depender de hover", () => {
  const start = grid.indexOf("private struct AddSlotButton");
  const end = grid.indexOf("struct DropDelegate", start);
  const source = grid.slice(start, end);
  assert.match(source, /Image\(systemName: "plus"\)/);
  assert.match(source, /Text\(I18n\.text\("picker\.add", language: languageStore\.selected\)\)/);
  assert.doesNotMatch(source, /if isHovered \{[\s\S]*Image\(systemName: "plus"\)/);
});

test("ícones do PWA usam a mesma régua interna dos slots do Mac", () => {
  assert.match(dockIcon, /private let iconSize: CGFloat = 68/);
  assert.match(dockIcon, /private let iconCardSize: CGFloat = 80/);
  assert.match(dockIcon, /private let cornerRadius: CGFloat = 20/);
  assert.match(dockIcon, /iconWithEffects[\s\S]*?\.padding\(6\)/);
  assert.match(dockIcon, /RoundedRectangle\(cornerRadius: 28, style: \.continuous\)/);
  assert.match(dockIcon, /\.strokeBorder\(Color\.white\.opacity\(0\.08\), lineWidth: 1\)/);

  assert.match(pwa, /--tile-r: 0\.32;/, "o raio externo deve ficar levemente menos arredondado");
  assert.match(pwa, /--tile-in: 0\.80;/, "o artwork normalizado deve ficar levemente maior que o macOS na referência móvel");
  assert.match(pwa, /--tile-in-r: 0\.27;/, "o raio interno deve ficar levemente menos arredondado");
  assert.match(pwa, /\.atile \.aglass\{[\s\S]*border-radius: 32%;/);
  assert.match(pwa, /\.atile \.aglass \.gicon, \.atile \.aglass img\.aicon\{[\s\S]*width: 80%; height: 80%;[\s\S]*border-radius: 27%;/);
  assert.match(pwa, /\.atile \.aglass \.gicon, \.atile \.aglass img\.aicon\{[\s\S]*border-radius: calc\(100% \* var\(--tile-in-r\)\);/);
  assert.match(pwa, /\.dcard \.aglass\{[\s\S]*border-radius: 32%;/);
  assert.match(pwa, /\.dcard \.aglass \.gicon, \.dcard \.aglass img\.aicon\{[\s\S]*width: 80%; height: 80%;[\s\S]*border-radius: 27%;/);

  const applePass = pwa.slice(pwa.lastIndexOf("  /* Apple pass"));
  assert.match(applePass, /\.aglass\{[\s\S]*background: rgba\(255,255,255,\.07\);[\s\S]*border: 1px solid rgba\(255,255,255,\.08\);/);
});

test("slots móveis aproximam a referência sem alterar o espaçamento entre eles", () => {
  assert.match(pwa, /--app-tile: min\(40vmin, max\(21vw,21vh\), 180px\);/);
  assert.match(pwa, /\.page-grid\{[\s\S]*grid-gap: clamp\(20px, 3vw, 32px\);/);
});

test("busca do picker Mac só usa o accent quando está focada", () => {
  assert.match(picker, /@FocusState private var isSearchFocused: Bool/);
  assert.match(picker, /\.focused\(\$isSearchFocused\)/);
  assert.match(picker, /isSearchFocused \? Color\.accentColor/);
});
