import test from "node:test";
import assert from "node:assert/strict";
import { createShortcutPiece, normalizeConfig, normalizePiece } from "../config.js";

test("atalho preserva o nome e recebe ID estável", () => {
  const first = createShortcutPiece("  Revisar proposta ✓  ");
  const second = createShortcutPiece("Revisar proposta ✓");

  assert.deepEqual(first, {
    id: second.id,
    type: "shortcut",
    name: "Revisar proposta ✓",
    emoji: "🖱️",
  });
  assert.match(first.id, /^shortcut:[a-f0-9]{64}$/);
  assert.deepEqual(normalizePiece(first), first);
});

test("emoji escolhido fica salvo sem mudar a identidade do atalho", () => {
  const first = createShortcutPiece("Criar nota", "📝");
  const renamedEmoji = createShortcutPiece("Criar nota", "📒");

  assert.equal(first.id, renamedEmoji.id);
  assert.equal(first.emoji, "📝");
  assert.equal(normalizePiece(first).emoji, "📝");
});

test("atalhos antigos recebem um emoji padrão e emoji inválido é rejeitado", () => {
  const legacy = normalizePiece({ type: "shortcut", name: "Abrir agenda" });
  assert.equal(legacy.emoji, "🖱️");
  assert.equal(createShortcutPiece("Marcar item", "1️⃣").emoji, "1️⃣");
  assert.throws(() => createShortcutPiece("Abrir agenda", "1"), /emoji/i);

  for (const emoji of ["", "  ", "AB", "x", "\u0000"]) {
    assert.throws(() => createShortcutPiece("Abrir agenda", emoji), /emoji/i);
  }
});

test("configuração mantém atalhos como peças e não os projeta em pinned de apps", () => {
  const shortcut = createShortcutPiece("Criar nota");
  const config = normalizeConfig({
    pieces: [
      { type: "app", name: "Safari" },
      shortcut,
    ],
  });

  assert.deepEqual(config.pieces.map(piece => piece.type), ["app", "shortcut"]);
  assert.deepEqual(config.pinned, ["Safari"]);
});

test("nome de atalho vazio, longo ou com controle é rejeitado", () => {
  for (const name of ["", "  ", "linha\nquebrada", "x".repeat(257), null]) {
    assert.throws(() => createShortcutPiece(name), /atalho/i);
  }
});
