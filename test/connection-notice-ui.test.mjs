import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "../server.js";

function disableWebSocket(page){
  return page.addInitScript(() => {
    class DisabledWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 3;
      constructor(url){ this.url = url; this.readyState = DisabledWebSocket.CLOSED; }
      close(){ this.readyState = DisabledWebSocket.CLOSED; }
      send(){}
    }
    window.WebSocket = DisabledWebSocket;
  });
}

function useControlledWebSocket(page){
  return page.addInitScript(() => {
    class ControlledWebSocket {
      constructor(url){
        this.url = url;
        this.readyState = 0;
        window.__dokkeSocketCount = (window.__dokkeSocketCount || 0) + 1;
        const shouldOpen = window.__dokkeSocketCount === 1;
        window.__dokkeStatusSocket = this;
        if (shouldOpen) setTimeout(() => {
            this.readyState = 1;
            if (this.onopen) this.onopen({});
          }, 0);
      }
      send(){}
      close(){
        this.readyState = 3;
        if (this.onclose) this.onclose({});
      }
    }
    window.WebSocket = ControlledWebSocket;
  });
}

const appsPayload = {
  ok: true,
  pieces: [{ id: "app:Terminal", type: "app", name: "Terminal", position: 0 }],
  pinned: ["Terminal"],
  running: [],
  v: "0.2.9",
};
const latestAppsPayload = {
  ok: true,
  pieces: [{ id: "app:Calculator", type: "app", name: "Calculator", position: 0 }],
  pinned: ["Calculator"],
  running: [],
  v: "0.2.9",
  revision: 12,
};
const staleAppsPayload = { ...appsPayload, revision: 11 };
const installedApps = [
  { name: "Terminal", path: "/Applications/Utilities/Terminal.app", icon: false },
  { name: "Calculator", path: "/Applications/Calculator.app", icon: false },
];
const staleInstalledApps = [installedApps[0]];
const latestInstalledApps = [installedApps[1]];

