import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export const ACTIVITY_STATES = Object.freeze(["working", "waiting", "idle", "error"]);
export const DEFAULT_ACTIVITY_STALE_MS = 15_000;
export const DEFAULT_ACTIVITY_WAITING_MS = 2 * 60 * 1000;
export const DEFAULT_ACTIVITY_SESSION_MS = 5 * 60 * 1000;
export const DEFAULT_ACTIVITY_HOOK_WORKING_MS = 5 * 60 * 1000;
export const DEFAULT_ACTIVITY_HOOK_WAITING_MS = 5 * 60 * 1000;
export const DEFAULT_ACTIVITY_HOOK_IDLE_MS = 30_000;
export const DEFAULT_ACTIVITY_HOOK_ERROR_MS = 60_000;
const DEFAULT_MAX_FILES = 2_000;
const MAX_TAIL_BYTES = 32 * 1024;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function dateFrom(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value) {
  const date = dateFrom(value);
  return date ? date.toISOString() : null;
}

function ageMs(now, timestamp) {
  const value = Number(timestamp);
  return Number.isFinite(value) ? Math.max(0, now - value) : Infinity;
}

function normalizeState(value) {
  return ACTIVITY_STATES.includes(value) ? value : "idle";
}

function detailFor(state) {
  if (state === "working") return "processando";
  if (state === "waiting") return "aguardando ação";
  if (state === "error") return "erro no processo";
  return null;
}

export function normalizeActivity(raw, { providerId = null, now = new Date() } = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const state = normalizeState(source.state);
  const sessions = Number.isFinite(Number(source.sessions))
    ? Math.max(0, Math.floor(Number(source.sessions))) : 0;
  const since = iso(source.since);
  const detail = typeof source.detail === "string" && source.detail.trim()
    ? source.detail.trim().slice(0, 120) : detailFor(state);
  return {
    ...(typeof providerId === "string" && providerId ? { providerId } : {}),
    state,
    since: state === "idle" ? null : since,
    detail,
    sessions,
    observedAt: iso(source.observedAt) || iso(now),
  };
}

function valueStrings(record) {
  if (!record || typeof record !== "object") return [];
  const payload = record.payload && typeof record.payload === "object" ? record.payload : null;
  const params = record.params && typeof record.params === "object" ? record.params : null;
  const update = params?.update && typeof params.update === "object" ? params.update : null;
  return [
    record.type, record.event, record.kind, record.status, record.state,
    record.stop_reason,
    record.action, record.waitingFor, record.waiting_for,
    payload?.type, payload?.event, payload?.kind, payload?.status, payload?.state,
    payload?.stop_reason,
    params?.type, params?.event, update?.type, update?.event, update?.sessionUpdate,
    record.message?.role, record.message?.stop_reason,
    payload?.message?.role, payload?.message?.stop_reason,
  ].filter(value => typeof value === "string").map(value => value.trim().toLowerCase());
}

export function classifyActivityLine(line) {
  if (typeof line !== "string" || !line.trim()) return null;
  let record;
  try { record = JSON.parse(line); } catch { return null; }
  const values = valueStrings(record);
  const joined = values.join(" ");
  if (/(approval_requested|permission_requested|request_user_input|needs[_ -]?input|waiting[_ -]?for|waiting)/.test(joined)) {
    return { state: "waiting", detail: "aguardando ação" };
  }
  if (/(task[_ -]?(complete|completed|finished)|turn[_ -]?(complete|completed|finished)|stop_reason|end[_ -]?turn|generation[_ -]?complete)/.test(joined)) {
    return { state: "idle", detail: null };
  }
  if (/(task[_ -]?started|turn[_ -]?started|message[_ -]?start|assistant|tool[_ -]?(use|call)|generat|stream|working|processing)/.test(joined)) {
    return { state: "working", detail: "processando" };
  }
  return null;
}

