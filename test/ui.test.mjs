import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "../server.js";

test("GET / serve as 3 telas (apps + apps abertos + usage) liquid glass", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") || "", /text\/html/);
    const html = await r.text();
    assert.match(html, /id="dokke"/, "html deve marcar a raiz da tela");
    assert.match(html, /id="screens"/, "html deve ter o wrapper das 3 telas");
    assert.match(html, /id="screenApps"/, "html deve ter a tela apps");
    assert.match(html, /id="screenRecents"/, "html deve ter a tela recentes");
    assert.match(html, /id="screenUsage"/, "html deve ter a tela Usage");
    assert.match(html, /<title>Dokke<\/title>/, "o título visível do PWA deve usar a marca correta");
    assert.match(
      html,
      /\.login-card\{[\s\S]*background: linear-gradient\(165deg, rgba\(255,255,255,\.18\), rgba\(255,255,255,\.07\) 55%, rgba\(255,255,255,\.12\)\);/,
      "painel de conexão deve ter opacidade suficiente para preservar a leitura"
    );
    assert.match(html, /toast\(t\("toast\.deviceConnected"\)\)/, "o status deve identificar o dispositivo conectado");
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
    assert.match(html, /const H_SNAP_DURATION = 250/, "pager deve usar um assentamento único de 250 ms");
    assert.match(html, /function smoothSnapProgress\(p\)/, "pager deve usar easing suave no assentamento");
    assert.match(html, /const IS_ANDROID_WEBVIEW/, "Android WebView deve ter caminho próprio");
    assert.doesNotMatch(html, /const ANDROID_NATIVE_PAGER|nativeLaunchpadGesture|nativeLaunchpadPending/, "Android não deve deixar o launchpad iniciar fling nativo concorrente");
    assert.match(html, /\.android-webview \.launchpad\{[\s\S]*touch-action: none;[\s\S]*scroll-snap-type: none;/, "Android deve entregar o arrasto inteiro ao pager controlado");
    assert.match(html, /\.android-webview \.launchpad\{[\s\S]*scroll-behavior: auto;/, "Android deve deixar o assentamento JavaScript controlar a rolagem");
    assert.match(html, /if \(launchpad\) launchpad\.scrollLeft = hStart - hDx/, "pager deve acompanhar o dedo pelo scroll controlado");
    assert.match(html, /hLastX = e\.clientX; hVel = 0; hGest = false; hDx = 0;/, "cada toque deve começar sem deslocamento horizontal residual");
    assert.doesNotMatch(html, /IS_ANDROID_WEBVIEW \? \(dir \? 140 : 90\)/, "Android não deve usar um encaixe brusco separado");
    assert.match(html, /function syncDots\(pageIdx\)/, "dots devem ter sincronização independente do evento scroll");
    assert.match(html, /launchpad\.addEventListener\("scroll"/, "dots devem acompanhar o scroll nativo do Android");
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
    assert.match(html, /function clearDrag\(\)[\s\S]*screenElements\.forEach[\s\S]*translate3d\(0, /, "limpeza do gesto deve reancorar todas as telas");
    assert.match(html, /function renderDeck/, "tela 2 com dock horizontal organizado");
    assert.match(html, /\.deck\{[\s\S]*padding: 0 clamp\(12px, 3vw, 32px\) 22px;/, "tela 2 deve usar o mesmo padding lateral da tela 1");
    assert.match(html, /\.page-grid\{[\s\S]*grid-gap: clamp\(20px, 3vw, 32px\);[\s\S]*justify-content: center;/, "a grade deve preservar o gutter normal entre os apps");
    assert.match(html, /\.page-grid\{[\s\S]*padding: clamp\(8px, 2vw, 24px\) clamp\(12px, 3vw, 32px\);/, "a grade deve preservar o padding interno dos slots");
    assert.doesNotMatch(html, /function updatePageGridTransforms\(\)/, "o pager não deve deslocar o grid de outro slide");
    assert.doesNotMatch(html, /pageSeamShift/, "o pager não deve calcular uma emenda que revele outro slide");
    assert.match(html, /\.page\{[\s\S]*overflow: hidden;/, "cada página deve cortar os slots do slide seguinte");
    assert.match(html, /\.deck-inner\{[\s\S]*gap: min\(3vmin, 14px\);[\s\S]*padding: 0;/, "tela 2 deve usar o mesmo gap da grid da tela 1");
    assert.match(html, /\.dcard\{[\s\S]*width: var\(--app-tile\);/, "cards da tela 2 não devem adicionar margem invisível");
    assert.match(html, /--app-tile: min\(40vmin, max\(21vw,21vh\), 180px\);/, "celular deve usar a régua do landscape nos dois sentidos");
    assert.match(html, /@media \(min-width:700px\)[\s\S]*--app-tile: min\(max\(22vw,22vh\), min\(30vw,30vh\), 220px\);/, "telas maiores devem preservar o tamanho do landscape no portrait");
    assert.doesNotMatch(html, /--app-tile: min\(44vw,/, "portrait não deve ampliar os cards em relação ao landscape");
    assert.match(html, /--tile-in: 0\.84;/, "ícones devem ficar um pouco menores dentro do card");
    assert.match(html, /\.atile \.aglass\{[\s\S]*width: 100%; height: 100%;/, "o Card Glass deve continuar preenchendo o slot");
    assert.match(html, /\.atile \.aglass \.gicon, \.atile \.aglass img\.aicon\{[\s\S]*width: 84%; height: 84%;/, "somente o ícone da tela 1 deve diminuir");
    assert.match(html, /\.dcard\{[\s\S]*container-type: inline-size;/, "cards da tela 2 devem usar a mesma régua de container da tela 1");
    assert.match(html, /\.dcard \.aglass\{[\s\S]*border-radius: 29%;/, "glass da tela 2 deve usar o mesmo raio da tela 1");
    assert.match(html, /\.dcard \.aglass \.gicon, \.dcard \.aglass img\.aicon\{[\s\S]*width: 84%; height: 84%;[\s\S]*border-radius: 18%;/, "ícones da tela 2 devem usar a mesma escala da tela 1");
    assert.match(html, /--tile-r: 0\.29;/, "cards glass devem ter um raio ligeiramente menor");
    assert.match(html, /\.atile \.aglass\{[\s\S]*border-radius: 29%;/, "fallback deve aplicar o mesmo raio menor aos cards");
    assert.match(html, /\.atile \.aglass::before\{ border-radius: 29%; \}/, "o highlight deve acompanhar a nova curva do card");
    assert.match(html, /\.bg\{[\s\S]*rgba\(232, 111, 39, 0\.46\)[\s\S]*rgba\(184, 76, 20, 0\.28\)[\s\S]*#241106 0%[\s\S]*#150804 55%[\s\S]*#080301 100%/, "o fundo deve iluminar o glass sem perder profundidade");
    assert.doesNotMatch(html, /screen\.orientation\.lock/, "nenhum cliente deve forçar retrato");
    assert.doesNotMatch(html, /requestAppPortraitLock|appPortraitLockRequested|portraitLockRequested/, "nenhum estado de lock de retrato deve permanecer");
    assert.match(html, /function syncLoginOrientation\(\)/, "login deve sincronizar a orientação nativa quando disponível");
    assert.match(html, /android\.setLoginPortrait\(loginOpen\)/, "somente o estado do login deve ser enviado ao APK");
    const loginStart = html.indexOf("function showLogin()");
    const loginEnd = html.indexOf("function loginError", loginStart);
    const loginFlow = html.slice(loginStart, loginEnd);
    assert.match(loginFlow, /function showLogin\(\)[\s\S]*syncLoginOrientation\(\)/, "abrir o PIN deve pedir retrato no APK");
    assert.match(loginFlow, /function hideLogin\(\)[\s\S]*syncLoginOrientation\(\)/, "fechar o PIN deve liberar a orientação");
    assert.match(html, /orientationchange[\s\S]*layoutDockScale\(\)[\s\S]*updateLandDir\(\)/, "a interface deve recalcular o layout ao girar");
    assert.doesNotMatch(html, /function physicalIconTurn\(\)/, "a arte não deve compensar um lock de orientação removido");
    assert.match(html, /setProperty\("--icon-turn", "0deg"\)/, "os ícones devem permanecer na orientação normal");
    assert.match(html, /const availableH = launchpad\.clientHeight/, "o pager deve medir a altura útil antes de escalar a grade");
    assert.match(
      html,
      /for \(const grid of gridEls\)\{\s*grid\.style\.transform = "";\s*\}/,
      "a medição deve limpar a escala anterior antes de calcular a nova",
    );
    assert.match(html, /className = "page-grid"/, "a escala deve ficar numa grade interna, fora do item do pager");
    assert.match(html, /const gridEls = pageEls\.map\(page => page\.firstElementChild\)/, "o pager deve preservar a largura integral de cada página");
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
    assert.match(html, /function preventTouchFocusScroll\(el\)/, "toque em um app não deve deixar o WebView reposicionar o pager pelo foco");
    assert.match(html, /preventTouchFocusScroll\(el\)/, "tiles devem preservar o scroll durante o foco touch");
    assert.match(html, /el\.addEventListener\("focus", focus, true\)/, "a proteção deve cobrir o foco disparado depois do toque");
    assert.match(html, /document\.activeElement === el\) el\.blur\(\)/, "foco touch deve ser removido depois do clique sem afetar teclado");
    const deckGestureStart = html.indexOf("function bindDeckGestures()");
    const deckGestureEnd = html.indexOf("function renderRecents()", deckGestureStart);
    const deckGesture = html.slice(deckGestureStart, deckGestureEnd);
    const deckPointerDown = deckGesture.match(/deck\.addEventListener\("pointerdown"[\s\S]*?\n    \}\);/);
    assert.ok(deckPointerDown, "deck deve registrar o início do gesto");
    assert.doesNotMatch(deckPointerDown[0], /classList\.add\("swiping"\)/, "toque simples no deck não deve escurecer todos os cards");
    assert.match(deckGesture, /pointermove[\s\S]*classList\.add\("swiping"\)/, "somente o arraste real deve ativar o modo swiping");
    assert.match(html, /const DRAG = 4/, "Android deve iniciar o gesto com menos deslocamento");
    assert.doesNotMatch(html, /COOLDOWN_MS|coolUntil/, "gestos válidos não devem ser descartados por cooldown temporal");
    assert.match(html, /function commitPx\(\)\{ return Math\.max\(34, Math\.round\(h\(\) \* 0\.06\)\); \}/, "retorno vertical deve confirmar com um arrasto menor");
    assert.match(html, /const duration = reduced \? 1 : H_SNAP_DURATION/, "todos os clientes devem compartilhar a duração do encaixe");
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
    assert.match(html, /function favLong[\s\S]*?title\.textContent = isWebsite \?[\s\S]*?body\.textContent = isWebsite/, "nomes de apps e websites devem entrar no modal via textContent");
    assert.match(html, /function modal\(html, beforeMount, kind\)/, "modal deve aceitar variação visual sem duplicar a lógica");
    assert.match(html, /classList\.toggle\("confirm-scrim", isConfirm\)/, "confirmação deve usar scrim próprio do Dokke");
    assert.match(html, /className = "aglass confirm-icon"/, "confirmação deve mostrar o ícone real do app");
    assert.match(html, /\}, "confirm"\);/, "remoção de favorito deve abrir a confirmação visual correta");
    assert.match(html, /function syncIconOrientation\(\)[\s\S]*setProperty\("--icon-turn", "0deg"\)/, "PWA e APK devem manter os ícones sem rotação artificial");
    assert.match(html, /hOriginInLaunchpad = !!\(e\.target[\s\S]*closest\("\.launchpad"\)\)/, "gesto horizontal deve guardar a origem antes do pointer capture do Android");
    assert.match(html, /if \(!hOriginInLaunchpad && !hOriginInDeck\) return/, "gesto Android não deve depender do target capturado");
    assert.match(html, /hOriginInDeck = !!\(e\.target[\s\S]*closest\("\.deck"\)\)/, "gesto iniciado sobre um app da tela 2 deve guardar a origem");
    assert.match(html, /nativeDeckGesture = hOriginInDeck/, "dock deve deixar o arraste horizontal nativo e reservar o vertical para a troca de tela");
    assert.doesNotMatch(html.slice(html.indexOf("function bindDeckGestures()"), html.indexOf("function renderRecents()")), /pointerdown[\s\S]*stopPropagation/, "dock não pode bloquear o gesto vertical sobre os ícones");
    assert.match(html, /if \(nativeDeckGesture\)\{[\s\S]*setPointerCapture/, "gesto vertical sobre o dock deve assumir o ponteiro depois de sair do arraste horizontal nativo");
    assert.match(html, /scene\.dataset\.scene = s[\s\S]*?scene\.textContent = s/, "nome de cena deve entrar via DOM, não HTML cru");
    assert.doesNotMatch(html, /data-scene=\\\"" \+ s/, "nome de cena não pode ser concatenado em atributo HTML");
  } finally { await close(); }
});

test("ícones da tela 2 usam o mesmo enquadramento visual da tela 1", async () => {
  const { port, close } = await startServer({
    port: 0,
    obs: null,
    config: {
      schemaVersion: 2,
      revision: 0,
      pieces: [{ id: "app:Terminal", type: "app", name: "Terminal", position: 0 }],
      pinned: [],
    },
    appTools: {
      listAppProcesses: async () => [{ name: "Terminal", pid: 7, type: "Foreground" }],
      listInstalledApps: async () => [{ name: "Terminal", path: "/Applications/Utilities/Terminal.app", icon: false }],
    },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".atile .aglass", { timeout: 15000 });
    await page.waitForSelector(".dcard .aglass", { timeout: 15000 });
    const metrics = await page.evaluate(() => {
      const read = selector => {
        const root = document.querySelector(selector);
        const glass = root.querySelector(".aglass");
        const icon = root.querySelector(".aglass img.aicon, .aglass .gicon");
        const glassStyle = getComputedStyle(glass);
        const iconStyle = getComputedStyle(icon);
        return {
          glassRadius: glassStyle.borderRadius,
          iconRadius: iconStyle.borderRadius,
          iconWidth: icon.getBoundingClientRect().width,
          iconHeight: icon.getBoundingClientRect().height,
        };
      };
      return { first: read(".atile"), second: read(".dcard") };
    });
    assert.equal(metrics.second.glassRadius, metrics.first.glassRadius, "raio externo deve ser igual nas duas telas");
    assert.equal(metrics.second.iconRadius, metrics.first.iconRadius, "raio do ícone deve ser igual nas duas telas");
    assert.ok(Math.abs(metrics.second.iconWidth - metrics.first.iconWidth) < 0.1, "largura do ícone deve ser igual nas duas telas");
    assert.ok(Math.abs(metrics.second.iconHeight - metrics.first.iconHeight) < 0.1, "altura do ícone deve ser igual nas duas telas");
  } finally {
    await browser.close();
    await close();
  }
});

test("swipes verticais rápidos encadeiam as telas sem repetir a tela anterior", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });

    const currentScreen = () => page.evaluate(() =>
      document.body.classList.contains("is-usage")
        ? "usage"
        : document.body.classList.contains("is-recents")
          ? "recents"
          : "apps"
    );
    const swipe = async (direction, pauseAfter = 50) => {
      const box = await page.locator("#screens").boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const sign = direction === "up" ? -1 : 1;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(cx, cy + sign * 55 * i, { steps: 1 });
        await page.waitForTimeout(4);
      }
      await page.mouse.up();
      await page.waitForTimeout(pauseAfter);
    };

    await swipe("up");
    await swipe("up", 500);
    assert.equal(await currentScreen(), "usage", "o segundo swipe rápido deve avançar de recents para usage");

    await swipe("down");
    await swipe("down", 500);
    assert.equal(await currentScreen(), "apps", "o segundo swipe rápido deve voltar de recents para apps");
  } finally {
    await browser.close();
    await close();
  }
});

test("swipe vertical imediato após o settle não é descartado pelo cooldown", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
    const result = await page.evaluate(async () => {
      const screens = document.querySelector("#screens");
      const event = (type, y, pointerId) => screens.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, pointerType: "touch", isPrimary: true,
        clientX: 195, clientY: y,
      }));
      const swipeUp = pointerId => {
        event("pointerdown", 700, pointerId);
        for (let i = 1; i <= 6; i++) event("pointermove", 700 - 100 * i, pointerId);
        event("pointerup", 100, pointerId);
      };
      const second = new Promise(resolve => {
        const observer = new MutationObserver(() => {
          if (!document.body.classList.contains("is-recents")) return;
          observer.disconnect();
          swipeUp(2);
          setTimeout(() => resolve(document.body.classList.contains("is-usage") ? "usage" : "recents"), 500);
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      });
      swipeUp(1);
      return await second;
    });
    assert.equal(result, "usage", "um swipe iniciado logo após o settle deve avançar para Usage");
  } finally {
    await browser.close();
    await close();
  }
});

test("swipes horizontais rápidos encadeiam páginas do Launchpad", async () => {
  const pieces = Array.from({ length: 24 }, (_, index) => ({
    id: `website:https://fast-page-${index + 1}.example.com`,
    type: "website",
    title: `Fast page ${index + 1}`,
    url: `https://fast-page-${index + 1}.example.com`,
    position: index,
  }));
  const { port, close } = await startServer({ port: 0, obs: null, config: { schemaVersion: 2, revision: 0, pieces, pinned: [] } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll(".dots .d").length >= 3, { timeout: 15000 });
    const result = await page.evaluate(async () => {
      const launchpad = document.querySelector("#launchpad");
      const event = (type, x, pointerId) => launchpad.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, pointerType: "touch", isPrimary: true,
        clientX: x, clientY: 400,
      }));
      const swipeLeft = pointerId => {
        const rect = launchpad.getBoundingClientRect();
        const start = rect.left + rect.width / 2;
        event("pointerdown", start, pointerId);
        for (let i = 1; i <= 6; i++) event("pointermove", start - 90 * i, pointerId);
        event("pointerup", start - 540, pointerId);
      };
      swipeLeft(1);
      swipeLeft(2);
      await new Promise(resolve => setTimeout(resolve, 500));
      const dots = [...document.querySelectorAll(".dots .d")];
      return dots.findIndex(dot => dot.classList.contains("on"));
    });
    assert.equal(result, 2, "dois swipes rápidos devem chegar à terceira página");
  } finally {
    await browser.close();
    await close();
  }
});

function overflowingUsagePayload() {
  const resources = {
    session: { kind: "consumption", unit: "requests", used: 5, limit: 20, remaining: 15, utilization: 0.25, resetsAt: "2026-09-01T10:00:00.000Z" },
    weekly: { kind: "consumption", unit: "requests", used: 10, limit: 100, remaining: 90, utilization: 0.1, resetsAt: "2026-09-07T10:00:00.000Z" },
  };
  for (let index = 1; index <= 10; index++) {
    resources[`extra${index}`] = { kind: "consumption", unit: "requests", used: index, limit: 100, remaining: 100 - index, utilization: index / 100, resetsAt: "2026-09-07T10:00:00.000Z" };
  }
  return {
    ok: true,
    source: "openusage",
    sourceState: "available",
    updatedAt: "2026-08-31T13:00:00.000Z",
    providers: {
      codex: {
        id: "codex",
        name: "Codex",
        plan: "Plus",
        status: "normal",
        mascot: "energized",
        resources,
        trend: {
          points: Array.from({ length: 31 }, (_, index) => ({ label: `day-${index + 1}`, value: index + 1, valueLabel: `${index + 1} tokens` })),
          note: "Long trend fixture for the internal vertical-scroll contract. ".repeat(18),
        },
      },
      antigravity: {
        id: "antigravity",
        name: "Antigravity",
        status: "normal",
        resources: {
          weekly: { kind: "consumption", unit: "percent", remaining: 45, utilization: 0.45 },
        },
      },
      grok: {
        id: "grok",
        name: "Grok",
        status: "normal",
        resources: {
          weekly: { kind: "consumption", unit: "percent", remaining: 28, utilization: 0.28 },
        },
      },
    },
    errors: [],
  };
}

async function openOverflowingUsagePage(port, browser, beforeNavigate) {
  const page = await browser.newPage({ viewport: { width: 390, height: 480 }, hasTouch: true });
  await page.route("**/api/usage", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(overflowingUsagePayload()),
  }));
  if (beforeNavigate) await beforeNavigate(page);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
  const swipeUp = async () => {
    const box = await page.locator("#screens").boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(x, y - 55 * i, { steps: 1 });
      await page.waitForTimeout(4);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
  };
  await swipeUp();
  await swipeUp();
  await page.waitForSelector(".usage-scroll", { timeout: 5000 });
  return page;
}

test("Usage mostra outros provedores abaixo e promove o card clicado", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.route("**/api/usage", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "openusage",
        sourceState: "available",
        updatedAt: "2026-08-31T13:00:00.000Z",
        providers: {
          claude: {
            id: "claude",
            name: "Claude",
            plan: "Pro",
            status: "attention",
            resources: {
              session: { kind: "consumption", unit: "percent", remaining: 32, utilization: 0.32 },
              weekly: { kind: "consumption", unit: "percent", remaining: 61, utilization: 0.61 },
            },
          },
          codex: {
            id: "codex",
            name: "Codex",
            plan: "Plus",
            status: "normal",
            resources: { session: { kind: "consumption", unit: "percent", remaining: 84, utilization: 0.84 } },
          },
          antigravity: {
            id: "antigravity",
            name: "Antigravity",
            status: "normal",
            resources: { geminiWeekly: { kind: "consumption", unit: "percent", remaining: 45, utilization: 0.45 } },
          },
          grok: {
            id: "grok",
            name: "Grok",
            status: "normal",
            resources: { weekly: { kind: "consumption", unit: "percent", remaining: 28, utilization: 0.28 } },
          },
        },
        errors: [],
      }),
    }));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
    const swipeUp = async () => {
      const box = await page.locator("#screens").boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(x, y - 55 * i, { steps: 1 });
        await page.waitForTimeout(4);
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
    };
    await swipeUp();
    await swipeUp();
    await page.waitForSelector(".usage-card");

    const initialIds = await page.locator(".usage-card").evaluateAll(cards => cards.map(card => card.dataset.provider));
    assert.deepEqual(initialIds, ["claude", "codex", "antigravity", "grok"], "todos os provedores devem aparecer na pilha");
    assert.match(await page.locator('[data-provider="antigravity"] .usage-provider-name').textContent(), /Antigravity/);
    assert.match(await page.locator('[data-provider="grok"] .usage-provider-name').textContent(), /Grok/);
    assert.match(await page.locator('[data-provider="antigravity"] .usage-provider-logo img').getAttribute("src") || "", /provider-icons\/antigravity\.svg/);
    assert.match(await page.locator('[data-provider="grok"] .usage-provider-logo img').getAttribute("src") || "", /provider-icons\/grok\.svg/);
    assert.equal(await page.locator('[data-provider="antigravity"] .usage-limit-label').first().textContent(), "semana");
    const weeklyBarColor = await page.locator(".usage-card.is-open .usage-week-bar i").evaluate(fill => getComputedStyle(fill).backgroundColor);
    assert.notEqual(weeklyBarColor, "rgba(255, 255, 255, 0.42)", "a barra semanal deve acompanhar o status, não usar branco fixo");

    await page.locator('article[data-provider="antigravity"]').click();
    await page.waitForSelector(".usage-stack.is-reordering", { timeout: 1000 });
    await page.waitForFunction(() => {
      const card = document.querySelector('.usage-stack.is-reordering article[data-provider="antigravity"]');
      return card && card.style.transition.includes("transform");
    });
    await page.waitForFunction(() => document.querySelector(".usage-card.is-open")?.dataset.provider === "antigravity");
    const promotedIds = await page.locator(".usage-card").evaluateAll(cards => cards.map(card => card.dataset.provider));
    assert.deepEqual(promotedIds, ["antigravity", "claude", "codex", "grok"], "o provedor clicado deve subir para o topo");
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage não promove a IA preferida quando ela está sem dados utilizáveis", async () => {
  const { port, close } = await startServer({
    port: 0,
    config: { usageProvider: "claude" },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.route("**/api/usage", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "dokke",
        sourceState: "available",
        updatedAt: new Date().toISOString(),
        providers: {
          claude: { id: "claude", name: "Claude", resources: {} },
          codex: {
            id: "codex",
            name: "Codex",
            resources: {
              session: { kind: "consumption", unit: "percent", used: 55, limit: 100, remaining: 45, utilization: 0.55 },
            },
          },
        },
        errors: [],
      }),
    }));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
    const swipeUp = async () => {
      const box = await page.locator("#screens").boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(x, y - 55 * i, { steps: 1 });
        await page.waitForTimeout(4);
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
    };
    await swipeUp();
    await swipeUp();
    await page.waitForSelector('.usage-card.is-open[data-provider="codex"]');
    assert.equal(await page.locator('.usage-card[data-provider="claude"]').getAttribute("role"), null, "provider sem dados não deve ser promovível");
    assert.equal(await page.locator(".usage-card").count(), 2, "provider sem dados ainda deve aparecer abaixo");
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage reage no gráfico e na troca de IA sem duplicar a confirmação", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser);
    await page.evaluate(() => {
      const root = document.querySelector("#screenUsage");
      const added = [];
      const observer = new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          node.querySelectorAll?.(".usage-mood-bubble").forEach(bubble => added.push(bubble.textContent));
          if (node.matches?.(".usage-mood-bubble")) added.push(node.textContent);
        }));
      });
      observer.observe(root, { childList: true, subtree: true });
      window.__usageMascotTrace = { added, observer };
      document.querySelector(".usage-card.is-open .usage-gauge-wrap svg").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await page.waitForSelector('.usage-mascot-wrap[data-reaction="chart"]', { timeout: 1000 });
    const trace = await page.evaluate(() => {
      window.__usageMascotTrace.observer.disconnect();
      return window.__usageMascotTrace.added;
    });
    assert.equal(trace.filter(text => text === "Atualizando...").length, 0, "o gráfico não deve disparar refresh da cota");
    assert.equal(trace.filter(text => text === "Atualizado").length, 0, "o gráfico não deve criar confirmação duplicada");

    await page.locator(".usage-card.is-open .usage-gauge-wrap svg").dispatchEvent("click");
    await page.waitForSelector('.usage-mascot-wrap[data-reaction="chart"]', { timeout: 1000 });

    await page.locator('article[data-provider="antigravity"]').dispatchEvent("click");
    await page.waitForSelector('.usage-mascot-wrap[data-reaction="provider"]', { timeout: 1000 });
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage deixa o mascote em modo de escrita enquanto o modelo atualiza", async () => {
  const { port, close } = await startServer({ port: 0, config: { usageProvider: "codex" } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser, async page => {
      await page.route("**/api/usage/activity", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          source: "dokke",
          sourceState: "available",
          updatedAt: new Date().toISOString(),
          providers: { codex: { state: "working", since: new Date().toISOString(), detail: "processando", sessions: 1 } },
          errors: [],
        }),
      });
      });
    });
    await page.waitForSelector('.usage-mascot-wrap[data-activity="working"]', { timeout: 5000 });
    const writingState = await page.locator('.usage-mascot-wrap[data-activity="working"]').evaluate(wrap => ({
      eyes: [...wrap.querySelectorAll(".usage-token-eyes i")].map(eye => {
      const style = getComputedStyle(eye);
      return { animation: style.animationName, transform: style.transform, opacity: style.opacity };
      }),
      hand: wrap.querySelector(".usage-writing-tool") ? getComputedStyle(wrap.querySelector(".usage-writing-tool")).animationName : null,
      line: wrap.querySelector(".usage-writing-line") ? getComputedStyle(wrap.querySelector(".usage-writing-line")).animationName : null,
    }));
    assert.deepEqual(writingState.eyes.map(eye => eye.animation), ["none", "none"]);
    assert.equal(writingState.eyes[0].transform, "none");
    assert.equal(writingState.eyes[1].transform, "none");
    assert.equal(writingState.eyes[0].opacity, "1");
    assert.equal(writingState.eyes[1].opacity, "1");
    assert.equal(writingState.hand, "usageWritingTool");
    assert.equal(writingState.line, "usageWritingLine");
    assert.equal(await page.locator('.usage-mascot-wrap[data-activity="working"]').count(), 1);
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage reage ao estado real de atividade retornado pelo backend", async () => {
  const { port, close } = await startServer({ port: 0, config: { usageProvider: "codex" } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 480 }, hasTouch: true });
    await page.route("**/api/usage/activity", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "dokke",
        sourceState: "available",
        updatedAt: new Date().toISOString(),
        providers: { codex: { state: "working", since: new Date().toISOString(), detail: "processando", sessions: 1 } },
        errors: [],
      }),
    }));
    const pagePayload = overflowingUsagePayload();
    await page.route("**/api/usage", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pagePayload),
    }));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
    const swipeUp = async () => {
      const box = await page.locator("#screens").boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(x, y - 55 * i, { steps: 1 });
        await page.waitForTimeout(4);
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
    };
    await swipeUp();
    await swipeUp();
    await page.waitForSelector('.usage-mascot-wrap[data-provider="codex"][data-activity="working"]', { timeout: 4000 });
    const writingState = await page.locator('.usage-mascot-wrap[data-provider="codex"][data-activity="working"]').evaluate(wrap => ({
      eyes: [...wrap.querySelectorAll(".usage-token-eyes i")].map(node => {
        const style = getComputedStyle(node);
        return { animation: style.animationName, transform: style.transform, opacity: style.opacity };
      }),
      hand: wrap.querySelector(".usage-writing-tool") ? getComputedStyle(wrap.querySelector(".usage-writing-tool")).animationName : null,
      line: wrap.querySelector(".usage-writing-line") ? getComputedStyle(wrap.querySelector(".usage-writing-line")).animationName : null,
    }));
    assert.deepEqual(writingState.eyes.map(eye => eye.animation), ["none", "none"]);
    assert.equal(writingState.eyes[0].transform, "none");
    assert.equal(writingState.eyes[1].transform, "none");
    assert.equal(writingState.eyes[0].opacity, "1");
    assert.equal(writingState.eyes[1].opacity, "1");
    assert.equal(writingState.hand, "usageWritingTool");
    assert.equal(writingState.line, "usageWritingLine");
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mostra projeção acima do limite e alterna o formato do reset ao clicar", async () => {
  const resetAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { port, close } = await startServer({
    port: 0,
    config: { usage: { enabled: true, display: "used", reset: "countdown" } },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.route("**/api/usage", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "openusage",
        sourceState: "available",
        updatedAt: new Date().toISOString(),
        providers: {
          codex: {
            id: "codex",
            name: "Codex",
            plan: "Plus",
            status: "normal",
            resources: {
              session: {
                kind: "consumption",
                unit: "percent",
                used: 84,
                limit: 100,
                remaining: 16,
                utilization: 0.84,
                resetsAt: resetAt,
                periodDurationMs: 10 * 60 * 60 * 1000,
              },
              weekly: {
                kind: "consumption",
                unit: "percent",
                used: 84,
                limit: 100,
                remaining: 16,
                utilization: 0.84,
                resetsAt: resetAt,
                periodDurationMs: 10 * 60 * 60 * 1000,
              },
            },
          },
        },
        errors: [],
      }),
    }));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
    const swipeUp = async () => {
      const box = await page.locator("#screens").boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(x, y - 55 * i, { steps: 1 });
        await page.waitForTimeout(4);
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
    };
    await swipeUp();
    await swipeUp();
    const primary = page.locator(".usage-card.is-open .usage-limit.primary");
    await primary.waitFor({ state: "visible" });
    assert.equal(await primary.getAttribute("data-pace"), "behind");
    assert.equal(await primary.locator(".usage-pace-warning").getAttribute("data-pace"), "behind");
    assert.equal(await primary.locator(".usage-pace-flame").count(), 1);
    assert.match(await primary.locator(".usage-pace-warning").textContent() || "", /limite/);
    const weekly = page.locator(".usage-card.is-open .usage-limit:not(.primary)");
    assert.equal(await weekly.locator(".usage-limit-label").textContent(), "semana");
    assert.equal(await weekly.locator(".usage-pace-flame").count(), 1, "a semana deve mostrar o fogo quando a projeção passa do limite");
    const weeklyPaceTick = weekly.locator(".usage-week-pace-tick");
    assert.equal(await weeklyPaceTick.count(), 1, "a semana deve mostrar o risquinho do ritmo quando a projeção passa do limite");
    assert.equal(await weeklyPaceTick.getAttribute("data-pace"), "behind");
    assert.match(await weeklyPaceTick.getAttribute("style") || "", /left:/, "o risquinho deve ser posicionado na régua");

    const percentage = primary.locator(".usage-gauge-copy .usage-limit-value");
    assert.equal(await percentage.textContent(), "84%");
    await percentage.click();
    await page.waitForFunction(() => document.querySelector(".usage-gauge-copy .usage-limit-value")?.textContent === "16%");

    const reset = primary.locator(".usage-limit-reset-value");
    const countdown = await reset.textContent();
    assert.equal(await reset.evaluate(node => node.tagName), "SPAN", "o countdown não deve ser um controle clicável");
    await reset.click();
    await page.waitForTimeout(100);
    assert.equal(await reset.textContent(), countdown, "clicar no countdown não deve alternar o reset");
    const gaugeChart = primary.locator(".usage-gauge-wrap svg");
    await gaugeChart.click({ position: { x: 10, y: 10 } });
    await page.waitForFunction(() => !!document.querySelector(".usage-five-reset-exact"));
    assert.match(await reset.textContent() || "", /^\d+h \d+m$/, "o countdown grande deve permanecer compacto");
    const exactCaption = primary.locator(".usage-five-reset-exact");
    assert.equal(await exactCaption.evaluate(node => node.tagName), "SPAN", "a data exata também não deve ser um controle clicável");
    assert.match(await exactCaption.textContent() || "", /hoje|amanhã|ontem/);
    assert.equal(await exactCaption.evaluate(node => getComputedStyle(node).fontSize), "11px");
    await exactCaption.click();
    await page.waitForTimeout(100);
    assert.ok(await exactCaption.isVisible(), "a data exata deve continuar visível após o clique");
    await gaugeChart.click({ position: { x: 10, y: 10 } });
    await page.waitForFunction(() => !document.querySelector(".usage-five-reset-exact"));
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage não exibe o sidecar Mais limites mesmo com recursos extras", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser);
    assert.equal(await page.locator(".usage-more").count(), 0, "o botão Mais limites não deve existir");
    assert.equal(await page.locator(".usage-more-panel").count(), 0, "o painel lateral de limites não deve existir");
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage permite scroll vertical nativo sem trocar de tela", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser);
    const before = await page.evaluate(() => {
      const scroll = document.querySelector(".usage-scroll");
      return { clientHeight: scroll.clientHeight, scrollHeight: scroll.scrollHeight, scrollTop: scroll.scrollTop };
    });
    await page.mouse.move(195, 420);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(220);
    const after = await page.evaluate(() => ({
      screen: document.body.classList.contains("is-usage") ? "usage" : "other",
      scrollTop: document.querySelector(".usage-scroll").scrollTop,
    }));
    assert.ok(before.scrollHeight > before.clientHeight, "o cenário precisa ter conteúdo além da viewport");
    assert.equal(after.screen, "usage", "scroll interno não deve navegar para outra tela");
    assert.ok(after.scrollTop > 0, "scroll interno deve avançar");
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage navega para a tendência no segundo slide", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser);
    await page.waitForSelector(".usage-provider-dot");
    assert.equal(await page.locator(".usage-provider-slide").count(), 2, "o segundo slide deve ser reservado para a tendência");
    await page.locator(".usage-provider-dot").nth(1).click();
    await page.waitForFunction(() => {
      const track = document.querySelector(".usage-provider-track");
      return track.scrollLeft >= track.clientWidth - 1 && document.querySelectorAll(".usage-provider-dot")[1]?.getAttribute("aria-current") === "true";
    });
    assert.ok(await page.evaluate(() => document.querySelector(".usage-provider-track").scrollLeft > 0), "o track deve avançar para o segundo slide");
    assert.equal(await page.locator(".usage-provider-dot").nth(1).getAttribute("aria-current"), "true");
    assert.ok(await page.locator(".usage-trend-slide .usage-trend").isVisible(), "a tendência deve aparecer no segundo slide");
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mantém o card compacto no portrait estreito do A02", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser);
    const metrics = await page.evaluate(() => {
      const card = document.querySelector(".usage-card.is-open");
      const featured = card?.querySelector(".usage-featured");
      const scroll = document.querySelector(".usage-scroll");
      return {
        cardHeight: card?.getBoundingClientRect().height || 0,
        featuredHeight: featured?.getBoundingClientRect().height || 0,
        viewportHeight: scroll?.clientHeight || 0,
      };
    });
    assert.ok(metrics.cardHeight < 360, `card aberto não deve preencher o A02: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.featuredHeight < 320, `conteúdo do card não deve herdar flex expansível: ${JSON.stringify(metrics)}`);
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage usa a régua da página sem cartão externo e a fonte padrão do app", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser);
    const metrics = await page.evaluate(() => {
      const frame = document.querySelector(".usage-content");
      const openCard = document.querySelector(".usage-card.is-open");
      const sideDots = document.querySelector("#vdots");
      const bodyFont = getComputedStyle(document.body).fontFamily;
      const textSelectors = [
        ".usage-title",
        ".usage-five-copy .usage-limit-label",
        ".usage-five-copy .usage-limit-reset-value",
        ".usage-five-caption",
        ".usage-week-top b",
        ".usage-week-value .usage-limit-value",
        ".usage-week-reset",
      ];
      return {
        frameWidth: frame?.getBoundingClientRect().width || 0,
        frameLeft: frame?.getBoundingClientRect().left || 0,
        cardLeft: openCard?.getBoundingClientRect().left || 0,
        cardWidth: openCard?.getBoundingClientRect().width || 0,
        cardRight: openCard?.getBoundingClientRect().right || 0,
        dotsLeft: sideDots?.getBoundingClientRect().left || 0,
        frameBackground: getComputedStyle(frame).backgroundImage,
        frameBorder: getComputedStyle(frame).borderStyle,
        bodyFont,
        interLoaded: document.fonts.check("16px Inter"),
        textFonts: textSelectors.map(selector => getComputedStyle(document.querySelector(selector)).fontFamily),
      };
    });
    assert.equal(metrics.frameWidth, 350, `o frame da Usage deve seguir a régua ampliada do esboço: ${JSON.stringify(metrics)}`);
    assert.equal(Math.round(metrics.cardLeft - metrics.frameLeft), 0, `o card deve alinhar na borda do frame: ${JSON.stringify(metrics)}`);
    assert.equal(Math.round(metrics.cardWidth), 342, `o card deve ocupar o frame com a folga mínima dos dots: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.cardRight < metrics.dotsLeft - 8, `o card não pode encostar nos dots laterais: ${JSON.stringify(metrics)}`);
    assert.equal(metrics.frameBackground, "none", "a Usage não deve criar um cartão de fundo externo");
    assert.equal(metrics.frameBorder, "none", "a Usage não deve criar uma borda externa nova");
    assert.equal(metrics.interLoaded, true, "a fonte padrão do app deve estar disponível sem rede");
    assert.deepEqual(metrics.textFonts, metrics.textFonts.map(() => metrics.bodyFont), "os textos da Usage devem usar a fonte padrão do app");
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("long press de website pede confirmação antes de remover o fixo", async () => {
  const { port, close } = await startServer({
    port: 0,
    config: {
      schemaVersion: 2,
      revision: 1,
      pieces: [{ id: "website:https://example.com", type: "website", title: "Example", url: "https://example.com", position: 0 }],
      pinned: [],
    },
  });
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const tileLongStart = html.indexOf("function tileLong");
    const tileLongEnd = html.indexOf("// ---------- rendering: launchpad", tileLongStart);
    const tileLong = html.slice(tileLongStart, tileLongEnd);
    const favLongStart = html.indexOf("function favLong");
    const favLongEnd = html.indexOf("function tileLong", favLongStart);
    const favLong = html.slice(favLongStart, favLongEnd);
    assert.match(tileLong, /if \(piece\.type === "website"\) favLong\(piece\)/);
    assert.doesNotMatch(tileLong, /if \(piece\.type === "website"\) unpinPiece\(piece\.id\)/);
    assert.match(favLong, /const isWebsite = piece && piece\.type === "website"/);
    assert.match(favLong, /websiteFaviconPath\(piece\.url\)/);
    assert.match(favLong, /unpinPiece\(piece\.id\)/);
    assert.match(favLong, /\}, "confirm"\);/);
  } finally {
    await close();
  }
});

