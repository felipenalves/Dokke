import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, obs, dockGrid, contentView, dokkeApp, docsMain, docsStyle, readme, readmeEn] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../obs.js", import.meta.url), "utf8"),
  readFile(new URL("../mac/Sources/DockGridView.swift", import.meta.url), "utf8"),
  readFile(new URL("../mac/Sources/ContentView.swift", import.meta.url), "utf8"),
  readFile(new URL("../mac/Sources/DokkeApp.swift", import.meta.url), "utf8"),
  readFile(new URL("../docs/src/main.js", import.meta.url), "utf8"),
  readFile(new URL("../docs/src/style.css", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../README.en.md", import.meta.url), "utf8").catch(() => ""),
]);

const REQUIRED_I18N_KEYS = [
  "login.title",
  "login.description",
  "login.pinLabel",
  "login.connect",
  "dock.apps",
  "dock.openApps",
  "dock.pinned",
  "recents.title",
  "recents.empty",
  "modal.pinTitle",
  "modal.cancel",
  "modal.removeConfirm",
  "toast.macDisconnected",
  "toast.pinFailed",
  "obs.title",
  "obs.startRecording",
  "obs.stopRecording",
  "obs.stopAll",
  "update.available",
  "update.reload",
  "aria.close",
  "aria.language",
  "aria.selectLanguage",
];

function extractBalancedObject(source, start) {
  const open = source.indexOf("{", start);
  if (open === -1) return null;

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }

  return null;
}

function extractAssignedObject(source, name) {
  const assignment = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`).exec(source);
  return assignment ? extractBalancedObject(source, assignment.index) : null;
}

function extractFunction(source, name) {
  const declaration = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  if (!declaration) return null;

  const parametersOpen = source.indexOf("(", declaration.index);
  let parametersDepth = 0;
  let quote = null;
  let escaped = false;
  let bodyStart = -1;
  for (let index = parametersOpen; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") parametersDepth += 1;
    if (char === ")") {
      parametersDepth -= 1;
      if (parametersDepth === 0) {
        bodyStart = index + 1;
        break;
      }
    }
  }
  if (bodyStart === -1) return null;
  const body = extractBalancedObject(source, bodyStart);
  return body ? source.slice(declaration.index, bodyStart) + body : null;
}

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

test("PWA declara catálogos pt-BR e en com as mesmas chaves funcionais", () => {
  const literal = extractAssignedObject(html, "I18N");
  assert.ok(literal, "faltou const I18N = { ... }");

  let catalogs;
  assert.doesNotThrow(() => {
    catalogs = Function(`\"use strict\"; return (${literal});`)();
  }, "I18N precisa ser um objeto JavaScript válido");

  assert.deepEqual(Object.keys(catalogs).sort(), ["en", "pt-BR"]);
  assert.deepEqual(
    Object.keys(catalogs["pt-BR"]).sort(),
    Object.keys(catalogs.en).sort(),
    "pt-BR e en precisam manter paridade de chaves",
  );

  for (const key of REQUIRED_I18N_KEYS) {
    assert.ok(key in catalogs["pt-BR"], `faltou a chave ${key} em pt-BR`);
    assert.ok(key in catalogs.en, `faltou a chave ${key} em en`);
    assert.equal(typeof catalogs["pt-BR"][key], "string", `${key} em pt-BR precisa ser string`);
    assert.equal(typeof catalogs.en[key], "string", `${key} em en precisa ser string`);
    assert.ok(catalogs["pt-BR"][key].trim(), `${key} em pt-BR não pode ser vazio`);
    assert.ok(catalogs.en[key].trim(), `${key} em en não pode ser vazio`);
  }
  assert.notEqual(catalogs["pt-BR"]["login.title"], catalogs.en["login.title"]);
});

