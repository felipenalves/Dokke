import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "../server.js";

test("GET / serve as 2 telas (apps + apps abertos) liquid glass", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") || "", /text\/html/);
    const html = await r.text();
    assert.match(html, /id="dokke"/, "html deve marcar a raiz da tela");
    assert.match(html, /id="screens"/, "html deve ter o wrapper das 2 telas");
    assert.match(html, /id="screenApps"/, "html deve ter a tela apps");
    assert.match(html, /id="screenRecents"/, "html deve ter a tela recentes");
    assert.match(
      html,
      /\.login-card\{[\s\S]*background: linear-gradient\(165deg, rgba\(255,255,255,\.18\), rgba\(255,255,255,\.07\) 55%, rgba\(255,255,255,\.12\)\);/,
      "painel de conexão deve ter opacidade suficiente para preservar a leitura"
    );
    assert.match(html, /toast\("Dispositivo conectado"\)/, "o status deve identificar o dispositivo conectado");
    assert.doesNotMatch(html, /toast\("Mac conectado"\)/, "o status não deve atribuir a conexão ao Mac");
    assert.match(html, /id="vdots"/, "html deve ter os dots verticais laterais");
    assert.match(html, /\.vdots\{[\s\S]*safe-area-inset-right/, "V-Dots devem respeitar a safe area lateral");
    assert.doesNotMatch(html, /html\.land-secondary \.vdots\{/, "V-Dots não devem migrar para a esquerda em landscape-secondary");
    assert.match(html, /body\{[\s\S]*position: fixed;\s*inset: 0;/, "body deve cobrir o viewport inteiro do iPad");
    assert.match(html, /body\{[\s\S]*top: calc\(-1px - env\(safe-area-inset-top/, "body deve avançar pela safe area do iPad");
    assert.match(html, /main\{[\s\S]*position: fixed;\s*inset:\s*0;/, "main deve ficar preso ao viewport, sem fresta no canto");
    assert.match(html, /contextmenu[\s\S]*preventDefault/, "cards não devem abrir o menu nativo de imagem");
    assert.match(html, /-webkit-touch-callout: none/, "cards não devem abrir callout no toque longo");
    assert.match(html, /img\.draggable = false/, "ícones não devem ser arrastáveis");
    assert.match(html, /\.bg\{[\s\S]*right: calc\(-32px - env\(safe-area-inset-right/, "fundo deve cobrir a borda lateral do PWA");
    assert.match(html, /const HEALTH_OK = 15000, APPS_OK = 2500/, "fallback de apps deve atualizar rápido sem WebSocket");
    assert.match(html, /id="launchpad"/, "html deve ter o launchpad");
    assert.match(html, /\.launchpad\{[\s\S]*touch-action: none;[\s\S]*overscroll-behavior: none;/, "pager não deve deixar o Safari roubar o gesto vertical");
    assert.match(html, /launchpad\.style\.scrollBehavior = "auto"/, "pager deve seguir o dedo sem smooth acumulado");
    assert.match(html, /function animateHorizontalSnap\(target, duration\)/, "pager deve ter encaixe com duração controlada");
    assert.match(html, /const IS_ANDROID_WEBVIEW/, "Android WebView deve ter caminho próprio");
    assert.match(html, /const ANDROID_NATIVE_PAGER = IS_ANDROID_WEBVIEW/, "Android deve usar o pager nativo");
    assert.match(html, /\.android-webview \.launchpad\{[\s\S]*touch-action: pan-x;/, "Android deve deixar o WebView conduzir o arrasto horizontal");
    assert.match(html, /if \(launchpad\) launchpad\.scrollLeft = hStart - hDx/, "pager Android deve acompanhar o dedo pelo scroll nativo");
    assert.match(html, /IS_ANDROID_WEBVIEW \? \(dir \? 140 : 90\)/, "Android deve usar encaixe mais curto sem perder a suavidade");
    assert.match(html, /function syncDots\(pageIdx\)/, "dots devem ter sincronização independente do evento scroll");
    assert.match(html, /launchpad\.addEventListener\("scroll"/, "dots devem acompanhar o scroll nativo do Android");
    assert.match(html, /nativeLaunchpadGesture/, "gesto horizontal Android deve ficar fora do ponteiro capturado");
    assert.match(html, /const HV_FLICK = 0\.32/, "flick horizontal deve responder a arrastos rápidos sem exigir força");
    assert.match(html, /const HPAGE_RATIO = 0\.18/, "arrasto lento deve trocar antes de ocupar um quarto da tela");
    assert.match(html, /OBS Commander/, "html deve conter o drawer OBS Commander");
    assert.match(html, /function tileLong/, "long-press no launchpad fixa/desfixa favorito");
    assert.doesNotMatch(html, /Recentes\.\.\./, "tela 2 sem título Recentes...");
    assert.doesNotMatch(html, /\.screens\.up/, "sem classe .up com transform CSS (tranco)");
    assert.match(html, /function goScreen/, "troca de tela final via goScreen (sem setY fixo)");
    assert.match(html, /body\.is-recents/, "troca de tela por classe opacity (não empilha telas)");
    assert.match(html, /#screenRecents\{[\s\S]*transform: translate3d\(0, 100%, 0\)/, "tela 2 deve começar fora da viewport");
    assert.match(html, /body\.is-recents #screenApps\{[\s\S]*transform: translate3d\(0, -100%, 0\)/, "tela 1 deve permanecer fora quando tela 2 estiver ativa");
    assert.match(html, /function clearDrag\(\)[\s\S]*is-recents[\s\S]*translate3d\(0, -100%, 0\)/, "limpeza do gesto não pode trazer a tela inativa de volta");
    assert.match(html, /function renderDeck/, "tela 2 com dock horizontal organizado");
    assert.match(html, /\.deck\{[\s\S]*padding: 0 clamp\(12px, 3vw, 32px\) 22px;/, "tela 2 deve usar o mesmo padding lateral da tela 1");
    assert.match(html, /\.deck-inner\{[\s\S]*gap: min\(2\.5vmin, 12px\);[\s\S]*padding: 0;/, "tela 2 deve usar o mesmo gap da grid da tela 1");
    assert.match(html, /\.dcard\{[\s\S]*width: var\(--app-tile\);/, "cards da tela 2 não devem adicionar margem invisível");
    assert.match(html, /orientation: portrait\) and \(max-width:699px\)[\s\S]*--app-tile: min\(44vw, calc\(\(100dvh - var\(--dokke-safe-top\) - var\(--dokke-safe-bottom\) - 96px\) \/ 4\), 190px\)/, "celular em retrato deve caber no viewport standalone");
    assert.match(html, /orientation: landscape\) and \(max-height:500px\)[\s\S]*--app-tile: min\(40vmin, 21vw, 180px\)/, "celular deitado deve manter folga vertical no A02");
    assert.match(html, /function setLayer\(on, axis\)/, "camadas GPU devem ser escolhidas pelo eixo do gesto");
    const layerStart = html.indexOf("function setLayer(on, axis)");
    const layerEnd = html.indexOf("let dragRaf", layerStart);
    assert.match(html.slice(layerStart, layerEnd), /if \(on\)[\s\S]*return;[\s\S]*requestAnimationFrame/, "efeitos pesados devem ser restaurados depois do frame final");
    assert.match(html, /setLayer\(true, "horizontal"\)/, "slide horizontal deve promover apenas a faixa de apps");
    assert.match(html, /setLayer\(true, "vertical"\)/, "slide vertical deve promover as telas");
    assert.match(html, /body\.swiping \.launchpad\{[\s\S]*scroll-snap-type: none/, "slide deve desativar o snap durante o gesto");
    assert.doesNotMatch(html, /body\.swiping \.atile \.aglass|body\.swiping \.dcard \.aglass|body\.swiping \.aglass::before/, "trocar de página não deve alterar visualmente o card-glass");
    assert.match(html, /\.android-webview \.aglass\{[\s\S]*0 2px 5px rgba\(0,0,0,\.24\)/, "Android deve manter o glass com sombra externa leve");
    assert.match(html, /\.android-webview \.aglass::before\{\s*display: none;/, "Android deve evitar o highlight extra dos cards");
    assert.doesNotMatch(html, /@keyframes touchRipple|\.aglass::after/, "toque não deve criar brilho/ripple branco");
    assert.doesNotMatch(html, /\.atile:active\{\s*background:/, "toque não deve pintar um fundo extra no tile");
    assert.match(html, /function triggerHaptic\(\)/, "toque deve ter uma camada única de feedback háptico");
    assert.match(html, /navigator\.vibrate\(8\)/, "PWA deve solicitar uma vibração curta quando suportado");
    assert.match(html, /window\.DokkeAndroid[\s\S]*performHapticFeedback/, "APK deve usar o bridge nativo de haptic");
    const deckGestureStart = html.indexOf("function bindDeckGestures()");
    const deckGestureEnd = html.indexOf("function renderRecents()", deckGestureStart);
    const deckGesture = html.slice(deckGestureStart, deckGestureEnd);
    const deckPointerDown = deckGesture.match(/deck\.addEventListener\("pointerdown"[\s\S]*?\n    \}\);/);
    assert.ok(deckPointerDown, "deck deve registrar o início do gesto");
    assert.doesNotMatch(deckPointerDown[0], /classList\.add\("swiping"\)/, "toque simples no deck não deve escurecer todos os cards");
    assert.match(deckGesture, /pointermove[\s\S]*classList\.add\("swiping"\)/, "somente o arraste real deve ativar o modo swiping");
    assert.match(html, /const DRAG = 4/, "Android deve iniciar o gesto com menos deslocamento");
    assert.match(html, /const COOLDOWN_MS = 80/, "retorno rápido não deve ser bloqueado por cooldown longo");
    assert.match(html, /function commitPx\(\)\{ return Math\.max\(34, Math\.round\(h\(\) \* 0\.06\)\); \}/, "retorno vertical deve confirmar com um arrasto menor");
    assert.match(html, /IS_ANDROID_WEBVIEW \? \(dir \? 140 : 90\)/, "Android deve encaixar o pager em menos tempo");
    assert.match(html, /transform: rotate\(var\(--icon-turn\)\);/, "ícones não devem ganhar uma textura GPU extra");
    assert.doesNotMatch(html, /layoutTimeTravel|centerTimeTravel|bindTimeTravel|favscroll|favrow/, "Time Travel v01 removido (deck v03)");
    assert.match(html, /"Apps abertos"/, "tela 2 com título Apps abertos");
    assert.doesNotMatch(html, /tzone-pin|tdivider/, "tela 2 v03 sem split pinados/divisor antigo");
    assert.doesNotMatch(html, /Long press any app to pin|Long press any app to unpin/, "tela 2 não oferece fixação");
    assert.doesNotMatch(html, /📌/, "sem emoji de pin");
    assert.match(html, /\.thint/, "hint com classe thint presente");
    assert.doesNotMatch(html, /\.ddiv|className = "ddiv"/, "tela 2 sem grupo de fixados ou divisor");
    assert.match(html, /\.dcard\.front/, "card da frente com classe front");
    assert.doesNotMatch(html, /toque em \+ para adicionar/, "copy morta do botão + removida");
    assert.match(html, /id="upDownload"/, "aviso de atualização deve ter ação explícita");
    assert.match(html, /DokkeAndroid\.requestUpdate/, "Android deve controlar o download da atualização");
    assert.match(html, /cmpVer\(rel\.tag, apkNow\)/, "APK deve comparar a versão instalada com a release");
    assert.match(html, /function loadIcon/, "ícones devem ter cache compartilhado entre as telas");
    assert.match(html, /const ICON_REV = "5"/, "ícones corrigidos devem invalidar o cache antigo do navegador");
    assert.match(html, /if \(img && !img\.src\) img\.src = iconPath\(name\)/, "o card deve apontar para o endpoint do ícone sem esperar o blob");
    assert.match(html, /running\.forEach\(function\(a\)[\s\S]*?primeIcon\(a\.name\)/, "ícones de apps recém-abertos devem ser aquecidos antes da montagem da tela 2");
    assert.match(html, /primeIcon\(name\)/, "o clique deve adiantar o carregamento do ícone da tela 2");
    assert.match(html, /@keyframes appPress/, "o toque no app deve ter feedback visual");
    assert.doesNotMatch(html, /touchRipple|--press-x|--press-y/, "o toque não deve criar brilho localizado");
    assert.match(html, /pressFeedback\(el, e\)/, "o feedback deve receber o evento de toque");
    assert.match(html, /\.atile\.is-activating, \.dcard\.is-activating\{[\s\S]*background: transparent !important;[\s\S]*animation: appPress/, "o feedback deve animar o tile inteiro sem revelar uma segunda camada");
    assert.doesNotMatch(html, /\.atile\.is-activating \.aglass, \.dcard\.is-activating \.aglass\{[\s\S]*animation: appPress/, "o glass interno não deve ser comprimido separadamente");
    const buttonStart = html.indexOf("function makeBtn");
    const buttonEnd = html.indexOf("// ---------- actions", buttonStart);
    assert.doesNotMatch(html.slice(buttonStart, buttonEnd), /pointercancel[\s\S]*remove\("is-activating"\)/, "pointercancel não deve apagar o feedback antes do timer");
    assert.match(html, /--icon-turn/, "a orientação deve girar o conteúdo dentro do glass");
    assert.match(html, /translate3d\(0, /, "slide vertical deve usar composição 3D");
    assert.doesNotMatch(html, /#screenApps\{ opacity:|#screenRecents\{ opacity:/, "slide não deve animar opacidade junto com a posição");
    const settleStart = html.indexOf("function settleTo(nextName)");
    const settleEnd = html.indexOf("function settleAndCommit", settleStart);
    assert.ok(settleStart >= 0 && settleEnd > settleStart, "settleTo deve existir isolada");
    assert.doesNotMatch(html.slice(settleStart, settleEnd), /goScreen\(nextName\)/, "troca de camada só deve ocorrer depois do slide");
    assert.match(html, /let recentsRenderPending = false/, "render da tela 2 deve ter estado pendente");
    assert.match(html, /let launchpadRenderPending = false/, "render da tela 1 deve ter estado pendente");
    assert.match(html, /function renderPendingRecentsBeforeTransition\(\)/, "tela 2 pendente deve ser preparada antes da animação vertical");
    assert.match(html, /function renderPendingLaunchpadBeforeTransition\(\)/, "tela 1 pendente deve ser preparada antes da animação vertical");
    assert.match(html, /body\.classList\.contains\("swiping"\)[\s\S]*recentsRenderPending/, "render da tela 2 não deve ocorrer durante o gesto");
    assert.match(html, /body\.classList\.contains\("swiping"\)[\s\S]*launchpadRenderPending/, "render da tela 1 não deve ocorrer durante o gesto");
    const settleBody = html.slice(settleStart, settleEnd);
    assert.match(settleBody, /if \(nextName === "recents"\)\{[\s\S]*renderPendingRecentsBeforeTransition\(\);[\s\S]*void screensEl\.offsetHeight;/, "render pendente deve sair do frame final da transição");
    assert.match(settleBody, /if \(nextName === "apps"\)\{[\s\S]*renderPendingLaunchpadBeforeTransition\(\);[\s\S]*void screensEl\.offsetHeight;/, "render pendente do launchpad deve sair do frame final da transição");
    assert.doesNotMatch(html, /landscape = next;\s*renderLaunchpad\(true\)/, "rotação não deve reconstruir a tela 1");
    assert.match(html, /function favLong[\s\S]*?textContent = "\\\"" \+ name/, "nome de app no modal deve entrar via textContent");
    assert.match(html, /function modal\(html, beforeMount, kind\)/, "modal deve aceitar variação visual sem duplicar a lógica");
    assert.match(html, /classList\.toggle\("confirm-scrim", isConfirm\)/, "confirmação deve usar scrim próprio do Dokke");
    assert.match(html, /className = "aglass confirm-icon"/, "confirmação deve mostrar o ícone real do app");
    assert.match(html, /\}, "confirm"\);/, "remoção de favorito deve abrir a confirmação visual correta");
    assert.match(html, /function syncIconOrientation\(\)[\s\S]*setProperty\("--icon-turn", "0deg"\)/, "ícones reais devem permanecer na orientação normal");
    assert.match(html, /hOriginInLaunchpad = !!\(e\.target[\s\S]*closest\("\.launchpad"\)\)/, "gesto horizontal deve guardar a origem antes do pointer capture do Android");
    assert.match(html, /if \(!hOriginInLaunchpad && !hOriginInDeck\) return/, "gesto Android não deve depender do target capturado");
    assert.match(html, /hOriginInDeck = !!\(e\.target[\s\S]*closest\("\.deck"\)\)/, "gesto iniciado sobre um app da tela 2 deve guardar a origem");
    assert.match(html, /nativeDeckGesture = hOriginInDeck/, "dock deve deixar o arraste horizontal nativo e reservar o vertical para a troca de tela");
    assert.doesNotMatch(html.slice(html.indexOf("function bindDeckGestures()"), html.indexOf("function renderRecents()")), /pointerdown[\s\S]*stopPropagation/, "dock não pode bloquear o gesto vertical sobre os ícones");
    assert.match(html, /if \(nativeLaunchpadGesture \|\| nativeDeckGesture\)/, "gesto vertical deve assumir o ponteiro depois de sair do arraste horizontal nativo");
    assert.match(html, /scene\.dataset\.scene = s[\s\S]*?scene\.textContent = s/, "nome de cena deve entrar via DOM, não HTML cru");
    assert.doesNotMatch(html, /data-scene=\\\"" \+ s/, "nome de cena não pode ser concatenado em atributo HTML");
  } finally { await close(); }
});

test("GET / inclui PWA manifest link, apple-mobile-web-app e service worker", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /rel="manifest"\s+href="\/manifest\.webmanifest"/, "link rel=manifest deve apontar para manifest.webmanifest");
    assert.match(html, /name="apple-mobile-web-app-capable"\s+content="yes"/, "apple-mobile-web-app-capable=yes");
    assert.match(html, /name="apple-mobile-web-app-status-bar-style"/, "apple-mobile-web-app-status-bar-style deve existir");
    assert.match(html, /rel="apple-touch-icon"/, "apple-touch-icon deve existir");
    assert.match(html, /rel="icon"[^>]*media="\(prefers-color-scheme: light\)"[^>]*href="\/icon-192\.png"/, "favicon claro deve existir");
    assert.match(html, /rel="icon"[^>]*media="\(prefers-color-scheme: dark\)"[^>]*href="\/icon-192-dark\.png"/, "favicon escuro deve existir");
    assert.match(html, /viewport-fit=cover/, "viewport-fit=cover deve estar no viewport meta");
    assert.match(html, /serviceWorker/, "deve registrar service worker");
    assert.match(html, /\/sw\.js/, "deve referenciar sw.js");
  } finally { await close(); }
});

test("toque no app não revela um segundo glass durante a animação", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForSelector(".atile");

    const state = await page.locator(".atile").first().evaluate(tile => {
      tile.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: 10,
        clientY: 10,
      }));
      const glass = tile.querySelector(".aglass");
      return {
        tileAnimation: getComputedStyle(tile).animationName,
        tileBackground: getComputedStyle(tile).backgroundColor,
        glassAnimation: getComputedStyle(glass).animationName,
      };
    });

    assert.equal(state.tileAnimation, "appPress", "a animação deve ficar no tile inteiro");
    assert.equal(state.tileBackground, "rgba(0, 0, 0, 0)", "o tile não deve criar um glass por baixo");
    assert.equal(state.glassAnimation, "none", "o glass interno não deve ser comprimido separadamente");
  } finally {
    await browser.close();
    await close();
  }
});

test("login reposiciona o cartão dentro do visual viewport quando o teclado abre", async () => {
  const { port, close } = await startServer({ port: 0, trustLoopback: false });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 411, height: 888 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.addInitScript(() => {
      const listeners = {};
      const visualViewport = {
        height: 888,
        width: 411,
        offsetTop: 0,
        addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
        removeEventListener() {},
      };
      Object.defineProperty(window, "visualViewport", { configurable: true, value: visualViewport });
      window.__setKeyboardViewport = height => {
        visualViewport.height = height;
        listeners.resize?.forEach(listener => listener());
      };
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.locator("#loginScrim.show").waitFor();
    await page.evaluate(() => window.__setKeyboardViewport(596));

    const bounds = await page.evaluate(() => {
      const scrim = document.querySelector("#loginScrim").getBoundingClientRect();
      const button = document.querySelector("#loginGo").getBoundingClientRect();
      return { scrimBottom: scrim.bottom, buttonBottom: button.bottom };
    });
    assert.ok(bounds.scrimBottom <= 596.5, "scrim deve acompanhar a altura visível quando o teclado abre");
    assert.ok(bounds.buttonBottom <= 596.5, "botão Conectar deve continuar visível acima do teclado");
  } finally {
    await browser.close();
    await close();
  }
});

test("login em desktop landscape permanece na orientação normal", async () => {
  const { port, close } = await startServer({ port: 0, trustLoopback: false });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.locator("#loginScrim.show").waitFor();

    const layout = await page.evaluate(() => {
      const scrim = document.querySelector("#loginScrim");
      const card = document.querySelector(".login-card");
      const scrimStyle = getComputedStyle(scrim);
      const cardRect = card.getBoundingClientRect();
      return {
        transform: scrimStyle.transform,
        cardWidth: cardRect.width,
        cardHeight: cardRect.height,
        viewportWidth: window.innerWidth,
      };
    });
    assert.equal(layout.transform, "none", "desktop não deve girar o scrim de login");
    assert.ok(layout.cardWidth < layout.viewportWidth / 2, "desktop deve manter o cartão compacto horizontalmente");
    assert.ok(layout.cardHeight < layout.viewportWidth / 2, "desktop não deve transformar o cartão em uma coluna girada");
  } finally {
    await browser.close();
    await close();
  }
});

test("Android atualizado não exibe o banner de atualização do Mac host", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.DokkeAndroid = {
        appVersion: () => "0.2.7",
        requestUpdate: () => {}
      };
    });
    await page.route("**/api/version", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          local: { tag: "v0.2.6", apkVersion: "0.2.6" },
          latest: { tag: "v0.2.7", apkUrl: "https://example.test/dokke.apk" }
        })
      });
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    const shown = await page.locator("#upBanner").evaluate(el => el.classList.contains("show"));
    assert.equal(shown, false, "APK atualizado não pode herdar o alerta do Mac host antigo");
  } finally {
    await browser.close();
    await close();
  }
});

test("falha ao ler versão do Android não cai no banner do Mac", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.DokkeAndroid = {
        appVersion: () => { throw new Error("bridge indisponível"); },
        requestUpdate: () => {}
      };
    });
    await page.route("**/api/version", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          local: { tag: "v0.2.6", apkVersion: "0.2.6" },
          latest: { tag: "v0.2.7", apkUrl: "https://example.test/dokke.apk" }
        })
      });
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    const shown = await page.locator("#upBanner").evaluate(el => el.classList.contains("show"));
    assert.equal(shown, false, "Android sem versão legível não pode herdar o alerta do Mac");
  } finally {
    await browser.close();
    await close();
  }
});

test("gesto de retorno acompanha a tela 2 até a tela 1", async () => {
  const { port, close } = await startServer(0);
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const match = html.match(/function rubberDy\(dy\)\{([\s\S]*?)\n    \}/);
    assert.ok(match, "rubberDy deve existir");
    const rubberDy = new Function("dy", "state", "h", "RUBBER", match[1]);
    assert.equal(rubberDy(200, { screen: "recents" }, () => 800, 28), 200,
      "o retorno deve seguir o dedo, não ficar preso no rubber band");
    assert.equal(rubberDy(-200, { screen: "recents" }, () => 800, 28), -28,
      "o overscroll para cima continua limitado");
  } finally { await close(); }
});

