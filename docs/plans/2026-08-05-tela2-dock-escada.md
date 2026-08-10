# Tela 2 "Dock em escada" — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir a fileira horizontal Time Travel da tela 2 por uma pilha vertical em cascata (deck de cartas) com fila circular infinita `[abertos] | [pinados]`, divisor estilo dock e swipe que roda a pilha.

**Architecture:** Tudo em `public/index.html` (CSS + JS inline, padrão do projeto). Render do deck: fila `q[]` montada com dedupe; todos os itens são filhos absolutos de `.deck` posicionados por slot `((i - deckCur) % len)`; drag = `translateY` no container; snap = `cur` novo + re-render (contínuo porque o conteúdo é periódico por módulo). Janela renderizada: slots -1..3 (o -1 fica clipado acima, viabiliza wrap bidirecional). Blur off durante o drag via `body.swiping` (fix de performance existente). Testes: `test/ui.test.mjs` (asserts de string, convenção do repo) + loop `measure/jank.mjs` + probe Playwright.

**Tech Stack:** HTML/CSS/JS vanilla em `public/index.html` (sem build), node:test, Playwright (devDep já instalada).

---

### Task 1: Atualizar os asserts da tela 2 no teste (vermelho primeiro)

**Files:**
- Modify: `test/ui.test.mjs:24-30`

**Step 1: Trocar os asserts do Time Travel pelos do deck**

```js
    assert.match(html, /function renderDeck/, "tela 2 com deck em escada (pilha vertical)");
    assert.doesNotMatch(html, /layoutTimeTravel|centerTimeTravel|bindTimeTravel|favscroll|favrow/, "Time Travel v01 removido (deck v03)");
    assert.match(html, /"Recentes"/, "tela 2 com título Recentes");
    assert.doesNotMatch(html, /tzone-pin|tdivider/, "tela 2 v03 sem split pinados/divisor antigo");
    assert.doesNotMatch(html, /Long press any app to pin/, "hint de long-press removido");
    assert.doesNotMatch(html, /📌/, "sem emoji de pin");
    assert.doesNotMatch(html, /thint/, "sem hint na tela 2");
    assert.match(html, /\.ddiv/, "divisor | estilo dock presente");
    assert.match(html, /\.dcard\.front/, "card da frente com classe front");
```

**Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — os novos asserts `function renderDeck`, `"Recentes"`, `.ddiv`, `.dcard.front` não existem ainda no HTML servido.

---

### Task 2: CSS da tela 2 — trocar `.favscroll`/`.favrow`/`.fav` pelo deck

**Files:**
- Modify: `public/index.html:255-322` (bloco `.favscroll` até `.fav .rdot`)

**Step 1: Substituir o bloco CSS do carrossel horizontal pelo do deck**

```css
  /* ---- tela 2 v03: deck em escada (pilha vertical, fila circular) ---- */
  .deck{
    flex: 1 1 auto; min-height: 0;
    position: relative;
    width: 100%;
    overflow: hidden;
    touch-action: none;
  }
  .dcard{
    position: absolute; left: 50%; top: 0;
    width: clamp(120px, 26vmin, 200px);
    height: clamp(120px, 26vmin, 200px);
    margin-left: calc(clamp(120px, 26vmin, 200px) / -2);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px;
    transform-origin: 50% 50%;
    will-change: transform, opacity;
  }
  .dcard .aglass{
    width: 86%; height: 86%;
  }
  .dcard .aglass .gicon, .dcard .aglass img.aicon{
    width: 80%; height: 80%; border-radius: 18%;
  }
  .dcard .aglass .gicon{ font-size: 34px; }
  .dcard .dname{
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,.85);
    text-align: center;
    max-width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    opacity: 0; transform: translateY(-4px);
    transition: opacity .15s ease, transform .15s ease;
  }
  .dcard.front .dname{ opacity: 1; transform: none; }
  .ddiv{
    position: absolute; left: 50%; top: 0;
    width: 2px; height: 42%;
    margin-left: -1px;
    border-radius: 1px;
    background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.55), rgba(255,255,255,0));
  }
  /* Durante o drag/snap o blur recomputaria por frame (custo de GPU forte em
     WebView fraca = travadinha). Volta no repouso. */
  body.swiping .dcard .aglass{
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
```

Notas: o card **não** tem `transition: transform` (a animação de snap é feita no container `.deck`; re-render posiciona por continuidade). O `.rstage` (linha ~246) continua. `.fav`/`.aglass` base: **manter** `.aglass` (tela 1 usa `.atile .aglass`; o deck reusa `.aglass`).

**Step 2: Rodar os testes e ver o resto do suite seguir verde**

