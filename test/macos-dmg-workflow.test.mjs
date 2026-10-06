import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = async (url) => {
  try {
    return await readFile(url, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
};

const [workflow, releaseWorkflow, updater, website, readme, englishReadme, verifyDmg, smokeServer, packageDmg, mergeArchitectures, packageDmgTests] = await Promise.all([
  readText(new URL("../.github/workflows/macos-dmg.yml", import.meta.url)),
  readText(new URL("../.github/workflows/release-macos.yml", import.meta.url)),
  readText(new URL("../mac/Sources/DokkeUpdateManager.swift", import.meta.url)),
  readText(new URL("../docs/src/main.js", import.meta.url)),
  readText(new URL("../README.md", import.meta.url)),
  readText(new URL("../README.en.md", import.meta.url)),
  readText(new URL("../mac/verify-dmg.sh", import.meta.url)),
  readText(new URL("../mac/smoke-packaged-server.mjs", import.meta.url)),
  readText(new URL("../mac/package-dmg.sh", import.meta.url)),
  readText(new URL("../mac/merge-app-architectures.sh", import.meta.url)),
  readText(new URL("./package-dmg.test.mjs", import.meta.url)),
]);

test("macOS matrix builds native Intel and Apple Silicon targets", () => {
  for (const buildWorkflow of [workflow, releaseWorkflow]) {
    assert.match(buildWorkflow, /runner:\s*macos-26-intel\s*\n\s*target_arch:\s*x86_64/);
    assert.match(buildWorkflow, /runner:\s*macos-26\s*\n\s*target_arch:\s*arm64/);
    assert.match(buildWorkflow, /DOKKE_TARGET_ARCH:\s*\$\{\{\s*matrix\.target_arch\s*\}\}/);
    assert.match(buildWorkflow, /mac\/verify-dmg\.sh/);
  }
});

test("native builds archive app bundles for the universal compatibility package", () => {
  for (const buildWorkflow of [workflow, releaseWorkflow]) {
    assert.match(buildWorkflow, /tar -czf[^\n]*Dokke\.app/);
    assert.match(buildWorkflow, /Dokke-macOS-\$\{\{ matrix\.artifact_suffix \}\}-app\.tar\.gz/);
    assert.match(buildWorkflow, /build-legacy-universal:/);
    const universalJob = buildWorkflow.slice(buildWorkflow.indexOf("build-legacy-universal:"));
    assert.match(universalJob, /run: npm ci/);
    assert.match(universalJob, /\(cd mac\/dist && shasum -a 256 Dokke-macOS\.dmg/);
    assert.doesNotMatch(universalJob, /shasum -a 256 mac\/dist\/Dokke-macOS\.dmg/);
    assert.match(buildWorkflow, /merge-app-architectures\.sh/);
    assert.match(buildWorkflow, /verify-dmg\.sh[^\n]* universal/);
    assert.match(buildWorkflow, /node-version:\s*24\.21\.0/);
  }
});

test("macOS workflow reruns when app, web, server, or adaptive icon inputs change", () => {
  for (const path of [
    "mac/**",
    "assets/branding/dokke-icon/**",
    "server.js",
    "package.json",
    "package-lock.json",
    "public/**",
  ]) {
    assert.ok(workflow.includes(path), `workflow does not watch ${path}`);
  }
});

test("third-party Actions are pinned to immutable commit SHAs", () => {
  const uses = [...`${workflow}\n${releaseWorkflow}`.matchAll(/^\s*uses: (.+)$/gm)].map((match) => match[1]);
  assert.ok(uses.length >= 7, `expected pinned CI and release Actions; found ${uses.length}`);
  for (const action of uses) {
    assert.match(action, /^actions\/[a-z-]+@[a-f0-9]{40} # v\d+\.\d+\.\d+$/);
  }
});

test("native CI has no PR trigger that could run edited workflow permissions", () => {
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(workflow, /contents:\s*write|gh release create|publish-release/);
  assert.match(workflow, /push:/);
  assert.doesNotMatch(workflow, /pull_request(?:_target)?:/);
  assert.match(workflow, /actions\/upload-artifact@/);
});

test("macOS release is manually dispatched from main and validates a main tag", () => {
  assert.match(releaseWorkflow, /workflow_dispatch:/);
  assert.match(releaseWorkflow, /if:\s*github\.ref == 'refs\/heads\/main'/);
  assert.match(releaseWorkflow, /permissions:\n  contents: read/);
  assert.match(releaseWorkflow, /git merge-base --is-ancestor/);
  assert.match(releaseWorkflow, /RELEASE_TAG/);
  assert.match(releaseWorkflow, /package\.json/);
  assert.match(releaseWorkflow, /needs:\s*validate-release/);
  assert.match(releaseWorkflow, /pattern:\s*['"]\*['"]/);
  assert.match(releaseWorkflow, /Dokke-macOS\.dmg/);
  assert.match(releaseWorkflow, /dokke\.apk/);
  assert.match(releaseWorkflow, /dump badging public\/dokke\.apk/);
  assert.match(releaseWorkflow, /keytool -printcert -jarfile/);
  assert.match(releaseWorkflow, /"\$\{apksigner\}" verify --print-certs/);
  assert.match(releaseWorkflow, /\(cd public && shasum -a 256 dokke\.apk > dokke\.apk\.sha256\)/);
  assert.doesNotMatch(releaseWorkflow, /shasum -a 256 public\/dokke\.apk > public\/dokke\.apk\.sha256/);
  assert.match(releaseWorkflow, /previous_version_code/);
  assert.match(releaseWorkflow, /previous_signers/);
  assert.match(releaseWorkflow, /android_version_code/);
  assert.match(releaseWorkflow, /2100000000/);
  assert.match(releaseWorkflow, /latest_apk_version_code/);
  assert.match(releaseWorkflow, /group:\s*dokke-release-publisher/);
  assert.match(releaseWorkflow, /queue:\s*max/);
  assert.match(releaseWorkflow, /EXPECTED_SHA/);
  assert.match(releaseWorkflow, /android\/app\/build\.gradle/);
  assert.match(releaseWorkflow, /public\/version\.json/);
  assert.match(releaseWorkflow, /refs\/tags\/\$\{RELEASE_TAG\}/);
  assert.match(releaseWorkflow, /permissions:\n\s+contents:\s*write/);
  assert.match(releaseWorkflow, /gh release create/);
  assert.doesNotMatch(releaseWorkflow, /pull_request:/);
});

test("release workflow invokes the resolved apksigner binary for every signer check", () => {
  const commands = releaseWorkflow
    .split("\n")
    .filter((line) => /apksigner.*verify --print-certs/.test(line));

  assert.equal(commands.length, 4, "expected current and previous APK checks in both release jobs");
  for (const command of commands) {
    assert.match(command, /"\$\{apksigner\}" verify --print-certs/);
  }
});

test("release signer checks preserve apksigner failure status before parsing certificate digests", () => {
  const commands = releaseWorkflow
    .split("\n")
    .filter((line) => /apksigner.*verify --print-certs/.test(line));

  assert.equal(commands.length, 4, "expected current and previous APK checks in both release jobs");
  for (const command of commands) {
    assert.match(command, /_signer_output="\$\("\$\{apksigner\}" verify --print-certs/);
  }
});

test("release signer parser accepts legacy and SDK-ranged signer labels", () => {
  const signerParsers = [...releaseWorkflow.matchAll(/sed -nE '([^']*SHA-256 digest[^']*)'/g)]
    .map(([, pattern]) => pattern);
  const certificateDigest = "0123456789abcdef".repeat(4);
  const signerLines = [
    `Signer #1 certificate SHA-256 digest: ${certificateDigest}`,
    `Signer (minSdkVersion=24, maxSdkVersion=32) certificate SHA-256 digest: ${certificateDigest}`,
  ];

  assert.equal(signerParsers.length, 4, "expected all current and previous signer parsers");
  for (const pattern of signerParsers) {
    for (const signerLine of signerLines) {
      const result = spawnSync("sed", ["-nE", pattern], {
        input: `${signerLine}\n`,
        encoding: "utf8",
      });
      assert.equal(result.status, 0);
      assert.equal(result.stdout, `${certificateDigest}\n`, `failed to parse: ${signerLine}`);
    }
  }
});

test("release workflow audits npm dependencies before tests and packaging", () => {
  const installDependencies = releaseWorkflow.indexOf("run: npm ci");
  const auditDependencies = releaseWorkflow.indexOf("run: npm audit --audit-level=high");
  const runTests = releaseWorkflow.indexOf("run: npm test");
  assert.ok(installDependencies >= 0, "dependency installation step is missing");
  assert.ok(auditDependencies > installDependencies, "dependency audit must follow npm ci");
  assert.ok(runTests > auditDependencies, "dependency audit must finish before tests and packaging");
});

test("Mac download entry points direct users to the Intel or Apple Silicon package", () => {
  assert.match(website, /releases\/latest/);
  assert.doesNotMatch(website, /releases\/latest\/download\/Dokke-macOS\.dmg/);
  for (const content of [readme, englishReadme]) {
    assert.match(content, /releases\/latest/);
    assert.match(content, /Dokke-macOS-intel-x86_64\.dmg/);
    assert.match(content, /Dokke-macOS-apple-silicon-arm64\.dmg/);
    assert.doesNotMatch(content, /releases\/latest\/download\/Dokke-macOS\.dmg/);
  }
});

test("updater selects the DMG matching the running app and supports legacy releases", () => {
  assert.match(updater, /#if arch\(arm64\)[\s\S]*Dokke-macOS-apple-silicon-arm64\.dmg/);
  assert.match(updater, /#elseif arch\(x86_64\)[\s\S]*Dokke-macOS-intel-x86_64\.dmg/);
  assert.match(updater, /architectureSpecificDMGAssetName/);
  const architectureAssetIndex = updater.indexOf("$0.name == Self.architectureSpecificDMGAssetName");
  const legacyAssetIndex = updater.indexOf('$0.name == "Dokke-macOS.dmg"');
  assert.ok(architectureAssetIndex >= 0, "architecture-specific asset lookup is missing");
  assert.ok(legacyAssetIndex > architectureAssetIndex, "legacy package must only be a fallback");
});

test("DMG is verified and its bundled app passes smoke checks before artifact upload", () => {
  const verifyStep = workflow.indexOf("mac/verify-dmg.sh");
  const uploadStep = workflow.indexOf("actions/upload-artifact@");
  assert.ok(verifyStep >= 0, "DMG verification step is missing");
  assert.ok(uploadStep > verifyStep, "artifact upload must follow DMG verification");
  assert.match(verifyDmg, /hdiutil verify/);
  assert.match(verifyDmg, /hdiutil attach[^\n]*-readonly/);
  assert.match(verifyDmg, /shasum -a 256 -c/);
  assert.match(verifyDmg, /lipo -archs/);
  assert.match(verifyDmg, /node-bin\/node/);
  assert.match(verifyDmg, /smoke-packaged-server\.mjs/);
  assert.match(verifyDmg, /universal/);
  assert.match(verifyDmg, /DOKKE_SKIP_RUNTIME_SMOKE/);
  assert.doesNotMatch(`${workflow}\n${releaseWorkflow}`, /DOKKE_SKIP_RUNTIME_SMOKE/);
  assert.match(mergeArchitectures, /lipo -create/);
  assert.match(mergeArchitectures, /lipo "\$\{temporary_binary\}" -verify_arch x86_64/);
  assert.match(mergeArchitectures, /lipo "\$\{temporary_binary\}" -verify_arch arm64/);
  assert.match(mergeArchitectures, /MAX_UNIVERSAL_BUNDLE_MB=256/);
  assert.match(mergeArchitectures, /codesign --verify --deep --strict/);
  assert.match(packageDmg, /DOKKE_APP_BUNDLE/);
  assert.match(packageDmg, /-size 300m/);
});

test("macOS matrix installs the Playwright browser before running the full suite", () => {
  const installBrowser = workflow.indexOf("npx playwright install chromium");
  const runTests = workflow.indexOf("run: npm test");
  assert.ok(installBrowser >= 0, "Chromium installation step is missing");
  assert.ok(runTests > installBrowser, "Playwright browser must be installed before npm test");
});

test("macOS workflows inspect the built DMG after the general test suite", () => {
  for (const buildWorkflow of [workflow, releaseWorkflow]) {
    const generalTests = buildWorkflow.indexOf("- name: Run project tests");
    const buildDmg = buildWorkflow.indexOf("run: ./mac/package-dmg.sh", generalTests);
    const layoutTestStep = buildWorkflow.indexOf("- name: Test architecture-specific DMG layout", buildDmg);
    const layoutTests = buildWorkflow.indexOf("node --test test/package-dmg.test.mjs", layoutTestStep);
    const verifyDmgStep = buildWorkflow.indexOf("mac/verify-dmg.sh", layoutTests);

    assert.ok(generalTests >= 0, "general project test step is missing");
    assert.ok(buildDmg > generalTests, "DMG build must follow the general suite");
    assert.ok(layoutTestStep > buildDmg, "DMG layout assertions must inspect the built artifact afterwards");
    assert.ok(layoutTests > layoutTestStep, "the layout test command is missing");
    assert.ok(verifyDmgStep > layoutTests, "artifact verification must follow layout assertions");

    const generalTestBlock = buildWorkflow.slice(generalTests, buildDmg);
    const layoutTestBlock = buildWorkflow.slice(layoutTestStep, verifyDmgStep);
    assert.match(generalTestBlock, /DOKKE_SKIP_DMG_FIXTURE/);
    assert.match(generalTestBlock, /run: npm test -- --test-concurrency=1/);
    assert.match(layoutTestBlock, /DOKKE_DMG_FIXTURE/);
  }

  assert.match(packageDmgTests, /DOKKE_SKIP_DMG_FIXTURE/);
  assert.match(packageDmgTests, /DOKKE_DMG_FIXTURE/);
});

test("packaged server smoke starts the embedded server and checks the Dokke health response", () => {
  assert.match(smokeServer, /startServer\(/);
  assert.match(smokeServer, /\/health/);
  assert.match(smokeServer, /service:\s*["']Dokke["']/);
  assert.match(smokeServer, /await server\.close\(\)/);
});
