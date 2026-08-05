import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";

const ex = promisify(execFile);
const LSAPPINFO = "/usr/bin/lsappinfo";
const ICON_CACHE_DIR = join(import.meta.dirname, ".icon-cache");
/** Ícone servido no máximo 128px — menos RAM no browser e no Node. */
export const ICON_MAX_PX = 128;
/** TTL do inventário de apps (scan de /Applications). */
export const INSTALLED_APPS_TTL_MS = 120_000;
/** Cap do cache PNG em memória (LRU). Disco continua cacheando o resto. */
export const MEM_PNG_MAX = 40;
/** TTL do lsappinfo (fork caro) — evita um processo novo a cada poll do J5. */
export const RUNNING_TTL_MS = 1500;

const defaultAppDirs = () => [
  "/Applications",
  "/System/Applications",
  join(homedir(), "Applications"),
];

/** Apps de sistema fora dos dirs padrão (Finder fica em CoreServices, não /Applications). */
const SYSTEM_APP_PATHS = [
  ["Finder", "/System/Library/CoreServices/Finder.app"],
];

/** Cache de inventário: evita N× readdir quando a UI pede 80 ícones de uma vez. */
let installedCache = { at: 0, apps: null, promise: null };
/** Cache de running (lsappinfo): evita fork de processo a cada poll / por cliente. */
let runningCache = { at: 0, value: null, promise: null };

/** Só testes / hot-reload. */
export function clearInstalledAppsCache() {
  installedCache = { at: 0, apps: null, promise: null };
}

export function listApps(raw) {
  const apps = [];
  let cur = null;
  for (const line of raw.split("\n")) {
    const nm = line.match(/^\s*\d+\)\s+"([^"]+)"/);
    if (nm) { cur = { name: nm[1].trim(), pid: null, type: null }; apps.push(cur); continue; }
    const pd = line.match(/^\s*pid\s*=\s*(\d+)/);
    if (pd && cur) {
      cur.pid = Number(pd[1]);
      const ty = line.match(/type="([^"]+)"/);
      if (ty) cur.type = ty[1];
    }
  }
  return apps;
}

export async function listAppProcesses() {
  const now = Date.now();
  if (runningCache.value && now - runningCache.at < RUNNING_TTL_MS) return runningCache.value;
  if (runningCache.promise) return runningCache.promise;
  runningCache.promise = (async () => {
    try {
      const { stdout } = await ex(LSAPPINFO, []);
      // UI só precisa de apps em primeiro plano — corta 50+ helpers do payload
      return listApps(stdout).filter(a => !a.type || a.type === "Foreground");
    } catch {
      return [];
    }
  })().then((v) => {
    runningCache.value = v;
    runningCache.at = Date.now();
    runningCache.promise = null;
    return v;
  }, (e) => {
    runningCache.promise = null;
    throw e;
  });
  return runningCache.promise;
}

/** Só readdir — sem plutil. Usado no inventário (80 apps × plutil = segundos). */
export async function hasAnyIconFile(appPath) {
  try {
    const files = await readdir(join(appPath, "Contents", "Resources"));
    return files.some(f => {
      const lower = f.toLowerCase();
      return lower.endsWith(".icns") || lower.endsWith(".png");
    });
  } catch {
    return false;
  }
}

async function bundleIconName(appPath) {
  // CFBundleIconFile é a fonte autoritativa; só no getIcon (lazy), não no scan.
  try {
    const { stdout } = await ex("plutil", ["-convert", "json", "-o", "-", join(appPath, "Contents", "Info.plist")]);
    const info = JSON.parse(stdout);
    const raw = info && info.CFBundleIconFile;
    if (typeof raw === "string" && raw) return raw.endsWith(".icns") ? raw : raw + ".icns";
  } catch {}
  return null;
}

export async function findIconFile(appPath) {
  try {
    const resDir = join(appPath, "Contents", "Resources");
    const files = await readdir(resDir);
    const icns = files.filter(f => f.toLowerCase().endsWith(".icns"));
    if (icns.length) {
      const named = await bundleIconName(appPath);
      if (named) {
        const hit = icns.find(f => f.toLowerCase() === named.toLowerCase());
        if (hit) return join(resDir, hit);
      }
      const pref = ["appicon.icns", "app.icns", "icon.icns"];
      for (let i = 0; i < pref.length; i++) {
        const hit = icns.find(f => f.toLowerCase() === pref[i]);
        if (hit) return join(resDir, hit);
      }
      return join(resDir, icns[0]);
    }
    const png = files.find(f => f.toLowerCase().endsWith(".png"));
    return png ? join(resDir, png) : null;
  } catch {
    return null;
  }
}

