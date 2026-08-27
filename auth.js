import { randomInt, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";

export const PIN_RE = /^\d{4}$/;
export const AUTH_COOKIE = "j5_pin";
export const PIN_FILE = ".j5-pin";
export const SESSION_COOKIE = "j5_session";
export const SESSION_FILE = "j5-sessions.json";
/** Sessão longa de kiosk: renova só com novo login ou rotação de pin. */
export const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const SESSION_MAX_DEFAULT = 64;

/** Caminho completo do arquivo .j5-pin dentro do projeto. */
export function pinFilePath(root = import.meta.dirname) {
  return join(root, PIN_FILE);
}

/** Gera um pin de 4 dígitos. */
export function newPin() {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

/** Lê o pin do arquivo .j5-pin. Retorna null se não existir ou for inválido. */
export async function readPinFile(root = import.meta.dirname) {
  try {
    const raw = await readFile(pinFilePath(root), "utf8");
    const pin = raw.trim();
    return PIN_RE.test(pin) ? pin : null;
  } catch {
    return null;
  }
}

/** Persiste o pin no arquivo .j5-pin. */
export async function writePinFile(pin, root = import.meta.dirname) {
  if (!PIN_RE.test(pin)) throw new Error("pin inválido");
  const file = pinFilePath(root);
  await writeFile(file, pin + "\n", { encoding: "utf8", mode: 0o600 });
  // mode só vale na criação; chmod também corrige arquivos legados (ex.: 0644).
  await chmod(file, 0o600);
}

/** Garante que exista um pin válido no arquivo .j5-pin. Retorna o pin. */
export async function ensurePin(root = import.meta.dirname) {
  const existing = await readPinFile(root);
  if (existing) {
    // A garantia inclui corrigir a permissão de um .j5-pin já existente.
    await chmod(pinFilePath(root), 0o600);
    return existing;
  }
  const pin = newPin();
  await writePinFile(pin, root);
  return pin;
}

/** Loopback (127.0.0.1 / ::1 / IPv4-mapped) = dono do Mac, confiável. */
export function isLoopback(addr) {
  if (!addr) return false;
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

export function pinCookie(pin, { secure = false } = {}) {
  const attrs = ["Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=15552000"];
  if (secure) attrs.push("Secure");
  return `${AUTH_COOKIE}=${pin}; ${attrs.join("; ")}`;
}

export function pinFromCookie(header) {
  if (!header) return null;
  const m = String(header).match(new RegExp(`(?:^|;[^\\S]*)\\s*${AUTH_COOKIE}=([^;\\s]+)`));
  return m ? m[1] : null;
}

/** Cookie de sessão: carrega um token opaco, nunca o PIN. */
export function sessionCookie(token, { secure = false, maxAgeMs = SESSION_TTL_MS } = {}) {
  const attrs = ["Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) attrs.push("Secure");
  return `${SESSION_COOKIE}=${token}; ${attrs.join("; ")}`;
}

/** Apaga o cookie legado que carregava o PIN cru (upgrades de versões antigas). */
export function clearLegacyPinCookie() {
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

/** Parser do cookie de sessão — mesma fronteira estrita do parser do pin. */
export function tokenFromCookie(header) {
  if (!header) return null;
  const m = String(header).match(new RegExp(`(?:^|;[^\\S]*)\\s*${SESSION_COOKIE}=([^;\\s]+)`));
  return m ? m[1] : null;
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

/** Comparação em tempo constante (via digest) pra comparação do pin. */
export function safeEqual(a, b) {
  const ha = Buffer.from(hashToken(a), "hex");
  const hb = Buffer.from(hashToken(b), "hex");
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}

/**
 * Sessões persistidas: o cookie guarda um token aleatório; no disco só fica
 * o sha256 dele com expiração. Roubo do arquivo não revela tokens utilizáveis,
 * rotação de pin mata todas as sessões e reinício do server não desloga kiosk.
 */
export function createSessionStore({ file, ttlMs = SESSION_TTL_MS, maxSessions = SESSION_MAX_DEFAULT, now = Date.now } = {}) {
  const map = new Map(); // sha256hex -> expiresAtMs
  let queue = Promise.resolve();

  // carga inicial síncrona: arquivo minúsculo, uma leitura no boot — check()
  // precisa funcionar já na primeira request, sem corrida com a carga async.
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    if (raw && typeof raw === "object") {
      for (const [h, exp] of Object.entries(raw)) {
        const expNum = Number(exp);
        if (typeof h === "string" && h.length === 64 && Number.isFinite(expNum) && expNum > now()) {
          map.set(h, expNum);
        }
      }
    }
  } catch {}

  const persist = () => {
    queue = queue.then(async () => {
      for (const [h, exp] of map) if (exp <= now()) map.delete(h);
      const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
      try {
        await writeFile(tmp, JSON.stringify(Object.fromEntries(map)), { encoding: "utf8", mode: 0o600 });
        await rename(tmp, file);
      } catch {
        try { await writeFile(file, JSON.stringify(Object.fromEntries(map)), "utf8"); } catch {}
      }
    }).catch(() => {});
    return queue;
  };

  return {
    async issue() {
      const token = randomBytes(32).toString("base64url");
      map.set(hashToken(token), now() + ttlMs);
      while (map.size > maxSessions) {
        let oldest = null;
        for (const [h, exp] of map) if (!oldest || exp < map.get(oldest)) oldest = h;
        map.delete(oldest);
      }
      await persist();
      return token;
    },
    check(token) {
      if (!token || typeof token !== "string" || token.length < 20) return false;
      const exp = map.get(hashToken(token));
      return Number.isFinite(exp) && exp > now();
    },
    async revokeAll() {
      map.clear();
      await persist();
    },
    size() { return map.size; },
  };
}

/**
 * Anti-bruteforce do pin: N falhas → lock por IP, com poda de entradas velhas.
 * Extraída pra ser testável sem HTTP.
 */
export function createPinLocks({ maxFails = 5, lockMs = 60_000, now = Date.now } = {}) {
  const locks = new Map();
  /** Remove entradas que já não afetam comportamento: lock vencido e
   *  contador de falhas mais velho que a janela do próprio lock. */
  function prune() {
    const t = now();
    for (const [ip, l] of locks) {
      if (l.until <= t && t - l.last > lockMs) locks.delete(ip);
    }
  }
  return {
    isLocked(ip) {
      const l = locks.get(ip);
      return !!(l && l.until > now());
    },
    register(ip) {
      prune();
      const t = now();
      const prev = locks.get(ip);
      if (!prev || t - prev.last > lockMs) {
        locks.set(ip, { fails: 1, last: t, until: 0 });
      } else {
        prev.fails += 1;
        prev.last = t;
        if (prev.fails >= maxFails) prev.until = t + lockMs;
      }
    },
    reset(ip) { locks.delete(ip); },
    prune,
    size() { return locks.size; },
  };
}
