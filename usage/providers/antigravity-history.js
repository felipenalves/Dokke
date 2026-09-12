import { readdir, realpath, stat } from "node:fs/promises";
import { join } from "node:path";

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : 0;
}

const MAXIMUM_PLAUSIBLE_TOKENS = 1_000_000_000_000;

function tokenCount(value) {
  return Math.min(number(value), MAXIMUM_PLAUSIBLE_TOKENS);
}

function readVarint(bytes, offset) {
  if (!(bytes instanceof Uint8Array) || offset < 0 || offset >= bytes.length) return null;
  let value = 0;
  for (let index = 0; index < 10; index += 1) {
    const position = offset + index;
    if (position >= bytes.length) return null;
    const byte = bytes[position];
    const payload = byte & 0x7f;
    if (index === 9 && payload > 1) return null;
    value += payload * 2 ** (index * 7);
    if (!Number.isSafeInteger(value)) return null;
    if (!(byte & 0x80)) return { value, next: position + 1 };
  }
  return null;
}

function field(bytes, requested) {
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    if (!tag || !tag.value) return null;
    const fieldNumber = Math.floor(tag.value / 8);
    const wire = tag.value & 7;
    if (wire === 0) {
      const value = readVarint(bytes, tag.next);
      if (!value) return null;
      if (fieldNumber === requested) return { kind: "varint", value: value.value };
      offset = value.next;
      continue;
    }
    if (wire === 2) {
      const length = readVarint(bytes, tag.next);
      if (!length || length.value > bytes.length - length.next) return null;
      const end = length.next + length.value;
      if (fieldNumber === requested) return { kind: "bytes", value: bytes.slice(length.next, end) };
      offset = end;
      continue;
    }
    if (wire === 1 || wire === 5) {
      const width = wire === 1 ? 8 : 4;
      if (bytes.length - tag.next < width) return null;
      offset = tag.next + width;
      continue;
    }
    return null;
  }
  return null;
}

function bytesField(bytes, requested) {
  const value = field(bytes, requested);
  return value?.kind === "bytes" ? value.value : null;
}

function varintField(bytes, requested) {
  const value = field(bytes, requested);
  return value?.kind === "varint" ? value.value : null;
}

function textField(bytes, requested) {
  const value = bytesField(bytes, requested);
  if (!value) return null;
  const text = new TextDecoder().decode(value).trim();
  return text || null;
}

function timestampSeconds(message) {
  const seconds = varintField(message, 1);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

function timestampFromStepMetadata(stepMetadata) {
  const timestamp = bytesField(stepMetadata, 1);
  return timestamp ? timestampSeconds(timestamp) : null;
}

function decodeHex(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g).map(part => Number.parseInt(part, 16)));
}

export function modelCandidates(id, label) {
  const clean = value => typeof value === "string" && value.trim() ? value.trim() : null;
  const rawID = clean(id);
  const normalizedID = rawID?.endsWith("-tiered") ? rawID.slice(0, -"-tiered".length) : rawID;
  const normalizedLabel = clean(label);
  const values = normalizedID?.endsWith("-default")
    ? [normalizedLabel, normalizedID]
    : [normalizedID, normalizedLabel];
  return [...new Set(values.filter(Boolean))];
}

function decodeGeneration(bytes, stepMetadata = null) {
  const wrapped = bytesField(bytes, 1);
  if (!wrapped) return null;
  const modelID = textField(wrapped, 19);
  const label = textField(wrapped, 21);
  const usage = bytesField(wrapped, 4);
  if (!usage) return null;

  const systemPrompt = tokenCount(varintField(usage, 1));
  const input = tokenCount(varintField(usage, 2));
  const output = tokenCount(varintField(usage, 3));
  const cacheRead = tokenCount(varintField(usage, 5));
  const generated = input !== 0 || output !== 0 || cacheRead !== 0;
  if (!modelID && !label && !generated) return null;
  if (systemPrompt + input + output + cacheRead <= 0) return null;

  const embeddedTiming = bytesField(wrapped, 9);
  const embeddedTimestamp = embeddedTiming
    ? timestampSeconds(bytesField(embeddedTiming, 4) || new Uint8Array())
    : null;
  const timestampSecondsValue = embeddedTimestamp || (stepMetadata ? timestampFromStepMetadata(stepMetadata) : null);
  if (!timestampSecondsValue) return null;

  return {
    timestampSeconds: timestampSecondsValue,
    model: modelCandidates(modelID, label)[0] || "Unknown Antigravity Model",
    inputTokens: systemPrompt + input,
    cacheReadTokens: cacheRead,
    outputTokens: output,
  };
}

