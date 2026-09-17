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
    assert.match(html, /\.ttitle\{[\s\S]*font-family: "Bricolage Grotesque", sans-serif;/, "o título de Apps abertos deve usar a fonte de display");
    assert.match(html, /\.usage-title\{ font-family: "Bricolage Grotesque", sans-serif;/, "o título de Uso deve compartilhar a fonte de display");
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
    assert.match(html, /\.usage-state\{[\s\S]*background: linear-gradient\(145deg, rgba\(255,255,255,\.09\)/, "estados de aviso do Usage devem seguir o glass quente");
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

test("troca vertical anima somente as duas telas envolvidas", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.addInitScript(() => {
      navigator.serviceWorker.register = () => Promise.reject(new Error("blocked"));
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
    const transitions = await page.evaluate(async () => {
      const screens = document.querySelector("#screens");
      const ids = ["screenApps", "screenRecents", "screenUsage"];
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
      "a tela que não participa da troca não deve entrar na animação",
    );
  } finally {
    await browser.close();
    await close();
  }
});

test("rolagem rápida durante o settle preserva a próxima intenção vertical", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.addInitScript(() => {
      navigator.serviceWorker.register = () => Promise.reject(new Error("blocked"));
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".launchpad .atile", { timeout: 15000 });

    await page.evaluate(() => new Promise(resolve => {
      const screens = document.querySelector("#screens");
      const wheel = () => screens.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 500,
      }));
      screens.addEventListener("transitionrun", () => {
        wheel();
        resolve();
      }, { once: true });
      wheel();
    }));
    await page.waitForTimeout(700);

    assert.equal(
      await page.evaluate(() => document.body.classList.contains("is-usage")),
      true,
      "a segunda rolagem não deve desaparecer durante o assentamento da primeira",
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

function trendUsagePayload() {
  const payload = overflowingUsagePayload();
  payload.providers.codex.trend = {
    points: Array.from({ length: 60 }, (_, index) => {
      const value = index < 30 ? 2_000_000 : 1_000_000;
      return {
        label: `Sep ${index + 1}`,
        value,
        valueLabel: `${(value / 1_000_000).toFixed(1)}M tokens`,
      };
    }),
  };
  return payload;
}

function threeProviderUsagePayload() {
  const payload = overflowingUsagePayload();
  payload.providers.claude = {
    id: "claude",
    name: "Claude",
    status: "normal",
    resources: {
      weekly: { kind: "consumption", unit: "percent", remaining: 12, utilization: 0.12 },
    },
  };
  return payload;
}

async function openOverflowingUsagePage(port, browser, beforeNavigate, viewport = { width: 390, height: 480 }, payload = overflowingUsagePayload()) {
  const page = await browser.newPage({ viewport, hasTouch: true });
  await page.route("**/api/usage", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
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

test("Usage landscape dá prioridade ao card principal e preenche o slide de tendência", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 1024, height: 572 },
      { width: 1280, height: 800 },
    ]) {
      const page = await openOverflowingUsagePage(port, browser, null, viewport);
      const metrics = await page.evaluate(() => {
        const stack = document.querySelector(".usage-stack");
        const stackRect = stack.getBoundingClientRect();
        const usageHead = document.querySelector(".usage-head");
        const headTitle = usageHead?.querySelector(".usage-title")?.getBoundingClientRect().toJSON() || null;
        const headSync = usageHead?.querySelector(".usage-sync")?.getBoundingClientRect().toJSON() || null;
        const cards = [...stack.querySelectorAll(".usage-card")].map(card => ({
          className: card.className,
          rect: card.getBoundingClientRect().toJSON(),
          weekly: card.querySelector(".usage-metric-week")?.getBoundingClientRect().toJSON() || null,
          landscapeParts: {
            gauge: card.querySelector(".usage-gauge-wrap")?.getBoundingClientRect().toJSON() || null,
            reset: card.querySelector(".usage-five-copy")?.getBoundingClientRect().toJSON() || null,
            pace: card.querySelector(".usage-pace-explanation")?.getBoundingClientRect().toJSON() || null,
            week: card.querySelector(".usage-metric-week")?.getBoundingClientRect().toJSON() || null,
            weekBorderLeft: card.querySelector(".usage-metric-week")
              ? getComputedStyle(card.querySelector(".usage-metric-week")).borderLeftWidth
              : null,
          },
        }));
        const open = cards.find(card => card.className.includes("is-open"));
        const closed = cards.filter(card => card.className.includes("is-closed"));
        return { stack: stackRect.toJSON(), open, closed, headTitle, headSync, scrollHeight: stack.scrollHeight, clientHeight: stack.clientHeight };
      });
      if (viewport.width > viewport.height) {
        const widthRatio = metrics.open.rect.width / metrics.closed[0].rect.width;
        assert.ok(widthRatio >= 1.35 && widthRatio <= 1.65, `o landscape deve priorizar o card aberto em uma divisão próxima de 60/40: ${JSON.stringify({ viewport, widthRatio, metrics })}`);
      } else {
        assert.ok(Math.abs(metrics.open.rect.width - metrics.closed[0].rect.width) <= 1, `o retrato deve manter a largura integral do card aberto: ${JSON.stringify({ viewport, metrics })}`);
      }
      assert.ok(!metrics.open.weekly || metrics.open.weekly.bottom <= metrics.open.rect.bottom + 1, `a régua semanal deve caber no card principal: ${JSON.stringify({ viewport, metrics })}`);
      assert.ok(metrics.open.rect.height < viewport.height * .8, `o card principal não deve reservar altura artificial: ${JSON.stringify({ viewport, metrics })}`);
      assert.ok(metrics.closed.every(card => card.rect.height < metrics.open.rect.height), `os cards fechados devem ser mais compactos: ${JSON.stringify({ viewport, metrics })}`);
      if (viewport.width > viewport.height) {
        assert.ok(metrics.open.rect.height >= Math.min(viewport.height * .55, 380) - 1, `o card principal deve usar melhor a altura útil do landscape: ${JSON.stringify({ viewport, metrics })}`);
        assert.ok(metrics.headTitle && metrics.headSync && metrics.headSync.left >= metrics.headTitle.right - 1 && metrics.headSync.top < metrics.headTitle.bottom && metrics.headSync.bottom > metrics.headTitle.top, `o status deve ficar à frente do título no landscape: ${JSON.stringify({ viewport, metrics })}`);
        const { gauge, reset, pace, week } = metrics.open.landscapeParts;
        assert.ok(gauge && reset, `o card landscape deve manter o gauge e o reset visíveis: ${JSON.stringify({ viewport, metrics })}`);
        if (week) {
          assert.ok(gauge.left < reset.left, `gauge e reset devem seguir a ordem horizontal: ${JSON.stringify({ viewport, metrics })}`);
          assert.ok(week.left <= gauge.left + 1 && week.right >= reset.right - 1, `a semana deve voltar para uma faixa abaixo do gauge e do reset: ${JSON.stringify({ viewport, metrics })}`);
          if (pace) {
            assert.ok(week.top >= pace.bottom - 1, `a semana deve voltar para baixo do aviso de ritmo: ${JSON.stringify({ viewport, metrics })}`);
          } else {
            assert.ok(week.top >= Math.max(gauge.bottom, reset.bottom) - 1, `a semana deve ficar abaixo da primeira faixa do card: ${JSON.stringify({ viewport, metrics })}`);
          }
          assert.equal(metrics.open.landscapeParts.weekBorderLeft, "0px", `a semana não deve ter uma divisória vertical própria: ${JSON.stringify({ viewport, metrics })}`);
        }
      }
      assert.ok(metrics.closed.every(card => card.rect.top < metrics.stack.bottom && card.rect.bottom <= metrics.stack.bottom + 1), `os cards laterais devem ficar dentro da grade: ${JSON.stringify({ viewport, metrics })}`);
      assert.ok(metrics.scrollHeight <= metrics.clientHeight + 1, `a grade landscape não deve criar overflow vertical: ${JSON.stringify({ viewport, metrics })}`);
      const initialSlideMetrics = await page.locator(".usage-provider-track").evaluate(track => ({
        track: track.getBoundingClientRect().toJSON(),
        slides: [...track.children].map(slide => slide.getBoundingClientRect().toJSON()),
        scrollLeft: track.scrollLeft,
      }));
      const nextSlide = initialSlideMetrics.slides[1];
      assert.ok(!nextSlide || nextSlide.left >= initialSlideMetrics.track.right - 1 || nextSlide.right <= initialSlideMetrics.track.left + 1, `o slide 2 não pode vazar no slide 1: ${JSON.stringify({ viewport, initialSlideMetrics })}`);
      await page.locator(".usage-provider-dot").nth(1).click();
      const trendMetrics = await page.locator(".usage-trend").evaluate(trend => ({
        rect: trend.getBoundingClientRect().toJSON(),
        slide: trend.closest(".usage-trend-slide").getBoundingClientRect().toJSON(),
        summary: trend.closest(".usage-trend-slide").querySelector(".usage-trend-summary").getBoundingClientRect().toJSON(),
        track: trend.closest(".usage-provider-track").getBoundingClientRect().toJSON(),
        bars: trend.querySelector(".usage-trend-bar-chart").getBoundingClientRect().toJSON(),
        activityCount: trend.querySelectorAll(".usage-trend-activity-panel, .usage-trend-grid").length,
        viewportHeight: innerHeight,
      }));
      assert.ok(trendMetrics.rect.left >= trendMetrics.track.left + 7 && trendMetrics.rect.right <= trendMetrics.track.right - 7, `o frame deve respeitar o gutter do slide: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.summary.top >= trendMetrics.rect.top - 1 && trendMetrics.summary.bottom <= trendMetrics.rect.bottom + 1, `o resumo deve respeitar o padding do frame: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(Math.abs(trendMetrics.rect.bottom - trendMetrics.slide.bottom) <= 1, `o card da tendência deve terminar no fim do slide: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.summary.height + trendMetrics.rect.height >= trendMetrics.viewportHeight * .65, `a tendência não deve reservar altura vazia: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.rect.bottom <= trendMetrics.viewportHeight + 1, `o card da tendência deve caber na viewport: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.bars.height >= Math.min(64, trendMetrics.viewportHeight * .18), `as barras devem manter uma área legível no landscape: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.equal(trendMetrics.activityCount, 0, `o segundo slide deve ter somente o gráfico de tokens por dia: ${JSON.stringify({ viewport, trendMetrics })}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage portrait preenche o slide de tendência e amplia as barras", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      const page = await openOverflowingUsagePage(port, browser, null, viewport);
      await page.locator(".usage-provider-dot").nth(1).click();
      const trendMetrics = await page.locator(".usage-trend").evaluate(trend => ({
        rect: trend.getBoundingClientRect().toJSON(),
        slide: (() => {
          const slide = trend.closest(".usage-trend-slide");
          const rect = slide.getBoundingClientRect();
          const styles = getComputedStyle(slide);
          return {
            ...rect.toJSON(),
            contentHeight: rect.height - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom),
          };
        })(),
        summary: trend.closest(".usage-trend-slide").querySelector(".usage-trend-summary").getBoundingClientRect().toJSON(),
        track: trend.closest(".usage-provider-track").getBoundingClientRect().toJSON(),
        bars: trend.querySelector(".usage-trend-bar-chart").getBoundingClientRect().toJSON(),
        activityCount: trend.querySelectorAll(".usage-trend-activity-panel, .usage-trend-grid").length,
        viewportHeight: innerHeight,
      }));
      assert.ok(trendMetrics.rect.left >= trendMetrics.track.left + 7 && trendMetrics.rect.right <= trendMetrics.track.right - 7, `o frame portrait deve respeitar o gutter do slide: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.summary.top >= trendMetrics.rect.top - 1 && trendMetrics.summary.bottom <= trendMetrics.rect.bottom + 1, `o resumo portrait deve respeitar o padding do frame: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.rect.bottom <= trendMetrics.slide.bottom + 1, `o card portrait deve caber no slide: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.rect.height < trendMetrics.viewportHeight * .8, `o card portrait não deve reservar altura vazia: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.bars.height >= 118, `as barras portrait devem manter uma área legível: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.equal(trendMetrics.activityCount, 0, `o segundo slide portrait deve ter somente o gráfico de tokens por dia: ${JSON.stringify({ viewport, trendMetrics })}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage trend filtra o periodo e atualiza o resumo e as barras", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser, null, { width: 390, height: 844 }, trendUsagePayload());
    await page.locator(".usage-provider-dot").nth(1).click();
    assert.equal(await page.locator(".usage-provider-track").evaluate(track => track.scrollTop), 0, "trocar para a tendência não deve deslocar o track verticalmente pelo foco do pager");
    assert.equal(await page.locator(".usage-trend-period").count(), 3, "a tendência deve oferecer somente Hoje, 7D e 30D");
    assert.equal(await page.locator('.usage-trend-period[data-period="12m"]').count(), 0, "a tendência não deve oferecer uma janela de 12 meses");
    assert.equal(await page.locator('.usage-trend-period[data-period="3m"]').count(), 0, "a tendência não deve oferecer uma janela de 3 meses");
    assert.equal(await page.locator('.usage-trend-period[data-period="today"]').count(), 1, "a tendência deve oferecer o atalho de hoje");
    assert.equal(await page.locator('.usage-trend-period[aria-pressed="true"]').getAttribute("data-period"), "30d", "30 dias deve ser o período inicial para preservar a leitura das barras");
    assert.equal(await page.locator(".usage-trend-bar").count(), 30, "o período inicial deve exibir uma barra por dia sem comprimir o gráfico");
    assert.equal(await page.locator(".usage-trend-summary-metric").count(), 4, "o resumo deve manter quatro métricas compactas");
    assert.equal(await page.locator(".usage-trend-summary-metrics").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length), 4, "as quatro métricas devem permanecer em uma única faixa no mobile");
    assert.deepEqual(await page.locator(".usage-trend-summary-metric").first().evaluate(el => [...el.children].map(child => child.className)), ["usage-trend-summary-value", "usage-trend-summary-label"], "cada métrica deve mostrar o valor antes da legenda");
    assert.match((await page.locator(".usage-trend-summary-total").textContent()).trim(), /M$/, "o total deve ficar destacado em formato compacto");
    assert.equal(await page.locator(".usage-trend-summary-comparison").count(), 1, "o resumo deve comparar o período atual com o anterior");
    assert.match(await page.locator(".usage-trend-summary-comparison").textContent(), /↓\s*50%.*30 dias anteriores/, "a comparação deve mostrar a queda contra os 30 dias anteriores");
    assert.deepEqual(await page.locator(".usage-trend-bar-y-axis-label").allTextContents(), ["1M", "500K", "0"], "o gráfico deve exibir a escala vertical com topo, meio e zero");
    assert.equal(await page.locator(".usage-trend-panel-chevron").count(), 1, "o cabeçalho do gráfico deve manter a indicação de navegação");
    assert.equal(await page.locator(".usage-trend-activity-panel").count(), 0, "a atividade deve sair do segundo slide");
    assert.equal(await page.locator(".usage-trend-grid").count(), 0, "o heatmap não deve ser renderizado no segundo slide");
    assert.equal(await page.locator(".usage-trend-bar-tooltip").isHidden(), true, "a quantidade diária só deve aparecer depois do clique");
    const initialTooltip = await page.locator(".usage-trend-bar-tooltip").boundingBox();
    assert.equal(initialTooltip, null, "o tooltip não deve ocupar o gráfico antes de uma interação");
    const firstBar = page.locator(".usage-trend-bar").first();
    const secondBar = page.locator(".usage-trend-bar").nth(1);
    await firstBar.click();
    const firstTooltip = await page.locator(".usage-trend-bar-tooltip").boundingBox();
    const chartBounds = await page.locator(".usage-trend-bar-chart").boundingBox();
    assert.equal(await firstBar.getAttribute("role"), null, "cada barra deve preservar a semântica nativa de botão");
    assert.ok(firstTooltip && chartBounds && firstTooltip.x >= chartBounds.x - 1 && firstTooltip.x + firstTooltip.width <= chartBounds.x + chartBounds.width + 1, "o tooltip deve permanecer dentro do gráfico");
    await secondBar.click();
    const secondTooltip = await page.locator(".usage-trend-bar-tooltip").boundingBox();
    assert.notEqual(firstTooltip?.x, secondTooltip?.x, "o tooltip deve acompanhar a barra selecionada");

    await page.locator('.usage-trend-period[data-period="7d"]').click();
    assert.equal(await page.locator('.usage-trend-period[aria-pressed="true"]').getAttribute("data-period"), "7d", "o período selecionado deve ser refletido no controle");
    assert.equal(await page.locator(".usage-trend-bar").count(), 7, "o período de sete dias deve exibir uma barra por dia");
    assert.equal(await page.locator(".usage-trend-summary-window").textContent(), "últimos 7 dias", "o resumo deve acompanhar o período selecionado");
    await page.locator('.usage-trend-period[data-period="today"]').click();
    assert.equal(await page.locator('.usage-trend-period[aria-pressed="true"]').getAttribute("data-period"), "today", "o atalho de hoje deve ser selecionável");
    assert.equal(await page.locator(".usage-trend-bar").count(), 1, "o atalho de hoje deve exibir apenas o ponto atual");
    assert.equal(await page.locator(".usage-trend-summary-window").textContent(), "hoje", "o resumo deve identificar a janela de hoje");
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage trend encaixa resumo e barras sem overflow", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1280, height: 800 },
    ]) {
      const page = await openOverflowingUsagePage(port, browser, null, viewport, trendUsagePayload());
      await page.locator(".usage-provider-dot").nth(1).click();
      const metrics = await page.locator(".usage-trend").evaluate(trend => {
        const slide = trend.closest(".usage-trend-slide");
        const card = trend.getBoundingClientRect();
        const summary = trend.querySelector(".usage-trend-summary").getBoundingClientRect();
        const bars = trend.querySelector(".usage-trend-bars-panel").getBoundingClientRect();
        return {
          card: card.toJSON(),
          slide: slide.getBoundingClientRect().toJSON(),
          summary: summary.toJSON(),
          bars: bars.toJSON(),
          activityCount: trend.querySelectorAll(".usage-trend-activity-panel, .usage-trend-grid").length,
          cardScrollHeight: trend.scrollHeight,
          cardClientHeight: trend.clientHeight,
          slideScrollHeight: slide.scrollHeight,
          slideClientHeight: slide.clientHeight,
        };
      });
      assert.ok(metrics.bars.width > 0 && metrics.bars.height > 0, `o gráfico principal deve ter área própria: ${JSON.stringify({ viewport, metrics })}`);
      assert.equal(metrics.activityCount, 0, `a atividade não deve mais ser renderizada: ${JSON.stringify({ viewport, metrics })}`);
      assert.ok(metrics.summary.bottom <= metrics.card.bottom + 1, `o resumo deve caber no frame: ${JSON.stringify({ viewport, metrics })}`);
      assert.ok(metrics.cardScrollHeight <= metrics.cardClientHeight + 1, `o card não pode criar scroll vertical: ${JSON.stringify({ viewport, metrics })}`);
      assert.ok(metrics.slideScrollHeight <= metrics.slideClientHeight + 1, `o slide não pode criar scroll vertical: ${JSON.stringify({ viewport, metrics })}`);
      assert.ok(metrics.card.right <= metrics.slide.right + 1 && metrics.card.left >= metrics.slide.left - 1, `o frame deve respeitar a largura do slide: ${JSON.stringify({ viewport, metrics })}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage e Tendência compartilham gutters e escala responsiva", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1280, height: 800 },
    ]) {
      const page = await openOverflowingUsagePage(port, browser, null, viewport, trendUsagePayload());
      const usageMetrics = await page.locator(".usage-scroll").evaluate(scroll => {
        const head = scroll.querySelector(".usage-head");
        const stack = scroll.querySelector(".usage-stack");
        const dots = scroll.querySelector(".usage-provider-dots");
        const value = scroll.querySelector(".usage-card.is-open .usage-gauge-copy .usage-limit-value");
        const rect = el => el?.getBoundingClientRect().toJSON() || null;
        return {
          head: rect(head),
          stack: rect(stack),
          dots: rect(dots),
          value: rect(value),
          valueFontSize: value ? getComputedStyle(value).fontSize : null,
          scrollWidth: scroll.scrollWidth,
          clientWidth: scroll.clientWidth,
          scrollHeight: scroll.scrollHeight,
          clientHeight: scroll.clientHeight,
        };
      });
      const numericValueFontSize = Number.parseFloat(usageMetrics.valueFontSize || "0");
      assert.ok(usageMetrics.head && usageMetrics.stack && usageMetrics.dots, `Usage deve expor uma régua única: ${JSON.stringify({ viewport, usageMetrics })}`);
      assert.ok(Math.abs(usageMetrics.head.left - usageMetrics.stack.left) <= 1, `título e stack devem compartilhar o gutter esquerdo: ${JSON.stringify({ viewport, usageMetrics })}`);
      assert.ok(Math.abs(usageMetrics.head.right - usageMetrics.stack.right) <= 1, `título e stack devem compartilhar o gutter direito: ${JSON.stringify({ viewport, usageMetrics })}`);
      assert.ok(Math.abs(usageMetrics.dots.left - usageMetrics.stack.left) <= 1 && Math.abs(usageMetrics.dots.right - usageMetrics.stack.right) <= 1, `dots devem respeitar a mesma régua externa: ${JSON.stringify({ viewport, usageMetrics })}`);
      assert.ok(usageMetrics.scrollWidth <= usageMetrics.clientWidth + 1 && usageMetrics.scrollHeight <= usageMetrics.clientHeight + 1, `Usage não pode criar overflow estrutural: ${JSON.stringify({ viewport, usageMetrics })}`);
      if (viewport.width > viewport.height && viewport.height <= 520) {
        assert.ok(numericValueFontSize <= 34, `o número do gauge deve acompanhar o gauge no landscape curto: ${JSON.stringify({ viewport, usageMetrics })}`);
      }

      await page.locator(".usage-provider-dot").nth(1).click();
      const trendMetrics = await page.locator(".usage-trend").evaluate(trend => {
        const slide = trend.closest(".usage-trend-slide");
        const selectors = [".usage-trend-periods", ".usage-trend-summary", ".usage-trend-bars-panel"];
        const rect = el => el?.getBoundingClientRect().toJSON() || null;
        return {
          slide: rect(slide),
          frame: rect(trend),
          periods: rect(trend.querySelector(".usage-trend-periods")),
          summary: rect(trend.querySelector(".usage-trend-summary")),
          panel: rect(trend.querySelector(".usage-trend-bars-panel")),
          selectors,
          gap: (() => {
            const summary = trend.querySelector(".usage-trend-summary");
            const panel = trend.querySelector(".usage-trend-bars-panel");
            return summary && panel ? panel.getBoundingClientRect().top - summary.getBoundingClientRect().bottom : null;
          })(),
          scrollWidth: trend.scrollWidth,
          clientWidth: trend.clientWidth,
          scrollHeight: trend.scrollHeight,
          clientHeight: trend.clientHeight,
        };
      });
      assert.ok(trendMetrics.slide && trendMetrics.frame && trendMetrics.periods && trendMetrics.summary && trendMetrics.panel, `Tendência deve expor o frame completo: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.frame.left >= trendMetrics.slide.left + 7 && trendMetrics.frame.right <= trendMetrics.slide.right - 7, `o frame da tendência deve usar o mesmo gutter do Usage: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(Math.abs(trendMetrics.periods.left - trendMetrics.summary.left) <= 1 && Math.abs(trendMetrics.panel.left - trendMetrics.summary.left) <= 1, `seletor, resumo e gráfico devem compartilhar o padding interno: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(Math.abs(trendMetrics.periods.right - trendMetrics.summary.right) <= 1 && Math.abs(trendMetrics.panel.right - trendMetrics.summary.right) <= 1, `seletor, resumo e gráfico devem terminar na mesma régua: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok((trendMetrics.gap ?? Infinity) <= 24, `o gráfico não pode ficar separado por um vão artificial: ${JSON.stringify({ viewport, trendMetrics })}`);
      assert.ok(trendMetrics.scrollWidth <= trendMetrics.clientWidth + 1 && trendMetrics.scrollHeight <= trendMetrics.clientHeight + 1, `Tendência não pode criar overflow estrutural: ${JSON.stringify({ viewport, trendMetrics })}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mantém o marcador de estimativa na semana quando o ritmo está adiantado", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const resetAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const payload = overflowingUsagePayload();
    payload.providers.codex.resources.weekly = {
      kind: "consumption",
      unit: "percent",
      used: 31,
      limit: 100,
      remaining: 69,
      utilization: 0.31,
      resetsAt: resetAt,
      periodDurationMs: 7 * 24 * 60 * 60 * 1000,
    };
    const page = await openOverflowingUsagePage(port, browser, null, { width: 390, height: 844 }, payload);
    const weekly = page.locator(".usage-card.is-open .usage-limit:not(.primary)");
    const paceTick = weekly.locator(".usage-week-pace-tick");
    assert.equal(await weekly.getAttribute("data-pace"), "ahead");
    assert.equal(await paceTick.count(), 1, "a semana deve manter o marcador mesmo quando o ritmo está adiantado");
    assert.equal(await paceTick.getAttribute("data-pace"), "ahead");
    assert.match(await paceTick.getAttribute("style") || "", /left:/, "o marcador deve indicar a posição estimada na régua");
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage encaixa o track depois de um arrasto horizontal interrompido", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser, null, { width: 844, height: 390 });
    const result = await page.evaluate(async () => {
      const track = document.querySelector(".usage-provider-track");
      const width = track.clientWidth;
      track.style.scrollSnapType = "none";
      track.scrollLeft = Math.round(width * .45);
      track.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, pointerType: "touch" }));
      await new Promise(resolve => setTimeout(resolve, 180));
      return {
        scrollLeft: track.scrollLeft,
        width,
        currentIndex: [...document.querySelectorAll(".usage-provider-dot")].findIndex(dot => dot.getAttribute("aria-current") === "true"),
      };
    });
    assert.ok(result.scrollLeft <= 1 || Math.abs(result.scrollLeft - result.width) <= 1, `o track não pode permanecer entre slides: ${JSON.stringify(result)}`);
    assert.equal(result.currentIndex, 0, `o dot deve acompanhar o slide encaixado: ${JSON.stringify(result)}`);
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mostra outros provedores abaixo e promove o card clicado", async () => {
  const { port, close } = await startServer({
    port: 0,
    config: { schemaVersion: 2, revision: 0, pieces: [], pinned: [] },
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

test("Usage reage no card e na troca de IA sem duplicar a confirmação", async () => {
  const { port, close } = await startServer({
    port: 0,
    config: { schemaVersion: 2, revision: 0, pieces: [], pinned: [], usageProvider: "codex" },
  });
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
      document.querySelector(".usage-card.is-open").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await page.waitForSelector('.usage-mascot-wrap[data-reaction="chart"]', { timeout: 1000 });
    const trace = await page.evaluate(() => {
      window.__usageMascotTrace.observer.disconnect();
      return window.__usageMascotTrace.added;
    });
    assert.equal(trace.filter(text => text === "Atualizando...").length, 0, "o gráfico não deve disparar refresh da cota");
    assert.equal(trace.filter(text => text === "Atualizado").length, 0, "o gráfico não deve criar confirmação duplicada");

    await page.locator(".usage-card.is-open").dispatchEvent("click");
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
      sprite: wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]') ? getComputedStyle(wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]')).animationName : null,
      frame: wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]')?.dataset.frame,
      transform: wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]')?.style.transform,
      image: wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]') ? getComputedStyle(wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]')).backgroundImage : null,
      oldOverlay: wrap.querySelector(".usage-writing-tool, .usage-writing-line")
    }));
    assert.equal(writingState.sprite, "none");
    assert.match(writingState.frame, /^\d+$/);
    assert.match(writingState.transform, /translate3d\(/);
    assert.match(writingState.image, /dokke-mascot-working-(start|loop|end)-strip\.webp/);
    assert.equal(await page.locator('.usage-mascot-wrap[data-activity="working"] .usage-mascot-sprite').getAttribute("data-phase"), "start");
    assert.equal(writingState.oldOverlay, null);
    const workingFrames = await page.evaluate(async () => {
      const read = () => document.querySelector('.usage-mascot-wrap[data-activity="working"] .usage-mascot-sprite-layer[data-active="true"]')?.dataset.frame;
      const initial = read();
      const deadline = performance.now() + 1200;
      let later = initial;
      while (performance.now() < deadline && later === initial) {
        await new Promise(resolve => setTimeout(resolve, 80));
        later = read();
      }
      return { initial, later };
    });
    assert.notEqual(workingFrames.initial, workingFrames.later, "o working deve avançar as poses enquanto o modelo atualiza");
    assert.equal(await page.locator('.usage-mascot-wrap[data-activity="working"]').count(), 1);
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage encadeia start, loop e end ao trocar entre working e thinking", async () => {
  const { port, close } = await startServer({ port: 0, config: { usageProvider: "codex" } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let activityState = "working";
  try {
    const page = await openOverflowingUsagePage(port, browser, async page => {
      await page.route("**/api/usage/activity", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          source: "dokke",
          sourceState: "available",
          updatedAt: new Date().toISOString(),
          providers: { codex: { state: activityState, since: new Date().toISOString(), detail: activityState, sessions: 1 } },
          errors: [],
        }),
      }));
    });
    const mascot = page.locator('.usage-mascot-wrap[data-provider="codex"]');
    await page.waitForSelector('.usage-mascot-wrap[data-provider="codex"] .usage-mascot-sprite[data-phase="loop"]', { timeout: 5000 });
    assert.match(await mascot.locator('.usage-mascot-sprite-layer[data-active="true"]').evaluate(layer => getComputedStyle(layer).backgroundImage), /working-loop-strip/);

    activityState = "waiting";
    await page.waitForSelector('.usage-mascot-wrap[data-provider="codex"] .usage-mascot-sprite[data-phase="end"]', { timeout: 5000 });
    await page.waitForSelector('.usage-mascot-wrap[data-provider="codex"] .usage-mascot-sprite[data-phase="start"]', { timeout: 5000 });
    await page.waitForFunction(() => {
      const wrap = document.querySelector('.usage-mascot-wrap[data-provider="codex"]');
      const sprite = wrap?.querySelector(".usage-mascot-sprite");
      return wrap?.dataset.activity === "waiting" && sprite?.dataset.activity === "thinking";
    }, null, { timeout: 5000 });
    assert.match(await mascot.locator('.usage-mascot-sprite-layer[data-active="true"]').evaluate(layer => getComputedStyle(layer).backgroundImage), /thinking-(start|loop)-strip/);
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mantém o loop do mascote no WebView com movimento reduzido", async () => {
  const { port, close } = await startServer({ port: 0, config: { usageProvider: "codex" } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser, async page => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/api/usage/activity", route => route.abort());
    });
    const frames = await page.evaluate(async () => {
      const read = () => document.querySelector('.usage-mascot-wrap[data-activity="idle"] .usage-mascot-idle-layer[data-active="true"]')?.dataset.frame || null;
      const initial = read();
      await new Promise(resolve => setTimeout(resolve, 1400));
      return { initial, later: read(), reduced: matchMedia("(prefers-reduced-motion: reduce)").matches };
    });
    assert.equal(frames.reduced, true, "o teste deve estar no modo de movimento reduzido");
    assert.match(frames.initial || "", /^\d+$/, "o frame inicial deve existir");
    assert.match(frames.later || "", /^\d+$/, "o frame posterior deve existir");
    assert.notEqual(frames.initial, frames.later, "o mascote deve continuar em loop, mesmo em movimento reduzido");
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mantém o loop de standby quando o modelo está idle", async () => {
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
            providers: { codex: { state: "idle", since: new Date().toISOString(), detail: "parado", sessions: 0 } },
            errors: [],
          }),
        });
      });
    });
    await page.waitForSelector('.usage-mascot-wrap[data-activity="idle"]', { timeout: 5000 });
    const standbyState = await page.locator('.usage-mascot-wrap[data-activity="idle"]').evaluate(wrap => {
      const idle = wrap.querySelector(".usage-mascot-idle");
      const layer = idle?.querySelector('.usage-mascot-idle-layer[data-active="true"]');
      const style = layer ? getComputedStyle(layer) : null;
      return {
        animation: style?.animationName,
        frame: layer?.dataset.frame,
        image: style?.backgroundImage,
        oldEyes: wrap.querySelector(".usage-token-eyes"),
      };
    });
    assert.equal(standbyState.animation, "none");
    assert.match(standbyState.frame, /^\d+$/);
    assert.match(standbyState.image, /dokke-mascot-idle-(principal|one|coffee)-strip\.webp/);
    assert.equal(standbyState.oldEyes, null);
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage avança os frames do idle e entra na pausa de cafe", async () => {
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
            providers: { codex: { state: "idle", since: new Date().toISOString(), detail: "parado", sessions: 0 } },
            errors: [],
          }),
        });
      });
    });
    const snapshots = await page.evaluate(async () => {
      const read = () => {
        const layer = document.querySelector('.usage-mascot-wrap[data-activity="idle"] .usage-mascot-idle-layer[data-active="true"]');
        return { frame: Number(layer?.dataset.frame), transform: layer?.style.transform, phase: layer?.dataset.phase, image: layer ? getComputedStyle(layer).backgroundImage : "" };
      };
      const initial = read();
      await new Promise(resolve => setTimeout(resolve, 900));
      const moving = read();
      const deadline = performance.now() + 9000;
      let coffee = read();
      while (performance.now() < deadline && coffee.phase !== "idleCoffee") {
        await new Promise(resolve => setTimeout(resolve, 180));
        coffee = read();
      }
      return { initial, moving, coffee };
    });
    assert.notEqual(snapshots.initial.frame, snapshots.moving.frame, "o idle deve trocar de pose com o tempo");
    assert.notEqual(snapshots.initial.transform, snapshots.moving.transform, "o renderer deve mover o strip por transform");
    assert.equal(snapshots.coffee.phase, "idleCoffee", "o idle deve entrar no track de cafe");
    assert.match(snapshots.coffee.image, /dokke-mascot-idle-coffee-strip\.webp/);
    assert.match(String(snapshots.coffee.frame), /^\d+$/);
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage volta ao idle comum depois da pausa de cafe", async () => {
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
            providers: { codex: { state: "idle", since: new Date().toISOString(), detail: "parado", sessions: 0 } },
            errors: [],
          }),
        });
      });
    });
    const gesture = await page.evaluate(async () => {
      const read = () => {
        const layer = document.querySelector('.usage-mascot-wrap[data-activity="idle"] .usage-mascot-idle-layer[data-active="true"]');
        return {
          layer,
          frame: Number(layer?.dataset.frame),
          image: layer ? getComputedStyle(layer).backgroundImage : "",
        };
      };
      const deadline = performance.now() + 12000;
      let snapshot = read();
      let frame = snapshot.frame;
      while (performance.now() < deadline && snapshot.image.includes("idle-coffee")) {
        await new Promise(resolve => setTimeout(resolve, 300));
        snapshot = read();
        frame = snapshot.frame;
      }
      return {
        frame,
        image: snapshot.image,
      };
    });
    assert.notEqual(gesture.image.includes("idle-coffee"), true, "o idle deve sair da pausa de cafe");
    assert.match(gesture.image, /dokke-mascot-idle-(principal|one)-strip\.webp/);
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
      sprite: wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]') ? getComputedStyle(wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]')).animationName : null,
      frame: wrap.querySelector('.usage-mascot-sprite-layer[data-active="true"]')?.dataset.frame,
      tokenBackground: getComputedStyle(wrap.querySelector(".usage-token")).backgroundImage,
      oldOverlay: wrap.querySelector(".usage-writing-tool, .usage-writing-line")
    }));
    assert.equal(writingState.sprite, "none");
    assert.match(writingState.frame, /^\d+$/);
    assert.equal(writingState.tokenBackground, "none");
    assert.equal(writingState.oldOverlay, null);
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
    assert.equal(await primary.locator(".usage-pace-warning").count(), 1);
    assert.equal(await primary.locator(".usage-pace-flame").count(), 1);
    assert.match(await primary.locator(".usage-pace-explanation").textContent() || "", /limite/);
    const weekly = page.locator(".usage-card.is-open .usage-limit:not(.primary)");
    assert.equal(await weekly.locator(".usage-limit-label").textContent(), "semana");
    assert.equal(await weekly.locator(".usage-pace-flame").count(), 1, "a semana deve mostrar o fogo quando a projeção passa do limite");
    const weeklyPaceTick = weekly.locator(".usage-week-pace-tick");
    assert.equal(await weeklyPaceTick.count(), 1, "a semana deve mostrar o risquinho do ritmo quando a projeção passa do limite");
    assert.equal(await weeklyPaceTick.getAttribute("data-pace"), "behind");
    assert.match(await weeklyPaceTick.getAttribute("style") || "", /left:/, "o risquinho deve ser posicionado na régua");

    const reset = primary.locator(".usage-limit-reset-value");
    const countdown = await reset.textContent();
    assert.equal(await reset.evaluate(node => node.tagName), "SPAN", "o countdown não deve ser um controle clicável");
    await reset.click();
    await page.waitForTimeout(100);
    assert.equal(await reset.textContent(), countdown, "clicar no countdown não deve alternar o reset");
    const gaugeChart = primary.locator(".usage-gauge-wrap svg");
    await gaugeChart.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(100);
    assert.equal(await reset.textContent(), countdown, "clicar no gráfico não deve alternar o reset");
    assert.equal(await primary.locator(".usage-five-reset-exact").count(), 0, "o gráfico não deve controlar a data exata");
    const usageCard = page.locator(".usage-card.is-open");
    assert.equal(await usageCard.getAttribute("role"), null, "o card aberto não deve ser um botão que contém outros controles");
    assert.equal(await usageCard.locator(".usage-reset-block").getAttribute("role"), "button", "o reset deve ter um controle acessível próprio");
    await usageCard.click({ position: { x: 20, y: 20 } });
    await page.waitForFunction(() => !!document.querySelector(".usage-five-reset-exact"));
    assert.match(await reset.textContent() || "", /^\d+h \d+m$/, "o countdown grande deve permanecer compacto");
    const exactCaption = primary.locator(".usage-five-reset-exact");
    assert.equal(await exactCaption.evaluate(node => node.tagName), "SPAN", "a data exata também não deve ser um controle clicável");
    assert.match(await exactCaption.textContent() || "", /hoje|amanhã|ontem/);
    assert.equal(await exactCaption.evaluate(node => getComputedStyle(node).fontSize), "11px");
    await exactCaption.click();
    await page.waitForTimeout(100);
    assert.ok(await exactCaption.isVisible(), "a data exata deve continuar visível após o clique");
    assert.ok(await exactCaption.isVisible(), "a data exata deve continuar visível após a troca do reset");
    await usageCard.click({ position: { x: 20, y: 20 } });
    await page.waitForFunction(() => !document.querySelector(".usage-five-reset-exact"));
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage separa uso real, reset e aviso de ritmo", async () => {
  const resetAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const payload = overflowingUsagePayload();
  payload.providers.codex.resources.session = {
    kind: "consumption",
    unit: "percent",
    used: 84,
    limit: 100,
    remaining: 16,
    utilization: 0.84,
    resetsAt: resetAt,
    periodDurationMs: 10 * 60 * 60 * 1000,
  };
  payload.providers.codex.resources.weekly = {
    kind: "consumption",
    unit: "percent",
    used: 69,
    limit: 100,
    remaining: 31,
    utilization: 0.69,
    resetsAt: resetAt,
    periodDurationMs: 7 * 24 * 60 * 60 * 1000,
  };
  const { port, close } = await startServer({
    port: 0,
    config: { usage: { enabled: true, display: "used", reset: "countdown" } },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser, null, { width: 390, height: 844 }, payload);
    const card = page.locator('.usage-card.is-open[data-provider="codex"]');
    assert.equal(await card.locator(".usage-provider-name .usage-provider-plan").count(), 0);
    assert.equal(await card.locator(".usage-card-head > .usage-provider-plan").textContent(), "Plus");
    assert.equal(await card.locator(".usage-card-head > .usage-card-chevron").count(), 0);
    const primary = page.locator('.usage-card.is-open[data-provider="codex"] .usage-limit.primary');
    assert.equal(await primary.locator(".usage-pace-score").getAttribute("data-metric"), "usage");
    assert.equal(await primary.locator(".usage-pace-score").textContent(), "84%");
    assert.equal(await primary.locator(".usage-pace-label").count(), 0);
    assert.equal(await primary.locator(".usage-gauge-wrap").getAttribute("role"), "button");
    await primary.locator(".usage-pace-score").click();
    await page.waitForFunction(() => document.querySelector(".usage-pace-score")?.textContent === "16%");
    assert.match(await primary.locator(".usage-pace-explanation").textContent() || "", /antes do reset/);
    assert.equal(await primary.locator(".usage-pace-explanation .usage-pace-flame").count(), 1);
    assert.equal(await primary.locator(".usage-actual-block").count(), 0);
    assert.equal(await primary.locator(".usage-actual-percent").count(), 0);
    assert.match(await primary.locator(".usage-reset-block").textContent() || "", /Reset em/);
    assert.match(await primary.locator('svg[role="img"]').getAttribute("aria-label") || "", /restante/i);
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mostra estado útil nos cards fechados e mantém um único pager interno", async () => {
  const payload = overflowingUsagePayload();
  payload.providers.antigravity.resources = {};
  const { port, close } = await startServer({
    port: 0,
    config: { usage: { enabled: true, display: "used", reset: "countdown" } },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser, null, { width: 390, height: 844 }, payload);
    assert.equal(await page.locator('.usage-card.is-closed[data-provider="grok"] .usage-peek').textContent(), "28%");
    assert.equal(await page.locator('.usage-card.is-closed[data-provider="grok"] .usage-secondary-meter').count(), 1);
    assert.equal(await page.locator('.usage-card.is-closed[data-provider="antigravity"] .usage-peek').textContent(), "—");
    assert.equal(await page.locator('.usage-card.is-closed[data-provider="antigravity"] .usage-secondary-meter').count(), 0);
    const closedRow = await page.locator('.usage-card.is-closed[data-provider="grok"]').evaluate(card => {
      const items = [...card.querySelectorAll(".usage-provider-logo, .usage-provider-name, .usage-peek, .usage-card-chevron, .usage-secondary-meter")];
      const centers = items.map(item => {
        const rect = item.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
      return {
        height: card.getBoundingClientRect().height,
        headDisplay: getComputedStyle(card.querySelector(".usage-card-head")).display,
        centerSpread: Math.max(...centers) - Math.min(...centers),
      };
    });
    assert.equal(closedRow.headDisplay, "contents", "o cabeçalho fechado deve compartilhar a mesma linha do card");
    assert.ok(closedRow.height <= 56, `card fechado deve economizar altura: ${JSON.stringify(closedRow)}`);
    assert.ok(closedRow.centerSpread <= 1, `elementos do card fechado devem ficar centralizados: ${JSON.stringify(closedRow)}`);
    assert.equal(await page.locator("#vdots").evaluate(node => getComputedStyle(node).display), "none");
    assert.equal(await page.locator(".usage-provider-dots").count(), 1);
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mantém escala e gutters responsivos no landscape e no portrait", async () => {
  const payload = overflowingUsagePayload();
  const { port, close } = await startServer({
    port: 0,
    config: { usage: { enabled: true, display: "used", reset: "countdown" } },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const landscape = await openOverflowingUsagePage(port, browser, null, { width: 844, height: 390 }, payload);
    const compactMetrics = await landscape.locator('.usage-card.is-open[data-provider="codex"] .usage-pace-score').evaluate(node => {
      const card = node.closest(".usage-card");
      const gauge = node.closest(".usage-gauge-wrap");
      const style = getComputedStyle(node);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        cardWidth: card.getBoundingClientRect().width,
        gaugeWidth: gauge.getBoundingClientRect().width,
        overflow: document.querySelector(".usage-scroll").scrollHeight - document.querySelector(".usage-scroll").clientHeight,
      };
    });
    assert.ok(compactMetrics.fontSize <= 30, `percentual deve acompanhar o gauge no landscape curto: ${JSON.stringify(compactMetrics)}`);
    assert.ok(compactMetrics.fontSize <= compactMetrics.gaugeWidth * 0.31, `percentual não pode dominar o gauge: ${JSON.stringify(compactMetrics)}`);
    assert.ok(compactMetrics.overflow <= 1, `landscape curto não pode criar overflow: ${JSON.stringify(compactMetrics)}`);
    await landscape.close();

    const portrait = await openOverflowingUsagePage(port, browser, null, { width: 390, height: 844 }, payload);
    const portraitGutters = await portrait.evaluate(() => {
      const selectors = [".usage-head", ".usage-card.is-open", ".usage-provider-dots"];
      return selectors.map(selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { selector, left: rect.left, right: innerWidth - rect.right };
      });
    });
    assert.ok(portraitGutters.every(({ left, right }) => left >= 8 && right >= 8), `portrait deve usar gutter simétrico: ${JSON.stringify(portraitGutters)}`);
    await portrait.locator(".usage-provider-dot").nth(1).click();
    await portrait.waitForFunction(() => document.querySelector(".usage-trend-slide .usage-trend")?.getBoundingClientRect().width > 0);
    const trendGutters = await portrait.evaluate(() => {
      const selectors = [".usage-head", ".usage-trend", ".usage-trend-periods", ".usage-trend-plot"];
      return selectors.map(selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { selector, left: rect.left, right: innerWidth - rect.right };
      });
    });
    assert.ok(trendGutters.every(({ left, right }) => left >= 8 && right >= 8), `Tendência não deve sangrar até a borda: ${JSON.stringify(trendGutters)}`);
    assert.equal(Math.round(trendGutters[0].left), Math.round(trendGutters[1].left), `head e frame da Tendência precisam compartilhar o gutter: ${JSON.stringify(trendGutters)}`);
    assert.ok(trendGutters[2].left >= trendGutters[1].left, `seletor precisa respeitar o padding do frame: ${JSON.stringify(trendGutters)}`);
    assert.ok(trendGutters[3].left >= trendGutters[1].left, `gráfico precisa respeitar o padding do frame: ${JSON.stringify(trendGutters)}`);
    assert.equal(Math.round(trendGutters[2].left), Math.round(trendGutters[3].left), `seletor e gráfico precisam compartilhar o gutter interno: ${JSON.stringify(trendGutters)}`);
    await portrait.close();
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

test("Usage não rola verticalmente e permanece dentro da viewport", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const payload = threeProviderUsagePayload();
    for (const viewport of [{ width: 390, height: 480 }, { width: 390, height: 844 }, { width: 393, height: 852 }]) {
      const page = await openOverflowingUsagePage(port, browser, null, viewport, payload);
      const before = await page.evaluate(() => {
        const scroll = document.querySelector(".usage-scroll");
        const dots = document.querySelector(".usage-provider-dots");
        const track = document.querySelector(".usage-provider-track");
        const stack = document.querySelector(".usage-stack");
        const closed = [...document.querySelectorAll(".usage-card.is-closed")];
        return {
          clientHeight: scroll.clientHeight,
          scrollHeight: scroll.scrollHeight,
          scrollTop: scroll.scrollTop,
          overflowY: getComputedStyle(scroll).overflowY,
          pagerBottom: dots.getBoundingClientRect().bottom,
          viewportBottom: scroll.getBoundingClientRect().bottom,
          closedHeights: closed.map(card => card.getBoundingClientRect().height),
          trackFlex: getComputedStyle(track).flex,
          stackFlex: getComputedStyle(stack).flex,
          cardBottoms: [...document.querySelectorAll(".usage-card")].map(card => card.getBoundingClientRect().bottom),
          trackBottom: track.getBoundingClientRect().bottom,
        };
      });
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(220);
      const after = await page.evaluate(() => ({
        screen: document.body.classList.contains("is-usage") ? "usage" : "other",
        scrollTop: document.querySelector(".usage-scroll").scrollTop,
        scrollHeight: document.querySelector(".usage-scroll").scrollHeight,
        clientHeight: document.querySelector(".usage-scroll").clientHeight,
      }));
      assert.equal(before.overflowY, "hidden", `Usage não deve oferecer rolagem vertical: ${JSON.stringify(viewport)}`);
      assert.ok(before.scrollHeight <= before.clientHeight + 1, `todos os elementos devem caber na viewport: ${JSON.stringify({ viewport, before })}`);
      assert.ok(before.pagerBottom >= before.viewportBottom - 64, `o pager deve acompanhar o fim da viewport: ${JSON.stringify({ viewport, before })}`);
      assert.ok(before.pagerBottom >= before.viewportBottom - 12, `o pager visual deve ficar próximo do fim da viewport: ${JSON.stringify({ viewport, before })}`);
      assert.ok(before.closedHeights.every(height => height <= 56), `os cards fechados devem ser compactos: ${JSON.stringify({ viewport, before })}`);
      if (viewport.height > 520) {
        assert.equal(before.trackFlex, "0 0 auto", `o track portrait não deve herdar a altura da viewport: ${JSON.stringify({ viewport, before })}`);
        assert.equal(before.stackFlex, "0 0 auto", `a pilha portrait não deve esticar e esconder cards: ${JSON.stringify({ viewport, before })}`);
      }
      assert.ok(before.cardBottoms.every(bottom => bottom <= before.trackBottom + 1), `nenhum card pode ser cortado pelo track: ${JSON.stringify({ viewport, before })}`);
      assert.equal(after.screen, "usage", `scroll interno não deve navegar para outra tela: ${JSON.stringify(viewport)}`);
      assert.equal(after.scrollTop, 0, `a página não deve avançar verticalmente: ${JSON.stringify(viewport)}`);
      assert.ok(after.scrollHeight <= after.clientHeight + 1, `o conteúdo não deve criar overflow vertical: ${JSON.stringify({ viewport, after })}`);
      await page.close();
    }
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
    const hDotMetrics = await page.evaluate(() => Array.from(document.querySelectorAll(".usage-provider-dot")).map(dot => {
      const rect = dot.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(dot, "::before").transform);
      return { width: rect.width, height: rect.height, visualCenter: rect.left + rect.width / 2 + matrix.e };
    }));
    assert.deepEqual(hDotMetrics.map(dot => [dot.width, dot.height]), [[44, 44], [44, 44]], "h-dots devem manter a área de toque padronizada");
    assert.equal(Math.round(Math.abs(hDotMetrics[1].visualCenter - hDotMetrics[0].visualCenter)), 20, `h-dots visíveis devem seguir o espaçamento padrão: ${JSON.stringify(hDotMetrics)}`);
    assert.ok(await page.evaluate(() => document.querySelector(".usage-provider-track").scrollLeft > 0), "o track deve avançar para o segundo slide");
    assert.equal(await page.locator(".usage-provider-dot").nth(1).getAttribute("aria-current"), "true");
    assert.ok(await page.locator(".usage-trend-slide .usage-trend").isVisible(), "a tendência deve aparecer no segundo slide");
    await page.close();
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage mantém a tendência selecionada durante uma atualização do painel", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let activityState = "idle";
  try {
    const page = await openOverflowingUsagePage(port, browser, async page => {
      await page.route("**/api/usage/activity", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          source: "dokke",
          sourceState: "available",
          updatedAt: new Date().toISOString(),
          providers: { codex: { state: activityState, since: "2026-09-16T10:00:00.000Z", detail: activityState, sessions: activityState === "working" ? 1 : 0 } },
          errors: [],
        }),
      }));
    }, { width: 844, height: 390 }, trendUsagePayload());
    await page.locator(".usage-provider-dot").nth(1).click();
    await page.waitForFunction(() => {
      const track = document.querySelector(".usage-provider-track");
      return track && track.scrollLeft >= track.clientWidth - 1
        && document.querySelector(".usage-title")?.textContent === "Tendência de uso";
    });

    activityState = "working";
    await page.waitForSelector('.usage-mascot-wrap[data-activity="working"]', { state: "attached", timeout: 3000 });

    assert.equal(await page.locator(".usage-title").textContent(), "Tendência de uso", "a atualização não deve voltar o título para Uso");
    assert.equal(await page.locator(".usage-provider-dot").nth(1).getAttribute("aria-current"), "true", "a atualização não deve reativar o primeiro dot");
    assert.ok(await page.locator(".usage-provider-track").evaluate(track => track.scrollLeft >= track.clientWidth - 1), "a atualização deve preservar o segundo slide");
    await page.close();
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
      const visibleDot = document.querySelector("#vdots .d.on, #vdots .d");
      const visibleDotStyle = visibleDot ? getComputedStyle(visibleDot, "::before") : null;
      const visibleDotRect = visibleDot?.getBoundingClientRect();
      const visibleDotTransform = visibleDotStyle?.transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,([^,]+)/);
      const visibleDotShift = visibleDotTransform ? Number(visibleDotTransform[1]) : 0;
      const bodyFont = getComputedStyle(document.body).fontFamily;
      const textSelectors = [
        ".usage-five-copy .usage-limit-label",
        ".usage-five-copy .usage-limit-reset-value",
        ".usage-five-copy .usage-five-reset-exact, .usage-reset-date",
        ".usage-week-top b",
        ".usage-week-value .usage-limit-value",
        ".usage-week-reset",
      ];
      const textFontEntries = textSelectors.map(selector => {
        const element = document.querySelector(selector);
        return { selector, font: element ? getComputedStyle(element).fontFamily : null };
      });
      return {
        frameWidth: frame?.getBoundingClientRect().width || 0,
        frameLeft: frame?.getBoundingClientRect().left || 0,
        cardLeft: openCard?.getBoundingClientRect().left || 0,
        cardWidth: openCard?.getBoundingClientRect().width || 0,
        cardRight: openCard?.getBoundingClientRect().right || 0,
        dotsHidden: sideDots ? getComputedStyle(sideDots).display === "none" : false,
        visibleDotsLeft: (visibleDotRect?.left || 0) + ((visibleDotRect?.width || 0) - parseFloat(visibleDotStyle?.width || "0")) / 2 + visibleDotShift,
        frameBackground: getComputedStyle(frame).backgroundImage,
        frameBorder: getComputedStyle(frame).borderStyle,
        bodyFont,
        interLoaded: document.fonts.check("16px Inter"),
        textFonts: textFontEntries.map(entry => entry.font),
        missingTextFonts: textFontEntries.filter(entry => !entry.font).map(entry => entry.selector),
      };
    });
    assert.equal(metrics.frameWidth, 390, `o frame da Usage deve ocupar a largura útil do viewport: ${JSON.stringify(metrics)}`);
    assert.equal(Math.round(metrics.cardLeft - metrics.frameLeft), 8, `o card deve respeitar o gutter lateral do frame: ${JSON.stringify(metrics)}`);
    assert.equal(Math.round(metrics.cardWidth), 374, `o card deve ocupar a largura útil descontando os gutters: ${JSON.stringify(metrics)}`);
    assert.equal(metrics.dotsHidden, true, `o Usage deve usar somente o pager inferior: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.cardRight <= metrics.frameLeft + metrics.frameWidth + 1, `o card deve caber no frame sem os dots laterais: ${JSON.stringify(metrics)}`);
    assert.equal(metrics.frameBackground, "none", "a Usage não deve criar um cartão de fundo externo");
    assert.equal(metrics.frameBorder, "none", "a Usage não deve criar uma borda externa nova");
    assert.equal(metrics.interLoaded, true, "a fonte padrão do app deve estar disponível sem rede");
    assert.deepEqual(metrics.textFonts, metrics.textFonts.map(() => metrics.bodyFont), `os textos da Usage devem usar a fonte padrão do app: ${JSON.stringify(metrics)}`);
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
    const portraitStart = html.indexOf("@media (max-width: 699px){", html.indexOf(".usage-limits"));
    const portraitEnd = html.indexOf("}", portraitStart);
    const portraitCss = html.slice(portraitStart, portraitEnd > portraitStart ? portraitEnd + 1 : portraitStart + 500);

    assert.match(portraitCss, /\.usage-limits\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "os limites devem ocupar a largura inteira no celular");
    assert.match(html, /\.usage-card\.is-open\{[^}]*background:\s*linear-gradient\(145deg, rgba\(255,255,255,\.11\), rgba\(255,255,255,\.045\) 46%, rgba\(7,9,11,\.62\)\)/, "o provedor aberto deve usar a superfície liquid glass do esboço");
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

test("Safari portrait mantém proporção legível e alinha o gauge à esquerda", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await openOverflowingUsagePage(port, browser, null, { width: 393, height: 667 });
    const layout = await page.evaluate(() => {
      const card = document.querySelector(".usage-card.is-open");
      const metric = document.querySelector(".usage-metric-5h");
      const gauge = document.querySelector(".usage-gauge-wrap");
      return {
        browserMode: document.body.classList.contains("is-browser"),
        cardHeight: card.getBoundingClientRect().height,
        metricLeft: metric.getBoundingClientRect().left,
        gaugeLeft: gauge.getBoundingClientRect().left,
        gaugeHeight: gauge.getBoundingClientRect().height,
      };
    });
    assert.equal(layout.browserMode, true, `o teste deve reproduzir o Safari no navegador: ${JSON.stringify(layout)}`);
    assert.ok(layout.cardHeight >= 240, `o card não deve parecer achatado pela barra do Safari: ${JSON.stringify(layout)}`);
    assert.ok(layout.gaugeHeight >= 120, `o gauge deve manter uma altura legível: ${JSON.stringify(layout)}`);
    assert.ok(Math.abs(layout.gaugeLeft - layout.metricLeft) <= 1, `o gauge deve alinhar à esquerda da coluna: ${JSON.stringify(layout)}`);
  } finally {
    await browser.close();
    await close();
  }
});

test("Usage ancora o pager no fim da viewport visual quando a viewport estrutural é maior", async () => {
  const { port, close } = await startServer(0);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await openOverflowingUsagePage(
      port,
      browser,
      async currentPage => {
        await currentPage.addInitScript(() => {
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
      },
      { width: 393, height: 852 },
    );
    const layout = await page.evaluate(() => {
      const scroll = document.querySelector(".usage-scroll");
      const dots = document.querySelector(".usage-provider-dots");
      return {
        viewportHeight: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dokke-viewport-height")),
        scrollBottom: scroll.getBoundingClientRect().bottom,
        dotsBottom: dots.getBoundingClientRect().bottom,
        scrollHeight: scroll.scrollHeight,
        clientHeight: scroll.clientHeight,
      };
    });
    assert.equal(layout.viewportHeight, 808, `a viewport visual simulada deve ser aplicada: ${JSON.stringify(layout)}`);
    assert.ok(layout.scrollBottom <= 809, `o conteúdo não pode usar a altura estrutural antiga: ${JSON.stringify(layout)}`);
    assert.ok(layout.dotsBottom >= 796 && layout.dotsBottom <= 809, `os dots devem terminar na viewport visual: ${JSON.stringify(layout)}`);
    assert.ok(layout.scrollHeight <= layout.clientHeight + 1, `o Usage não pode criar overflow quando a barra do Safari muda a viewport: ${JSON.stringify(layout)}`);
  } finally {
    await browser.close();
    await close();
  }
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
    assert.match(js, /dokke-v31/, "service worker deve invalidar o cache antigo da UI");
    assert.match(js, /dokke-mascot-working-loop-strip\.webp\?v=20260909-11/, "sprites do mascote devem entrar no precache offline");
    assert.match(js, /dokke-mascot-idle-principal-strip\.webp\?v=20260909-11/, "o idle principal deve entrar no precache offline");
    assert.doesNotMatch(js, /dokke-mascot-idle-two-strip/, "o idleTwo removido não deve voltar ao precache");
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
