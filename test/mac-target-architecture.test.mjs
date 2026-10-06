import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [installScript, packageScript] = await Promise.all([
  readFile(new URL("../mac/install.sh", import.meta.url), "utf8"),
  readFile(new URL("../mac/package-dmg.sh", import.meta.url), "utf8"),
]);
const nodeDependencyVerifier = installScript.match(/^verify_node_dependencies\(\) \{[\s\S]*?^\}/m)?.[0];

function runNodeDependencyVerifier(otoolOutput) {
  const script = [
    nodeDependencyVerifier,
    "otool() {",
    "  cat <<'OTOOLOUT'",
    otoolOutput,
    "OTOOLOUT",
    "}",
    "verify_node_dependencies /fixture/node",
  ].join("\n");
  return spawnSync("bash", ["-c", script], { encoding: "utf8" });
}

test("macOS builder selects an explicit arm64 or x86_64 Swift target", () => {
  assert.match(installScript, /DOKKE_TARGET_ARCH/);
  assert.match(installScript, /arm64-apple-macosx14\.0/);
  assert.match(installScript, /x86_64-apple-macosx14\.0/);
  assert.match(installScript, /--triple/);
});

test("macOS bundle rejects an embedded Node runtime without the requested architecture", () => {
  assert.match(installScript, /lipo -archs/);
  assert.match(installScript, /node-bin\/node/);
  assert.match(installScript, /TARGET_ARCH/);
});

test("macOS candidate builds can be staged outside the shared default dist", () => {
  assert.match(installScript, /DOKKE_DIST_DIR/);
  assert.match(packageScript, /DOKKE_DIST_DIR/);
});

test("architecture-specific DMGs use separate names inside the selected dist", () => {
  assert.match(packageScript, /arm64\) OUTPUT="\$\{DIST_DIR\}\/Dokke-macOS-apple-silicon-arm64\.dmg"/);
  assert.match(packageScript, /x86_64\) OUTPUT="\$\{DIST_DIR\}\/Dokke-macOS-intel-x86_64\.dmg"/);
});

test("cross-architecture builds explain how to supply a matching Node runtime", () => {
  assert.match(installScript, /compatível com \$\{TARGET_ARCH\}.*DOKKE_NODE/);
});

test("embedded Node rejects non-system dynamic library dependencies", () => {
  assert.match(installScript, /\/System\/Library\/\*\|\/usr\/lib\/\*/);
});

test("dependency verifier accepts a universal Node with system libraries in both slices", () => {
  assert.ok(nodeDependencyVerifier, "Node dependency verifier is defined");
  const result = runNodeDependencyVerifier(`/fixture/node (architecture arm64):
\t/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation (compatibility version 150.0.0, current version 3038.1.255)
\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1351.0.0)
/fixture/node (architecture x86_64):
\t/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation (compatibility version 150.0.0, current version 3038.1.255)
\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1351.0.0)`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("dependency verifier rejects a custom library in any Node slice", () => {
  assert.ok(nodeDependencyVerifier, "Node dependency verifier is defined");
  const result = runNodeDependencyVerifier(`/fixture/node (architecture arm64):
\t/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation (compatibility version 150.0.0, current version 3038.1.255)
/fixture/node (architecture x86_64):
\t/opt/custom/libexample.dylib (compatibility version 1.0.0, current version 1.0.0)`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fora do sistema/);
});

test("dependency verifier rejects parent traversal from a system library directory", () => {
  assert.ok(nodeDependencyVerifier, "Node dependency verifier is defined");
  const result = runNodeDependencyVerifier(`/fixture/node:
\t/usr/lib/../../tmp/libexample.dylib (compatibility version 1.0.0, current version 1.0.0)`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fora do sistema/);
});