export async function scanAppsDirs(dirs, includeSystemApps = false) {
  const seen = new Set();
  const apps = [];
  for (const dir of dirs) {
    let entries;
    try { entries = await readdir(dir); } catch { continue; }
    const batch = [];
    for (const entry of entries) {
      if (!entry.endsWith(".app")) continue;
      const key = entry.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      batch.push(entry);
    }
    // inventário mínimo: sem readdir de Resources (ícone assume true; 404 → monograma)
    for (const entry of batch) {
      apps.push({ name: entry.slice(0, -4), path: join(dir, entry), icon: true });
    }
  }
  if (includeSystemApps) {
    for (const [name, path] of SYSTEM_APP_PATHS) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      apps.push({ name, path, icon: true });
    }
  }
  apps.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  return apps;
}

export async function listInstalledApps() {
  const now = Date.now();
  if (installedCache.apps && now - installedCache.at < INSTALLED_APPS_TTL_MS) {
    return installedCache.apps;
  }
  if (installedCache.promise) return installedCache.promise;
  installedCache.promise = scanAppsDirs(defaultAppDirs(), true)
    .then(apps => {
      installedCache = { at: Date.now(), apps, promise: null };
      return apps;
    })
    .catch(err => {
      installedCache.promise = null;
      throw err;
    });
  return installedCache.promise;
}

export async function convertToPng(sourcePath, outPath, exec, maxPx = ICON_MAX_PX) {
  // -Z = fit longest side; ícone de dock não precisa de 1024px
  await exec("sips", ["-s", "format", "png", "-Z", String(maxPx), sourcePath, "--out", outPath]);
}

function lruSet(map, key, value, max) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const first = map.keys().next().value;
    map.delete(first);
  }
}

/** PNG tem conteúdo visível? sips pode gerar PNG todo transparente p/ alguns .icns
 *  (ex.: Books.app) — nesse caso tratamos como "sem ícone" (cai no monograma no cliente). */