test("Usage usa o título curto do esboço e um cabeçalho de sincronização útil", async () => {
  const { port, close } = await startServer(0);
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.match(html, /I18N\["pt-BR"\]\["usage\.title"\] = "Uso"/, "a página deve usar o título curto do esboço");
    assert.match(html, /usage-live-dot/, "o cabeçalho deve ter o indicador de estado");
    assert.match(html, /@keyframes usagePulse/, "o estado online deve ter pulso próprio");
    assert.match(html, /usage-provider-logo/, "o provedor deve ter uma marca visual dedicada");
    assert.match(html, /OpenAI/, "o cabeçalho deve carregar a identidade OpenAI do Codex");
    assert.match(html, /Claude/, "o cabeçalho deve identificar Claude");
    assert.match(html, /usage-sync-label/, "o cabeçalho deve informar a sincronização");
    const renderStart = html.indexOf("function renderUsage()");
    const renderEnd = html.indexOf("function usageRefresh", renderStart);
    const renderSource = html.slice(renderStart, renderEnd > renderStart ? renderEnd : renderStart + 24000);
    assert.doesNotMatch(renderSource, /t\("usage\.localData"\)|t\("usage\.source"\)/, "o hero não deve expor origem técnica ou dados locais");
  } finally {
    await close();
  }
});

