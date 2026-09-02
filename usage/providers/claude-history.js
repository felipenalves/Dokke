import { jsonlFiles, createIncrementalFileCache } from "../history-cache.js";

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : 0;
}

function tokensFromUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  if (typeof usage.speed === "string" && !["fast", "standard"].includes(usage.speed)) return null;
  const cacheCreation = usage.cache_creation && typeof usage.cache_creation === "object" ? usage.cache_creation : {};
  const tokens = {
    input: number(usage.input_tokens),
    cacheWrite5m: number(cacheCreation.ephemeral_5m_input_tokens ?? usage.cache_creation_input_tokens),
    cacheWrite1h: number(cacheCreation.ephemeral_1h_input_tokens),
    cacheRead: number(usage.cache_read_input_tokens),
    output: number(usage.output_tokens),
  };
  tokens.total = tokens.input + tokens.cacheWrite5m + tokens.cacheWrite1h + tokens.cacheRead + tokens.output;
  return tokens.total > 0 ? tokens : null;
}

function eventFromRecord(record) {
  if (!record || typeof record !== "object") return null;
  const message = record.message && typeof record.message === "object" ? record.message : {};
  const usage = record.usage || message.usage;
  const tokens = tokensFromUsage(usage);
  const timestamp = record.timestamp || message.timestamp;
  const date = new Date(timestamp);
  if (!tokens || Number.isNaN(date.getTime())) return null;
  const model = String(record.model || message.model || "").trim();
  const messageID = String(message.id || record.messageId || "").trim() || null;
  const requestID = String(record.requestId || message.requestId || "").trim() || null;
  const cost = Number(record.costUSD ?? message.costUSD ?? usage.costUSD);
  return {
    timestamp: date.toISOString(),
    model: model || null,
    tokens,
    costUSD: Number.isFinite(cost) && cost >= 0 ? cost : null,
    isFast: usage.speed === "fast",
    messageID,
    requestID,
    isSidechain: record.isSidechain === true || message.isSidechain === true,
    hasSpeed: Object.prototype.hasOwnProperty.call(usage, "speed")
      || Object.prototype.hasOwnProperty.call(record, "speed")
      || Object.prototype.hasOwnProperty.call(message, "speed"),
  };
}

export function parseClaudeFile(content) {
  const events = [];
  for (const line of String(content).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = eventFromRecord(JSON.parse(line));
      if (event) events.push(event);
    } catch {}
  }
  return events;
}

function shouldReplace(candidate, existing) {
  if (candidate.isSidechain !== existing.isSidechain) return !candidate.isSidechain;
  if (candidate.tokens.total !== existing.tokens.total) return candidate.tokens.total > existing.tokens.total;
  return candidate.hasSpeed && !existing.hasSpeed;
}

function deduplicate(events) {
  const byIdentity = new Map();
  const exact = new Set();
  for (const event of events) {
    if (!event.messageID && !event.requestID) {
      const key = [event.timestamp, event.model, event.tokens.total].join("\u0000");
      if (!exact.has(key)) { exact.add(key); byIdentity.set(`exact:${key}`, event); }
      continue;
    }
    const key = `${event.messageID || ""}\u0000${event.requestID || ""}`;
    const current = byIdentity.get(key);
    if (!current || shouldReplace(event, current)) byIdentity.set(key, event);
  }
  return [...byIdentity.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function scanClaudeHistory({ roots = [], since = new Date(0), cache = createIncrementalFileCache(), maxFiles = 2000 } = {}) {
  const files = await jsonlFiles(roots, { maxFiles });
  const events = [];
  for (const file of files) {
    try { events.push(...await cache.read(file, parseClaudeFile)); } catch {}
  }
  const cutoff = new Date(since).getTime();
  return deduplicate(events).filter(event => Date.parse(event.timestamp) >= cutoff);
}
