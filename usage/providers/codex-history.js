import { jsonlFiles, createIncrementalFileCache } from "../history-cache.js";

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : 0;
}

function usageFromObject(value) {
  if (!value || typeof value !== "object") return null;
  const input = number(value.input_tokens ?? value.prompt_tokens ?? value.input);
  const cacheRead = Math.min(input, number(value.cached_input_tokens ?? value.cache_read_input_tokens ?? value.cache_read_tokens));
  const output = number(value.output_tokens ?? value.completion_tokens ?? value.output);
  const reasoning = number(value.reasoning_output_tokens ?? value.reasoning_tokens);
  const reportedTotal = number(value.total_tokens);
  const total = reportedTotal > 0 || input + output + reasoning === 0
    ? reportedTotal : input + output + reasoning;
  return { input, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead, output, reasoning, total };
}

function equalUsage(left, right) {
  return Boolean(left && right)
    && left.input === right.input
    && left.cacheRead === right.cacheRead
    && left.output === right.output
    && left.reasoning === right.reasoning
    && left.total === right.total;
}

function subtractUsage(current, previous) {
  return {
    input: Math.max(0, current.input - (previous?.input || 0)),
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    cacheRead: Math.max(0, current.cacheRead - (previous?.cacheRead || 0)),
    output: Math.max(0, current.output - (previous?.output || 0)),
    reasoning: Math.max(0, current.reasoning - (previous?.reasoning || 0)),
    total: Math.max(0, current.total - (previous?.total || 0)),
  };
}

function billableTokens(raw) {
  if (!raw) return null;
  return {
    input: Math.max(0, raw.input - raw.cacheRead),
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    cacheRead: raw.cacheRead,
    output: raw.output,
    total: raw.total,
  };
}

function autoReviewPricingModel(timestamp) {
  const date = String(timestamp || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "gpt-5";
  if (date >= "2026-07-09") return "gpt-5.6-luna";
  if (date >= "2026-04-23") return "gpt-5.5";
  if (date >= "2026-03-05") return "gpt-5.4";
  if (date >= "2026-02-05") return "gpt-5.3-codex";
  if (date >= "2025-12-11") return "gpt-5.2-codex";
  if (date >= "2025-11-13") return "gpt-5.1-codex";
  if (date >= "2025-09-15") return "gpt-5-codex";
  return "gpt-5";
}

function recordType(record) {
  return record?.type || record?.payload?.type || record?.payload?.info?.type || "";
}

function parseCodexRecords(content) {
  const events = [];
  let model = "gpt-5";
  let previousTotals = null;
  let sawSessionMeta = false;
  let replayGate = null;
  let currentTierIsFast = false;
  for (const line of String(content).split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    const payload = record.payload && typeof record.payload === "object" ? record.payload : record;
    const type = recordType(record);
    if (type === "turn_context") {
      const next = payload.model || payload.info?.model;
      if (typeof next === "string" && next.trim()) model = next.trim();
      continue;
    }
    if (type === "session_meta" && !sawSessionMeta) {
      sawSessionMeta = true;
      const meta = payload;
      const child = [meta?.forked_from_id, meta?.parent_thread_id].some(value => value !== null && value !== undefined && String(value).trim() !== "")
        || meta?.thread_source === "subagent"
        || (meta?.source && meta.source.subagent !== null && meta.source.subagent !== undefined);
      if (child) {
        const created = new Date(record.timestamp || payload.timestamp || "");
        replayGate = Number.isNaN(created.getTime()) ? { selfTimed: true } : { timestamp: Math.floor(created.getTime() / 1000) };
      }
      continue;
    }
    if (type === "event_msg" && payload?.type === "task_started" && replayGate) {
      const startedAt = number(payload.started_at);
      const lineDate = new Date(record.timestamp || payload.timestamp || "");
      const gate = replayGate.timestamp ?? (Number.isNaN(lineDate.getTime()) ? null : Math.floor(lineDate.getTime() / 1000));
      if (startedAt > 0 && gate !== null && startedAt >= gate) replayGate = null;
      continue;
    }
    if (type === "event_msg" && payload?.type === "thread_settings_applied") {
      const tier = payload.thread_settings?.service_tier || payload.service_tier;
      if (typeof tier === "string") currentTierIsFast = tier === "fast" || tier === "priority";
      continue;
    }
    if (type !== "token_count") continue;
    const info = payload.info || record.info || payload;
    const cumulative = usageFromObject(info.total_token_usage);
    const last = usageFromObject(info.last_token_usage);
    if (!cumulative && !last) continue;
    if (cumulative && equalUsage(cumulative, previousTotals)) continue;
    if (replayGate) {
      if (cumulative) previousTotals = cumulative;
      continue;
    }
    const rawTokens = last || (cumulative ? subtractUsage(cumulative, previousTotals) : null);
    if (cumulative) previousTotals = cumulative;
    const tokens = billableTokens(rawTokens);
    if (!tokens || tokens.total <= 0) continue;
    const date = new Date(record.timestamp || payload.timestamp || Date.now());
    if (Number.isNaN(date.getTime())) continue;
    events.push({
      timestamp: date.toISOString(),
      model,
      pricingModel: model === "codex-auto-review"
        ? autoReviewPricingModel(record.timestamp || payload.timestamp)
        : typeof payload.pricing_model === "string" ? payload.pricing_model : null,
      tokens,
      isFast: currentTierIsFast || payload.service_tier === "priority" || info.service_tier === "priority",
      costUSD: null,
    });
  }
  return events;
}

export function parseCodexFile(content) {
  return parseCodexRecords(content);
}

export async function scanCodexHistory({ homes = [], since = new Date(0), cache = createIncrementalFileCache(), maxFiles = 2000 } = {}) {
  const files = await jsonlFiles(homes, { maxFiles });
  const events = [];
  for (const file of files) {
    try { events.push(...await cache.read(file, parseCodexFile)); } catch {}
  }
  const cutoff = new Date(since).getTime();
  const seen = new Set();
  return events
    .filter(event => Date.parse(event.timestamp) >= cutoff)
    .filter(event => {
      const key = [event.timestamp, event.model, event.tokens.input, event.tokens.cacheRead, event.tokens.output, event.tokens.total].join("\u0000");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
