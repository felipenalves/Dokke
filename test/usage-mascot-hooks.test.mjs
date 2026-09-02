import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  normalizeHookEvent,
  normalizeProviderId,
  runMascotHook,
} from "../usage/mascot-hook.js";
import {
  createActivityMonitor,
  DEFAULT_ACTIVITY_HOOK_WORKING_MS,
} from "../usage/activity.js";
import {
  DOKKE_HOOK_MARKER,
  mergeHookConfig,
  removeManagedHooks,
  installMascotHooks,
  uninstallMascotHooks,
  enableCodexHooksFeature,
} from "../usage/hooks.js";

const NOW = new Date("2026-09-01T15:00:00.000Z");

test("hook reduz o payload a provider, sessão, estado e timestamp", () => {
  const event = normalizeHookEvent({
    hook_event_name: "UserPromptSubmit",
    session_id: "claude-session-1",
    prompt: "não deve sair do processo",
  }, { providerId: "claude", now: NOW });

  assert.deepEqual(event, {
    providerId: "claude",
    sessionId: "claude-session-1",
    state: "working",
    observedAt: NOW.toISOString(),
  });
});

test("hook mapeia espera, conclusão e falha sem inventar estado para evento desconhecido", () => {
  assert.equal(normalizeHookEvent({ event: "SessionStart", session_id: "a" }, { providerId: "claude", now: NOW }).state, "idle");
  assert.equal(normalizeHookEvent({ event: "BeforeAgent", session_id: "a" }, { providerId: "antigravity", now: NOW }).state, "working");
  assert.equal(normalizeHookEvent({ event: "AfterAgent", session_id: "a" }, { providerId: "antigravity", now: NOW }).state, "idle");
  assert.equal(normalizeHookEvent({ event: "PermissionRequest", session_id: "a" }, { providerId: "claude", now: NOW }).state, "waiting");
  assert.equal(normalizeHookEvent({ event: "PermissionDenied", session_id: "a" }, { providerId: "claude", now: NOW }).state, "working");
  assert.equal(normalizeHookEvent({ event: "Stop", session_id: "a" }, { providerId: "claude", now: NOW }).state, "idle");
  assert.equal(normalizeHookEvent({ event: "StopFailure", session_id: "a" }, { providerId: "claude", now: NOW }).state, "error");
  assert.equal(normalizeHookEvent({ event: "Telemetry", session_id: "a" }, { providerId: "claude", now: NOW }), null);
});

test("provider aceita aliases conhecidos mas rejeita entrada arbitrária", () => {
  assert.equal(normalizeProviderId("anthropic"), "claude");
  assert.equal(normalizeProviderId("gemini"), "antigravity");
  assert.equal(normalizeProviderId("unknown-ai"), null);
});

test("CLI do hook falha aberto e envia apenas o evento reduzido", async () => {
  let request = null;
  const result = await runMascotHook(["--provider", "codex"], {
    stdin: {
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: "s", prompt: "segredo" });
      },
    },
    now: NOW,
    fetchImpl: async (_url, options) => {
      request = options;
      return { ok: true };
    },
  });
  assert.equal(result, 0);
  assert.deepEqual(JSON.parse(request.body), {
    providerId: "codex", sessionId: "s", state: "working", observedAt: NOW.toISOString(),
  });
});

test("estado fresco do hook tem precedência e evento idle impede scanner atrasado", async () => {
  let clock = NOW.getTime();
  let fallbackCalls = 0;
  const monitor = createActivityMonitor({
    now: () => new Date(clock),
    intervalMs: 0,
    providers: [{
      id: "claude",
      async readActivity() {
        fallbackCalls += 1;
        return { state: "working", since: NOW.toISOString() };
      },
    }],
    hookWorkingMs: 120_000,
    hookIdleMs: 30_000,
  });

  try {
    monitor.ingestActivityEvent({
      providerId: "claude", sessionId: "session-1", state: "working", observedAt: NOW.toISOString(),
    });
    assert.equal((await monitor.getActivity()).providers.claude.state, "working");
    assert.equal(fallbackCalls, 0);

    monitor.ingestActivityEvent({
      providerId: "claude", sessionId: "session-1", state: "idle", observedAt: NOW.toISOString(),
    });
    assert.equal((await monitor.getActivity()).providers.claude.state, "idle");
    assert.equal(fallbackCalls, 0);

    monitor.ingestActivityEvent({
      providerId: "claude", sessionId: "session-1", state: "working", observedAt: NOW.toISOString(),
    });
    clock += 120_001;
    assert.equal((await monitor.getActivity()).providers.claude.state, "working");
    assert.equal(fallbackCalls, 1);
  } finally {
    monitor.close();
  }
});

test("eventos duplicados não contam sessões duas vezes", async () => {
  const monitor = createActivityMonitor({
    now: () => NOW,
    intervalMs: 0,
    providers: [{ id: "codex", readActivity: async () => ({ state: "idle" }) }],
  });
  const event = { providerId: "codex", sessionId: "same", state: "working", observedAt: NOW.toISOString() };
  try {
    monitor.ingestActivityEvent(event);
    monitor.ingestActivityEvent(event);
    const snapshot = await monitor.getActivity();
    assert.equal(snapshot.providers.codex.state, "working");
    assert.equal(snapshot.providers.codex.sessions, 1);
  } finally {
    monitor.close();
  }
});

