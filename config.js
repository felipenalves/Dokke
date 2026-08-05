import { readFile, writeFile, rename } from "node:fs/promises";

const DEFAULT = { pinned: [] };

/** Normaliza lista de favoritos: strings trimmed, sem vazios, sem duplicata (ordem estável). */
export function normalizePinned(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export async function loadConfig(file) {
  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    const cfg = { ...structuredClone(DEFAULT), ...raw };
    cfg.pinned = normalizePinned(cfg.pinned);
    return cfg;
  } catch { return structuredClone(DEFAULT); }
}

export async function saveConfig(file, cfg) {
  const safe = { ...structuredClone(DEFAULT), ...cfg, pinned: normalizePinned(cfg?.pinned) };
  const tmp = file + ".tmp";
  await writeFile(tmp, JSON.stringify(safe, null, 2));
  await rename(tmp, file);
}
