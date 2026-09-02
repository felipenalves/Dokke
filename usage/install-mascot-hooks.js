#!/usr/bin/env node
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  installMascotHooks,
  mascotHookCommand,
  providerHookEvents,
  supportedHookProviders,
  uninstallMascotHooks,
} from "./hooks.js";

function option(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] || fallback : fallback;
}

function usage() {
  console.log(`Uso: node usage/install-mascot-hooks.js --provider <all|claude|codex|antigravity|grok> [opções]

Opções:
  --home <path>      home usado para localizar a configuração do provider
  --node <path>      runtime Node que o hook deve executar
  --script <path>    arquivo usage/mascot-hook.js
  --uninstall        remove somente entradas gerenciadas pelo Dokke
`);
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  usage();
  process.exit(0);
}

const requestedProvider = option(argv, "--provider");
const providerIds = requestedProvider === "all" ? supportedHookProviders() : [requestedProvider];
if (!requestedProvider || !providerIds.every(provider => supportedHookProviders().includes(provider))) {
  usage();
  process.exitCode = 2;
} else {
  const homeDir = option(argv, "--home", homedir());
  const uninstall = argv.includes("--uninstall");
  const nodePath = option(argv, "--node", process.execPath);
  const scriptPath = option(argv, "--script", resolve(import.meta.dirname, "mascot-hook.js"));
  for (const providerId of providerIds) {
    const events = providerHookEvents(providerId);
    const result = uninstall
      ? await uninstallMascotHooks({ providerId, homeDir })
      : await installMascotHooks({ providerId, homeDir, nodePath, scriptPath, events });
    if (!result.ok) {
      console.error(`Falha em ${providerId}: ${result.error}`);
      process.exitCode = 1;
      continue;
    }
    if (uninstall) {
      console.log(`Dokke: hooks removidos de ${result.file}`);
    } else {
      console.log(`Dokke: hooks instalados para ${providerId} em ${result.file}`);
      console.log(`Comando: ${mascotHookCommand({ nodePath, scriptPath, providerId })}`);
      console.log(`Eventos: ${result.events.join(", ")}`);
    }
  }
}