test("evento atrasado não faz o mascote regredir de estado", async () => {
  const monitor = createActivityMonitor({
    now: () => NOW,
    intervalMs: 0,
    providers: [{ id: "codex", readActivity: async () => ({ state: "idle" }) }],
  });
  try {
    monitor.ingestActivityEvent({ providerId: "codex", sessionId: "same", state: "working", observedAt: NOW.toISOString() });
    monitor.ingestActivityEvent({ providerId: "codex", sessionId: "same", state: "idle", observedAt: new Date(NOW.getTime() - 1_000).toISOString() });
    assert.equal((await monitor.getActivity()).providers.codex.state, "working");
  } finally {
    monitor.close();
  }
});

test("merge de hook preserva hook do usuário e é idempotente", () => {
  const userCommand = "echo user-hook";
  const dokkeCommand = `node mascot-hook.js --marker ${DOKKE_HOOK_MARKER}`;
  const original = {
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: "command", command: userCommand }] }],
    },
    otherSetting: true,
  };
  const once = mergeHookConfig(original, { command: dokkeCommand, events: ["UserPromptSubmit", "Stop"] });
  const twice = mergeHookConfig(once, { command: dokkeCommand, events: ["UserPromptSubmit", "Stop"] });

  assert.equal(twice.otherSetting, true);
  assert.equal(twice.hooks.UserPromptSubmit[0].hooks[0].command, userCommand);
  assert.equal(twice.hooks.UserPromptSubmit.filter(group => group.hooks.some(hook => hook.command === dokkeCommand)).length, 1);
  assert.equal(twice.hooks.Stop.filter(group => group.hooks.some(hook => hook.command === dokkeCommand)).length, 1);
  assert.deepEqual(removeManagedHooks(twice), original);
});

test("constante de working mantém o contrato de expiração separado do scanner", () => {
  assert.equal(DEFAULT_ACTIVITY_HOOK_WORKING_MS, 5 * 60 * 1000);
});

test("instalador grava atomicamente e uninstall remove só o que é do Dokke", async () => {
  const home = await mkdtemp(join("/tmp", "dokke-hook-install-"));
  try {
    const userConfig = join(home, ".claude", "settings.json");
    await mkdir(join(home, ".claude"), { recursive: true });
    await writeFile(userConfig, JSON.stringify({ hooks: {
      Stop: [{ hooks: [{ type: "command", command: "echo preserve" }] }],
    } }));
    const first = await installMascotHooks({
      providerId: "claude", homeDir: home, nodePath: "/usr/bin/node", scriptPath: "/dokke/mascot-hook.js",
    });
    assert.equal(first.ok, true);
    const installed = JSON.parse(await readFile(userConfig, "utf8"));
    assert.equal(installed.hooks.Stop.length, 2);
    await installMascotHooks({
      providerId: "claude", homeDir: home, nodePath: "/usr/bin/node", scriptPath: "/dokke/mascot-hook.js",
    });
    const repeated = JSON.parse(await readFile(userConfig, "utf8"));
    assert.equal(repeated.hooks.Stop.length, 2);
    await uninstallMascotHooks({ providerId: "claude", homeDir: home });
    assert.deepEqual(JSON.parse(await readFile(userConfig, "utf8")), {
      hooks: { Stop: [{ hooks: [{ type: "command", command: "echo preserve" }] }] },
    });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("instalador não sobrescreve configuração JSON quebrada", async () => {
  const home = await mkdtemp(join("/tmp", "dokke-hook-invalid-"));
  try {
    const userConfig = join(home, ".claude", "settings.json");
    await mkdir(join(home, ".claude"), { recursive: true });
    await writeFile(userConfig, "{ quebrado");
    const result = await installMascotHooks({
      providerId: "claude", homeDir: home, nodePath: "/usr/bin/node", scriptPath: "/dokke/mascot-hook.js",
    });
    assert.equal(result.ok, false);
    assert.equal(await readFile(userConfig, "utf8"), "{ quebrado");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Codex habilita a feature no bloco existente sem reformatar o restante", () => {
  const original = "model = \"gpt-5\"\n\n[features]\nresponses = true\n\n[ui]\ncolor = \"blue\"\n";
  const result = enableCodexHooksFeature(original);
  assert.equal(result.changed, true);
  assert.equal(result.featureEnabledByDokke, true);
  assert.match(result.contents, /\[features\][\s\S]*hooks = true/);
  assert.match(result.contents, /\[ui\][\s\S]*color = \"blue\"/);

  const legacy = enableCodexHooksFeature("[features]\ncodex_hooks = false\n");
  assert.equal(legacy.featureKey, "codex_hooks");
  assert.equal(legacy.contents, "[features]\ncodex_hooks = true\n");
});

test("instalador do Codex conecta hooks.json à feature sem tocar no restante do config", async () => {
  const home = await mkdtemp(join("/tmp", "dokke-hook-codex-"));
  try {
    const codexDir = join(home, ".codex");
    await mkdir(codexDir, { recursive: true });
    await writeFile(join(codexDir, "config.toml"), "model = \"gpt-5\"\n");
    await writeFile(join(codexDir, "hooks.json"), JSON.stringify({ hooks: {
      Stop: [{ hooks: [{ type: "command", command: "echo preserve" }] }],
    } }));
    const result = await installMascotHooks({
      providerId: "codex", homeDir: home, nodePath: "/usr/bin/node", scriptPath: "/dokke/mascot-hook.js",
    });
    assert.equal(result.ok, true);
    assert.match(await readFile(join(codexDir, "config.toml"), "utf8"), /\[features\]\nhooks = true/);
    const hooks = JSON.parse(await readFile(join(codexDir, "hooks.json"), "utf8"));
    assert.equal(hooks.hooks.Stop.length, 2);
    assert.equal(hooks.hooks.PermissionRequest.length, 1);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