test("marcas do Painel de Uso são servidas como SVG local", async () => {
  const { port, close } = await startServer(0);
  try {
    for (const asset of ["openai.svg", "anthropic.svg", "claude.svg"]) {
      const response = await fetch(`http://127.0.0.1:${port}/${asset}`);
      assert.equal(response.status, 200, `${asset} deve estar disponível no servidor local`);
      assert.match(response.headers.get("content-type") || "", /image\/svg\+xml/, `${asset} deve ter MIME SVG`);
      const svg = await response.text();
      assert.doesNotMatch(svg, /currentColor/, `${asset} precisa de uma cor própria quando usado como img`);
    }
  } finally {
    await close();
  }
});

test("gauge radial e barra semanal aparecem dentro dos limites", async () => {
  const { port, close } = await startServer(0);
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const nodeStart = html.indexOf("function usageLimitNode");
    const nodeEnd = html.indexOf("function renderUsage", nodeStart);
    const nodeSource = html.slice(nodeStart, nodeEnd);
    assert.ok(nodeStart >= 0 && nodeEnd > nodeStart, "o renderizador do limite deve existir");
    assert.match(nodeSource, /usagePaintGauge\(svg,/, "o limite principal deve pintar o gauge radial");
    assert.match(nodeSource, /usage-week-bar/, "o limite semanal deve ter uma barra segmentada");
  } finally {
    await close();
  }
});

