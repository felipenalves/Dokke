import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contentView = await readFile(new URL("../mac/Sources/ContentView.swift", import.meta.url), "utf8");
const app = await readFile(new URL("../mac/Sources/DokkeApp.swift", import.meta.url), "utf8");

const about = contentView.slice(
  contentView.indexOf("struct AboutView"),
  contentView.indexOf("private struct QRCodeView")
);
const menuBar = contentView.slice(contentView.indexOf("struct MenuBarView"));

test("tela de conexão prioriza o código e esconde configuração técnica", () => {
  assert.match(contentView, /case about = "Conectar"/);
  assert.match(contentView, /private let aboutContentMaxWidth: CGFloat = 980/);
  assert.match(about, /\.frame\(maxWidth: aboutContentMaxWidth, alignment: \.leading\)/);
  assert.match(about, /\.frame\(maxWidth: \.infinity, alignment: \.center\)/);
  assert.match(about, /AccessCodeView/);
  assert.equal(about.includes('TextField("http://127.0.0.1:3000"'), false);
  assert.doesNotMatch(contentView.slice(0, contentView.indexOf("struct AboutView")), /UpdateBanner/);
});

test("menu bar abre o Dokke, sincroniza dados e expõe atualização somente quando necessário", () => {
  assert.match(app, /WindowGroup\("Dokke", id: "main"\)/);
  assert.match(menuBar, /@EnvironmentObject private var updater: DokkeUpdateManager/);
  assert.match(menuBar, /openWindow\(id: "main"\)/);
  assert.match(menuBar, /Sincronizar agora/);
  assert.match(menuBar, /Verificar atualizações/);
});