function fulfillJson(route, status, body){
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("resultado antigo de /health não derruba uma conexão confirmada por /api/apps", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let releaseHealth;
  let markHealthStarted;
  let markHealthFinished;
  const healthGate = new Promise(resolve => { releaseHealth = resolve; });
  const healthStarted = new Promise(resolve => { markHealthStarted = resolve; });
  const healthFinished = new Promise(resolve => { markHealthFinished = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await disableWebSocket(page);
    await page.route("**/health", async route => {
      markHealthStarted();
      await healthGate;
      await fulfillJson(route, 503, { ok: false });
      markHealthFinished();
    });
    await page.route("**/api/apps/installed", route => fulfillJson(route, 200, { ok: true, apps: installedApps }));
    await page.route("**/api/apps", route => fulfillJson(route, 200, appsPayload));

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await healthStarted;
    await page.waitForSelector('.launchpad .atile[data-id="app:Terminal"]', { timeout: 10000 });
    releaseHealth();
    await healthFinished;
    await page.waitForTimeout(100);

    assert.equal(
      await page.locator("body").evaluate(element => element.classList.contains("is-disconnected")),
      false,
      "uma falha de health iniciada antes da resposta saudável de apps não deve cobrir o dock"
    );
  } finally {
    releaseHealth();
    await browser.close();
    await close();
  }
});

test("resposta antiga de /api/apps não sobrescreve a resposta do retry", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let healthStatus = 200;
  let appsRequests = 0;
  let releaseStaleApps;
  let markStaleAppsStarted;
  let markStaleAppsFinished;
  const staleAppsGate = new Promise(resolve => { releaseStaleApps = resolve; });
  const staleAppsStarted = new Promise(resolve => { markStaleAppsStarted = resolve; });
  const staleAppsFinished = new Promise(resolve => { markStaleAppsFinished = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await disableWebSocket(page);
    await page.route("**/health", route => fulfillJson(
      route,
      healthStatus,
      healthStatus === 200 ? { ok: true } : { ok: false }
    ));
    await page.route("**/api/apps/installed", route => fulfillJson(route, 200, { ok: true, apps: installedApps }));
    await page.route("**/api/apps", async route => {
      appsRequests += 1;
      if (appsRequests === 1) return fulfillJson(route, 200, appsPayload);
      if (appsRequests === 2){
        markStaleAppsStarted();
        await staleAppsGate;
        await fulfillJson(route, 200, staleAppsPayload);
        markStaleAppsFinished();
        return;
      }
      await fulfillJson(route, 200, latestAppsPayload);
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.launchpad .atile[data-id="app:Terminal"]', { timeout: 10000 });
    healthStatus = 503;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await staleAppsStarted;
    await page.waitForFunction(() => document.body.classList.contains("is-disconnected"));

    await page.locator("#connectionRetry").click();
    await page.waitForSelector('.launchpad .atile[data-id="app:Calculator"]', { timeout: 10000 });
    releaseStaleApps();
    await staleAppsFinished;
    await page.waitForTimeout(50);

    assert.equal(await page.locator('.launchpad .atile[data-id="app:Calculator"]').count(), 1);
    assert.equal(
      await page.locator('.launchpad .atile[data-id="app:Terminal"]').count(),
      0,
      "a resposta antiga não deve restaurar os favoritos anteriores",
    );
  } finally {
    releaseStaleApps();
    await browser.close();
    await close();
  }
});

test("resposta de apps pendente não apaga o aviso após o servidor informar offline", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let appsRequests = 0;
  let releasePendingApps;
  let markPendingAppsStarted;
  let markPendingAppsFinished;
  const pendingAppsGate = new Promise(resolve => { releasePendingApps = resolve; });
  const pendingAppsStarted = new Promise(resolve => { markPendingAppsStarted = resolve; });
  const pendingAppsFinished = new Promise(resolve => { markPendingAppsFinished = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await useControlledWebSocket(page);
    await page.route("**/health", route => fulfillJson(route, 200, { ok: true }));
    await page.route("**/api/apps/installed", route => fulfillJson(route, 200, { ok: true, apps: installedApps }));
    await page.route("**/api/apps", async route => {
      appsRequests += 1;
      if (appsRequests === 1) return fulfillJson(route, 200, appsPayload);
      if (appsRequests === 2){
        markPendingAppsStarted();
        await pendingAppsGate;
        await fulfillJson(route, 200, staleAppsPayload);
        markPendingAppsFinished();
        return;
      }
      return fulfillJson(route, 200, latestAppsPayload);
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.launchpad .atile[data-id="app:Terminal"]', { timeout: 10000 });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await pendingAppsStarted;
    await page.waitForFunction(() => window.__dokkeStatusSocket?.readyState === 1);
    await page.evaluate(() => window.__dokkeStatusSocket.onmessage({
      data: JSON.stringify({ type: "online", online: false, v: "0.2.9" }),
    }));
    await page.waitForFunction(() => document.body.classList.contains("is-disconnected"));
    releasePendingApps();
    await pendingAppsFinished;
    await page.waitForTimeout(50);

    assert.equal(
      await page.locator("body").evaluate(element => element.classList.contains("is-disconnected")),
      true,
      "uma resposta iniciada antes da queda não deve ocultar o aviso offline",
    );
  } finally {
    releasePendingApps();
    await browser.close();
    await close();
  }
});

test("poll de apps continua armado quando um evento WS invalida a resposta HTTP pendente", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let appsRequests = 0;
  let releasePendingApps;
  let markPendingAppsStarted;
  let markPendingAppsFinished;
  const pendingAppsGate = new Promise(resolve => { releasePendingApps = resolve; });
  const pendingAppsStarted = new Promise(resolve => { markPendingAppsStarted = resolve; });
  const pendingAppsFinished = new Promise(resolve => { markPendingAppsFinished = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await useControlledWebSocket(page);
    await page.route("**/health", route => fulfillJson(route, 200, { ok: true }));
    await page.route("**/api/apps/installed", route => fulfillJson(route, 200, { ok: true, apps: installedApps }));
    await page.route("**/api/apps", async route => {
      appsRequests += 1;
      if (appsRequests === 1) return fulfillJson(route, 200, appsPayload);
      if (appsRequests === 2){
        markPendingAppsStarted();
        await pendingAppsGate;
        await fulfillJson(route, 200, staleAppsPayload);
        markPendingAppsFinished();
        return;
      }
      return fulfillJson(route, 200, latestAppsPayload);
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.launchpad .atile[data-id="app:Terminal"]', { timeout: 10000 });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await pendingAppsStarted;
    await page.waitForFunction(() => window.__dokkeStatusSocket?.readyState === 1);
    await page.evaluate(() => window.__dokkeStatusSocket.onmessage({
      data: JSON.stringify({
        type: "apps",
        pieces: [{ id: "app:Calculator", type: "app", name: "Calculator", position: 0 }],
        pinned: ["Calculator"],
        running: [],
        revision: 12,
        v: "0.2.9",
      }),
    }));
    await page.waitForSelector('.launchpad .atile[data-id="app:Calculator"]', { timeout: 10000 });
    await page.evaluate(() => window.__dokkeStatusSocket.close());
    releasePendingApps();
    await pendingAppsFinished;

    const deadline = Date.now() + 6000;
    while (appsRequests < 3 && Date.now() < deadline) await page.waitForTimeout(50);
    assert.equal(appsRequests, 3, "o polling HTTP deve retomar depois da resposta invalidada e da queda do WebSocket");
    assert.equal(await page.locator('.launchpad .atile[data-id="app:Calculator"]').count(), 1);
    assert.equal(await page.locator('.launchpad .atile[data-id="app:Terminal"]').count(), 0);
  } finally {
    releasePendingApps();
    await browser.close();
    await close();
  }
});

test("inventário se atualiza quando o Mac fixa um app recém-instalado", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let installedRequests = 0;

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await useControlledWebSocket(page);
    await page.route("**/health", route => fulfillJson(route, 200, { ok: true }));
    await page.route("**/api/apps/installed", route => {
      installedRequests += 1;
      if (installedRequests === 1) return fulfillJson(route, 200, { ok: true, apps: staleInstalledApps });
      if (installedRequests === 2) return fulfillJson(route, 503, { ok: false });
      return fulfillJson(route, 200, { ok: true, apps: installedApps });
    });
    await page.route("**/api/apps", route => fulfillJson(
      route,
      200,
      installedRequests >= 2 ? latestAppsPayload : appsPayload,
    ));

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.launchpad .atile[data-id="app:Terminal"]', { timeout: 10000 });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForFunction(() => window.__dokkeStatusSocket?.readyState === 1);
    await page.evaluate(payload => window.__dokkeStatusSocket.onmessage({
      data: JSON.stringify({ type: "apps", ...payload }),
    }), latestAppsPayload);

    await page.waitForSelector("#connectionRetry:visible", { timeout: 5000 });
    await page.locator("#connectionRetry").click();
    await page.waitForSelector('.launchpad .atile[data-id="app:Calculator"]', { timeout: 10000 });
    assert.ok(installedRequests >= 3, "um novo app fixado deve renovar e permitir repetir o inventário já carregado");
  } finally {
    await browser.close();
    await close();
  }
});

test("evento WS renova o inventário inicial ainda pendente quando chega um app novo", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let installedRequests = 0;
  let releaseInitialInventory;
  let markInitialInventoryStarted;
  let markAppsSnapshotLoaded;
  let markInitialInventoryFinished;
  const initialInventoryGate = new Promise(resolve => { releaseInitialInventory = resolve; });
  const initialInventoryStarted = new Promise(resolve => { markInitialInventoryStarted = resolve; });
  const appsSnapshotLoaded = new Promise(resolve => { markAppsSnapshotLoaded = resolve; });
  const initialInventoryFinished = new Promise(resolve => { markInitialInventoryFinished = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await useControlledWebSocket(page);
    await page.route("**/health", route => fulfillJson(route, 200, { ok: true }));
    await page.route("**/api/apps/installed", async route => {
      installedRequests += 1;
      if (installedRequests === 1){
        markInitialInventoryStarted();
        await initialInventoryGate;
        await fulfillJson(route, 200, { ok: true, apps: staleInstalledApps });
        markInitialInventoryFinished();
        return;
      }
      await fulfillJson(route, 200, { ok: true, apps: installedApps });
    });
    await page.route("**/api/apps", async route => {
      await fulfillJson(route, 200, appsPayload);
      markAppsSnapshotLoaded();
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await Promise.all([initialInventoryStarted, appsSnapshotLoaded]);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForFunction(() => window.__dokkeStatusSocket?.readyState === 1);
    await page.evaluate(payload => window.__dokkeStatusSocket.onmessage({
      data: JSON.stringify({ type: "apps", ...payload }),
    }), latestAppsPayload);

    releaseInitialInventory();
    await initialInventoryFinished;
    await page.waitForSelector('.launchpad .atile[data-id="app:Calculator"]', { timeout: 5000 });
    assert.ok(installedRequests >= 2, "um novo app recebido por WS deve renovar o inventário pendente");
    await page.waitForTimeout(50);
    assert.equal(await page.locator('.launchpad .atile[data-id="app:Calculator"]').count(), 1,
      "a resposta antiga do inventário não deve apagar o app que chegou por WS");
  } finally {
    releaseInitialInventory();
    await browser.close();
    await close();
  }
});

test("poll HTTP renova o inventário inicial quando chega um app fixado durante a carga", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let installedRequests = 0;
  let appsRequests = 0;
  let releaseInitialInventory;
  let markInitialInventoryStarted;
  let markInitialAppsLoaded;
  let markUpdatedAppsLoaded;
  let markInitialInventoryFinished;
  const initialInventoryGate = new Promise(resolve => { releaseInitialInventory = resolve; });
  const initialInventoryStarted = new Promise(resolve => { markInitialInventoryStarted = resolve; });
  const initialAppsLoaded = new Promise(resolve => { markInitialAppsLoaded = resolve; });
  const updatedAppsLoaded = new Promise(resolve => { markUpdatedAppsLoaded = resolve; });
  const initialInventoryFinished = new Promise(resolve => { markInitialInventoryFinished = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await disableWebSocket(page);
    await page.route("**/health", route => fulfillJson(route, 200, { ok: true }));
    await page.route("**/api/apps/installed", async route => {
      installedRequests += 1;
      if (installedRequests === 1){
        markInitialInventoryStarted();
        await initialInventoryGate;
        await fulfillJson(route, 200, { ok: true, apps: staleInstalledApps });
        markInitialInventoryFinished();
        return;
      }
      await fulfillJson(route, 200, { ok: true, apps: installedApps });
    });
    await page.route("**/api/apps", async route => {
      appsRequests += 1;
      const payload = appsRequests === 1 ? appsPayload : latestAppsPayload;
      await fulfillJson(route, 200, payload);
      if (appsRequests === 1) markInitialAppsLoaded();
      else markUpdatedAppsLoaded();
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await Promise.all([initialInventoryStarted, initialAppsLoaded]);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await updatedAppsLoaded;
    releaseInitialInventory();
    await initialInventoryFinished;

    await page.waitForSelector('.launchpad .atile[data-id="app:Calculator"]', { timeout: 5000 });
    assert.ok(installedRequests >= 2, "a resposta HTTP com uma peça nova deve renovar o inventário pendente");
  } finally {
    releaseInitialInventory();
    await browser.close();
    await close();
  }
});

test("resposta antiga de /api/apps/installed não apaga o inventário atualizado pelo retry", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let healthStatus = 200;
  let appsStatus = 200;
  let appsRequests = 0;
  let installedRequests = 0;
  let releaseStaleInstalled;
  let markStaleInstalledStarted;
  let markStaleInstalledFinished;
  const staleInstalledGate = new Promise(resolve => { releaseStaleInstalled = resolve; });
  const staleInstalledStarted = new Promise(resolve => { markStaleInstalledStarted = resolve; });
  const staleInstalledFinished = new Promise(resolve => { markStaleInstalledFinished = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await disableWebSocket(page);
    await page.route("**/health", route => fulfillJson(
      route,
      healthStatus,
      healthStatus === 200 ? { ok: true } : { ok: false }
    ));
    await page.route("**/api/apps/installed", async route => {
      installedRequests += 1;
      if (installedRequests === 1){
        markStaleInstalledStarted();
        await staleInstalledGate;
        await fulfillJson(route, 200, { ok: true, apps: staleInstalledApps });
        markStaleInstalledFinished();
        return;
      }
      await fulfillJson(route, 200, { ok: true, apps: latestInstalledApps });
    });
    await page.route("**/api/apps", route => {
      appsRequests += 1;
      const online = appsStatus === 200;
      const payload = appsRequests === 1 ? appsPayload : latestAppsPayload;
      return fulfillJson(route, appsStatus, online ? payload : { ok: false });
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await staleInstalledStarted;
    await page.waitForFunction(() => !document.body.classList.contains("is-disconnected"));
    healthStatus = 503;
    appsStatus = 503;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForFunction(() => document.body.classList.contains("is-disconnected"));

    healthStatus = 200;
    appsStatus = 200;
    await page.locator("#connectionRetry").click();
    await page.waitForSelector('.launchpad .atile[data-id="app:Calculator"]', { timeout: 10000 });
    releaseStaleInstalled();
    await staleInstalledFinished;
    await page.waitForTimeout(50);

    assert.equal(
      await page.locator('.launchpad .atile[data-id="app:Calculator"]').count(),
      1,
      "a carga inicial antiga do inventário não deve apagar o app recebido pelo retry"
    );
    assert.equal(await page.locator('.launchpad .atile[data-id="app:Terminal"]').count(), 0);
  } finally {
    releaseStaleInstalled();
    await browser.close();
    await close();
  }
});

test("aviso offline prende e devolve o foco, inclusive ao fechar o login", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let healthStatus = 200;
  let appsStatus = 200;
  let authSucceeded = false;
  let releasePostLoginApps;
  let markPostLoginAppsStarted;
  const postLoginAppsGate = new Promise(resolve => { releasePostLoginApps = resolve; });
  const postLoginAppsStarted = new Promise(resolve => { markPostLoginAppsStarted = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await disableWebSocket(page);
    await page.route("**/health", route => fulfillJson(
      route,
      healthStatus,
      healthStatus === 200 ? { ok: true } : { ok: false }
    ));
    await page.route("**/api/apps/installed", route => fulfillJson(route, 200, { ok: true, apps: installedApps }));
    await page.route("**/api/auth", async route => {
      authSucceeded = true;
      await fulfillJson(route, 200, { ok: true });
    });
    await page.route("**/api/apps", async route => {
      if (authSucceeded){
        markPostLoginAppsStarted();
        await postLoginAppsGate;
      }
      await fulfillJson(route, appsStatus, appsStatus === 200 ? appsPayload : { ok: false });
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.launchpad .atile[data-id="app:Terminal"]', { timeout: 10000 });
    await page.waitForFunction(() => !document.body.classList.contains("is-disconnected"));
    const appTile = page.locator('.atile[data-id="app:Terminal"]');

    await appTile.evaluate(element => element.focus());
    assert.equal(await appTile.evaluate(element => element === document.activeElement), true, "app deve receber o foco antes do teste de modal");
    healthStatus = 503;
    appsStatus = 503;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForFunction(() => document.body.classList.contains("is-disconnected"));
    const connectionTitle = (await page.locator("#connectionTitle").textContent()).trim();
    assert.ok(connectionTitle, "o aviso deve ter um título visível");
    assert.equal(
      await page.getByRole("dialog", { name: connectionTitle, exact: true }).count(),
      1,
      "o diálogo deve usar seu título visível como nome acessível",
    );
    assert.equal(await page.evaluate(() => document.activeElement.id), "connectionRetry", "o alerta deve receber o foco ao abrir");

    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "connectionRetry", "Tab deve permanecer no único controle do alerta");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "connectionRetry", "Shift+Tab também deve permanecer no alerta");

    appsStatus = 200;
    await page.locator("#connectionRetry").click();
    await page.waitForFunction(() => !document.body.classList.contains("is-disconnected"));
    await page.waitForFunction(() => document.activeElement.matches('.atile[data-id="app:Terminal"]'));
    assert.equal(await appTile.evaluate(element => element === document.activeElement), true, "ao fechar, o foco deve voltar ao app que estava selecionado");

    await appTile.evaluate(element => element.focus());
    healthStatus = 503;
    appsStatus = 401;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForFunction(() => document.querySelector("#loginScrim").classList.contains("show"));
    healthStatus = 200;
    appsStatus = 200;
    await page.locator("#loginPin").fill("1234");
    await postLoginAppsStarted;
    await page.waitForFunction(() => document.body.classList.contains("is-disconnected"));
    assert.equal(await page.evaluate(() => document.activeElement.id), "connectionRetry", "o aviso reaberto não deve deixar foco no PIN oculto nem atrás do diálogo");

    releasePostLoginApps();
    await page.waitForFunction(() => !document.body.classList.contains("is-disconnected"));
    await page.waitForFunction(() => document.activeElement.matches('.atile[data-id="app:Terminal"]'));
    assert.equal(await appTile.evaluate(element => element === document.activeElement), true, "depois do login e da reconexão, o foco deve voltar ao app");
  } finally {
    releasePostLoginApps();
    await browser.close();
    await close();
  }
});

test("falha ao carregar favoritos não é mascarada pelo inventário de apps instalados", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let markInstalledLoaded;
  let markAppsFailed;
  const installedLoaded = new Promise(resolve => { markInstalledLoaded = resolve; });
  const appsFailed = new Promise(resolve => { markAppsFailed = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await disableWebSocket(page);
    await page.route("**/health", route => fulfillJson(route, 200, { ok: true }));
    await page.route("**/api/apps/installed", async route => {
      await fulfillJson(route, 200, { ok: true, apps: installedApps });
      markInstalledLoaded();
    });
    await page.route("**/api/apps", async route => {
      await installedLoaded;
      await new Promise(resolve => setTimeout(resolve, 100));
      await fulfillJson(route, 503, { ok: false });
      markAppsFailed();
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await appsFailed;
    await page.waitForTimeout(100);

    assert.equal(
      await page.locator("body").evaluate(element => element.classList.contains("is-disconnected")),
      true,
      "o app deve explicar e permitir repetir a carga dos favoritos mesmo com o inventário disponível",
    );
    assert.equal(await page.locator("#connectionRetry").isVisible(), true);
  } finally {
    await browser.close();
    await close();
  }
});

test("falha HTTP no inventário mostra retry e tenta carregar novamente", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let installedRequests = 0;
  let markFirstFailure;
  let markRecovery;
  const firstFailure = new Promise(resolve => { markFirstFailure = resolve; });
  const recovered = new Promise(resolve => { markRecovery = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await disableWebSocket(page);
    await page.route("**/health", route => fulfillJson(route, 200, { ok: true }));
    await page.route("**/api/apps", route => fulfillJson(route, 200, appsPayload));
    await page.route("**/api/apps/installed", async route => {
      installedRequests += 1;
      if (installedRequests === 1){
        await fulfillJson(route, 500, { ok: false });
        markFirstFailure();
        return;
      }
      await fulfillJson(route, 200, { ok: true, apps: installedApps });
      markRecovery();
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await firstFailure;
    await page.waitForSelector("#connectionRetry:visible", { timeout: 2000 });
    await recovered;
    await page.waitForFunction(() => !document.body.classList.contains("is-disconnected"));
    assert.ok(installedRequests >= 2, "o inventário deve ser solicitado novamente após uma resposta HTTP de erro");
    assert.ok(await page.locator(".atile").count() > 0, "a tentativa recuperada deve preencher o launchpad");
  } finally {
    await browser.close();
    await close();
  }
});

test("tela Abertos restaurada mostra seu estado inicial antes da resposta do Mac", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  let releaseApps;
  let releaseInstalled;
  let markAppsStarted;
  let markInstalledStarted;
  const appsGate = new Promise(resolve => { releaseApps = resolve; });
  const installedGate = new Promise(resolve => { releaseInstalled = resolve; });
  const appsStarted = new Promise(resolve => { markAppsStarted = resolve; });
  const installedStarted = new Promise(resolve => { markInstalledStarted = resolve; });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await page.addInitScript(() => localStorage.setItem("dokke.lastScreen", "recents"));
    await disableWebSocket(page);
    await page.route("**/health", route => fulfillJson(route, 200, { ok: true }));
    await page.route("**/api/apps", async route => {
      markAppsStarted();
      await appsGate;
      await fulfillJson(route, 200, appsPayload);
    });
    await page.route("**/api/apps/installed", async route => {
      markInstalledStarted();
      await installedGate;
      await fulfillJson(route, 200, { ok: true, apps: installedApps });
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await Promise.all([appsStarted, installedStarted]);
    assert.equal(await page.locator("body").evaluate(element => element.classList.contains("is-recents")), true);
    assert.equal(await page.locator("#screenRecents .rempty").isVisible(), true,
      "a tela restaurada deve mostrar seu estado vazio enquanto o Mac ainda não respondeu");
  } finally {
    releaseApps();
    releaseInstalled();
    await browser.close();
    await close();
  }
});
