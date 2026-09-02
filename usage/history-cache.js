import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { dirname, relative, sep } from "node:path";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_FILES = 2000;

function inside(root, file) {
  const relativePath = relative(root, file);
  return relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !relativePath.startsWith(sep));
}

export function createIncrementalFileCache({
  cacheFile = null,
  fs = { readFile, readdir, realpath, stat },
  maxBytes = DEFAULT_MAX_BYTES,
  maxFiles = DEFAULT_MAX_FILES,
} = {}) {
  const records = new Map();
  let loaded = false;
  let dirty = false;

  async function load() {
    if (loaded) return;
    loaded = true;
    if (!cacheFile) return;
    try {
      const value = JSON.parse(await fs.readFile(cacheFile, "utf8"));
      if (value?.schema !== 1 || !value.files || typeof value.files !== "object") return;
      for (const [file, record] of Object.entries(value.files)) {
        if (record && Number.isFinite(record.size) && Number.isFinite(record.mtimeMs) && Array.isArray(record.events)) {
          records.set(file, record);
        }
      }
    } catch {
      // A missing or corrupt derived cache is safe: the source files remain authoritative.
    }
  }

  async function read(file, parse, { root = null } = {}) {
    await load();
    const resolved = await fs.realpath(file);
    if (root) {
      const resolvedRoot = await fs.realpath(root);
      if (!inside(resolvedRoot, resolved)) throw new Error("arquivo fora da raiz permitida");
    }
    const info = await fs.stat(resolved);
    if (info.size > maxBytes) throw new Error("arquivo de histórico grande demais");
    const key = resolved;
    const previous = records.get(key);
    if (previous && previous.size === info.size && previous.mtimeMs === info.mtimeMs) return previous.events;
    const content = await fs.readFile(resolved, "utf8");
    const events = await parse(content, resolved);
    records.set(key, { size: info.size, mtimeMs: info.mtimeMs, events: events === undefined ? [] : events });
    dirty = true;
    return records.get(key).events;
  }

  async function persist() {
    await load();
    if (!cacheFile || !dirty) return;
    const payload = JSON.stringify({ schema: 1, files: Object.fromEntries(records) });
    const temporary = `${cacheFile}.tmp-${process.pid}`;
    const { mkdir, rename, writeFile } = await import("node:fs/promises");
    await mkdir(dirname(cacheFile), { recursive: true });
    await writeFile(temporary, payload, { mode: 0o600 });
    await rename(temporary, cacheFile);
    dirty = false;
  }

  return { load, read, persist, get size() { return records.size; } };
}

export async function jsonlFiles(roots, { fs = { readdir, stat }, maxFiles = DEFAULT_MAX_FILES } = {}) {
  const files = [];
  const visited = new Set();
  async function walk(root) {
    if (files.length >= maxFiles) return;
    let entries;
    try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const path = `${root}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) await walk(path);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        try {
          const info = await fs.stat(path);
          if (!visited.has(path) && info.isFile()) { visited.add(path); files.push(path); }
        } catch {}
      }
    }
  }
  for (const root of Array.isArray(roots) ? roots : []) await walk(root);
  return files.sort();
}
