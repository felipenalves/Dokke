import { execFile } from "node:child_process";

export function cliExec(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout) => err ? reject(err) : resolve({ stdout }));
  });
}

export async function openApp(name, tools = { exec: cliExec }) {
  await tools.exec("open", ["-a", name]);
}

/** Abre uma URL no navegador padrão sem interpretar a entrada como shell. */
export async function openWebsite(url, tools = { exec: cliExec }) {
  await tools.exec("/usr/bin/open", [url]);
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
