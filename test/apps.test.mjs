import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalAppNameFromBundlePath, listApps, scanAppsDirs } from "../apps.js";

test("listApps parseia saída real do lsappinfo", () => {
  const fake = ` 3) "Finder" ASN:0x0-0x3003:
    bundleID="com.apple.finder"
    executable path="/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder"
    pid = 628 type="Foreground" flavor=1 Version="15.0" Arch=ARM64
    coalition: 768
 1) "loginwindow" ASN:0x0-0x1001:
    bundleID="com.apple.loginwindow"
    bundle path="/System/Library/CoreServices/loginwindow.app"
    executable path="/System/Library/CoreServices/loginwindow.app/Contents/MacOS/loginwindow"
    pid = 410 type="UIElement" flavor=3 Version="3085.5.3" fileType="APPL" creator="lgnw" Arch=ARM64
    childASNs: ASN:0x0-0x24024: ASN:0x0-0x25025:
    coalition: 374
 9) "robo" ASN:0x10-0x1A1: 
    bundleID=[ NULL ]
    pid = 599 !signalled type="BackgroundOnly" flavor=3 Version=[ NULL ] fileType="????" creator="????" Arch=ARM64
    coalition: 616
`;
  assert.deepEqual(listApps(fake), [
    { name: "Finder", pid: 628, type: "Foreground" },
    { name: "loginwindow", pid: 410, type: "UIElement" },
    { name: "robo", pid: 599, type: "BackgroundOnly" },
  ]);
});

test("listApps vazio retorna []", () => {
  assert.deepEqual(listApps(""), []);
});

test("listApps com entrada sem pid mantém pid/type null", () => {
  const fake = ` 5) "Central de Controle" ASN:0x0-0x6000:
    bundleID="com.apple.controlcenter"
    coalition: 900
`;
  assert.deepEqual(listApps(fake), [{ name: "Central de Controle", pid: null, type: null }]);
});

test("canonicalAppNameFromBundlePath usa o bundle como identidade estável", () => {
  assert.equal(canonicalAppNameFromBundlePath("/System/Applications/Calendar.app"), "Calendar");
  assert.equal(canonicalAppNameFromBundlePath("/usr/sbin/controlcenter"), null);
});

test("scanAppsDirs lista apps com nome, path e icon", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5-scan-"));
  try {
    await mkdir(join(dir, "A.app", "Contents", "Resources"), { recursive: true });
    await writeFile(join(dir, "A.app", "Contents", "Resources", "a.icns"), "icns");
    await mkdir(join(dir, "B.app", "Contents", "Resources"), { recursive: true });
    await writeFile(join(dir, "B.app", "Contents", "Resources", "b.png"), "png");
    await mkdir(join(dir, "NoIcon.app", "Contents", "Resources"), { recursive: true });
    await mkdir(join(dir, "not-an-app"));
    await mkdir(join(dir, "Utilities", "Nested.app", "Contents", "Resources"), { recursive: true });
    await writeFile(join(dir, "Utilities", "Nested.app", "Contents", "Resources", "nested.icns"), "icns");
    // inventário otimista: icon=true sempre (404 no endpoint → monograma)
    assert.deepEqual(await scanAppsDirs([dir]), [
      { name: "A", path: join(dir, "A.app"), icon: true },
      { name: "B", path: join(dir, "B.app"), icon: true },
      { name: "Nested", path: join(dir, "Utilities", "Nested.app"), icon: true },
      { name: "NoIcon", path: join(dir, "NoIcon.app"), icon: true },
    ]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("scanAppsDirs com diretório inexistente retorna []", async () => {
  assert.deepEqual(await scanAppsDirs([join(tmpdir(), "j5-nao-existe-xyz")]), []);
});

test("scanAppsDirs deduplica nomes (primeiro vence) e ordena sem diferenciar maiúsculas", async () => {
  const d1 = await mkdtemp(join(tmpdir(), "j5-dup1-"));
  const d2 = await mkdtemp(join(tmpdir(), "j5-dup2-"));
  try {
    await mkdir(join(d1, "Zeta.app", "Contents", "Resources"), { recursive: true });
    await writeFile(join(d1, "Zeta.app", "Contents", "Resources", "z.icns"), "z");
    await mkdir(join(d1, "alpha.app", "Contents", "Resources"), { recursive: true });
    await writeFile(join(d1, "alpha.app", "Contents", "Resources", "a.icns"), "a");
    await mkdir(join(d2, "Alpha.app", "Contents", "Resources"), { recursive: true });
    await writeFile(join(d2, "Alpha.app", "Contents", "Resources", "a.png"), "a");
    await mkdir(join(d2, "Bravo.app", "Contents", "Resources"), { recursive: true });
    await writeFile(join(d2, "Bravo.app", "Contents", "Resources", "b.icns"), "b");
    const apps = await scanAppsDirs([d1, d2]);
    assert.deepEqual(apps.map(a => a.name), ["alpha", "Bravo", "Zeta"]);
    assert.equal(apps[0].path, join(d1, "alpha.app"));
  } finally { await rm(d1, { recursive: true, force: true }); await rm(d2, { recursive: true, force: true }); }
});
