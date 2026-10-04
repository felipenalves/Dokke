import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { listShortcuts, runShortcut } from "../actions.js";

test("lista atalhos locais com o comando oficial do macOS", async () => {
  let invocation;
  const shortcuts = await listShortcuts({
    exec: async (command, args) => {
      invocation = { command, args };
      return { stdout: "Criar nota\r\nRevisar proposta ✓\r\n" };
    },
  });

  assert.deepEqual(invocation, { command: "/usr/bin/shortcuts", args: ["list"] });
  assert.deepEqual(shortcuts, ["Criar nota", "Revisar proposta ✓"]);
});

test("executa o atalho pelo CLI do macOS e preserva o nome como argumento único", async () => {
  let invocation;
  const child = new EventEmitter();
  child.unref = () => {};
  await runShortcut("Revisar proposta & enviar", {
    spawn: (command, args, options) => {
      invocation = { command, args, options };
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
  });

  assert.deepEqual(invocation, {
    command: "/usr/bin/shortcuts",
    args: ["run", "Revisar proposta & enviar"],
    options: { detached: true, stdio: "ignore" },
  });
  child.emit("close", 0);
});

test("inicia o atalho sem aguardar o término e informa quando ele já está rodando", async () => {
  const children = [];
  const invocations = [];
  const tools = {
    spawn(command, args, options) {
      invocations.push({ command, args, options });
      const child = new EventEmitter();
      child.unref = () => {};
      children.push(child);
      return child;
    },
  };

  const first = runShortcut(" Criar nota ", tools);
  assert.equal(invocations.length, 1);
  assert.deepEqual(invocations[0], {
    command: "/usr/bin/shortcuts",
    args: ["run", "Criar nota"],
    options: { detached: true, stdio: "ignore" },
  });
  children[0].emit("spawn");
  await first;

  const duplicate = await Promise.allSettled([runShortcut("Criar nota", tools)]);
  children[0].emit("close", 0);
  assert.equal(duplicate[0].status, "rejected");
  assert.equal(duplicate[0].reason.code, "SHORTCUT_ALREADY_RUNNING");
  assert.equal(invocations.length, 1, "não dispara de novo enquanto a primeira execução está ativa");

  const afterClose = runShortcut("Criar nota", tools);
  assert.equal(invocations.length, 2, "permite executar novamente depois do encerramento");
  children[1].emit("spawn");
  await afterClose;
  children[1].emit("close", 0);
});

test("erro antes do processo iniciar é devolvido ao chamador", async () => {
  const failure = new Error("spawn falhou");
  const child = new EventEmitter();
  child.unref = () => {};
  const pending = runShortcut("Criar nota", { spawn: () => child });
  child.emit("error", failure);
  await assert.rejects(pending, failure);
});

test("retorna falha quando a CLI encerra com erro logo após iniciar", async () => {
  const child = new EventEmitter();
  child.unref = () => {};
  const pending = runShortcut("Atalho removido", { spawn: () => child });
  child.emit("spawn");
  child.emit("close", 1);
  await assert.rejects(pending, /código 1/);
});
