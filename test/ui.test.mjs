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
    assert.match(html, /<title>Dokke<\/title>/, "o título visível do PWA deve usar a marca correta");
    assert.match(html, /\.ttitle\{[\s\S]*font-family: "Bricolage Grotesque", sans-serif;/, "o título de Apps abertos deve usar a fonte de display");
    assert.match(
      html,
      /\.login-card\{[\s\S]*background: linear-gradient\(165deg, rgba\(255,255,255,\.18\), rgba\(255,255,255,\.07\) 55%, rgba\(255,255,255,\.12\)\);/,
      "painel de conexão deve ter opacidade suficiente para preservar a leitura"
    );
    assert.match(html, /toast\(t\("toast\.deviceConnected"\), "ok"\)/, "o status deve identificar o dispositivo conectado");
    assert.doesNotMatch(html, /toast\("Mac conectado"\)/, "o status não deve atribuir a conexão ao Mac");
    assert.match(html, /\.toast\{[\s\S]*background:rgba\(37,18,11,\.9\);/, "avisos devem usar uma superfície quente e discreta");
    assert.doesNotMatch(html, /\.toast\{[\s\S]*rgba\(28,34,54,\.94\)/, "avisos não devem usar o fundo azulado anterior");
    assert.match(html, /toast\(t\("toast\.updated"\), "sync"\)/, "atualização deve usar o estado visual de sincronização");
    assert.match(html, /\.toast\{[\s\S]*width:\s*fit-content;[\s\S]*max-width:\s*calc\(100vw - 24px\);[\s\S]*justify-content:\s*center;/, "avisos devem ser compactos e centralizados sem largura fixa");
    assert.match(html, /\.toast::before\{[\s\S]*width:6px; height:6px;[\s\S]*box-shadow:none;/, "avisos devem usar apenas um indicador mínimo de estado");
    assert.match(html, /"toast\.updated": "Atualizando"/, "aviso de atualização deve usar copy mínima sem reticências");
    const robscardBlocks = html.match(/\.robscard\{[^}]*\}/g) || [];
    assert.ok(robscardBlocks.length >= 2 && robscardBlocks.every(block => !block.includes("rgba(10,132,255")), "o card de status não deve usar azul frio");
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
    assert.match(html, /--app-tile: min\(40vmin, max\(21vw,21vh\), 180px\);/, "celular deve preservar a régua vertical do slot sem mexer no gutter");
    assert.match(html, /@media \(min-width:700px\)[\s\S]*--app-tile: min\(max\(22vw,22vh\), min\(30vw,30vh\), 220px\);/, "telas maiores devem preservar o tamanho do landscape no portrait");
    assert.doesNotMatch(html, /--app-tile: min\(44vw,/, "portrait não deve ampliar os cards em relação ao landscape");
    assert.match(html, /--tile-in: 0\.80;/, "ícones devem ficar levemente maiores na referência móvel após a normalização do PNG");
    assert.match(html, /\.atile \.aglass\{[\s\S]*width: 100%; height: 100%;/, "o Card Glass deve continuar preenchendo o slot");
    assert.match(html, /\.atile \.aglass \.gicon, \.atile \.aglass img\.aicon\{[\s\S]*width: 80%; height: 80%;/, "somente o ícone da tela 1 deve respeitar o padding visual da referência");
    assert.match(html, /\.dcard\{[\s\S]*container-type: inline-size;/, "cards da tela 2 devem usar a mesma régua de container da tela 1");
    assert.match(html, /\.dcard \.aglass\{[\s\S]*border-radius: 32%;/, "glass da tela 2 deve usar o raio reduzido");
    assert.match(html, /\.dcard \.aglass \.gicon, \.dcard \.aglass img\.aicon\{[\s\S]*width: 80%; height: 80%;[\s\S]*border-radius: 27%;/, "ícones da tela 2 devem usar a mesma régua arredondada");
    assert.match(html, /--tile-r: 0\.32;/, "cards glass devem usar o raio externo reduzido");
    assert.match(html, /\.atile \.aglass\{[\s\S]*border-radius: 32%;/, "fallback deve aplicar o raio reduzido do card");
    assert.match(html, /\.atile \.aglass::before\{ border-radius: 32%; \}/, "o highlight deve acompanhar a curva reduzida do card");
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

test("swipe vertical rápido reverte de Recentes para Apps após a primeira navegação", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });

    const currentScreen = () => page.evaluate(() =>
      document.body.classList.contains("is-recents") ? "recents" : "apps"
    );
    const swipe = async direction => {
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
    };

    await swipe("up");
    await page.waitForFunction(() => document.body.classList.contains("is-recents"));
    assert.equal(await currentScreen(), "recents", "a primeira navegação precisa chegar em Recentes");
    await swipe("down");
    await page.waitForFunction(() => !document.body.classList.contains("is-recents"));
    assert.equal(await currentScreen(), "apps", "o swipe reverso deve voltar de Recentes para Apps");
  } finally {
    await browser.close();
    await close();
  }
});

test("troca vertical anima somente as duas telas envolvidas", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      navigator.serviceWorker.register = () => Promise.reject(new Error("blocked"));
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
    const transitions = await page.evaluate(async () => {
      const screens = document.querySelector("#screens");
      const ids = ["screenApps", "screenRecents"];
      const events = [];
      for (const id of ids){
        const el = document.getElementById(id);
        el.addEventListener("transitionrun", event => {
          if (event.propertyName === "transform") events.push(event.target.id);
        });
      }
      const event = (type, y, pointerId) => screens.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, pointerType: "touch", isPrimary: true,
        clientX: 195, clientY: y,
      }));
      event("pointerdown", 700, 1);
      for (let i = 1; i <= 6; i++) event("pointermove", 700 - 100 * i, 1);
      event("pointerup", 100, 1);
      await new Promise(resolve => setTimeout(resolve, 320));
      return events;
    });
    assert.deepEqual(
      [...new Set(transitions)].sort(),
      ["screenApps", "screenRecents"],
      "somente as telas ativas devem participar da animação",
    );
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

test("V-Dots seguem o mesmo espaçamento visual dos h-dots", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll("#vdots .d").length >= 2);
    const metrics = await page.evaluate(() => Array.from(document.querySelectorAll("#vdots .d")).map(dot => {
      const rect = dot.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(dot, "::before").transform);
      return { width: rect.width, height: rect.height, visualCenter: rect.top + rect.height / 2 + matrix.f };
    }));
    assert.deepEqual(metrics.map(dot => [dot.width, dot.height]), metrics.map(() => [44, 44]), "v-dots devem manter a área de toque padronizada");
    assert.equal(Math.round(Math.abs(metrics[1].visualCenter - metrics[0].visualCenter)), 20, `v-dots visíveis devem seguir o espaçamento padrão: ${JSON.stringify(metrics)}`);
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("long press de website ou atalho pede confirmação antes de remover o fixo", async () => {
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
    assert.match(tileLong, /if \(piece\.type === "website" \|\| piece\.type === "shortcut"\) favLong\(piece\)/);
    assert.doesNotMatch(tileLong, /if \(piece\.type === "website"\) unpinPiece\(piece\.id\)/);
    assert.match(favLong, /const isWebsite = piece && piece\.type === "website"/);
    assert.match(favLong, /websiteFaviconPath\(piece\.url\)/);
    assert.match(favLong, /unpinPiece\(piece\.id\)/);
    assert.match(favLong, /\}, "confirm"\);/);
  } finally {
    await close();
  }
});

test("toque rápido em app não dispara o long press de remoção", async () => {
  const { port, close } = await startServer({
    port: 0,
    obs: null,
    config: {
      schemaVersion: 2,
      revision: 0,
      pieces: [{ id: "app:Terminal", type: "app", name: "Terminal", position: 0 }],
      pinned: ["Terminal"],
    },
    appTools: {
      listAppProcesses: async () => [],
      listInstalledApps: async () => [{ name: "Terminal", path: "/Applications/Utilities/Terminal.app", icon: false }],
    },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.route("**/api/apps/Terminal/activate", async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    const tile = page.locator('.atile[data-id="app:Terminal"]');
    await tile.waitFor({ state: "visible", timeout: 15000 });
    await tile.evaluate(el => {
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 40, clientY: 40 }));
      document.querySelector("#screens").dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 40, clientY: 40 }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await page.waitForTimeout(700);
    assert.equal(await page.locator("#sheet.confirm-sheet").count(), 0, "toque rápido não deve abrir remoção");
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("PWA bloqueia seleção, callout e menu nativo em toda a superfície", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    const safeguards = await page.evaluate(() => {
      const root = document.querySelector("#dokke");
      const target = document.querySelector(".atile") || root;
      const selectstart = new Event("selectstart", { bubbles: true, cancelable: true });
      const contextmenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
      const touchCalloutRule = document.documentElement.innerHTML.includes("#dokke, #dokke *")
        && document.documentElement.innerHTML.includes("-webkit-touch-callout: none");
      return {
        selectstartPrevented: !target.dispatchEvent(selectstart),
        contextmenuPrevented: !target.dispatchEvent(contextmenu),
        rootUserSelect: getComputedStyle(root).userSelect,
        tileUserSelect: getComputedStyle(target).userSelect,
        touchCalloutRule,
      };
    });
    assert.equal(safeguards.selectstartPrevented, true, "a superfície não deve permitir seleção de texto");
    assert.equal(safeguards.contextmenuPrevented, true, "a superfície não deve abrir menu nativo");
    assert.equal(safeguards.rootUserSelect, "none", `a raiz deve bloquear seleção: ${JSON.stringify(safeguards)}`);
    assert.equal(safeguards.tileUserSelect, "none", `os tiles devem bloquear seleção: ${JSON.stringify(safeguards)}`);
    assert.equal(safeguards.touchCalloutRule, true, `o callout touch deve ficar desativado: ${JSON.stringify(safeguards)}`);
    await page.close();
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
    assert.match(html, /@media \(display-mode: standalone\)[\s\S]*--dokke-viewport-height:\s*100dvh;/, "o layout deve ter fallback para a viewport dinâmica do PWA standalone");
    assert.match(html, /function syncDokkeViewport\(\)/, "o PWA deve sincronizar a altura real da viewport");
    assert.match(html, /if \(DOKKE_STANDALONE\)[\s\S]*visualViewport\.addEventListener\("resize", syncDokkeViewport/, "mudanças da viewport visual devem recalcular somente o PWA");
    assert.match(html, /serviceWorker/, "deve registrar service worker");
    assert.match(html, /\/sw\.js/, "deve referenciar sw.js");
  } finally { await close(); }
});

test("PWA usa a altura real do visualViewport para ignorar a barra do Safari", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.addInitScript(() => {
      const visualViewport = new EventTarget();
      Object.defineProperties(visualViewport, {
        height: { configurable: true, value: 808 },
        offsetTop: { configurable: true, value: 0 },
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: visualViewport,
      });
      Object.defineProperty(navigator, "standalone", {
        configurable: true,
        value: true,
      });
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    const layout = await page.evaluate(() => ({
      viewportHeight: getComputedStyle(document.documentElement).getPropertyValue("--dokke-viewport-height").trim(),
      mainHeight: getComputedStyle(document.querySelector("main")).height,
      screenHeight: getComputedStyle(document.querySelector(".screen")).height,
    }));
    assert.equal(layout.viewportHeight, "808px", `a altura do visualViewport deve governar o PWA: ${JSON.stringify(layout)}`);
    assert.equal(layout.mainHeight, "808px", `main deve ocupar a viewport real: ${JSON.stringify(layout)}`);
    assert.equal(layout.screenHeight, "808px", `cada tela deve ocupar a viewport real: ${JSON.stringify(layout)}`);
  } finally {
    await browser.close();
    await close();
  }
});

test("Safari no navegador preserva a régua estrutural e não comprime os cards", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.addInitScript(() => {
      const visualViewport = new EventTarget();
      Object.defineProperties(visualViewport, {
        height: { configurable: true, value: 808 },
        offsetTop: { configurable: true, value: 0 },
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: visualViewport,
      });
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    const layout = await page.evaluate(() => ({
      viewportHeight: getComputedStyle(document.documentElement).getPropertyValue("--dokke-viewport-height").trim(),
      mainHeight: getComputedStyle(document.querySelector("main")).height,
    }));
    assert.equal(layout.viewportHeight, "100%", `o Safari no navegador não deve receber a altura visual reduzida: ${JSON.stringify(layout)}`);
    assert.equal(layout.mainHeight, "852px", `a régua original do navegador deve permanecer intacta: ${JSON.stringify(layout)}`);
  } finally {
    await browser.close();
    await close();
  }
});

test("toque no app não revela um segundo glass durante a animação", async () => {
  const { port, close } = await startServer({
    port: 0,
    obs: null,
    config: {
      schemaVersion: 2,
      revision: 0,
      pieces: [{ id: "app:Terminal", type: "app", name: "Terminal", position: 0 }],
      pinned: ["Terminal"],
    },
    appTools: {
      listAppProcesses: async () => [],
      listInstalledApps: async () => [{ name: "Terminal", path: "/Applications/Utilities/Terminal.app", icon: false }],
    },
    iconService: { getIconPng: async () => null },
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.atile[data-name="Terminal"]');

    const state = await page.locator('.atile[data-name="Terminal"]').evaluate(tile => {
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
        { id: "shortcut:Test One", type: "shortcut", name: "Test One", emoji: "🖱️", position: 0 },
        { id: "shortcut:Test Two", type: "shortcut", name: "Test Two", emoji: "🖱️", position: 1 },
      ],
      pinned: [],
    },
    appTools: {
      listAppProcesses: async () => [],
      listInstalledApps: async () => [],
    },
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll(".atile.empty").length === 38);
    const empty = page.locator(".atile.empty .aglass").first();
    const style = await empty.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { background: computed.backgroundColor, border: computed.border, boxShadow: computed.boxShadow };
    });
    assert.equal(await page.locator(".atile.empty").count(), 38);
    assert.equal(style.background, "rgba(255, 255, 255, 0.05)");
    assert.match(style.border, /rgba\(255, 255, 255, 0\.08\)/);
    assert.equal(style.boxShadow, "none");
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

test("gesto vertical percorre as duas telas e limita overscroll nas bordas", async () => {
  const { port, close } = await startServer(0);
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const match = html.match(/function rubberDy\(dy\)\{([\s\S]*?)\n    \}/);
    assert.ok(match, "rubberDy deve existir");
    const rubberDy = new Function("dy", "state", "h", "RUBBER", match[1]);
    assert.equal(rubberDy(200, { screen: "recents" }, () => 800, 28), 200,
      "o retorno deve seguir o dedo, não ficar preso no rubber band");
    assert.equal(rubberDy(-200, { screen: "recents" }, () => 800, 28), -28,
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
    assert.match(js, /dokke-v34/, "service worker deve invalidar o cache antigo da UI");
    const appResponse = await fetch(`http://127.0.0.1:${port}/`);
    const appHtml = await appResponse.text();
    assert.match(appHtml, /serviceWorker\.register\("\/sw\.js\?rev=dokke-v34"\)/, "registro e cache do service worker devem compartilhar a revisão atual");
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
    await page.waitForFunction(() => {
      const grid = document.querySelector(".page-grid");
      return Boolean(grid) && (grid.style.transform === "" || grid.style.transform.startsWith("scale("));
    });
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
    assert.ok(bounds.scale === "" || /^scale\(/.test(bounds.scale), "a grade só deve escalar quando a safe area reduzir a altura útil");
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
