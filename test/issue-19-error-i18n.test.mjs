import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, server, android, androidLanguage, dockStore, languageStore] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../server.js", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/com/dokke/app/MainActivity.kt", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/com/dokke/app/AndroidLanguage.kt", import.meta.url), "utf8"),
  readFile(new URL("../mac/Sources/DockStore.swift", import.meta.url), "utf8"),
  readFile(new URL("../mac/Sources/LanguageStore.swift", import.meta.url), "utf8"),
]);

const ERROR_CODES = [
  "PINNED_LIMIT_REACHED",
  "REVISION_CONFLICT",
  "MIXED_PIECES_REQUIRES_NEW_CLIENT",
  "INVALID_PIECE_POSITION",
  "PIECE_SLOT_OCCUPIED",
  "INVALID_WEBSITE",
  "PIECE_NOT_WEBSITE",
  "PIECE_NOT_FOUND",
  "INVALID_REQUEST",
];

test("PWA localiza erros da API por código e não exibe error cru do servidor", () => {
  assert.match(html, /function serverErrorMessage\(data, fallbackKey, values = \{\}\)/);
  assert.match(html, /serverErrorMessage\(r\.data, "toast\.pinFailed"/);
  assert.doesNotMatch(html, /r\.data\.error/);
  for (const code of ERROR_CODES) {
    assert.match(html, new RegExp(`error\\.${code}`), `faltou a mensagem PWA para ${code}`);
  }
});

test("servidor publica códigos estáveis para os erros apresentados aos clientes", () => {
  for (const code of ERROR_CODES) {
    if (code === "PINNED_LIMIT_REACHED") {
      assert.match(server, /PINNED_LIMIT_CODE/, "faltou o código estável do limite no servidor");
    } else if (code === "PIECE_SLOT_OCCUPIED") {
      assert.match(server, /err\.code = ["']PIECE_SLOT_OCCUPIED["']/,
        "faltou o código estável de slot ocupado no servidor");
    } else {
      assert.match(server, new RegExp(`code: ["']${code}["']`), `faltou o código ${code} no servidor`);
    }
  }
});

test("Android usa catálogo próprio para todas as mensagens nativas visíveis", () => {
  assert.match(androidLanguage, /object AndroidLanguage/);
  assert.match(androidLanguage, /Locale/);
  assert.match(androidLanguage, /"update\.downloadTitle"/);
  assert.match(androidLanguage, /"offline\.title"/);
  assert.match(android, /AndroidLanguage\.text\(/);
  assert.doesNotMatch(android, /showUpdateMessage\("/);
  assert.doesNotMatch(android, /\.setTitle\("/);
  assert.doesNotMatch(android, /\.setMessage\("/);
});

test("macOS converte códigos da API em mensagens do catálogo selecionado", () => {
  for (const code of ERROR_CODES) {
    assert.match(languageStore, new RegExp(`error\\.${code}`), `faltou a mensagem macOS para ${code}`);
  }
  assert.match(dockStore, /func localizedServerError/);
  assert.match(dockStore, /I18n\.text\(/);
  assert.doesNotMatch(dockStore, /\["error"\] as\? String/);
  assert.doesNotMatch(dockStore, /lastError = error\.localizedDescription/);
});
