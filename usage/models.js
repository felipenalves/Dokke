export const SESSION_PERIOD_MS = 5 * 60 * 60 * 1000;
export const DAY_PERIOD_MS = 24 * 60 * 60 * 1000;
export const WEEK_PERIOD_MS = 7 * DAY_PERIOD_MS;
export const MONTH_PERIOD_MS = 30 * DAY_PERIOD_MS;
export const HISTORY_DAYS = 30;

export function finiteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function clampPercent(value) {
  const number = finiteNumber(value);
  return number === null ? null : Math.max(0, Math.min(100, number));
}

export function normalizeTimestamp(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1e10 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeResetAt(value, now = new Date()) {
  if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 1e6) {
    return normalizeTimestamp(new Date(now.getTime() + value * 1000));
  }
  return normalizeTimestamp(value);
}

export function createProgressResource({
  id,
  label,
  used,
  limit = 100,
  format = "percent",
  resetsAt = null,
  periodDurationMs = null,
  estimated = false,
}) {
  const normalizedLimit = finiteNumber(limit);
  const normalizedUsed = normalizedLimit !== null && normalizedLimit > 0
    ? (() => {
      const value = finiteNumber(used);
      return value === null ? null : Math.max(0, Math.min(normalizedLimit, value));
    })()
    : null;
  const remaining = normalizedUsed === null ? null : normalizedLimit - normalizedUsed;
  const utilization = normalizedUsed === null ? null : normalizedUsed / normalizedLimit * 100;
  return {
    id: String(id),
    label: String(label),
    kind: "consumption",
    unit: String(format),
    used: normalizedUsed,
    limit: normalizedLimit !== null && normalizedLimit > 0 ? normalizedLimit : null,
    remaining,
    utilization,
    resetsAt: normalizeTimestamp(resetsAt),
    periodDurationMs: finiteNumber(periodDurationMs),
    estimated: estimated === true,
  };
}

export function createValuesResource({ id, label, values = [], estimated = false }) {
  return {
    id: String(id),
    label: String(label),
    kind: "value",
    values: Array.isArray(values) ? values : [],
    estimated: estimated === true,
  };
}

export function createUsageError(code, message) {
  return { code: String(code), message: String(message) };
}

export function emptyHistory() {
  return {
    today: null,
    yesterday: null,
    last30Days: null,
    byModel: [],
  };
}