function pngIsEmpty(buf) {
  try {
    if (!buf || buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return false;
    let off = 8;
    let idat = [];
    let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0, hasIHDR = false;
    while (off + 8 <= buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.toString("latin1", off + 4, off + 8);
      const dataStart = off + 8;
      if (type === "IHDR") {
        hasIHDR = true;
        width = buf.readUInt32BE(dataStart);
        height = buf.readUInt32BE(dataStart + 4);
        bitDepth = buf[dataStart + 8];
        colorType = buf[dataStart + 9];
        interlace = buf[dataStart + 12];
      } else if (type === "IDAT") {
        idat.push(buf.subarray(dataStart, dataStart + len));
      } else if (type === "IEND") {
        break;
      }
      off = dataStart + len + 4; // pula CRC
    }
    if (!hasIHDR || interlace !== 0) return false;
    const hasAlpha = colorType === 6 || colorType === 4; // RGBA / gray+alpha
    if (!hasAlpha || bitDepth !== 8 || width < 1 || height < 1) return false;
    if (idat.length === 0) return false;
    const raw = inflateSync(Buffer.concat(idat));
    const channels = colorType === 6 ? 4 : 2;
    const stride = width * channels;
    let visible = 0, total = 0, p = 0;
    for (let y = 0; y < height; y++) {
      p += 1; // byte de filtro por linha
      for (let x = 0; x < width; x++) {
        const alphaIdx = p + x * channels + (channels - 1);
        if (alphaIdx + 1 > raw.length) return false;
        if (raw[alphaIdx] > 8) visible++;
        total++;
      }
      p += stride;
    }
    return total === 0 || visible / total < 0.01; // <1% opaco => vazio
  } catch (e) {
    return false;
  }
}

const MONOGRAM_COLORS = [
  ["#0a84ff","#5e5ce6"], ["#ff375f","#ff9f0a"], ["#30d158","#0a84ff"],
  ["#bf5af2","#ff375f"], ["#ff9f0a","#ff453a"], ["#64d2ff","#0a84ff"],
  ["#ffd60a","#ff9f0a"], ["#32d74b","#64d2ff"],
];

function monogramInitials(name) {
  const w = name.trim().split(/\s+/);
  if (w.length > 1) return (w[0][0] + w[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function monogramHash(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

async function monogramPng(name, execFn, cacheDir, maxPx) {
  const cacheFile = join(cacheDir, `mono-${createHash("sha1").update(name).digest("hex")}.png`);
  try { return await readFile(cacheFile); } catch {}

  const initials = monogramInitials(name);
  const [c1, c2] = MONOGRAM_COLORS[monogramHash(name) % MONOGRAM_COLORS.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxPx}" height="${maxPx}" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <text x="64" y="72" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif"
    font-weight="700" font-size="${initials.length > 1 ? 48 : 56}" fill="white"
    dominant-baseline="central">${initials.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</text>
</svg>`;

  const tmpSvg = join(cacheDir, `mono-${monogramHash(name)}.svg`);
  await mkdir(cacheDir, { recursive: true });
  await writeFile(tmpSvg, svg);
  try {
    await execFn("sips", ["-s", "format", "png", "-z", String(maxPx), String(maxPx), tmpSvg, "--out", cacheFile]);
    const buf = await readFile(cacheFile);
    return buf;
  } catch {
    return null;
  } finally {
    try { await unlink(tmpSvg); } catch {}
  }
}

export function realIconService(deps = {}) {
  const {
    scan = listInstalledApps,
    exec = ex,
    cacheDir = ICON_CACHE_DIR,
    ttlMs = INSTALLED_APPS_TTL_MS,
    memMax = MEM_PNG_MAX,
    maxPx = ICON_MAX_PX,
  } = deps;
  let appsByName = null;
  let appsAt = 0;
  let scanInflight = null;
  const memPng = new Map();
  const memMiss = new Set();
  const loadInflight = new Map();
  const iconPathByApp = new Map();

  async function resolveApps() {
    const now = Date.now();
    if (appsByName && now - appsAt < ttlMs) return appsByName;
    if (scanInflight) return scanInflight;
    scanInflight = Promise.resolve()
      .then(() => scan())
      .then(apps => {
        const m = new Map();
        for (const a of apps) m.set(a.name, a);
        appsByName = m;
        appsAt = Date.now();
        scanInflight = null;
        // não limpa memPng: ícones ainda válidos; path pode mudar no próximo miss
        memMiss.clear();
        iconPathByApp.clear();
        return m;
      })
      .catch(err => {
        scanInflight = null;
        throw err;
      });
    return scanInflight;
  }

  async function loadPng(name) {
    if (memPng.has(name)) {
      const hit = memPng.get(name);
      lruSet(memPng, name, hit, memMax);
      return hit;
    }

    const apps = await resolveApps();
    const app = apps.get(name);

    let src = null;
    if (app) {
      src = iconPathByApp.get(name);
      if (src === undefined) {
        src = await findIconFile(app.path);
        iconPathByApp.set(name, src);
      }
    }

    let buf = null;
    if (src) {
      try {
        if (src.endsWith(".png")) {
          buf = await readFile(src);
        } else {
          const out = join(cacheDir, `${createHash("sha1").update(name).digest("hex")}-z${maxPx}.png`);
          try { buf = await readFile(out); } catch {
            await mkdir(cacheDir, { recursive: true });
            await convertToPng(src, out, exec, maxPx);
            buf = await readFile(out);
          }
        }
        if (buf && pngIsEmpty(buf)) {
          buf = null;
          iconPathByApp.delete(name);
        }
      } catch { buf = null; }
    }

    if (!buf) {
      buf = await monogramPng(name, exec, cacheDir, maxPx);
    }

    if (buf) {
      lruSet(memPng, name, buf, memMax);
    } else {
      memMiss.add(name);
    }
    return buf;
  }

  return {
    async getIconPng(name) {
      if (memPng.has(name)) {
        const hit = memPng.get(name);
        lruSet(memPng, name, hit, memMax);
        return hit;
      }
      if (memMiss.has(name)) return null;
      if (loadInflight.has(name)) return loadInflight.get(name);
      const p = loadPng(name).finally(() => loadInflight.delete(name));
      loadInflight.set(name, p);
      return p;
    },
  };
}