async function readTail(file, size, fs) {
  if (typeof fs.open !== "function") return "";
  const handle = await fs.open(file, "r");
  try {
    const length = Math.min(Math.max(0, Number(size) || 0), MAX_TAIL_BYTES);
    if (!length) return "";
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, Math.max(0, Number(size) - length));
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

async function activityFiles(roots, { fs, match, maxFiles }) {
  const files = [];
  const visited = new Set();
  async function walk(root) {
    if (files.length >= maxFiles) return;
    let entries;
    try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const file = join(root, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
      } else if (entry.isFile() && match(file, entry.name)) {
        try {
          const info = await fs.stat(file);
          if (info.isFile() && !visited.has(file)) {
            visited.add(file);
            files.push({ file, info });
          }
        } catch {}
      }
    }
  }
  for (const root of Array.isArray(roots) ? roots : []) {
    if (typeof root !== "string" || !root.trim()) continue;
    await walk(root);
  }
  return files;
}

function classifyTail(tail) {
  const lines = String(tail || "").split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index--) {
    const result = classifyActivityLine(lines[index]);
    if (result) return result;
  }
  return null;
}

export async function scanFileActivity({
  providerId = null,
  roots = [],
  now = new Date(),
  fs = { open, readdir, stat },
  match = (_file, name) => name.endsWith(".jsonl"),
  staleAfterMs = DEFAULT_ACTIVITY_STALE_MS,
  waitingAfterMs = DEFAULT_ACTIVITY_WAITING_MS,
  sessionWindowMs = DEFAULT_ACTIVITY_SESSION_MS,
  maxFiles = DEFAULT_MAX_FILES,
} = {}) {
  const current = dateFrom(now) || new Date();
  const currentMs = current.getTime();
  const files = await activityFiles(roots, { fs, match, maxFiles });
  const recentSessions = files.filter(({ info }) => ageMs(currentMs, info.mtimeMs) <= sessionWindowMs).length;
  const latest = files.slice().sort((left, right) => right.info.mtimeMs - left.info.mtimeMs)[0];
  if (!latest) {
    return normalizeActivity({ state: "idle", sessions: recentSessions, observedAt: current }, { providerId, now: current });
  }

  const age = ageMs(currentMs, latest.info.mtimeMs);
  let marker = null;
  try { marker = classifyTail(await readTail(latest.file, latest.info.size, fs)); } catch {}
  let state = "idle";
  if (marker?.state === "waiting" && age <= waitingAfterMs) state = "waiting";
  else if (marker?.state === "idle") state = "idle";
  else if (age <= staleAfterMs) state = "working";
  return normalizeActivity({
    state,
    since: state === "idle" ? null : new Date(latest.info.mtimeMs).toISOString(),
    detail: marker?.detail || null,
    sessions: state === "idle" ? 0 : Math.max(1, recentSessions),
    observedAt: current,
  }, { providerId, now: current });
}

function emptyActivity(providerId, now) {
  return normalizeActivity({ state: "idle", sessions: 0, observedAt: now }, { providerId, now });
}

