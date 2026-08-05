import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";

test("server responde /health", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, service: "j5-dock" });
  } finally { await close(); }
});

test("path traversal retorna 404", async () => {
  const { port, close } = await startServer(0);
  try {
    for (const p of ["/%2e%2e/%2e%2e/etc/passwd", "/../etc/passwd"]) {
      const r = await fetch(`http://127.0.0.1:${port}${p}`);
      assert.equal(r.status, 404, `esperava 404 para ${p}`);
    }
  } finally { await close(); }
});