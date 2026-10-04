import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

assert.ok(process.argv[2], "Usage: smoke-packaged-server.mjs PATH_TO_DOKKE_APP");
const appPath = resolve(process.argv[2]);
const serverPath = join(appPath, "Contents", "Resources", "Dokke", "server.js");
const originalHome = process.env.HOME;
const temporaryHome = mkdtempSync(join(tmpdir(), "dokke-packaged-server-smoke-"));
let server;

try {
  process.env.HOME = temporaryHome;
  const { startServer } = await import(pathToFileURL(serverPath).href);
  server = await startServer({ port: 0, obs: null });

  const response = await fetch(`http://127.0.0.1:${server.port}/health`);
  assert.equal(response.status, 200, "packaged /health must return HTTP 200");
  assert.deepEqual(await response.json(), { ok: true, service: "Dokke" });
  console.log("PASS packaged Dokke server responds to /health");
} finally {
  if (server) await server.close();
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(temporaryHome, { recursive: true, force: true });
}