test("PWA detecta o idioma do dispositivo sem preferência manual", () => {
  assert.doesNotMatch(html, /dokke_lang/);
  assert.doesNotMatch(html, /data-language=/);

  const detectLanguage = extractFunction(html, "detectLanguage");
  const getInitialLanguage = extractFunction(html, "getInitialLanguage");

  assert.ok(detectLanguage, "faltou function detectLanguage(language = navigator.language)");
  assert.ok(getInitialLanguage, "faltou function getInitialLanguage()");
  assert.match(detectLanguage, /function detectLanguage\(language = navigator\.language\)/);
  assert.match(getInitialLanguage, /return detectLanguage\(browserLanguage\)/);
  const detect = Function(`${detectLanguage}\nreturn detectLanguage;`)();
  assert.equal(detect("pt-PT"), "pt-BR");
  assert.equal(detect("en-US"), "en");
  assert.equal(detect("fr-FR"), "en");
  assert.equal(detect(null), "pt-BR");

  const makeInitialLanguage = (browserLanguage) => Function(
    "navigator",
    `${detectLanguage}\n${getInitialLanguage}\nreturn getInitialLanguage;`,
  )({ language: browserLanguage });

  assert.equal(makeInitialLanguage("pt-BR")(), "pt-BR");
  assert.equal(makeInitialLanguage("fr-FR")(), "en");
  assert.equal(makeInitialLanguage(null)(), "pt-BR");

  assert.doesNotMatch(html, /function setLanguage/);
  assert.doesNotMatch(html, /localStorage\.(getItem|setItem)/);
});

test("PWA não expõe seletor manual de idioma", () => {
  assert.doesNotMatch(html, /language-control/);
  assert.doesNotMatch(html, /data-language-control/);
});

test("login valida o PIN automaticamente no quarto dígito", () => {
  const doLogin = extractFunction(html, "doLogin");
  assert.ok(doLogin, "faltou function doLogin()");
  assert.match(html, /loginSubmitting = false/);
  assert.match(doLogin, /if \(loginSubmitting\) return/);
  assert.match(doLogin, /loginSubmitting = true/);
  assert.match(doLogin, /finally \{[\s\S]*loginSubmitting = false/);

  const inputHandlerStart = html.indexOf('$("loginPin").addEventListener("input"');
  const inputHandlerEnd = html.indexOf('$("loginGo").addEventListener("click"', inputHandlerStart);
  const inputHandler = html.slice(inputHandlerStart, inputHandlerEnd);
  assert.match(inputHandler, /replace\(\/\\D\/g, ""\)/);
  assert.match(inputHandler, /normalized\.length === 4\) doLogin\(\)/);
});

