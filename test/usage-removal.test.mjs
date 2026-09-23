import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PWA não contém tela nem chamadas da área Uso", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /id=["']screenUsage["']/);
  assert.doesNotMatch(html, /is-usage|screenUsage/);
  assert.doesNotMatch(html, /\/api\/usage(?:\/|["'`])/);
});