test("GET /manifest.webmanifest retorna JSON válido com display standalone", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
    assert.equal(r.status, 200);
    const m = await r.json();
    assert.equal(m.display, "standalone");
    assert.equal(m.name, "dokke");
    assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, "manifest deve ter icons");
  } finally { await close(); }
});

test("GET /sw.js retorna service worker com cache-first", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/sw.js`);
    assert.equal(r.status, 200);
    const js = await r.text();
    assert.match(js, /caches\.open/, "sw.js deve usar Cache API");
    assert.match(js, /dokke-v16/, "service worker deve invalidar o cache antigo da UI");
    assert.match(js, /icon-192-dark\.png/, "service worker deve precachear o favicon escuro");
    assert.match(js, /url\.pathname === "\/sw\.js"/, "service worker não deve cachear a própria atualização");
    assert.match(js, /cache-first|caches\.match/, "sw.js deve ter strategy cache-first");
    assert.match(js, /install/, "sw.js deve ter evento install");
    assert.match(js, /activate/, "sw.js deve ter evento activate");
    assert.match(js, /fetch/, "sw.js deve ter evento fetch");
  } finally { await close(); }
});

test("grid em retrato não corta cards quando o PWA tem safe area", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ headless: true });
  const apps = Array.from({ length: 8 }, (_, i) => ({ name: `App ${i + 1}`, icon: false }));
  const pinned = apps.map(app => app.name);
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
    });
    await page.route("**/api/apps/installed", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, apps }),
    }));
    await page.route("**/api/apps", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, pinned, running: [], v: "0.2.7" }),
    }));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    // O Playwright não expõe safe-area-inset-*; estas dimensões reproduzem o
    // recuo do status bar e do indicador Home do PWA em um iPhone moderno.
    await page.addStyleTag({ content: ":root{--dokke-safe-top:59px;--dokke-safe-bottom:44px}.screen{padding-top:59px !important}.dots{padding-bottom:44px !important}" });
    await page.waitForFunction(() => document.querySelectorAll(".atile").length === 8);
    const bounds = await page.evaluate(() => {
      const pageRect = document.querySelector(".page").getBoundingClientRect();
      const launchpad = document.querySelector(".launchpad").getBoundingClientRect();
      const tiles = [...document.querySelectorAll(".page:first-child .atile")].map(el => el.getBoundingClientRect());
      return {
        page: { top: pageRect.top, bottom: pageRect.bottom },
        launchpad: { top: launchpad.top, bottom: launchpad.bottom },
        first: { top: tiles[0].top, bottom: tiles[0].bottom },
        last: { top: tiles.at(-1).top, bottom: tiles.at(-1).bottom },
      };
    });
    assert.ok(bounds.first.top >= bounds.launchpad.top - 0.5, "primeiro card não pode escapar pelo topo do pager");
    assert.ok(bounds.last.bottom <= bounds.launchpad.bottom + 0.5, "último card não pode ser cortado pelo rodapé do PWA");
  } finally {
    await browser.close();
    await close();
  }
});
