import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const helperPath = fileURLToPath(new URL("../mac/IconHelper/main.swift", import.meta.url));
const appsPath = fileURLToPath(new URL("../apps.js", import.meta.url));
const packagePath = fileURLToPath(new URL("../mac/Package.swift", import.meta.url));
const installPath = fileURLToPath(new URL("../mac/install.sh", import.meta.url));
const infoPath = fileURLToPath(new URL("../mac/IconHelper/Info.plist", import.meta.url));

test("helper macOS resolve o ícone do bundle pelo AppKit e grava PNG", () => {
  assert.equal(existsSync(helperPath), true, "helper nativo deve existir");
  const source = readFileSync(helperPath, "utf8");
  assert.match(source, /import AppKit/);
  assert.match(source, /NSWorkspace\.shared\.icon\(forFile:/);
  assert.match(source, /NSBitmapImageRep/);
  assert.match(source, /bitmap\.representation\(using: NSBitmapImageRep\.FileType\.png/);
  assert.match(source, /NSApplication\.shared/);
  assert.match(source, /effectiveAppearance/);
  assert.match(source, /performAsCurrentDrawingAppearance/);
  assert.doesNotMatch(source, /dokke-helper-debug/);
  const info = readFileSync(infoPath, "utf8");
  assert.match(info, /NSPrincipalClass/);
  assert.match(info, /NSApplication/);
  assert.match(info, /LSMinimumSystemVersion/);
});

test("helper resolve symlink do bundle antes de pedir o ícone ao AppKit", () => {
  const source = readFileSync(helperPath, "utf8");
  assert.match(
    source,
    /let iconPath = URL\(fileURLWithPath: appPath\)\.resolvingSymlinksInPath\(\)\.path/,
    "Safari e outros apps expostos pelo Cryptex não devem receber badge de alias"
  );
  assert.match(source, /NSWorkspace\.shared\.icon\(forFile: iconPath\)/);
  assert.doesNotMatch(source, /NSWorkspace\.shared\.icon\(forFile: appPath\)/);
});

test("server e instalador empacotam o helper nativo sem mudar o endpoint", () => {
  const apps = readFileSync(appsPath, "utf8");
  const packageSwift = readFileSync(packagePath, "utf8");
  const install = readFileSync(installPath, "utf8");
  assert.match(apps, /DokkeIconHelper/);
  assert.match(apps, /iconHelper/);
  assert.match(packageSwift, /executable\(name: "DokkeIconHelper", targets: \["DokkeIconHelper"\]\)/);
  assert.match(install, /swift build -c debug --product "DokkeIconHelper"/);
  assert.match(install, /SRV_DIR="\$\{APP_BUNDLE\}\/Contents\/Resources\/Dokke"/);
  assert.match(install, /ICON_HELPER_APP="\$\{SRV_DIR\}\/bin\/DokkeIconHelper\.app"/);
  assert.match(install, /Contents\/MacOS.*Contents\/Resources/);
  assert.match(install, /Contents\/MacOS\/DokkeIconHelper/);
});
