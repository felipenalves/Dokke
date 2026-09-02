import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function markStale(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const result = clone(snapshot);
  for (const provider of Object.values(result.providers || {})) {
    if (provider && typeof provider === "object") provider.stale = true;
  }
  return result;
}

export function createUsageStore({ file } = {}) {
  if (typeof file !== "string" || !file.trim()) throw new TypeError("arquivo do cache de uso é obrigatório");
  let loaded = false;
  let snapshot = null;

  async function load({ stale = false } = {}) {
    if (!loaded) {
      loaded = true;
      try {
        const raw = JSON.parse(await readFile(file, "utf8"));
        if (raw?.schema === 1 && raw.snapshot && typeof raw.snapshot === "object" && !Array.isArray(raw.snapshot)) {
          snapshot = raw.snapshot;
        }
      } catch {
        snapshot = null;
      }
    }
    return stale ? markStale(snapshot) : clone(snapshot);
  }

  async function save(value) {
    const next = clone(value);
    snapshot = next;
    loaded = true;
    const temporary = `${file}.tmp-${process.pid}`;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(temporary, JSON.stringify({ schema: 1, snapshot: next }), { mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, file);
    return clone(next);
  }

  return { load, save, markStale };
}

export { markStale };