Run: `npm test`
Expected: os asserts novos de Task 1 passam (CSS presente), os demais seguem passando.

---

### Task 3: JS — remover Time Travel e criar o deck (fila, render, posicionamento)

**Files:**
- Modify: `public/index.html:1083-1174` (remove `makeFavTile`, `layoutTimeTravel`, `centerTimeTravel`, `bindTimeTravel`)
- Modify: `public/index.html` (insere as funções do deck no lugar, antes de `renderRecents`)

**Step 1: Remover as 4 funções antigas (bloco 1083-1174)**

Apagar `makeFavTile`, `layoutTimeTravel`, `centerTimeTravel`, `bindTimeTravel` (e o `const open = ...`/glow interno delas).

**Step 2: Inserir o deck**

```js
  // ---------- tela 2 v03: deck em escada (pilha vertical, fila circular) ----------
  const DIV = { divider: true };
  const DECK_MIN_VIS = 0.36;      // degrau = 36% da altura do card
  let deckCur = 0;                // índice da fila no topo da escada
  let deckStep = 0;               // px por degrau (medido no layout)
  let deckPid = null, deckSy = 0, deckDy = 0, deckRaf = null;

  function deckQueue(){
    const q = [];
    const seen = {};
    state.running.forEach(function(a){
      if (a.type && a.type !== "Foreground") return;
      if (seen[a.name]) return;
      seen[a.name] = true;
      q.push(a.name);
    });
    const pins = (state.pinned || []).filter(function(n){ return !seen[n]; });
    if (pins.length){
      q.push(DIV);
      pins.forEach(function(n){ q.push(n); });
      q.push(DIV);
    }
    return q;
  }

  function makeDeckCard(name, isFront){
    const c = document.createElement("div");
    c.className = "dcard" + (isFront ? " front" : "");
    c.dataset.name = name;
    const glass = document.createElement("div");
    glass.className = "aglass";
    const img = document.createElement("img");
    img.className = "aicon";
    img.src = "/api/apps/" + encodeURIComponent(name) + "/icon";
    img.alt = "";
    img.loading = "lazy";
    img.onerror = function(){
      if (img.remove) img.remove();
      while (glass.firstChild) glass.removeChild(glass.firstChild);
      glass.appendChild(giconEl(name));
    };
    glass.appendChild(img);
    c.appendChild(glass);
    const nm = document.createElement("div");
    nm.className = "dname";
    nm.textContent = name;
    c.appendChild(nm);
    makeBtn(c, name, function(el){ activateApp(el.dataset.name); });
    bindHold(c, tileLong);
    return c;
  }

  function renderDeck(){
    const q = deckQueue();
    const stage = $("rstage");
    if (!stage) return;
    let deck = $("deck");
    if (deck){ deck.parentNode.removeChild(deck); deck = null; }
    if (!q.length) return;                       // renderRecents monta o rempty
    if (deckCur >= q.length) deckCur = 0;
    if (q[deckCur] && q[deckCur].divider) deckCur = 0;  // topo sempre num app quando existe
    deck = document.createElement("div");
    deck.className = "deck";
    deck.id = "deck";
    q.forEach(function(item, i){
      let slot = (((i - deckCur) % q.length) + q.length) % q.length;
      if (slot === q.length - 1) slot = -1;      // o card anterior fica clipado acima
      const el = item.divider
        ? (function(){ const d = document.createElement("div"); d.className = "ddiv"; d.dataset.slot = String(slot); return d; })()
        : (function(){ const c = makeDeckCard(item, slot === 0); c.dataset.slot = String(slot); return c; })();
      deck.appendChild(el);
    });
    stage.appendChild(deck);
    requestAnimationFrame(layoutDeck);
    positionDeck();
  }

  function layoutDeck(){
    const card = document.querySelector("#deck .dcard");
    deckStep = card ? Math.max(1, Math.round(card.offsetHeight * DECK_MIN_VIS)) : 0;
    positionDeck();
  }

  function positionDeck(){
    const deck = $("deck");
    const stage = $("rstage");
    if (!deck || !stage) return;
    const h = Math.max(stage.clientHeight, 1);
    const cardH = (deck.querySelector(".dcard") || { offsetHeight: 180 }).offsetHeight || 180;
    const frontY = Math.max(8, (h - cardH) / 2);
    deck.querySelectorAll(".dcard, .ddiv").forEach(function(el){
      const slot = parseInt(el.dataset.slot, 10);
      const scale = Math.max(0.45, 1 - slot * 0.22);
      el.style.transform = "translateY(" + (frontY + slot * deckStep) + "px) scale(" + scale.toFixed(2) + ")";
      el.style.opacity = String(Math.min(1, 0.32 + scale * 0.68).toFixed(2));
      el.style.zIndex = String(100 - slot);
    });
  }

  function deckSnap(){
    const len = deckQueue().length;
    if (deckDy){
      const step = deckStep || 1;
      const shift = Math.round(deckDy / step);   // dy>0 (down): volta; dy<0: avança
      deckCur = ((deckCur - shift) % len + len) % len;
    }
    deckDy = 0;
    renderDeck();
  }

  function deckDragTo(dy){
    deckDy = dy;
    if (!deckRaf) deckRaf = requestAnimationFrame(function(){
      deckRaf = null;
      const deck = $("deck");
      if (deck) deck.style.transform = "translateY(" + deckDy + "px)";
    });
  }

  function bindDeckGestures(){
    const deck = $("deck");
    if (!deck || deck.dataset.bound) return;
    deck.dataset.bound = "1";
    deck.addEventListener("pointerdown", function(e){
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();                       // swipe de tela não assume o gesto
      document.body.classList.add("swiping");
      deckPid = e.pointerId;
      deckSy = e.clientY;
      deckDy = 0;
      deck.style.transition = "none";
      try { deck.setPointerCapture(deckPid); } catch (err) {}
    });
    deck.addEventListener("pointermove", function(e){
      if (deckPid !== e.pointerId) return;
      e.preventDefault();
      deckDragTo(e.clientY - deckSy);
    }, { passive: false });
    function endDeck(e){
      if (deckPid !== e.pointerId) return;
      deckPid = null;
      suppressClickUntil = Date.now() + 320;
      const dy = deckDy;
      const deck = $("deck");
      if (deck){
        deck.style.transition = "transform .18s cubic-bezier(.22,.61,.36,1)";
        deck.style.transform = "translateY(0px)";
        const onEnd = function(){
          deck.removeEventListener("transitionend", onEnd);
          document.body.classList.remove("swiping");
          if (Math.abs(dy) >= Math.max(20, deckStep * 0.4)) deckSnap();
          else renderDeck();
        };
        deck.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 240);                  // fallback (garante limpeza)
      } else {
        document.body.classList.remove("swiping");
      }
    }
    deck.addEventListener("pointerup", endDeck);
    deck.addEventListener("pointercancel", endDeck);
  }
```