test("Painel de Uso empilha limites no retrato e não repete um card externo", async () => {
  const { port, close } = await startServer(0);
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const portraitStart = html.indexOf("@media (max-width: 699px)");
    const portraitEnd = html.indexOf("}", portraitStart);
    const portraitCss = html.slice(portraitStart, portraitEnd > portraitStart ? portraitEnd + 1 : portraitStart + 500);

    assert.match(portraitCss, /\.usage-limits\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "os limites devem ocupar a largura inteira no celular");
    assert.match(html, /\.usage-card\.is-open\{[^}]*background:\s*linear-gradient\(180deg, rgba\(22,24,27,\.84\), rgba\(12,14,16,\.89\)\)/, "o provedor aberto deve usar a moldura grafite translúcida do esboço");
  } finally {
    await close();
  }
});

test("Painel de Uso promove o card fechado para o topo", async () => {
  const { port, close } = await startServer(0);
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const renderStart = html.indexOf("function renderUsage()");
    const renderEnd = html.indexOf("async function loadUsage", renderStart);
    const renderSource = html.slice(renderStart, renderEnd);

    assert.match(html, /usage-stack/, "os provedores devem empilhar");
    assert.match(renderSource, /is-open/, "o provedor crítico deve abrir no topo");
    assert.match(renderSource, /is-closed/, "os demais provedores devem ficar fechados");
    assert.match(renderSource, /state\.usageOpenId = item\.id/, "o toque no card fechado deve promovê-lo");
    assert.match(html, /usage-peek/, "o card fechado deve mostrar o percentual");
  } finally {
    await close();
  }
});

