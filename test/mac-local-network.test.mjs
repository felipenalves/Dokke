import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const plist = await readFile(new URL("../mac/Info.plist", import.meta.url), "utf8");

test("Mac bundle explica o motivo do acesso à rede local", () => {
  assert.match(plist, /<key>NSLocalNetworkUsageDescription<\/key>/);
  assert.match(
    plist,
    /<key>NSLocalNetworkUsageDescription<\/key>\s*<string>[^<]*(?:rede local|dispositivos)[^<]*<\/string>/i
  );
});