Nota (desvio do design doc, justificado): `deckCur` **não** reseta a 0 em rebuild (rebuilds acontecem a cada push de `/api/apps`; reset jogaria o usuário pro início a toda mudança de estado). Mantém posição enquanto o índice continuar válido.

**Step 3: Rodar e conferir que nada quebrou**

Run: `npm test`
Expected: PASS.

---

### Task 4: `renderRecents` v03 + limpeza do prep de settle + resize

**Files:**
- Modify: `public/index.html:1176-1252` (corpo de `renderRecents`)
- Modify: `public/index.html:1715-1720` (bloco de prep no `settleTo`)
- Modify: `public/index.html` (listener de resize existente)

**Step 1: Reescrever `renderRecents`**

```js
  function renderRecents(){
    const sc = document.createElement("div");
    sc.className = "recents";

    const head = document.createElement("div");
    head.className = "thead";
    const title = document.createElement("div");
    title.className = "ttitle";
    title.textContent = "Recentes";
    head.appendChild(title);
    sc.appendChild(head);

    const stage = document.createElement("div");
    stage.className = "rstage";
    sc.appendChild(stage);

    const q = deckQueue();
    if (q.length){
      renderDeck();
    } else {
      const e = document.createElement("div");
      e.className = "rempty";
      e.textContent = "Nada aberto ainda — abra um app no Mac para ele aparecer aqui";
      stage.appendChild(e);
    }

    const obsApp = state.running.find(function(a){ return a.name === "OBS" || a.name === "OBS Studio"; });
    if (obsApp){
      const card = document.createElement("div");
      card.className = "robscard";
      const ic = document.createElement("span");
      ic.className = "ic";
      ic.textContent = "◈";
      card.appendChild(ic);
      const mid = document.createElement("div");
      mid.style.cssText = "flex:1 1 auto;min-width:0";
      const ot = document.createElement("div");
      ot.className = "ot";
      ot.textContent = "OBS";
      mid.appendChild(ot);
      const os = document.createElement("div");
      os.className = "os";
      os.textContent = state.obs.recording ? "gravando" : state.obs.streaming ? "ao vivo" : (state.obs.connected ? "conectado" : "offline");
      mid.appendChild(os);
      card.appendChild(mid);
      const arr = document.createElement("span");
      arr.className = "arr";
      arr.textContent = "›";
      card.appendChild(arr);
      makeBtn(card, "OBS, " + os.textContent, openDrawer);
      sc.appendChild(card);
    }

    replaceChildren($("screenRecents"), [sc]);
    bindDeckGestures();
  }
```

