import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertToPng, realIconService, scanAppsDirs } from "../apps.js";

test("convertToPng chama sips com args corretos e resolve", async () => {
  const calls = [];
  const exec = async (cmd, args) => { calls.push([cmd, args]); };
  await convertToPng("/x/App.icns", "/out/app.png", exec);
  assert.deepEqual(calls, [["sips", ["-s", "format", "png", "-Z", "128", "/x/App.icns", "--out", "/out/app.png"]]]);
});

test("convertToPng propaga erro do exec", async () => {
  const exec = async () => { throw new Error("sips falhou"); };
  await assert.rejects(convertToPng("/x.icns", "/o.png", exec), /sips falhou/);
});

test("realIconService converte icns via exec e cacheia no segundo chamado", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5-icon-"));
  const appPath = join(dir, "A.app");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  try {
    await mkdir(join(appPath, "Contents", "Resources"), { recursive: true });
    await writeFile(join(appPath, "Contents", "Resources", "a.icns"), "icns-dados");
    let execCalls = 0;
    const exec = async (cmd, args) => {
      execCalls++;
      assert.equal(cmd, "sips");
      const out = args[args.indexOf("--out") + 1];
      await writeFile(out, png);
    };
    const svc = realIconService({
      scan: async () => [{ name: "A", path: appPath, icon: true }],
      exec,
      cacheDir: join(dir, ".icon-cache"),
    });
    assert.deepEqual([...await svc.getIconPng("A")], [...png]);
    assert.deepEqual([...await svc.getIconPng("A")], [...png]);
    assert.equal(execCalls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("realIconService gera monograma para app desconhecido", async () => {
  const svc = realIconService({ scan: async () => [], cacheDir: join(tmpdir(), "j5-cache-xyz") });
  const buf = await svc.getIconPng("Fantasma");
  assert.ok(Buffer.isBuffer(buf), "deve retornar um buffer PNG");
  assert.ok(buf.length > 0, "buffer não deve estar vazio");
  assert.equal(buf[0], 0x89, "deve começar com magic number PNG");
});

test("realIconService serve png direto sem chamar exec", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5-png-"));
  const appPath = join(dir, "P.app");
  try {
    await mkdir(join(appPath, "Contents", "Resources"), { recursive: true });
    const bytes = Buffer.from("dados-png");
    await writeFile(join(appPath, "Contents", "Resources", "p.png"), bytes);
    let execCalls = 0;
    const svc = realIconService({
      scan: async () => [{ name: "P", path: appPath, icon: true }],
      exec: async () => { execCalls++; },
      cacheDir: join(dir, ".icon-cache"),
    });
    assert.deepEqual(await svc.getIconPng("P"), bytes);
    assert.equal(execCalls, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("realIconService faz um único scan no TTL (N getIconPng)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5-scan-ttl-"));
  const appPath = join(dir, "A.app");
  try {
    await mkdir(join(appPath, "Contents", "Resources"), { recursive: true });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(join(appPath, "Contents", "Resources", "a.png"), png);
    let scans = 0;
    const svc = realIconService({
      scan: async () => {
        scans++;
        return [{ name: "A", path: appPath, icon: true }];
      },
      exec: async () => {},
      cacheDir: join(dir, ".icon-cache"),
      ttlMs: 60_000,
    });
    await Promise.all([svc.getIconPng("A"), svc.getIconPng("A"), svc.getIconPng("A")]);
    assert.equal(scans, 1, "scan deve rodar uma vez sob concorrência");
    await svc.getIconPng("A");
    assert.equal(scans, 1, "scan em memória deve cobrir o segundo round");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("realIconService miss em memória não rescaneia a cada miss", async () => {
  let scans = 0;
  const svc = realIconService({
    scan: async () => {
      scans++;
      return [];
    },
    cacheDir: join(tmpdir(), "j5-miss-cache"),
    ttlMs: 60_000,
  });
  const buf1 = await svc.getIconPng("Fantasma");
  const buf2 = await svc.getIconPng("Fantasma");
  assert.ok(Buffer.isBuffer(buf1), "primeira chamada retorna monograma");
  assert.ok(Buffer.isBuffer(buf2), "segunda chamada retorna monograma cached");
  assert.deepEqual([...buf1], [...buf2], "deve retornar o mesmo monograma cached");
  assert.equal(scans, 1, "scan deve rodar apenas uma vez");
});

test("scanAppsDirs com includeSystemApps adiciona Finder de CoreServices com ícone real", async (t) => {
  // guard: só roda em Mac real com Finder — senão skip
  try {
    const fs = await import("node:fs");
    fs.accessSync("/System/Library/CoreServices/Finder.app/Contents/Resources/Finder.icns");
  } catch { t.skip("Finder não disponível neste sistema"); return; }
  const apps = await scanAppsDirs([], true);
  const finder = apps.find(a => a.name === "Finder");
  assert.ok(finder, "Finder deve entrar no inventário via path de sistema");
  assert.equal(finder.path, "/System/Library/CoreServices/Finder.app");
  assert.equal(finder.icon, true, "Finder deve ter ícone real detectado (Finder.icns)");
  // sem a flag, o comportamento antigo permanece (não injeta Finder nos testes tmp)
  const plain = await scanAppsDirs([]);
  assert.equal(plain.find(a => a.name === "Finder"), undefined);
});

test("findIconFile respeita CFBundleIconFile do Info.plist (e não a ordem do readdir)", async () => {
  let plutilOk = true;
  try { await import("node:child_process").then(m => m.execFileSync("plutil", ["-help"])); }
  catch { plutilOk = false; }
  const dir = await mkdtemp(join(tmpdir(), "j5-plist-"));
  const appPath = join(dir, "Multi Icon.app");
  try {
    await mkdir(join(appPath, "Contents", "Resources"), { recursive: true });
    await writeFile(join(appPath, "Contents", "Resources", "a.icns"), "primeiro-alfabetico");
    await writeFile(join(appPath, "Contents", "Resources", "z-real.icns"), "icone-real");
    await writeFile(join(appPath, "Contents", "Info.plist"),
      "<?xml version=\"1.0\"?><plist><dict><key>CFBundleIconFile</key><string>z-real.icns</string></dict></plist>");
    const apps = await scanAppsDirs([dir]);
    assert.equal(apps.length, 1);
    if (plutilOk){
      // plutil lê o plist: tem que escolher o ícone nomeado, não o primeiro do readdir
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0a]);
      const exec = async (cmd, args) => {
        const out = args[args.indexOf("--out") + 1];
        await writeFile(out, png);
      };
      const svc = realIconService({ scan: async () => apps, exec, cacheDir: join(dir, ".cache") });
      assert.deepEqual([...await svc.getIconPng(apps[0].name)], [...png], "ícone resolvido via CFBundleIconFile");
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
