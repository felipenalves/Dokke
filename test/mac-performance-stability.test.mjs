import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dockStore = await readFile(new URL("../mac/Sources/DockStore.swift", import.meta.url), "utf8");
const dockIcon = await readFile(new URL("../mac/Sources/DockIcon.swift", import.meta.url), "utf8");
const installScript = await readFile(new URL("../mac/install.sh", import.meta.url), "utf8");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const existingBundle = path.join(projectRoot, "mac", "dist", "Dokke.app");

test("@spec:AC-338 status idêntico não republica nem recarrega ícones", () => {
  const pingStatus = dockStore.slice(
    dockStore.indexOf("func pingStatus() async"),
    dockStore.indexOf("private func pingHealthOnly"),
  );
  assert.match(pingStatus, /if online != true \{ online = true \}/);
  assert.match(pingStatus, /if lastError != nil \{ lastError = nil \}/);
  assert.match(pingStatus, /if let nextDevices, devices != nextDevices \{ devices = nextDevices \}/);
  assert.match(pingStatus, /let pinnedChanged = pinned != p/);
  assert.match(pingStatus, /if pinnedChanged \{[\s\S]*preloadIcons\(\)/);
});

test("@spec:AC-339 mudança real publica apenas os campos alterados", () => {
  assert.match(dockStore, /if maxPinnedApps != max \{ maxPinnedApps = max \}/);
  const loadConfig = dockStore.slice(
    dockStore.indexOf("func loadConfig() async"),
    dockStore.indexOf("func loadInstalled() async"),
  );
  assert.match(loadConfig, /if pinned != p \{\s*pinned = p/s);
  const loadInstalled = dockStore.slice(
    dockStore.indexOf("func loadInstalled() async"),
    dockStore.indexOf("func togglePin"),
  );
  assert.match(loadInstalled, /let nextInstalled(?:: \[InstalledApp\])? = apps\.compactMap/);
  assert.match(loadInstalled, /if installed != nextInstalled \{[\s\S]*preloadIcons\(\)/);
});

test("@spec:AC-340 refresh periódico do hover ignora cursor e layout estáveis", () => {
  assert.match(dockIcon, /private var needsRefresh = true/);
  assert.match(dockIcon, /private var lastMouseLocation: NSPoint\?/);
  assert.match(dockIcon, /guard force \|\| needsRefresh \|\| cursor != lastMouseLocation else \{ return \}/);
});

test("@spec:AC-341 último tracker desmonta timer e monitor global", () => {
  const coordinator = dockIcon.slice(
    dockIcon.indexOf("private final class DockHoverCoordinator"),
    dockIcon.indexOf("private struct JiggleModifier"),
  );
  assert.match(coordinator, /func unregister[\s\S]*views\.isEmpty[\s\S]*stopIfNeeded\(\)/);
  assert.match(coordinator, /NSEvent\.removeMonitor\(monitor\)/);
  assert.match(coordinator, /refreshTimer\?\.invalidate\(\)/);
});

test("@spec:AC-342 scroll, drag e layout marcam refresh forçado", () => {
  assert.match(dockIcon, /refreshAll\(force: event\.type != \.mouseMoved\)/);
  assert.match(dockIcon, /func invalidateLayout\(\)[\s\S]*refreshAll\(force: true\)/);
  const tracker = dockIcon.slice(
    dockIcon.indexOf("final class TrackingView"),
    dockIcon.indexOf("private final class DockHoverCoordinator"),
  );
  assert.match(tracker, /override func updateTrackingAreas\(\)[\s\S]*DockHoverCoordinator\.shared\.invalidateLayout\(\)/);
});

test("@spec:AC-343 instalador limita o Release a 121 MB com um runtime Node", () => {
  assert.match(installScript, /MAX_BUNDLE_SIZE_MB=121/);
  assert.match(installScript, /validate_bundle_budget\(\) \{/);
  assert.match(installScript, /node-bin\/node/);
  assert.match(installScript, /node_count.*-ne 1/);
  assert.match(installScript, /bundle_kib="\$\(du -sk/);
  assert.match(installScript, /max_bundle_kib="\$\(\(MAX_BUNDLE_SIZE_MB \* 1024\)\)"/);
  assert.match(installScript, /--verify-bundle=/);
});

test("@spec:AC-343 mede o bundle Release existente pelo instalador", {
  skip: !existsSync(existingBundle) && "mac/dist/Dokke.app ainda não foi produzido por --build-only",
}, () => {
  const result = spawnSync(
    "bash",
    [path.join(projectRoot, "mac", "install.sh"), `--verify-bundle=${existingBundle}`],
    { cwd: projectRoot, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /bundle budget OK \(\d+ KiB <= 121 MiB; one Node runtime\)/);
});
