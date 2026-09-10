import { fileURLToPath } from "node:url";

export const MASCOT_HOOK_URL = "http://127.0.0.1:3000/api/usage/activity/event";
export const MASCOT_HOOK_PROVIDERS = Object.freeze(["claude", "codex", "antigravity", "grok"]);
export const MASCOT_HOOK_STATES = Object.freeze(["working", "waiting", "idle", "error"]);
export const MASCOT_HOOK_MAX_BYTES = 64 * 1024;
export const MASCOT_HOOK_TIMEOUT_MS = 250;

const PROVIDER_ALIASES = new Map([
  ["claude", "claude"],
  ["anthropic", "claude"],
  ["codex", "codex"],
  ["openai", "codex"],
  ["antigravity", "antigravity"],
  ["gemini", "antigravity"],
  ["grok", "grok"],
  ["xai", "grok"],
]);

function text(value, max = 160) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function compactEventText(value) {
  return text(value, 96)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function eventValues(raw) {
  if (!raw || typeof raw !== "object") return [];
  return [
    raw.hook_event_name,
    raw.hookEventName,
    raw.event_name,
    raw.eventName,
    raw.event,
    raw.type,
    raw.kind,
    raw.status,
    raw.state,
    raw.notification_type,
    raw.notificationType,
    raw.reason,
  ].filter(value => typeof value === "string").map(compactEventText).filter(Boolean);
}

function stateFor(values) {
  const joined = values.join(" ");
  if (values.some(value => MASCOT_HOOK_STATES.includes(value))) {
    return values.find(value => MASCOT_HOOK_STATES.includes(value));
  }
  if (/(permission denied|permission rejected|permission cancelled|permission canceled)/.test(joined)) {
    return "working";
  }
  if (/(permission|approval|ask user|question|input required|needs input|waiting|confirm)/.test(joined)) {
    return "waiting";
  }
  if (/(stop failure|session failure|failed|failure|error|exception|crash|aborted)/.test(joined)) {
    return "error";
  }
  if (/(session start|session end|session ended|after agent|after invocation|post invocation|stop cancelled|stop canceled|stop|idle prompt|task complete|completed|finished|end turn|generation complete|done)/.test(joined)) {
    return "idle";
  }
  if (/(session start|user prompt|prompt submit|before agent|before invocation|pre invocation|turn start|task start|assistant|tool use|tool call|pre tool|post tool|subagent start|stream|generat|process|running|working|invoke)/.test(joined)) {
    return "working";
  }
  return null;
}

function timestampFrom(raw, now) {
  const candidates = [raw?.observedAt, raw?.timestamp, raw?.time, raw?.event_time, raw?.eventTime];
  for (const candidate of candidates) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const fallback = now instanceof Date ? new Date(now) : new Date(now);
  return Number.isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
}

function sessionFrom(raw) {
  const value = raw?.session_id ?? raw?.sessionId ?? raw?.conversation_id ?? raw?.conversationId
    ?? raw?.thread_id ?? raw?.threadId;
  return text(value, 160) || "default";
}

export function normalizeProviderId(value) {
  const key = compactEventText(value).replaceAll(" ", "");
  return PROVIDER_ALIASES.get(key) || null;
}

/**
 * Normaliza payloads dos hooks sem carregar texto de prompt, argumentos ou
 * qualquer conteúdo do agente para o Dokke.
 */
export function normalizeHookEvent(raw, { providerId = null, now = new Date() } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const provider = normalizeProviderId(providerId || raw.providerId || raw.provider || raw.source);
  if (!provider) return null;
  const state = stateFor(eventValues(raw));
  if (!state) return null;
  return {
    providerId: provider,
    sessionId: sessionFrom(raw),
    state,
    observedAt: timestampFrom(raw, now),
  };
}

function isMain() {
  try { return fileURLToPath(import.meta.url) === process.argv[1]; } catch { return false; }
}

async function readStdin(stream = process.stdin, maxBytes = MASCOT_HOOK_MAX_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buffer.length;
    if (total > maxBytes) return null;
    chunks.push(buffer);
  }
  if (!chunks.length) return null;
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

export async function postMascotEvent(event, {
  url = process.env.DOKKE_MASCOT_HOOK_URL || MASCOT_HOOK_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = MASCOT_HOOK_TIMEOUT_MS,
} = {}) {
  if (!event || typeof fetchImpl !== "function") return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || MASCOT_HOOK_TIMEOUT_MS));
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    return Boolean(response?.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function runMascotHook(argv = process.argv.slice(2), {
  stdin = process.stdin,
  fetchImpl = globalThis.fetch,
  now = new Date(),
} = {}) {
  try {
    const providerId = argValue(argv, "--provider");
    const raw = await readStdin(stdin);
    const event = normalizeHookEvent(raw, { providerId, now });
    await postMascotEvent(event, { fetchImpl });
  } catch {
    // Hooks nunca podem bloquear nem alterar a execução do agente.
  }
  return 0;
}

if (isMain()) {
  runMascotHook().then(() => { process.exitCode = 0; }).catch(() => { process.exitCode = 0; });
}
