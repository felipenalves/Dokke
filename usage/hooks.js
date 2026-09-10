import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const DOKKE_HOOK_MARKER = "dokke-mascot-hook";
export const DOKKE_HOOK_EVENTS = Object.freeze([
  "SessionStart",
  "UserPromptSubmit",
  "PermissionRequest",
  "Notification",
  "Stop",
  "SessionEnd",
]);

const PROVIDER_HOOK_EVENTS = Object.freeze({
  // Claude Code exposes the lifecycle names below in settings.json.
  claude: Object.freeze(["SessionStart", "UserPromptSubmit", "PermissionRequest", "Notification", "Stop", "StopFailure", "SubagentStart", "SubagentStop", "SessionEnd"]),
  // Codex hooks.json currently exposes the session/prompt/stop lifecycle.
  codex: Object.freeze(["SessionStart", "UserPromptSubmit", "PermissionRequest", "Stop"]),
  // Gemini-compatible hook files use the agent/tool lifecycle names.
  antigravity: Object.freeze(["SessionStart", "SessionEnd", "BeforeAgent", "AfterAgent", "Notification"]),
  grok: Object.freeze(["SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "StopFailure", "StopCancelled", "Notification"]),
});

const PROVIDER_CONFIGS = Object.freeze({
  claude: { relativePath: join(".claude", "settings.json"), format: "hooks" },
  codex: { relativePath: join(".codex", "hooks.json"), format: "hooks" },
  antigravity: { relativePath: join(".gemini", "settings.json"), format: "hooks" },
  grok: { relativePath: join(".grok", "hooks", "dokke-mascot.json"), format: "hooks" },
});

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isManaged(command) {
  return typeof command === "string" && command.includes(DOKKE_HOOK_MARKER);
}

function cleanHookList(groups) {
  return (Array.isArray(groups) ? groups : []).map(group => {
    const safe = asObject(group);
    const hooks = Array.isArray(safe.hooks) ? safe.hooks.filter(hook => !isManaged(hook?.command)) : [];
    return { ...safe, hooks };
  }).filter(group => Array.isArray(group.hooks) && group.hooks.length > 0);
}

function managedGroup(command) {
  return { hooks: [{ type: "command", command }] };
}

export function mergeHookConfig(config, { command, events = DOKKE_HOOK_EVENTS } = {}) {
  const base = asObject(config);
  const hooks = asObject(base.hooks);
  const nextHooks = {};
  for (const [event, groups] of Object.entries(hooks)) {
    const cleaned = cleanHookList(groups);
    if (cleaned.length) nextHooks[event] = cleaned;
  }
  for (const event of Array.isArray(events) ? events : []) {
    if (typeof event !== "string" || !event || typeof command !== "string" || !command) continue;
    const groups = Array.isArray(nextHooks[event]) ? nextHooks[event] : [];
    if (!groups.some(group => group.hooks?.some(hook => hook.command === command))) {
      groups.push(managedGroup(command));
    }
    nextHooks[event] = groups;
  }
  return { ...base, hooks: nextHooks };
}

export function removeManagedHooks(config) {
  const base = asObject(config);
  const hooks = asObject(base.hooks);
  const nextHooks = {};
  for (const [event, groups] of Object.entries(hooks)) {
    const cleaned = cleanHookList(groups);
    if (cleaned.length) nextHooks[event] = cleaned;
  }
  const result = { ...base };
  if (Object.keys(nextHooks).length) result.hooks = nextHooks;
  else delete result.hooks;
  return result;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function mascotHookCommand({ nodePath, scriptPath, providerId }) {
  if (!nodePath || !scriptPath || !providerId) throw new Error("runtime do hook incompleto");
  return `${shellQuote(nodePath)} ${shellQuote(scriptPath)} --provider ${shellQuote(providerId)} # ${DOKKE_HOOK_MARKER}`;
}

export function providerHookConfigPath(providerId, homeDir = process.env.HOME || process.env.USERPROFILE || ".") {
  const config = PROVIDER_CONFIGS[providerId];
  if (!config) return null;
  return join(homeDir, config.relativePath);
}

export function supportedHookProviders() {
  return Object.keys(PROVIDER_CONFIGS);
}

export function providerHookEvents(providerId) {
  return [...(PROVIDER_HOOK_EVENTS[providerId] || DOKKE_HOOK_EVENTS)];
}

function codexFeatureRange(lines) {
  const start = lines.findIndex(line => line.trim() === "[features]");
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && /^\s*\[[^\]]+\]\s*$/.test(line));
  return { start, end: end < 0 ? lines.length : end };
}

function codexFeatureEntry(lines, range, key) {
  if (!range) return -1;
  return lines.findIndex((line, index) => index >= range.start + 1 && index < range.end
    && new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*(?:#.*)?$`).test(line));
}

export function enableCodexHooksFeature(contents = "", preferredKey = "hooks") {
  const original = typeof contents === "string" ? contents : "";
  const lines = original.split("\n");
  const range = codexFeatureRange(lines);
  const alternate = preferredKey === "hooks" ? "codex_hooks" : "hooks";
  const existingKey = codexFeatureEntry(lines, range, preferredKey) >= 0
    ? preferredKey
    : codexFeatureEntry(lines, range, alternate) >= 0 ? alternate : preferredKey;
  const index = codexFeatureEntry(lines, range, existingKey);
  if (index >= 0) {
    if (/=\s*true\s*(?:#.*)?$/.test(lines[index])) {
      return { contents: original, changed: false, featureEnabledByDokke: false, featureKey: existingKey };
    }
    lines[index] = lines[index].replace(/=\s*false\b/, "= true");
  } else if (range) {
    lines.splice(range.end, 0, `${existingKey} = true`);
  } else {
    const prefix = lines.length && lines[lines.length - 1] === "" ? "" : "\n";
    return {
      contents: `${original}${prefix}[features]\n${existingKey} = true\n`,
      changed: true,
      featureEnabledByDokke: true,
      featureKey: existingKey,
    };
  }
  return { contents: lines.join("\n"), changed: lines.join("\n") !== original, featureEnabledByDokke: true, featureKey: existingKey };
}

async function readJson(file, fs = { readFile }) {
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) return { value: {}, exists: true, valid: false };
    return { value, exists: true, valid: true };
  } catch (error) {
    if (error?.code === "ENOENT") return { value: {}, exists: false, valid: true };
    return { value: {}, exists: true, valid: false };
  }
}

async function writeJsonAtomic(file, value, fs = { mkdir, writeFile, rename, stat }) {
  await fs.mkdir(dirname(file), { recursive: true });
  let mode = 0o600;
  try { mode = (await fs.stat(file)).mode & 0o777; } catch {}
  const temporary = `${file}.dokke-${process.pid}-${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode });
  await fs.rename(temporary, file);
}

async function readText(file, fs = { readFile }) {
  try {
    return { value: await fs.readFile(file, "utf8"), exists: true };
  } catch (error) {
    if (error?.code === "ENOENT") return { value: "", exists: false };
    return { value: "", exists: true, valid: false };
  }
}

async function writeTextAtomic(file, value, fs = { mkdir, writeFile, rename, stat }) {
  await fs.mkdir(dirname(file), { recursive: true });
  let mode = 0o600;
  try { mode = (await fs.stat(file)).mode & 0o777; } catch {}
  const temporary = `${file}.dokke-${process.pid}-${Date.now()}.tmp`;
  await fs.writeFile(temporary, value, { mode });
  await fs.rename(temporary, file);
}

function providerConfigPath(providerId, homeDir) {
  const home = homeDir || process.env.HOME || process.env.USERPROFILE || ".";
  return providerId === "codex" ? join(home, ".codex", "config.toml") : null;
}

export async function installMascotHooks({
  providerId,
  homeDir,
  nodePath,
  scriptPath,
  events = DOKKE_HOOK_EVENTS,
  fs,
} = {}) {
  const file = providerHookConfigPath(providerId, homeDir);
  if (!file) return { ok: false, providerId, error: "provider sem formato de hook conhecido" };
  const command = mascotHookCommand({ nodePath, scriptPath, providerId });
  const loaded = await readJson(file, fs);
  if (!loaded.valid) return { ok: false, providerId, file, error: "configuração JSON inválida; arquivo preservado" };
  const after = mergeHookConfig(loaded.value, { command, events });
  let feature = null;
  const configFile = providerConfigPath(providerId, homeDir);
  if (configFile) {
    const config = await readText(configFile, fs);
    if (config.valid === false) return { ok: false, providerId, file: configFile, error: "configuração do Codex indisponível; arquivo preservado" };
    feature = enableCodexHooksFeature(config.value);
  }
  await writeJsonAtomic(file, after, fs);
  if (configFile && feature?.changed) {
    try {
      await writeTextAtomic(configFile, feature.contents, fs);
    } catch (error) {
      return { ok: false, providerId, file: configFile, error: "não foi possível habilitar hooks do Codex" };
    }
  }
  return { ok: true, providerId, file, events: [...events], command, ...(feature ? { feature } : {}) };
}

export async function uninstallMascotHooks({ providerId, homeDir, fs } = {}) {
  const file = providerHookConfigPath(providerId, homeDir);
  if (!file) return { ok: false, providerId, error: "provider sem formato de hook conhecido" };
  const loaded = await readJson(file, fs);
  if (!loaded.valid) return { ok: false, providerId, file, error: "configuração JSON inválida; arquivo preservado" };
  if (!loaded.exists) return { ok: true, providerId, file, changed: false };
  const after = removeManagedHooks(loaded.value);
  await writeJsonAtomic(file, after, fs);
  return { ok: true, providerId, file };
}