export function createActivityMonitor({
  providers = [],
  now = () => new Date(),
  intervalMs = 1_000,
  hookWorkingMs = DEFAULT_ACTIVITY_HOOK_WORKING_MS,
  hookWaitingMs = DEFAULT_ACTIVITY_HOOK_WAITING_MS,
  hookIdleMs = DEFAULT_ACTIVITY_HOOK_IDLE_MS,
  hookErrorMs = DEFAULT_ACTIVITY_HOOK_ERROR_MS,
} = {}) {
  const providerList = Array.isArray(providers)
    ? providers.filter(provider => provider && typeof provider.id === "string") : [];
  let current = null;
  let inFlight = null;
  let timer = null;
  const hookSessions = new Map();

  function hookTtl(state) {
    if (state === "working") return Math.max(0, Number(hookWorkingMs) || DEFAULT_ACTIVITY_HOOK_WORKING_MS);
    if (state === "waiting") return Math.max(0, Number(hookWaitingMs) || DEFAULT_ACTIVITY_HOOK_WAITING_MS);
    if (state === "error") return Math.max(0, Number(hookErrorMs) || DEFAULT_ACTIVITY_HOOK_ERROR_MS);
    return Math.max(0, Number(hookIdleMs) || DEFAULT_ACTIVITY_HOOK_IDLE_MS);
  }

  function hookActivity(providerId, observedAt) {
    const currentMs = observedAt.getTime();
    const entries = [...hookSessions.values()]
      .filter(entry => entry.providerId === providerId)
      .filter(entry => ageMs(currentMs, entry.observedAtMs) <= hookTtl(entry.state));
    if (!entries.length) return null;
    const priority = { idle: 1, error: 2, working: 3, waiting: 4 };
    entries.sort((left, right) => {
      const stateDelta = (priority[right.state] || 0) - (priority[left.state] || 0);
      return stateDelta || right.observedAtMs - left.observedAtMs;
    });
    const selected = entries[0];
    const activeSessions = entries.filter(entry => entry.state !== "idle").length;
    return normalizeActivity({
      state: selected.state,
      since: selected.state === "idle" ? null : selected.since,
      detail: selected.detail,
      sessions: activeSessions,
      observedAt: new Date(selected.observedAtMs),
    }, { providerId, now: observedAt });
  }

  async function refresh() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const observedAt = dateFrom(now()) || new Date();
      const maxHookTtl = Math.max(
        hookTtl("working"), hookTtl("waiting"), hookTtl("idle"), hookTtl("error"),
      );
      for (const [key, entry] of hookSessions) {
        if (ageMs(observedAt.getTime(), entry.observedAtMs) > maxHookTtl * 2) hookSessions.delete(key);
      }
      const entries = await Promise.all(providerList.map(async provider => {
        const hooked = hookActivity(provider.id, observedAt);
        if (hooked) return [provider.id, hooked];
        if (typeof provider.readActivity !== "function") return [provider.id, emptyActivity(provider.id, observedAt)];
        try {
          const value = await provider.readActivity({ now: observedAt });
          return [provider.id, normalizeActivity(value, { providerId: provider.id, now: observedAt })];
        } catch {
          return [provider.id, emptyActivity(provider.id, observedAt)];
        }
      }));
      current = {
        ok: true,
        source: "dokke",
        sourceState: "available",
        updatedAt: observedAt.toISOString(),
        providers: Object.fromEntries(entries),
        errors: [],
      };
      return clone(current);
    })();
    try { return await inFlight; }
    finally { inFlight = null; }
  }

  async function getActivity() {
    if (!current) return refresh();
    return clone(current);
  }

  function ingestActivityEvent(event) {
    if (!event || typeof event !== "object") return false;
    const providerId = typeof event.providerId === "string" ? event.providerId.trim() : "";
    const sessionId = typeof event.sessionId === "string" && event.sessionId.trim()
      ? event.sessionId.trim().slice(0, 160) : "default";
    const state = normalizeState(event.state);
    const observed = dateFrom(event.observedAt) || dateFrom(now()) || new Date();
    if (!providerId || !ACTIVITY_STATES.includes(state)) return false;
    const key = `${providerId}:${sessionId}`;
    const previous = hookSessions.get(key);
    if (previous && observed.getTime() < previous.observedAtMs) return true;
    hookSessions.set(key, {
      providerId,
      sessionId,
      state,
      since: state === "idle" ? null : observed.toISOString(),
      detail: detailFor(state),
      observedAtMs: observed.getTime(),
    });
    current = null;
    return true;
  }

  if (Number.isFinite(intervalMs) && intervalMs > 0) {
    timer = setInterval(() => { void refresh().catch(() => {}); }, intervalMs);
    if (timer.unref) timer.unref();
  }

  return {
    getActivity,
    refresh,
    ingestActivityEvent,
    close() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
