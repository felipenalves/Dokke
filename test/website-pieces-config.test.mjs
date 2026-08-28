import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_PINNED_APPS,
  MAX_PINNED_PIECES,
  createWebsitePiece,
  loadConfig,
  normalizeConfig,
  normalizeWebsiteUrl,
  pinnedLimits,
  saveConfig,
} from "../config.js";

test("@spec:AC-301 URL válida cria uma peça de site normalizada", () => {
  const piece = createWebsitePiece("YouTube", "youtube.com");
  assert.equal(piece.type, "website");
  assert.equal(piece.url, "https://youtube.com/");
  assert.equal(piece.title, "YouTube");
  assert.match(piece.id, /^website:[a-f0-9]{64}$/);
});

test("@spec:AC-302 URL inválida é rejeitada sem peça", () => {
  for (const value of [
    "",
    "not a url",
    "javascript:alert(1)",
    "file:///tmp/secret",
    "https://user:pass@example.com",
    "https://example.com/\nX-Injected: yes",
  ]) {
    assert.throws(() => createWebsitePiece("Site", value), /URL/i, value);
  }
});

test("@spec:AC-303 URL duplicada mantém o mesmo ID determinístico", () => {
  const a = createWebsitePiece("Site", "HTTPS://Example.com");
  const b = createWebsitePiece("Outro título", "https://example.com/");
  assert.equal(a.id, b.id);
  assert.equal(a.url, b.url);
});

test("@spec:AC-304 sugestão e entrada manual usam a mesma normalização", () => {
  const manual = createWebsitePiece(undefined, "youtube.com");
  const suggestion = createWebsitePiece("YouTube", "https://youtube.com/");
  assert.equal(manual.id, suggestion.id);
  assert.equal(manual.url, suggestion.url);
});

test("@spec:AC-305 configuração legada migra para peças de app", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dokke-pieces-config-"));
  const file = join(dir, "config.json");
  try {
    await writeFile(file, JSON.stringify({ pinned: ["Chrome", "Figma"] }));
    const cfg = await loadConfig(file);
    assert.equal(cfg.schemaVersion, 2);
    assert.equal(cfg.revision, 0);
    assert.deepEqual(cfg.pieces, [
      { id: "app:Chrome", type: "app", name: "Chrome" },
      { id: "app:Figma", type: "app", name: "Figma" },
    ]);
    assert.deepEqual(cfg.pinned, ["Chrome", "Figma"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("@spec:AC-306 configuração mista usa pieces como fonte e preserva sites", () => {
  const site = createWebsitePiece("Docs", "https://docs.example.com");
  const cfg = normalizeConfig({
    pinned: ["LegacyApp", "Site que não existe"],
    pieces: [
      { id: "app:Chrome", type: "app", name: "Chrome" },
      site,
    ],
  });
  assert.deepEqual(cfg.pinned, ["Chrome"]);
  assert.deepEqual(cfg.pieces, [
    { id: "app:Chrome", type: "app", name: "Chrome" },
    site,
  ]);
});

test("@spec:AC-307 normalização não reconstrói sites a partir de pinned legado", () => {
  const cfg = normalizeConfig({
    pieces: [{ id: "app:Chrome", type: "app", name: "Chrome" }],
    pinned: ["Chrome", "Site legado"],
  });
  assert.deepEqual(cfg.pinned, ["Chrome"]);
  assert.equal(cfg.pieces.some(piece => piece.type === "website"), false);
});

test("@spec:AC-319 limite anuncia peças totais e mantém alias de apps", () => {
  assert.equal(MAX_PINNED_PIECES, 39);
  assert.equal(MAX_PINNED_APPS, MAX_PINNED_PIECES);
  assert.deepEqual(pinnedLimits(), {
    pageSize: 8,
    maxPages: 5,
    maxPinnedPieces: 39,
    maxPinnedApps: 39,
  });
});

test("URL normalizada rejeita credenciais e preserva o caminho", () => {
  assert.equal(normalizeWebsiteUrl("example.com/docs"), "https://example.com/docs");
  assert.throws(() => normalizeWebsiteUrl("https://a:b@example.com"), /credenciais/i);
});

test("saveConfig grava o formato canônico v2", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dokke-pieces-config-"));
  const file = join(dir, "config.json");
  try {
    await saveConfig(file, { pinned: ["Safari"] });
    const raw = JSON.parse(await readFile(file, "utf8"));
    assert.equal(raw.schemaVersion, 2);
    assert.equal(raw.revision, 0);
    assert.deepEqual(raw.pieces, [{ id: "app:Safari", type: "app", name: "Safari" }]);
    assert.deepEqual(raw.pinned, ["Safari"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
