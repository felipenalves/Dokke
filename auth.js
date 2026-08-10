import { randomInt } from "node:crypto";
import { join } from "node:path";
import { chmod, readFile, writeFile } from "node:fs/promises";

export const PIN_RE = /^\d{4}$/;
export const AUTH_COOKIE = "j5_pin";
export const PIN_FILE = ".j5-pin";

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
