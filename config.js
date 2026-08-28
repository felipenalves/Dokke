import { readFile, writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";

const DEFAULT = { schemaVersion: 2, revision: 0, pieces: [], pinned: [] };
export const PINNED_PAGE_SIZE = 8;
export const PINNED_MAX_PAGES = 5;
export const MAX_DOCK_SLOTS = PINNED_PAGE_SIZE * PINNED_MAX_PAGES;
// Mantém o teto em cinco páginas e uma célula livre no último slide.
export const MAX_PINNED_PIECES = PINNED_PAGE_SIZE * PINNED_MAX_PAGES - 1;
// Alias público mantido para o contrato legado de apps.
export const MAX_PINNED_APPS = MAX_PINNED_PIECES;
export const PINNED_LIMIT_CODE = "PINNED_LIMIT_REACHED";
export const PINNED_LIMIT_MESSAGE = `Limite de ${PINNED_MAX_PAGES} páginas atingido`;

export function pinnedLimits() {
  return {
    pageSize: PINNED_PAGE_SIZE,
    maxPages: PINNED_MAX_PAGES,
    maxPinnedPieces: MAX_PINNED_PIECES,
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

export class WebsiteValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "WebsiteValidationError";
    this.code = "INVALID_WEBSITE";
  }
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Normaliza uma entrada manual ou sugerida para uma URL HTTP(S) segura. */
export function normalizeWebsiteUrl(raw) {
  if (typeof raw !== "string") throw new WebsiteValidationError("URL inválida");
  const input = raw.trim();
  if (!input || input.length > 2048 || CONTROL_CHARS.test(input)) {
    throw new WebsiteValidationError("URL inválida");
  }
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new WebsiteValidationError("URL inválida");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new WebsiteValidationError("URL deve usar HTTP ou HTTPS");
  }
  if (!parsed.hostname) throw new WebsiteValidationError("URL sem host");
  if (parsed.username || parsed.password) {
    throw new WebsiteValidationError("URL não pode conter credenciais");
  }
  return parsed.href;
}

function websiteTitle(title, normalizedUrl) {
  const fallback = new URL(normalizedUrl).hostname.replace(/^www\./i, "");
  const value = title == null || (typeof title === "string" && title.trim() === "")
    ? fallback
    : title;
  if (typeof value !== "string" || !value.trim() || CONTROL_CHARS.test(value)) {
    throw new WebsiteValidationError("título inválido");
  }
  const trimmed = value.trim();
  if (trimmed.length > 80) throw new WebsiteValidationError("título muito longo");
  return trimmed;
}

/** Cria uma peça de site; o ID sempre deriva da URL normalizada. */
export function createWebsitePiece(title, rawUrl) {
  const url = normalizeWebsiteUrl(rawUrl);
  const id = `website:${createHash("sha256").update(url).digest("hex")}`;
  return { id, type: "website", title: websiteTitle(title, url), url };
}

function normalizeAppPiece(piece) {
  const name = typeof piece === "string" ? piece.trim() : piece?.name?.trim();
  if (!name) return null;
  return { id: `app:${name}`, type: "app", name };
}

export function normalizePiece(piece) {
  if (typeof piece === "string") return normalizeAppPiece(piece);
  if (!piece || typeof piece !== "object") return null;
  if (piece.type === "app") return normalizeAppPiece(piece);
  if (piece.type === "website") {
    try { return createWebsitePiece(piece.title, piece.url); }
    catch { return null; }
  }
  return null;
}

export function normalizePieces(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  const positions = new Set();
  const hasPositions = list.some(raw => Number.isInteger(raw?.position));
  let nextPosition = 0;
  for (const raw of list) {
    const piece = normalizePiece(raw);
    if (!piece || seen.has(piece.id)) continue;
    seen.add(piece.id);
    if (hasPositions) {
      let position = Number.isInteger(raw?.position) && raw.position >= 0 && raw.position < MAX_DOCK_SLOTS
        ? raw.position
        : -1;
      if (position < 0 || positions.has(position)) {
        while (positions.has(nextPosition) && nextPosition < MAX_DOCK_SLOTS) nextPosition += 1;
        position = nextPosition;
      }
      if (position >= MAX_DOCK_SLOTS) continue;
      positions.add(position);
      nextPosition = Math.max(nextPosition, position + 1);
      out.push({ ...piece, position });
    } else {
      out.push(piece);
    }
    if (out.length >= MAX_PINNED_PIECES) break;
  }
  return hasPositions ? out.sort((a, b) => a.position - b.position) : out;
}

/** Materializa slots para uma mutação sem compactar os itens existentes. */
export function materializePiecePositions(pieces) {
  const normalized = normalizePieces(pieces);
  const used = new Set();
  const positioned = normalized.map(piece => {
    let position = Number.isInteger(piece.position) && piece.position >= 0 && piece.position < MAX_DOCK_SLOTS
      ? piece.position
      : 0;
    while (used.has(position) && position < MAX_DOCK_SLOTS) position += 1;
    if (position >= MAX_DOCK_SLOTS) return null;
    used.add(position);
    return { ...piece, position };
  }).filter(Boolean);
  return positioned.sort((a, b) => a.position - b.position);
}

export function firstAvailablePiecePosition(pieces) {
  const used = new Set(materializePiecePositions(pieces).map(piece => piece.position));
  for (let position = 0; position < MAX_DOCK_SLOTS; position += 1) {
    if (!used.has(position)) return position;
  }
  return null;
}

export function piecesToPinned(pieces) {
  return normalizePieces(pieces)
    .filter(piece => piece.type === "app")
    .map(piece => piece.name);
}

function safeRevision(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Converte legado e formato v2 para uma representação canônica em memória. */
export function normalizeConfig(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const legacy = normalizePinned(source.pinned).map(name => ({ type: "app", name }));
  const pieces = normalizePieces(Array.isArray(source.pieces) ? source.pieces : legacy);
  return {
    schemaVersion: 2,
    revision: safeRevision(source.revision),
    pieces,
    pinned: piecesToPinned(pieces),
  };
}

export async function loadConfig(file) {
  try {
    return normalizeConfig(JSON.parse(await readFile(file, "utf8")));
  } catch { return structuredClone(DEFAULT); }
}

export async function saveConfig(file, cfg) {
  const safe = normalizeConfig(cfg);
  // tmp único por escrita: escritas concorrentes (kiosk + app Mac) não colidem
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(safe, null, 2));
  await rename(tmp, file);
}
