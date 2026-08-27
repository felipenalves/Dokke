import { readFile, writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const DEFAULT = { pinned: [] };
export const PINNED_PAGE_SIZE = 8;
export const PINNED_MAX_PAGES = 5;
// Mantém o teto em cinco páginas e uma célula livre no último slide.
export const MAX_PINNED_APPS = PINNED_PAGE_SIZE * PINNED_MAX_PAGES - 1;
export const PINNED_LIMIT_CODE = "PINNED_LIMIT_REACHED";
export const PINNED_LIMIT_MESSAGE = `Limite de ${PINNED_MAX_PAGES} páginas atingido`;

export function pinnedLimits() {
  return {
    pageSize: PINNED_PAGE_SIZE,
    maxPages: PINNED_MAX_PAGES,
    maxPinnedApps: MAX_PINNED_APPS,
  };
}

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
  // tmp único por escrita: escritas concorrentes (kiosk + app Mac) não colidem
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(safe, null, 2));
  await rename(tmp, file);
}