test("PWA oculta a tela de Uso e reduz os dots quando a preferência está desligada", async () => {
  const { port, close } = await startServer({
    port: 0,
    obs: null,
    config: { usage: { enabled: false, display: "used", reset: "countdown" } },
    appTools: { listAppProcesses: async () => [], listInstalledApps: async () => [] },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll("#vdots .d").length === 2);
    assert.equal(await page.locator("#vdots .d").count(), 2);
    await page.locator("#vdots .d").nth(1).click();
    await page.waitForFunction(() => document.body.classList.contains("is-recents"));
    assert.equal(await page.locator("#screenUsage").evaluate(el => getComputedStyle(el).pointerEvents), "none");
  } finally {
    await browser.close();
    await close();
  }
});

test("PWA usa restante e data exata vindos das preferências compartilhadas", async () => {
  const resetAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const { port, close } = await startServer({
    port: 0,
    obs: null,
    config: { usage: { enabled: true, display: "remaining", reset: "exact" } },
    usage: {
      getUsage: async () => ({
        ok: true,
        source: "openusage",
        sourceState: "available",
        updatedAt: new Date().toISOString(),
        providers: {
          codex: {
            status: "normal",
            resources: {
              session: { kind: "consumption", unit: "percent", utilization: 0.25, resetsAt: resetAt },
              weekly: { kind: "consumption", unit: "percent", utilization: 0.4, resetsAt: resetAt },
            },
          },
        },
        errors: [],
      }),
    },
    appTools: { listAppProcesses: async () => [], listInstalledApps: async () => [] },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll("#vdots .d").length === 3);
    const swipeUp = async pointerId => {
      const screens = page.locator("#screens");
      await screens.dispatchEvent("pointerdown", { pointerId, pointerType: "touch", clientX: 195, clientY: 700 });
      for (let i = 1; i <= 6; i++) {
        await screens.dispatchEvent("pointermove", { pointerId, pointerType: "touch", clientX: 195, clientY: 700 - 100 * i });
      }
      await screens.dispatchEvent("pointerup", { pointerId, pointerType: "touch", clientX: 195, clientY: 100 });
    };
    await swipeUp(1);
    await page.waitForFunction(() => document.body.classList.contains("is-recents"));
    await swipeUp(2);
    await page.waitForFunction(() => document.body.classList.contains("is-usage"));
    await page.waitForSelector(".usage-limit.primary");
    assert.equal(await page.locator(".usage-limit.primary .usage-limit-value").textContent(), "75%");
    const exactReset = await page.locator(".usage-limit.primary .usage-five-reset-exact").textContent();
    assert.doesNotMatch(exactReset, /RESET/);
    assert.match(exactReset, /hoje|amanhã|ontem/);
  } finally {
    await browser.close();
    await close();
  }
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

test("PWA exibe cinco páginas completas e preserva slots vazios", async () => {
  const { port, close } = await startServer({
    port: 0,
    obs: null,
    config: {
      schemaVersion: 2,
      revision: 0,
      pieces: [
        { id: "app:App Store", type: "app", name: "App Store", position: 0 },
        { id: "app:Claude", type: "app", name: "Claude", position: 1 },
      ],
      pinned: ["App Store", "Claude"],
    },
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll(".atile.empty").length === 38);
    const empty = page.locator(".atile.empty .aglass").first();
    const style = await empty.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { background: computed.backgroundColor, border: computed.border, boxShadow: computed.boxShadow };
    });
    assert.equal(await page.locator(".atile.empty").count(), 38);
    assert.equal(style.background, "rgba(255, 255, 255, 0.035)");
    assert.match(style.border, /rgba\(240, 135, 55, 0\.18\)/);
    assert.match(style.boxShadow, /rgba\(255, 255, 255, 0\.035\)/);
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

test("gesto vertical percorre as três telas e limita overscroll nas bordas", async () => {
  const { port, close } = await startServer(0);
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const match = html.match(/function rubberDy\(dy\)\{([\s\S]*?)\n    \}/);
    assert.ok(match, "rubberDy deve existir");
    const rubberDy = new Function("dy", "state", "h", "RUBBER", match[1]);
    assert.equal(rubberDy(200, { screen: "recents" }, () => 800, 28), 200,
      "o retorno deve seguir o dedo, não ficar preso no rubber band");
    assert.equal(rubberDy(-200, { screen: "recents" }, () => 800, 28), -200,
      "a tela 2 deve acompanhar o avanço para Usage");
    assert.equal(rubberDy(-200, { screen: "usage" }, () => 800, 28), -28,
      "o overscroll acima da última tela continua limitado");
  } finally { await close(); }
});

test("GET /manifest.webmanifest retorna JSON válido com display standalone", async () => {
  const { port, close } = await startServer(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
    assert.equal(r.status, 200);
    const m = await r.json();
    assert.equal(m.display, "standalone");
    assert.equal(m.name, "Dokke");
    assert.equal(m.short_name, "Dokke");
    assert.equal(m.orientation, "any");
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
    assert.match(js, /dokke-v24/, "service worker deve invalidar o cache antigo da UI");
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
    await page.waitForFunction(() => document.querySelectorAll(".atile").length === 40);
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

test("grade mobile mantém a régua do retrato e se ajusta sem cortar com safe area alta", async () => {
  const pieces = Array.from({ length: 8 }, (_, i) => ({
    id: `website:https://site-${i + 1}.example.com`,
    type: "website",
    title: `Site ${i + 1}`,
    url: `https://site-${i + 1}.example.com`,
    position: i,
  }));
  const { port, close } = await startServer({
    port: 0,
    obs: null,
    config: { schemaVersion: 2, revision: 0, pieces, pinned: [] },
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: ":root{--dokke-safe-top:100px;--dokke-safe-bottom:100px}.screen{padding-top:100px !important}.dots{padding-bottom:100px !important}" });
    await page.waitForFunction(() => document.querySelectorAll(".atile").length === 40);
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForFunction(() => document.querySelector(".page-grid")?.style.transform.startsWith("scale("));
    const bounds = await page.evaluate(() => {
      const pager = document.querySelector(".launchpad");
      const firstPage = document.querySelector(".page");
      const firstGrid = document.querySelector(".page-grid");
      const tiles = [...document.querySelectorAll(".page:first-child .atile")];
      const pagerRect = pager.getBoundingClientRect();
      const tileRects = tiles.map(tile => tile.getBoundingClientRect());
      const style = getComputedStyle(firstGrid);
      return {
        pager: { left: pagerRect.left, right: pagerRect.right, top: pagerRect.top, bottom: pagerRect.bottom },
        first: { top: tileRects[0].top, bottom: tileRects[0].bottom },
        last: { top: tileRects.at(-1).top, bottom: tileRects.at(-1).bottom },
        slotGap: tileRects[1].left - tileRects[0].right,
        columns: style.gridTemplateColumns.split(" ").length,
        rows: style.gridTemplateRows.split(" ").length,
        columnGap: style.columnGap,
        rowGap: style.rowGap,
        scale: firstGrid.style.transform,
        pageWidth: firstPage.getBoundingClientRect().width,
        scrollLeft: pager.scrollLeft,
      };
    });
    assert.equal(bounds.columns, 2, "o retrato deve continuar em duas colunas");
    assert.equal(bounds.rows, 4, "o retrato deve continuar em quatro linhas");
    assert.equal(bounds.columnGap, "20px", "o retrato deve preservar o espaçamento normal entre slots");
    assert.equal(bounds.rowGap, "20px", "o retrato deve usar o mesmo espaçamento global nas linhas");
    assert.ok(bounds.slotGap <= 20.5, "o retrato não deve adicionar espaçamento entre os slots");
    assert.ok(bounds.first.top >= bounds.pager.top - 0.5, "o primeiro card não pode escapar pelo topo após a escala");
    assert.ok(bounds.last.bottom <= bounds.pager.bottom + 0.5, "o último card não pode ser cortado após a escala");
    assert.match(bounds.scale, /^scale\(/, "a escala deve ser aplicada somente quando a safe area reduzir a altura útil");
    assert.ok(Math.abs(bounds.pageWidth - (bounds.pager.right - bounds.pager.left)) < 0.5, "a página deve conservar a largura integral do pager");
    assert.ok(Math.abs(bounds.scrollLeft) < 1, "a escala interna não pode deslocar o scroll horizontal inicial");
  } finally {
    await browser.close();
    await close();
  }
});

test("PWA solicita Wake Lock quando visível, libera oculto e readquire ao voltar", async () => {
  const { port, close } = await startServer({ port: 0, obs: null });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.addInitScript(() => {
      const probe = { requests: [], releases: 0 };
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: {
          request: async type => {
            const listeners = {};
            const sentinel = {
              released: false,
              addEventListener(name, fn) { listeners[name] = fn; },
              async release() {
                if (sentinel.released) return;
                sentinel.released = true;
                probe.releases += 1;
                if (listeners.release) listeners.release();
              },
            };
            probe.requests.push(type);
            return sentinel;
          },
        },
      });
      window.__dokkeWakeLockProbe = probe;
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dokkeWakeLockProbe?.requests.length === 1, null, { timeout: 2500 });
    assert.deepEqual(await page.evaluate(() => window.__dokkeWakeLockProbe.requests), ["screen"]);

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => window.__dokkeWakeLockProbe.releases === 1, null, { timeout: 2500 });

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => window.__dokkeWakeLockProbe.requests.length === 2, null, { timeout: 2500 });
  } finally {
    await browser.close();
    await close();
  }
});

test("landscape touch mantém o slide centralizado sem girar o pager", async () => {
  const pieces = Array.from({ length: 8 }, (_, i) => ({
    id: `website:https://landscape-${i + 1}.example.com`,
    type: "website",
    title: `Landscape ${i + 1}`,
    url: `https://landscape-${i + 1}.example.com`,
    position: i,
  }));
  const { port, close } = await startServer({
    port: 0,
    obs: null,
    config: { schemaVersion: 2, revision: 0, pieces, pinned: [] },
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 473 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll(".atile").length === 40);
    await page.waitForSelector(".page-grid");
    await page.waitForTimeout(900);
    const layout = await page.evaluate(() => {
      const pager = document.querySelector(".launchpad");
      const firstPage = document.querySelector(".page");
      const pageTiles = [...document.querySelectorAll(".page")].slice(0, 2).map(page => [...page.querySelectorAll(":scope .atile")]);
      const grid = document.querySelector(".page-grid");
      const pagerRect = pager.getBoundingClientRect();
      const pageRect = firstPage.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      const style = getComputedStyle(grid);
      const firstRow = pageTiles[0].slice(0, 4).map(tile => tile.getBoundingClientRect());
      const nextPageFirst = pageTiles[1][0]?.getBoundingClientRect();
      return {
        scrollLeft: pager.scrollLeft,
        page: { left: pageRect.left, right: pageRect.right, width: pageRect.width },
        pager: { left: pagerRect.left, right: pagerRect.right, width: pagerRect.width },
        grid: { left: gridRect.left, right: gridRect.right, width: gridRect.width },
        pageTransform: firstPage.style.transform,
        gridTransform: grid.style.transform,
        pageOverflow: getComputedStyle(firstPage).overflow,
        iconTurn: getComputedStyle(document.documentElement).getPropertyValue("--icon-turn").trim(),
        tileWidth: grid.firstElementChild?.getBoundingClientRect().width || 0,
        slotGap: firstRow[1].left - firstRow[0].right,
        pageGap: nextPageFirst ? nextPageFirst.left - firstRow[3].right : Infinity,
        columns: style.gridTemplateColumns.split(" ").length,
        rows: style.gridTemplateRows.split(" ").length,
        columnGap: style.columnGap,
        rowGap: style.rowGap,
      };
    });
    assert.equal(layout.columns, 4, "landscape touch deve ocupar quatro colunas");
    assert.equal(layout.rows, 2, "landscape touch deve ocupar duas linhas");
    assert.ok(layout.tileWidth >= 180, "landscape touch deve aproveitar melhor o espaço com ícones grandes");
    assert.ok(layout.slotGap >= 30 && layout.slotGap <= 32, "landscape touch deve preservar o espaçamento global moderado dos slots");
    assert.equal(layout.columnGap, "30.72px", "landscape touch deve seguir a mesma régua responsiva do retrato");
    assert.equal(layout.rowGap, "30.72px", "landscape touch deve seguir a mesma régua responsiva do retrato");
    assert.equal(layout.pageOverflow, "hidden", "landscape touch deve mostrar somente os oito slots da página ativa");
    assert.equal(layout.pageTransform, "", "o item do pager não deve ser transformado");
    assert.equal(layout.iconTurn, "0deg", "o PWA não deve girar os ícones no landscape");
    assert.ok(layout.gridTransform === "" || /^scale\(/.test(layout.gridTransform), "se houver escala, ela deve ficar na grade interna");
    assert.ok(Math.abs(layout.scrollLeft) < 1, "o primeiro slide deve permanecer no scroll inicial");
    assert.ok(Math.abs(layout.page.width - layout.pager.width) < 0.5, "o slide deve conservar a largura integral do pager");
    assert.ok(Math.abs((layout.grid.left + layout.grid.right) / 2 - (layout.pager.left + layout.pager.right) / 2) < 0.5, "a grade deve continuar centrada no pager");
  } finally {
    await browser.close();
    await close();
  }
});
