import test from "node:test";
import assert from "node:assert/strict";
import { openApp, openWebsite, focusApp, activateApp } from "../actions.js";

test("@spec:AC-312 openWebsite usa /usr/bin/open com URL em argumento isolado", async () => {
  const calls = [];
  await openWebsite("https://example.com/a?b=1", {
    exec: async (cmd, args) => { calls.push([cmd, args]); return { stdout: "" }; },
  });
  assert.deepEqual(calls, [["/usr/bin/open", ["https://example.com/a?b=1"]]]);
});

test("openApp roda open -a e focus roda osascript", async () => {
  const cmds = [];
  const tools = {
    exec: async (cmd, args) => { cmds.push([cmd, args]); return { stdout: "" }; },
  };
  await openApp("Chrome", tools);
  await focusApp("Chrome", 1234, tools);
  assert(cmds.some(c => c[0] === "open" && c[1].includes("-a")));
  assert(cmds.some(c => c[0] === "osascript" && c[1].join(" ").includes("1234")));
});

test("focusApp cai pro open -a quando osascript falha", async () => {
  const cmds = [];
  const tools = {
    exec: async (cmd, args) => {
      cmds.push([cmd, args]);
      if (cmd === "osascript") throw new Error("sem permissão de acessibilidade");
      return { stdout: "" };
    },
  };
  await focusApp("Notes", 55, tools);
  assert.deepEqual(cmds.map(c => c[0]), ["osascript", "open"]);
});

test("activateApp decide: com pid foca, sem pid abre", async () => {
  const cmds = [];
  const tools = {
    exec: async (cmd, args) => { cmds.push([cmd, args]); return { stdout: "" }; },
  };
  await activateApp({ name: "Chrome", pid: 1234 }, tools);
  await activateApp({ name: "Notes", pid: null }, tools);
  assert(cmds.some(c => c[0] === "osascript" && c[1].join(" ").includes("1234")));
  assert(cmds.some(c => c[0] === "open" && c[1].join(" ").includes("Notes")));
});

test("focusApp rejeita pid nao inteiro (defesa em profundidade) e abre", async () => {
  const cmds = [];
  const tools = {
    exec: async (cmd, args) => { cmds.push([cmd, args]); return { stdout: "" }; },
  };
  await focusApp("Chrome", "5; do shell script \"touch /tmp/x\"", tools);
  assert.deepEqual(cmds.map(c => c[0]), ["open"]);
});
