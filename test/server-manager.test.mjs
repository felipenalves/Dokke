import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mac/Sources/ServerManager.swift", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("ServerManager preserva contexto de cada tentativa de inicialização", () => {
  assert.match(source, /private static let logPath = "\/tmp\/dokke-server\.log"/);
  assert.match(source, /seekToEndOfFile\(\)/, "o log não deve recomeçar no offset zero a cada restart");
  assert.match(source, /\[startup\]/, "o log deve marcar cada tentativa de subida");
  assert.match(source, /\[startup-error\]/, "falha de Process.run deve chegar ao log");
  assert.match(source, /\[exit\]/, "encerramento inesperado deve chegar ao log");
});

test("@spec:AC-333 adota somente um Dokke local identificado por health e version", () => {
  assert.match(source, /private enum ServerOwnership[\s\S]*case adopted/);
  assert.match(source, /private func preflightExistingServer\(\) async -> ServerPreflight/);
  assert.match(source, /\/health/);
  assert.match(source, /\/api\/version/);
  assert.match(source, /case \.adopted[\s\S]*ownership = \.adopted/);
  assert.match(source, /isRunning = true/);
});

test("@spec:AC-334 processo adotado ou desconhecido nunca recebe terminate", () => {
  const stop = source.slice(source.indexOf("func stop()"), source.indexOf("/// Reinicia"));
  assert.match(stop, /let wasOwned = ownership == \.owned/);
  assert.match(stop, /guard wasOwned, let proc, proc\.isRunning else \{ return \}/);
  assert.match(stop, /proc\.terminate\(\)/);

  const preflight = source.slice(
    source.indexOf("switch preflight"),
    source.indexOf("private func preflightExistingServer"),
  );
  const conflictBranch = preflight.slice(
    preflight.indexOf("case .conflict"),
    preflight.indexOf("case .available"),
  );
  assert.match(conflictBranch, /ownership = \.none/);
  assert.match(conflictBranch, /lastError = message/);
  assert.doesNotMatch(conflictBranch, /terminate\(/, "conflito não pode encerrar quem ocupa a porta");
});

test("@spec:AC-335 restart de processo próprio espera bind e respeita cinco tentativas", () => {
  assert.match(source, /private let maxConsecutiveRestartFailures = 5/);
  assert.match(source, /private let restartDelay: TimeInterval = 3/);
  assert.match(source, /private func confirmOwnedServerReady\(/);
  assert.match(source, /restartFailures = 0/, "o contador precisa existir para o bind confirmado");
  assert.match(source, /restartFailures \+= 1[\s\S]{0,280}restartFailures <= maxConsecutiveRestartFailures/s);
  const startBody = source.slice(source.indexOf("private func launchOwnedServer"), source.indexOf("private func confirmOwnedServerReady"));
  assert.doesNotMatch(startBody, /restartFailures = 0/, "Process.run não confirma bind");
  const readiness = source.slice(
    source.indexOf("private func confirmOwnedServerReady"),
    source.indexOf("private func finishStartupLog"),
  );
  assert.match(readiness, /failOwnedAttempt\(proc, message:/, "timeout de bind precisa entrar na mesma política de falha");
  const failedAttempt = source.slice(
    source.indexOf("private func failOwnedAttempt"),
    source.indexOf("private func confirmOwnedServerReady"),
  );
  assert.match(failedAttempt, /process = nil/);
  assert.match(failedAttempt, /ownership = \.none/);
  assert.match(failedAttempt, /handleOwnedFailure\(message\)/);
  assert.match(failedAttempt, /proc\.terminate\(\)/);
});

test("@spec:AC-333 versão adotada corresponde exatamente ao bundle", () => {
  assert.match(source, /CFBundleShortVersionString/);
  assert.match(
    source,
    new RegExp(`private static let packageVersionFallback = "${packageJson.version.replaceAll(".", "\\.")}"`),
  );
  assert.match(source, /private static func normalizedVersionTag\(/);
  assert.match(source, /candidate == bundledVersionTag/);
  assert.doesNotMatch(
    source,
    /private static func isCompatibleDokkeVersion\(_ tag: String\) -> Bool \{\s*tag\.hasPrefix\("v"\)/,
    "qualquer tag v* não pode ser considerada compatível",
  );
});

test("@spec:AC-334 listener local ausente é disponível, timeout continua conservador", () => {
  const noListener = source.slice(
    source.indexOf("private static func isNoLocalListenerError"),
    source.indexOf("private func launchOwnedServer"),
  );
  assert.match(noListener, /NSURLErrorCannotConnectToHost/);
  assert.match(noListener, /NSPOSIXErrorDomain/);
  assert.match(noListener, /ECONNREFUSED/);
  const preflight = source.slice(
    source.indexOf("private func preflightExistingServer"),
    source.indexOf("private static func isCompatibleDokkeVersion"),
  );
  assert.match(preflight, /if Self\.isNoLocalListenerError\(error\) \{\s*return \.available/s);
  assert.doesNotMatch(preflight, /timedOut[\s\S]{0,120}return \.available/);
});
