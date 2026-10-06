import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function createWorker({ failURLs = [] } = {}) {
  const handlers = new Map();
  const addedURLs = [];
  const addAllCalls = [];
  const deletedCaches = [];
  let skipWaitingCalls = 0;
  const shouldFail = url => failURLs.includes(url);
  const cache = {
    add(url) {
      addedURLs.push(url);
      return shouldFail(url) ? Promise.reject(new Error(`offline: ${url}`)) : Promise.resolve();
    },
    addAll(urls) {
      addAllCalls.push([...urls]);
      const failedURL = urls.find(shouldFail);
      if (failedURL) return Promise.reject(new Error(`offline: ${failedURL}`));
      addedURLs.push(...urls);
      return Promise.resolve();
    },
  };
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: () => { skipWaitingCalls += 1; return Promise.resolve(); },
    clients: { claim: () => Promise.resolve() },
  };
  const caches = {
    open: async () => cache,
    delete: async name => { deletedCaches.push(name); return true; },
    keys: async () => [],
  };
  vm.runInNewContext(source, { self, caches, Promise, URL, fetch: async () => {} });
  return {
    addedURLs,
    addAllCalls,
    deletedCaches,
    get skipWaitingCalls() { return skipWaitingCalls; },
    install() {
      let installPromise;
      handlers.get("install")({ waitUntil: promise => { installPromise = promise; } });
      return installPromise;
    },
  };
}

for (const shellURL of ["/", "/index.html"]) {
  test(`instalação aborta se o shell offline obrigatório ${shellURL} falhar`, async () => {
    const worker = createWorker({ failURLs: [shellURL] });

    await assert.rejects(worker.install(), new RegExp(`offline: ${shellURL.replace("/", "\\/")}`));
    assert.equal(worker.skipWaitingCalls, 0);
    assert.deepEqual(worker.deletedCaches, ["dokke-v34"]);
    assert.deepEqual(worker.addAllCalls, [["/", "/index.html"]]);
  });
}

test("falha de ícone ou manifesto não bloqueia a instalação do shell", async () => {
  const worker = createWorker({ failURLs: ["/icon-192.png", "/manifest.webmanifest"] });

  await worker.install();
  assert.equal(worker.skipWaitingCalls, 1);
  assert.deepEqual(worker.addAllCalls, [["/", "/index.html"]]);
  assert.deepEqual(worker.addedURLs, [
    "/", "/index.html", "/icon-192.png", "/icon-192-dark.png", "/icon-512.png", "/manifest.webmanifest",
  ]);
  assert.deepEqual(worker.deletedCaches, []);
});