test("PWA interpola valores fora do catálogo e não trata conteúdo dinâmico como HTML", () => {
  const literal = extractAssignedObject(html, "I18N");
  assert.ok(literal, "faltou o catálogo I18N para validar seus valores");
  const catalogs = Function(`\"use strict\"; return (${literal});`)();
  const serialized = JSON.stringify(catalogs);
  const translate = extractFunction(html, "t");

  assert.ok(translate, "faltou function t(key, values = {})");
  assert.match(translate, /function t\(key, values = \{\}\)/);
  assert.match(translate, /Object\.entries\(values\)/);
  assert.doesNotMatch(translate, /innerHTML/);
  assert.doesNotMatch(serialized, /https?:\/\//i, "URLs devem continuar fora do catálogo");
  assert.doesNotMatch(serialized, /<\s*\/?\s*[a-z][^>]*>/i, "HTML funcional deve continuar fora do catálogo");
  assert.doesNotMatch(serialized, /\b\d{4}\b/, "PINs devem continuar fora do catálogo");
  assert.doesNotMatch(serialized, /\b(?:Safari|Google Chrome|Spotify|Visual Studio Code)\b/i, "nomes de apps devem continuar fora do catálogo");

  const translateText = Function(
    "I18N",
    "currentLanguage",
    `${translate}\nreturn t;`,
  )(catalogs, "pt-BR");
  const malicious = '<img src=x onerror="alert(1)">';
  const translated = translateText("toast.pinAdded", { name: malicious });
  assert.equal(typeof translated, "string");
  assert.match(translated, /<img src=x onerror=/, "o valor deve permanecer texto literal");
  assert.doesNotMatch(translated, /&lt;img/, "t não deve converter o texto para HTML");
});

test("PWA não sombreia o tradutor ao montar cards", () => {
  const buildTile = extractFunction(html, "buildTile");
  assert.ok(buildTile, "faltou function buildTile(a, withIcon)");
  assert.match(buildTile, /const tile = document\.createElement\("div"\)/);
  assert.doesNotMatch(buildTile, /const t = document\.createElement\("div"\)/);
  assert.match(buildTile, /t\("dock\.opened"\)/);
});

test("contrato de i18n preserva marcadores atuais do PWA, OBS e macOS", () => {
  assert.match(html, /id="launchpad"/);
  assert.match(html, /id="launchpadTrack"/);
  assert.match(html, /id="dots"/);
  assert.match(html, /addEventListener\("pointerdown"/);
  assert.match(html, /document\.body\.classList\.contains\("swiping"\)/);
  assert.match(html, /maxPinnedApps/);
  assert.match(html, /PINNED_LIMIT_REACHED/);
  assert.match(html, /pinnedLimitMessage/);
  assert.match(html, /id="drawer"/);
  assert.match(html, /id="obspanel"/);
  assert.match(html, /function confirmStopAll\(\)/);
  assert.match(html, /\/api\/obs\//);

  assert.match(obs, /request\(type, args = \{\}\)/);
  assert.match(obs, /handleMessage\(raw\)/);
  assert.match(obs, /toggleRecord\(\)/);
  assert.match(obs, /GetSceneList/);
  assert.match(obs, /GetRecordStatus/);
  assert.match(obs, /StartRecord/);
  assert.match(obs, /StopRecord/);

  assert.match(dockGrid, /let pageSize = 8/);
  assert.match(dockGrid, /private let pageHeight: CGFloat = 288/);
  assert.match(dockGrid, /private let carouselGap: CGFloat = 24/);
  assert.match(dockGrid, /private let carouselPeekRatio: CGFloat = 0\.55/);
  assert.match(dockGrid, /LazyHStack\(alignment: \.center, spacing: carouselGap\)/);
  assert.match(contentView, /ForEach\(SidebarItem\.allCases, id: \\.self\)/);
  assert.match(contentView, /DokkeTheme\.selection/);
  assert.match(contentView, /ZStack\(alignment: \.topLeading\)/);
  assert.match(contentView, /Image\(systemName: "sidebar\.left"\)/);
});

test("macOS possui LanguageStore persistente e Picker no Conectar", () => {
  assert.match(dokkeApp, /LanguageStore\(/, "DokkeApp precisa criar o LanguageStore");
  assert.match(dokkeApp, /environmentObject\(languageStore\)/, "LanguageStore precisa chegar às views");
  assert.match(contentView, /LanguageStore/);
  assert.match(contentView, /Picker\(/, "Conectar precisa expor o Picker");
  return readFile(new URL("../mac/Sources/LanguageStore.swift", import.meta.url), "utf8")
    .then((languageStore) => {
      assert.match(languageStore, /enum DokkeLanguage: String, CaseIterable, Identifiable/);
      assert.match(languageStore, /case portuguese = "pt-BR"/);
      assert.match(languageStore, /case english = "en"/);
      assert.match(languageStore, /return "Português"/);
      assert.match(languageStore, /return "English"/);
      assert.match(languageStore, /"aria\.language": "Idioma"/);
      assert.match(languageStore, /"aria\.language": "Language"/);
      assert.match(languageStore, /UserDefaults/);
      assert.match(languageStore, /@Published (?:private\(set\) )?var selected/);
    });
});

test("landing e README oferecem os dois idiomas", () => {
  assert.match(docsMain, /const LANDING_LANGUAGE_KEY = "dokke_landing_lang"/);
  assert.match(docsMain, /function detectLandingLanguage\(language = navigator\.language\)/);
  assert.match(docsMain, /localStorage\.getItem\(LANDING_LANGUAGE_KEY\)/);
  assert.match(docsMain, /data-language-toggle/);
  assert.match(docsMain, /document\.documentElement\.lang = landingLanguage/);
  assert.match(docsMain, /["']pt-BR["']/);
  assert.match(docsMain, /["']en["']/);
  assert.match(docsMain, /localStorage\.setItem\(LANDING_LANGUAGE_KEY, landingLanguage\)/);
  assert.match(docsStyle, /@media \(max-width: 760px\)[\s\S]*\.nav-shell \{ grid-template-columns: auto auto;/);
  assert.match(docsStyle, /\.nav-actions \.github-link \{ min-height: 34px; padding: 0 12px; \}/);
  assert.doesNotMatch(docsStyle, /\.nav-actions \.github-link span \{ display: none; \}/);
  assert.ok(readmeEn.length > 0, "README.en.md precisa existir");
  assert.match(readme, /README\.en\.md/);
  assert.match(readmeEn, /README\.md/);
});
