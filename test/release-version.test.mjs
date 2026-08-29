import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [packageJson, publicVersion, androidGradle, macPlist, changelog] = await Promise.all([
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../public/version.json", import.meta.url), "utf8"),
  readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
  readFile(new URL("../mac/Info.plist", import.meta.url), "utf8"),
  readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8"),
]);

test("todos os metadados apontam para a release v0.2.8", () => {
  assert.equal(JSON.parse(packageJson).version, "0.2.8");
  assert.deepEqual(JSON.parse(publicVersion), { tag: "v0.2.8", apkVersion: "0.2.8" });
  assert.match(androidGradle, /versionCode = 11/);
  assert.match(androidGradle, /versionName = "0\.2\.8"/);
  assert.match(macPlist, /<key>CFBundleShortVersionString<\/key>\s*<string>0\.2\.8<\/string>/);
  assert.match(macPlist, /<key>CFBundleVersion<\/key>\s*<string>10<\/string>/);
  assert.match(changelog, /^## v0\.2\.8\b/m);
});