Notas: título "Recentes"; `renderDeck` monta o `.deck` dentro do `rstage` (ou nada quando vazio → `rempty`); chip OBS inalterado; `bindDeckGestures` roda **depois** do `replaceChildren`.

**Step 2: Remover o prep de centragem do `settleTo`** (o deck não precisa de centragem pré-flip; ele preserva `deckCur`):

```js
      // Pré-posiciona o carrossel ANTES do flip: layout da tela 2 roda
      // escondido (sem paint), e a animação começa no frame seguinte.
      if (nextName === "recents"){
        const scroll = document.querySelector("#screenRecents .favscroll");
        const row = document.querySelector("#screenRecents .favrow");
        if (scroll && row) centerTimeTravel(scroll, row);
      }
```
→ apagar as 7 linhas (o `void screensEl.offsetHeight;` logo abaixo permanece).

**Step 3: Adicionar re-layout do deck no resize** (dentro do `window.addEventListener("resize", ...)` existente):

```js
    window.addEventListener("resize", function(){
      checkOrientation();
      reAnchor();
      if ($("deck")){ layoutDeck(); }
    });
```

**Step 4: Rodar tudo**

Run: `npm test`
Expected: PASS (98).

---

### Task 5: Verificação com o loop e probe Playwright

**Files:**
- Create: `measure/deck-probe.mjs` (probe descartável de comportamento do deck)

**Step 1: Escrever o probe**

```js
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
await p.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
await p.waitForSelector(".launchpad .atile");
await p.waitForFunction(() => document.querySelectorAll("#deck .dcard").length > 0, { timeout: 15000 });
const front = () => p.evaluate(() => {
  const f = document.querySelector("#deck .dcard.front");
  const d = document.querySelectorAll("#deck .dcard");
  return { front: f ? f.dataset.name : null, n: d.length, divs: document.querySelectorAll("#deck .ddiv").length };
});
console.log("antes:", JSON.stringify(await front()));
const box = await p.locator("#deck").boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await p.mouse.move(cx, cy);
await p.mouse.down();
for (let i = 1; i <= 5; i++) { await p.mouse.move(cx, cy - 30 * i, { steps: 2 }); await p.waitForTimeout(12); }
await p.mouse.up();
await p.waitForTimeout(500);
const a = await front();
console.log("apos swipe up (avanca):", JSON.stringify(a));
await p.mouse.move(cx, cy);
await p.mouse.down();
for (let i = 1; i <= 5; i++) { await p.mouse.move(cx, cy + 30 * i, { steps: 2 }); await p.waitForTimeout(12); }
await p.mouse.up();
await p.waitForTimeout(500);
console.log("apos swipe down (volta):", JSON.stringify(await front()));
console.log("swiping solto:", await p.evaluate(() => document.body.classList.contains("swiping")));
await b.close();
```

**Step 2: Rodar com o server real e conferir**

Run: `node measure/deck-probe.mjs`
Expected: `antes.front` = primeiro app aberto; após swipe up o front mudou (avançou); após swipe down voltou (ou avançou de volta); `divs` ≥ 1 (divisor presente quando há pinados); `swiping solto: false`.

**Step 3: Loop de jank (regressão de performance)**

Run: `node measure/jank.mjs 2>&1 | tail -7`
Expected: `dropped: 0`, `maxGap` ≤ ~35 em todas as runs (a troca de tela continua lisa; o deck usa os mesmos padrões de transform).

**Step 4: Verificar wrap com poucos apps** (opcional, se houver ≤ 4 abertos+pinados: esperar teleporte invisível; comportamento documentado).

---

### Task 6: Smoke manual + fechamento

**Step 1: Curl no HTML servido**

Run: `curl -s localhost:3000/ | rg -c "renderDeck|dcard.front|Recentes"` 
Expected: ≥ 1 (as 3 strings presentes).

**Step 2: Atualizar o design doc com o desvio de `deckCur`** (não reseta em rebuild)

Editar `docs/plans/2026-08-05-tela2-dock-escada-design.md`: na seção Arquitetura, trocar
"reset de `cur` para 0" por "preserva `cur` em rebuilds (só valida o índice)".

**Step 3: Commit (perguntar ao usuário antes)**

Run: `git add public/index.html test/ui.test.mjs docs/plans/ && git commit -m "feat: tela 2 v03 — dock em escada (pilha vertical, fila circular, divisor |)"`
