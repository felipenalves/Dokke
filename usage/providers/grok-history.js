import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { jsonlFiles, createIncrementalFileCache } from "../history-cache.js";

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : 0;
}

function timestampOf(record, params) {
  const milliseconds = number(params?._meta?.agentTimestampMs || record?._meta?.agentTimestampMs);
  if (milliseconds > 0) return new Date(milliseconds);
  const value = record?.timestamp;
  if (typeof value === "number" && value > 0) return new Date(value * 1000);
  return new Date(value);
}

export function parseGrokFile(content) {
  const events = [];
  for (const line of String(content).split(/\r?\n/)) {
    if (!line.includes("turn_completed")) continue;
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    const params = record.params || {};
    const update = params.update || record.update;
    const usage = update?.usage;
    const modelUsage = usage?.modelUsage;
    if (update?.sessionUpdate !== "turn_completed" || !modelUsage || typeof modelUsage !== "object") continue;
    const timestamp = timestampOf(record, params);
    if (Number.isNaN(timestamp.getTime())) continue;
    for (const [model, value] of Object.entries(modelUsage)) {
      if (!value || typeof value !== "object") continue;
      const inputTotal = number(value.inputTokens);
      const cacheRead = Math.min(inputTotal, number(value.cachedReadTokens));
      const cacheWrite = Math.min(inputTotal - cacheRead, number(value.cacheCreationTokens));
      const output = number(value.outputTokens);
      const tokens = {
        input: inputTotal - cacheRead - cacheWrite,
        cacheWrite5m: cacheWrite,
        cacheWrite1h: 0,
        cacheRead,
        output,
        total: inputTotal + output,
      };
      if (tokens.total <= 0) continue;
      const ticks = number(value.costUsdTicks) || (Object.keys(modelUsage).length === 1 ? number(usage.costUsdTicks) : 0);
      events.push({
        eventID: params._meta?.eventId || record._meta?.eventId || null,
        timestamp: timestamp.toISOString(),
        model: String(model).trim(),
        tokens,
        costUSD: ticks > 0 ? ticks / 10_000_000_000 : null,
      });
    }
  }
  return events;
}

export async function scanGrokHistory({ roots = [], since = new Date(0), cache = createIncrementalFileCache(), maxFiles = 2000 } = {}) {
  const candidates = (await jsonlFiles(roots, { maxFiles })).filter(file => basename(file) === "updates.jsonl");
  const files = [];
  for (const file of candidates) {
    const summary = join(dirname(file), "summary.json");
    try {
      const parsed = JSON.parse(await readFile(summary, "utf8"));
      const kind = typeof parsed?.session_kind === "string" ? parsed.session_kind.trim().toLowerCase() : "";
      if (kind.startsWith("subagent")) continue;
    } catch {
      // An absent summary is valid for older sessions. A present but corrupt summary is
      // deliberately ignored: the coordinator transcript cannot be identified safely.
      try { await readFile(summary, "utf8"); continue; } catch {}
    }
    files.push(file);
  }
  const events = [];
  for (const file of files) {
    try { events.push(...await cache.read(file, parseGrokFile)); } catch {}
  }
  const cutoff = new Date(since).getTime();
  const seen = new Set();
  return events.filter(event => Date.parse(event.timestamp) >= cutoff).filter(event => {
    if (!event.eventID) return true;
    const key = `${event.eventID}\u0000${event.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
