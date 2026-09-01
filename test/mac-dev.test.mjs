import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("modo mac:dev executa o SwiftUI a partir do código-fonte sem empacotar dist", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const script = await readFile(new URL("../mac/dev.sh", import.meta.url), "utf8");

  assert.equal(packageJson.scripts["mac:dev"], "bash mac/dev.sh");
  assert.match(script, /ROOT=.*dirname/);
  assert.match(script, /cd "\$\{ROOT\}"/);
  assert.match(script, /swift run --package-path mac Dokke/);
  assert.doesNotMatch(script, /install\.sh|dist/);
});