export function decodeGenerationHex(hex, stepHex = null) {
  const bytes = decodeHex(hex);
  if (!bytes) return null;
  const stepMetadata = stepHex ? decodeHex(stepHex) : null;
  const decoded = decodeGeneration(bytes, stepMetadata);
  if (!decoded) return null;
  return {
    timestamp: new Date(decoded.timestampSeconds * 1000).toISOString(),
    model: decoded.model,
    inputTokens: decoded.inputTokens,
    cacheReadTokens: decoded.cacheReadTokens,
    outputTokens: decoded.outputTokens,
  };
}

function normalizeRow(row) {
  const decoded = row?.hex ? decodeGenerationHex(row.hex, row.step_hex || row.stepHex) : row;
  if (!decoded) return null;
  const timestamp = new Date(decoded.timestamp || (number(decoded.timestampSeconds) * 1000));
  if (Number.isNaN(timestamp.getTime())) return null;
  const input = number(decoded.inputTokens);
  const cacheRead = number(decoded.cacheReadTokens);
  const output = number(decoded.outputTokens);
  if (input + cacheRead + output <= 0) return null;
  return {
    timestamp: timestamp.toISOString(),
    model: String(decoded.model || "Unknown Antigravity Model").trim(),
    tokens: { input, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead, output, total: input + cacheRead + output },
    costUSD: null,
  };
}

export const MAXIMUM_BLOB_BYTES = 1_048_576;
export const SQLITE_BATCH_SIZE = 8;

export function stepMetadataProbeSQL() {
  return "SELECT 1 FROM pragma_table_info('steps') WHERE name = 'metadata'";
}

export function generationSQL(afterIndex = -1, maximumBlobBytes = MAXIMUM_BLOB_BYTES, includeSteps = true) {
  const cursor = Number.isInteger(afterIndex) ? afterIndex : -1;
  const maxBytes = Number.isInteger(maximumBlobBytes) && maximumBlobBytes > 0 ? maximumBlobBytes : MAXIMUM_BLOB_BYTES;
  const stepColumn = includeSteps
    ? `, (SELECT CASE WHEN length(metadata) <= ${maxBytes} THEN hex(metadata) ELSE NULL END FROM steps WHERE idx = g.idx) AS step_hex`
    : "";
  return `SELECT g.idx AS "index", CASE WHEN length(g.data) <= ${maxBytes} THEN hex(g.data) ELSE NULL END AS hex${stepColumn} FROM (SELECT idx, data FROM gen_metadata WHERE idx > ${cursor} AND data IS NOT NULL ORDER BY idx LIMIT ${SQLITE_BATCH_SIZE}) g`;
}

export async function discoverConversationDirectories(geminiHome) {
  try {
    const entries = await readdir(geminiHome, { withFileTypes: true });
    return entries
      .filter(entry => entry.name.startsWith("antigravity"))
      .map(entry => join(geminiHome, entry.name, "conversations"))
      .sort();
  } catch { return []; }
}

export async function discoverDatabases(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const paths = [];
    const seen = new Set();
    for (const entry of entries) {
      if (!entry.name.endsWith(".db")) continue;
      const path = join(root, entry.name);
      try {
        if (!(await stat(path)).isFile()) continue;
        const resolved = await realpath(path);
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        paths.push(resolved);
      } catch {}
    }
    return paths.sort();
  } catch { return []; }
}

export async function discoverDatabasesInGeminiHome(geminiHome) {
  const directories = await discoverConversationDirectories(geminiHome);
  const databases = [];
  const seen = new Set();
  for (const directory of directories) {
    for (const database of await discoverDatabases(directory)) {
      if (!seen.has(database)) {
        seen.add(database);
        databases.push(database);
      }
    }
  }
  return databases.sort();
}

export async function scanAntigravityHistory({
  databases = [],
  since = new Date(0),
  sqlite = { query: async () => [] },
  maxBytes = MAXIMUM_BLOB_BYTES,
} = {}) {
  const cutoff = new Date(since).getTime();
  const events = [];
  for (const database of databases) {
    let includeSteps = false;
    try {
      const probe = await sqlite.query(database, stepMetadataProbeSQL());
      includeSteps = Array.isArray(probe) && probe.length > 0;
    } catch {}
    let afterIndex = -1;
    for (;;) {
      let rows = [];
      try { rows = await sqlite.query(database, generationSQL(afterIndex, maxBytes, includeSteps)); } catch { break; }
      if (!Array.isArray(rows) || rows.length === 0) break;
      let advanced = false;
      for (const row of rows) {
        const index = Number(row?.index ?? row?.idx);
        if (!Number.isInteger(index) || index <= afterIndex) continue;
        afterIndex = index;
        advanced = true;
        const event = normalizeRow(row);
        if (event && Date.parse(event.timestamp) >= cutoff) events.push(event);
      }
      if (!advanced || rows.length < SQLITE_BATCH_SIZE) break;
    }
  }
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
