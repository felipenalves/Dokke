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
