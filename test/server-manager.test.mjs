import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mac/Sources/ServerManager.swift", import.meta.url), "utf8");

test("ServerManager preserva contexto de cada tentativa de inicialização", () => {
  assert.match(source, /private static let logPath = "\/tmp\/dokke-server\.log"/);
  assert.match(source, /seekToEndOfFile\(\)/, "o log não deve recomeçar no offset zero a cada restart");
  assert.match(source, /\[startup\]/, "o log deve marcar cada tentativa de subida");
  assert.match(source, /\[startup-error\]/, "falha de Process.run deve chegar ao log");
  assert.match(source, /\[exit\]/, "encerramento inesperado deve chegar ao log");
});
