function number(value) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : 0;
}

function readVarint(bytes, offset) {
  let value = 0;
  for (let index = 0; index < 10 && offset + index < bytes.length; index += 1) {
    const byte = bytes[offset + index];
    value += (byte & 0x7f) * 2 ** (index * 7);
    if (!(byte & 0x80)) return { value, next: offset + index + 1 };
  }
  return null;
}

function field(bytes, requested) {
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    if (!tag || !tag.value) return null;
    const number = Math.floor(tag.value / 8);
    const wire = tag.value & 7;
    if (wire === 0) {
      const value = readVarint(bytes, tag.next);
      if (!value) return null;
      if (number === requested) return { kind: "varint", value: value.value };
      offset = value.next;
    } else if (wire === 2) {
      const length = readVarint(bytes, tag.next);
      if (!length || length.value > bytes.length - length.next) return null;
      const end = length.next + length.value;
      if (number === requested) return { kind: "bytes", value: bytes.slice(length.next, end) };
      offset = end;
    } else if (wire === 1 || wire === 5) {
      const width = wire === 1 ? 8 : 4;
      offset = tag.next + width;
    } else return null;
  }
  return null;
}

function decodeGenerationHex(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = Uint8Array.from(hex.match(/../g).map(part => Number.parseInt(part, 16)));
  const wrapped = field(bytes, 1);
  if (!wrapped || wrapped.kind !== "bytes") return null;
  const modelField = field(wrapped.value, 19);
  const usageField = field(wrapped.value, 4);
  const timingField = field(wrapped.value, 9);
  if (!usageField || usageField.kind !== "bytes" || !timingField || timingField.kind !== "bytes") return null;
  const timingWall = field(timingField.value, 4);
  const timestamp = timingWall?.kind === "bytes" ? field(timingWall.value, 1)?.value : null;
  if (!timestamp) return null;
  const model = modelField?.kind === "bytes" ? new TextDecoder().decode(modelField.value).trim() : "Unknown Antigravity Model";
  const systemPrompt = field(usageField.value, 1)?.value || 0;
  const input = field(usageField.value, 2)?.value || 0;
  const output = field(usageField.value, 3)?.value || 0;
  const cacheRead = field(usageField.value, 5)?.value || 0;
  if (systemPrompt + input + output + cacheRead <= 0) return null;
  return { timestamp: new Date(timestamp * 1000).toISOString(), model, inputTokens: systemPrompt + input, cacheReadTokens: cacheRead, outputTokens: output };
}

function normalizeRow(row) {
  const decoded = row?.hex ? decodeGenerationHex(row.hex) : row;
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

export function generationSQL(afterIndex = -1, maximumBlobBytes = MAXIMUM_BLOB_BYTES) {
  const cursor = Number.isInteger(afterIndex) ? afterIndex : -1;
  const maxBytes = Number.isInteger(maximumBlobBytes) && maximumBlobBytes > 0 ? maximumBlobBytes : MAXIMUM_BLOB_BYTES;
  return `SELECT idx AS index, CASE WHEN length(data) <= ${maxBytes} THEN hex(data) ELSE NULL END AS hex FROM gen_metadata WHERE idx > ${cursor} AND data IS NOT NULL ORDER BY idx LIMIT ${SQLITE_BATCH_SIZE}`;
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
    let afterIndex = -1;
    for (;;) {
      let rows = [];
      try { rows = await sqlite.query(database, generationSQL(afterIndex, maxBytes)); } catch { break; }
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

export { decodeGenerationHex };
