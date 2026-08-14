import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contentView = await readFile(new URL("../mac/Sources/ContentView.swift", import.meta.url), "utf8");
const app = await readFile(new URL("../mac/Sources/DokkeApp.swift", import.meta.url), "utf8");
const theme = await readFile(new URL("../mac/Sources/DokkeTheme.swift", import.meta.url), "utf8");

const about = contentView.slice(
  contentView.indexOf("struct AboutView"),
  contentView.indexOf("private struct QRCodeView")
);
const sidebar = contentView.slice(
  contentView.indexOf("private var sidebar"),
  contentView.indexOf("private var detail")
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

test("janela principal abre menor por padrão sem reduzir os tamanhos mínimos", () => {
  assert.match(app, /\.frame\(minWidth: 840, idealWidth: 980, minHeight: 540, idealHeight: 628\)/);
  assert.match(app, /\.defaultSize\(width: 980, height: 628\)/);
});

test("sidebar replica largura, seleção azul opaca e contraste da referência", () => {
  assert.match(sidebar, /\.navigationSplitViewColumnWidth\(min: 180, ideal: 200, max: 216\)/);
  assert.match(sidebar, /\.padding\(\.horizontal, 14\)/);
  assert.match(sidebar, /\.padding\(\.top, 0\)/);
  assert.match(contentView, /\.foregroundStyle\(selection == item \? Color\.white : Color\.white\.opacity\(0\.58\)\)/);
  assert.match(contentView, /\.background\(selection == item \? DokkeTheme\.selection : \.clear\)/);
  assert.match(contentView, /case about = "Conectar"/);
});

test("paleta usa canvas, página e seleção próximas da captura", () => {
  const colors = {
    canvas: [0.161, 0.129, 0.125],
    page: [0.106, 0.067, 0.027],
    selection: [0.039, 0.388, 0.851],
  };

  for (const [name, expected] of Object.entries(colors)) {
    const match = theme.match(
      new RegExp(`static let ${name} = Color\\(red: ([\\d.]+), green: ([\\d.]+), blue: ([\\d.]+)\\)`),
    );
    assert.ok(match, `${name} deve usar RGB explícito`);
    const actual = match.slice(1).map(Number);
    actual.forEach((value, index) => {
      assert.ok(Math.abs(value - expected[index]) <= 0.002, `${name} componente ${index} fora do contrato`);
    });
  }
});

test("menu bar abre o Dokke, sincroniza dados e expõe atualização somente quando necessário", () => {
  assert.match(app, /WindowGroup\("Dokke", id: "main"\)/);
  assert.match(menuBar, /@EnvironmentObject private var updater: DokkeUpdateManager/);
  assert.match(menuBar, /openWindow\(id: "main"\)/);
  assert.match(menuBar, /Sincronizar agora/);
  assert.match(menuBar, /Verificar atualizações/);
});

test("cards de código e QR compartilham largura total, padding, raio e espaçamento idênticos", () => {
  const codeCard = about.slice(
    about.indexOf("VStack(spacing: 16)"),
    about.lastIndexOf("VStack(alignment: .leading, spacing: 16)")
  );
  const qrCard = about.slice(
    about.lastIndexOf("VStack(alignment: .leading, spacing: 16)"),
    about.indexOf("Servidor online")
  );
  const accessCodeView = about.slice(about.indexOf("private struct AccessCodeView"));

  assert.match(codeCard, /VStack\(spacing: 16\)/);
  assert.doesNotMatch(codeCard, /VStack\(alignment: \.leading/);
  assert.match(codeCard, /\.frame\(maxWidth: \.infinity\)\s*\.padding\(16\)/);
  assert.match(codeCard, /cornerRadius: 16/);
  assert.doesNotMatch(codeCard, /\.padding\(22\)/);
  assert.match(qrCard, /VStack\(alignment: \.leading, spacing: 16\)/);
  assert.match(qrCard, /\.frame\(maxWidth: \.infinity, alignment: \.leading\)\s*\.padding\(16\)/);
  assert.match(qrCard, /cornerRadius: 16/);
  assert.doesNotMatch(qrCard, /cornerRadius: 12/);
  assert.doesNotMatch(qrCard, /\.frame\(maxWidth: \.infinity\)\s*\n\s*Text\("O Mac e o dispositivo/);
  assert.match(accessCodeView, /VStack\(spacing: 14\)/);
  assert.match(accessCodeView, /\.frame\(maxWidth: \.infinity\)/);
  assert.match(accessCodeView, /\.frame\(width: 64, height: 76\)/);
});
