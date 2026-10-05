import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(projectRoot, "mac", "copy-public-assets.sh");
const expectedAssets = [
  "dokke.apk",
  "icon-192-dark.png",
  "icon-192.png",
  "icon-512.png",
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "version.json",
  "fonts/Inter-Regular.otf",
  "fonts/Inter-SemiBold.otf",
];

test("bundle do servidor Mac copia fontes aninhadas e exclui arquivos fora da allowlist", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dokke-public-assets-"));
  const source = path.join(root, "source");
  const destination = path.join(root, "bundle", "public");
  try {
    for (const asset of [...expectedAssets, "local-backup.bak"]) {
      const sourcePath = path.join(source, asset);
      await mkdir(path.dirname(sourcePath), { recursive: true });
      await writeFile(sourcePath, `asset:${asset}`);
    }

    const result = spawnSync("bash", [scriptPath, source, destination], { encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual((await readdir(destination)).sort(), [
      "dokke.apk",
      "fonts",
      "icon-192-dark.png",
      "icon-192.png",
      "icon-512.png",
      "index.html",
      "manifest.webmanifest",
      "sw.js",
      "version.json",
    ]);
    for (const asset of expectedAssets) {
      assert.equal(await readFile(path.join(destination, asset), "utf8"), `asset:${asset}`);
    }
    assert.deepEqual((await readdir(path.join(destination, "fonts"))).sort(), [
      "Inter-Regular.otf",
      "Inter-SemiBold.otf",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
