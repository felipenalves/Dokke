import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [packageJson, packageLock, publicVersion, androidGradle, macPlist, serverManager, contentView, changelog] = await Promise.all([
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
  readFile(new URL("../public/version.json", import.meta.url), "utf8"),
  readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
  readFile(new URL("../mac/Info.plist", import.meta.url), "utf8"),
  readFile(new URL("../mac/Sources/ServerManager.swift", import.meta.url), "utf8"),
  readFile(new URL("../mac/Sources/ContentView.swift", import.meta.url), "utf8"),
  readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8"),
]);

test("todos os metadados apontam para o candidato v0.2.9", () => {
  assert.equal(JSON.parse(packageJson).version, "0.2.9");
  assert.equal(JSON.parse(packageLock).version, "0.2.9");
  assert.equal(JSON.parse(packageLock).packages[""].version, "0.2.9");
  assert.deepEqual(JSON.parse(publicVersion), { tag: "v0.2.9", apkVersion: "0.2.9" });
  assert.match(androidGradle, /versionCode = 12/);
  assert.match(androidGradle, /versionName = "0\.2\.9"/);
  assert.match(macPlist, /<key>CFBundleShortVersionString<\/key>\s*<string>0\.2\.9<\/string>/);
  assert.match(macPlist, /<key>CFBundleVersion<\/key>\s*<string>11<\/string>/);
  assert.match(serverManager, /packageVersionFallback = "0\.2\.9"/);
  assert.match(contentView, /\?\? "0\.2\.9"/);
  assert.match(changelog, /^## v0\.2\.9 — em preparação/m);
});
