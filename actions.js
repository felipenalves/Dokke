import { execFile, spawn } from "node:child_process";

const activeShortcuts = new Set();
const SHORTCUT_START_GRACE_MS = 750;

export function cliExec(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout) => err ? reject(err) : resolve({ stdout }));
  });
}

export function cliSpawn(cmd, args, options) {
  return spawn(cmd, args, options);
}

export async function openApp(name, tools = { exec: cliExec }) {
  await tools.exec("open", ["-a", name]);
}

/** Abre uma URL no navegador padrão sem interpretar a entrada como shell. */
export async function openWebsite(url, tools = { exec: cliExec }) {
  await tools.exec("/usr/bin/open", [url]);
}

/** Retorna os nomes dos atalhos disponíveis na coleção local do Mac. */
export async function listShortcuts(tools = { exec: cliExec }) {
  const { stdout = "" } = await tools.exec("/usr/bin/shortcuts", ["list"]);
  return String(stdout)
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(Boolean);
}

/** Inicia o atalho pela CLI oficial sem esperar por prompts ou pelo fim da execução. */
export function runShortcut(name, tools = { spawn: cliSpawn }) {
  if (typeof name !== "string" || !name.trim()) throw new TypeError("nome do atalho inválido");
  const shortcutName = name.trim();
  if (activeShortcuts.has(shortcutName)) {
    return Promise.reject(Object.assign(new Error("atalho já está em execução"), {
      code: "SHORTCUT_ALREADY_RUNNING",
    }));
  }

  activeShortcuts.add(shortcutName);
  return new Promise((resolve, reject) => {
    let started = false;
    let settled = false;
    let confirmationTimer;
    let child;
    const forget = () => activeShortcuts.delete(shortcutName);

    try {
      child = tools.spawn(
        "/usr/bin/shortcuts",
        ["run", shortcutName],
        { detached: true, stdio: "ignore" },
      );
      child.once("spawn", () => {
        started = true;
        child.unref?.();
        confirmationTimer = setTimeout(() => {
          settled = true;
          resolve();
        }, SHORTCUT_START_GRACE_MS);
      });
      child.once("error", error => {
        if (started) return;
        forget();
        settled = true;
        reject(error);
      });
      child.once("close", code => {
        forget();
        if (confirmationTimer) clearTimeout(confirmationTimer);
        if (settled) return;
        settled = true;
        if (!started) reject(new Error("não foi possível iniciar o atalho"));
        else if (code === 0) resolve();
        else reject(new Error(`atalho encerrou com código ${code ?? "desconhecido"}`));
      });
    } catch (error) {
      forget();
      settled = true;
      reject(error);
    }
  });
}

export async function focusApp(name, pid, tools = { exec: cliExec }) {
  if (!(Number.isInteger(pid) && pid > 0)) return openApp(name, tools);
  const script = `tell application "System Events" to set frontmost of first process whose unix id is ${pid} to true`;
  try {
    await tools.exec("osascript", ["-e", script]);
  } catch {
    await openApp(name, tools);
  }
}

export async function activateApp(app, tools) {
  if (Number.isInteger(app.pid) && app.pid > 0) await focusApp(app.name, app.pid, tools);
  else await openApp(app.name, tools);
}
