import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { convertToPng, findIconFile, normalizePngIcon, realIconService, scanAppsDirs } from "../apps.js";

function pngChunk(type, data) {
  const name = Buffer.from(type, "latin1");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) {
    crc ^= out[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return out;
}

function rgbaPng(width, height, pixels) {
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    pixels.copy(scanlines, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function alphaBounds(buf) {
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  let off = 8;
  const chunks = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    if (type === "IDAT") chunks.push(buf.subarray(off + 8, off + 8 + len));
    off += len + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1) + 1;
    for (let x = 0; x < width; x++) {
      if (raw[row + x * 4 + 3] <= 8) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return { width, height, minX, minY, maxX, maxY };
}

test("convertToPng chama sips com args corretos e resolve", async () => {
  const calls = [];
  const exec = async (cmd, args) => { calls.push([cmd, args]); };
  await convertToPng("/x/App.icns", "/out/app.png", exec);
  assert.deepEqual(calls, [["sips", ["-s", "format", "png", "-Z", "512", "/x/App.icns", "--out", "/out/app.png"]]]);
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

test("cache de monogramas em disco respeita o cap (poda os mais antigos)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5-icon-prune-"));
  try {
    const cacheDir = join(dir, ".icon-cache");
    const exec = async (cmd, args) => {
      const out = args[args.indexOf("--out") + 1] ?? args[args.length - 1];
      await writeFile(out, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    };
    const diskMax = 10;
    const svc = realIconService({ scan: async () => [], exec, cacheDir, diskMax });
    for (let i = 0; i < 25; i++) {
      const buf = await svc.getIconPng(`Fantasma-${i}`);
      assert.ok(Buffer.isBuffer(buf));
    }
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(cacheDir)).filter(f => f.endsWith(".png"));
    assert.ok(files.length <= diskMax, `esperava <= ${diskMax} pngs em disco, tem ${files.length}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("normalizePngIcon equaliza margens transparentes no canvas", () => {
  const pixels = Buffer.alloc(4 * 4 * 4);
  for (let y = 1; y <= 2; y++) {
    for (let x = 1; x <= 2; x++) {
      const i = (y * 4 + x) * 4;
      pixels[i] = 255; pixels[i + 1] = 100; pixels[i + 2] = 20; pixels[i + 3] = 255;
    }
  }
  const normalized = normalizePngIcon(rgbaPng(4, 4, pixels), 32);
  assert.deepEqual(alphaBounds(normalized), {
    width: 32, height: 32, minX: 1, minY: 1, maxX: 30, maxY: 30,
  });
});

test("realIconService resolve nome localizado do app para o bundle original", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5-icon-alias-"));
  const appPath = join(dir, "Calendar.app");
  const bytes = Buffer.from("calendar-png");
  try {
    await mkdir(join(appPath, "Contents", "Resources"), { recursive: true });
    await writeFile(join(appPath, "Contents", "Resources", "calendar.png"), bytes);
    const svc = realIconService({
      scan: async () => [{ name: "Calendar", path: appPath, icon: true }],
      cacheDir: join(dir, ".icon-cache"),
    });
    assert.deepEqual(await svc.getIconPng("Calendário"), bytes);
  } finally { await rm(dir, { recursive: true, force: true }); }
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

test("findIconFile aceita CFBundleIconFile PNG e ignora PNG auxiliar", async () => {
  const dir = await mkdtemp(join(tmpdir(), "j5-plist-png-"));
  const appPath = join(dir, "NotionLike.app");
  try {
    await mkdir(join(appPath, "Contents", "Resources"), { recursive: true });
    await writeFile(join(appPath, "Contents", "Resources", "menuBar.png"), "auxiliar");
    await writeFile(join(appPath, "Contents", "Resources", "icon-production.png"), "real");
    await writeFile(join(appPath, "Contents", "Info.plist"),
      "<?xml version=\"1.0\"?><plist><dict><key>CFBundleIconFile</key><string>icon-production.png</string></dict></plist>");
    assert.equal(await findIconFile(appPath), join(appPath, "Contents", "Resources", "icon-production.png"));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
