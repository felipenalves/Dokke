# Dokke Usage Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o app macOS editar as preferências do painel Usage e aplicar essas preferências no PWA/Android por meio da configuração persistente do Dokke.

**Architecture:** Adicionar um objeto `usage` normalizado ao contrato de configuração existente. O servidor será a fonte compartilhada; `DockStore` editará o objeto via `PUT /api/config/usage`, a tela nativa exibirá somente controles, e o PWA consumirá o objeto para controlar a terceira tela e a apresentação dos dados.

**Tech Stack:** Node.js HTTP server, configuração JSON v2, WebSocket de status existente, SwiftUI/AppKit no macOS, PWA HTML/CSS/JavaScript, Node test runner e Swift Package Manager.

**Spec:** `docs/superpowers/specs/2026-08-31-dokke-usage-settings-design.md`

## Global Constraints

- Manter `schemaVersion: 2` e preservar configurações antigas sem o campo `usage`.
- Defaults obrigatórios: `enabled: true`, `display: "used"`, `reset: "countdown"`.
- O item `Usage` do Mac abre configurações; não renderizar `UsageView` no detalhe nativo.
- A terceira tela PWA/Android é removida quando `usage.enabled` for `false`.
- A janela de 5 horas continua sendo o limite primário quando existir; semanal continua sendo fallback.
- Não editar `dist`, não fazer commit, push, PR ou deploy sem autorização explícita.
- Preservar as alterações não relacionadas já existentes no worktree.

---

### Task 1: Normalizar Usage no contrato do servidor

**Files:**
- Modify: `config.js` — defaults, normalização e persistência do campo `usage`.
- Modify: `server.js` — configuração pública e endpoint `PUT /api/config/usage`.
- Test: `test/config-api.test.mjs` — defaults, persistência, validação e idempotência.

**Interfaces:**
- Produces `normalizeUsageSettings(raw) -> { enabled: boolean, display: "used"|"remaining", reset: "countdown"|"exact" }`.
- Produces `normalizeConfig(raw).usage` com o objeto normalizado.
- Produces `PUT /api/config/usage` com body `{ usage: { enabled, display, reset } }`, resposta `{ ok: true, config, pushed: true }` e erro `400` para valores inválidos.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `test/config-api.test.mjs`:

```js
test("GET /api/config inclui Usage com defaults compatíveis", async () => {
  const s = await startTemp({ config: { pinned: [] } });
  try {
    const body = await (await fetch(`${base(s)}/api/config`)).json();
    assert.deepEqual(body.config.usage, { enabled: true, display: "used", reset: "countdown" });
  } finally { await s.close(); }
});

test("PUT /api/config/usage persiste preferências do PWA", async () => {
  const s = await startTemp();
  try {
    const r = await fetch(`${base(s)}/api/config/usage`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usage: { enabled: false, display: "remaining", reset: "exact" } }),
    });
    const body = await r.json();
    assert.equal(r.status, 200);
    assert.deepEqual(body.config.usage, { enabled: false, display: "remaining", reset: "exact" });
    assert.equal(body.pushed, true);
    assert.deepEqual((await (await fetch(`${base(s)}/api/config`)).json()).config.usage, body.config.usage);
  } finally { await s.close(); }
});

test("PUT /api/config/usage rejeita valores fora do contrato", async () => {
  const s = await startTemp();
  try {
    const r = await fetch(`${base(s)}/api/config/usage`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usage: { enabled: "no", display: "tokens", reset: "later" } }),
    });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).ok, false);
  } finally { await s.close(); }
});
```

- [ ] **Step 2: Rodar os testes para confirmar o RED**

Run: `node --test --test-name-pattern='Usage|usage' test/config-api.test.mjs`

Expected: FAIL porque a configuração pública ainda não contém `usage` e o endpoint ainda não existe.

- [ ] **Step 3: Implementar a normalização e o endpoint**

Em `config.js`, manter os defaults fora de `normalizeConfig` e normalizar assim:

```js
const DEFAULT_USAGE = { enabled: true, display: "used", reset: "countdown" };

export function normalizeUsageSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: source.enabled === undefined ? DEFAULT_USAGE.enabled : source.enabled === true,
    display: source.display === "remaining" ? "remaining" : DEFAULT_USAGE.display,
    reset: source.reset === "exact" ? "exact" : DEFAULT_USAGE.reset,
  };
}
```

`normalizeConfig` deve incluir `usage: normalizeUsageSettings(source.usage)` e `saveConfig` deve preservar esse campo junto com `pieces` e `pinned`. `publicCfg` deve devolvê-lo.

Em `server.js`, adicionar depois de `GET /api/config` um handler protegido para `PUT /api/config/usage`: validar que `body.usage` é objeto, rejeitar `enabled` não booleano e `display`/`reset` fora dos enums, serializar dentro de `withConfigLock`, incrementar `revision` somente quando o objeto mudar, persistir com `persistConfig`, responder com `publicCfg` e chamar `onStatusChange` quando mudar. Incluir `usage: cfg.usage` também no objeto de `GET /api/apps`.

- [ ] **Step 4: Rodar os testes para confirmar o GREEN**

Run: `node --test test/config-api.test.mjs`

Expected: PASS, incluindo os testes de configuração existentes.

### Task 2: Criar a tela nativa de configurações do Mac

**Files:**
- Create: `mac/Sources/UsageSettings.swift` — enums e modelo local das preferências.
- Modify: `mac/Sources/DockStore.swift` — estado carregado e método de persistência.
- Modify: `mac/Sources/ContentView.swift` — rota do item Usage para Settings e ícone/label apropriados.
- Modify: `mac/Sources/LanguageStore.swift` — textos PT-BR e inglês dos controles.
- Create: `test/mac-usage-settings.test.mjs` — contrato nativo da tela e store.

**Interfaces:**
- `DokkeUsageSettings` é `Equatable`, com `enabled`, `display` e `reset`.
- `DockStore.usageSettings` é `@Published private(set)` e começa nos defaults.
- `DockStore.updateUsageSettings(_ settings: DokkeUsageSettings) async` publica `PUT /api/config/usage` e só confirma o novo estado após resposta válida.
- `UsageSettingsView(store:)` é a tela nativa acessada pelo item Usage.

- [ ] **Step 1: Escrever os testes que falham**

Criar `test/mac-usage-settings.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = name => readFile(new URL(`../mac/Sources/${name}`, import.meta.url), "utf8");

test("sidebar abre configurações de Usage no Mac", async () => {
  const content = await source("ContentView.swift");
  assert.match(content, /case \.usage:/);
  assert.match(content, /UsageSettingsView\(store:\s*store\)/);
  assert.match(content, /gearshape/);
  assert.doesNotMatch(content, /case \.usage:\s*UsageView\(store:\s*store\)/);
});

test("modelo nativo mantém defaults e enums do Usage", async () => {
  const settings = await source("UsageSettings.swift");
  assert.match(settings, /struct DokkeUsageSettings:\s*Equatable/);
  assert.match(settings, /enabled:\s*Bool/);
  assert.match(settings, /case used/);
  assert.match(settings, /case remaining/);
  assert.match(settings, /case countdown/);
  assert.match(settings, /case exact/);
  assert.match(settings, /enabled:\s*true/);
  assert.match(settings, /display:\s*\.used/);
  assert.match(settings, /reset:\s*\.countdown/);
});

test("tela nativa mostra somente preferências que controlam PWA e Android", async () => {
  const settings = await source("UsageSettings.swift");
  const store = await source("DockStore.swift");
  assert.match(settings, /Toggle\(/);
  assert.match(settings, /Picker\(/);
  assert.match(settings, /Configurações de uso|usage\.settingsTitle/);
  assert.doesNotMatch(settings, /UsageProviderCard|UsageTrendChart|UsageLimitPanel/);
  assert.match(store, /updateUsageSettings\(_ settings: DokkeUsageSettings\) async/);
  assert.match(store, /\/api\/config\/usage/);
});
```

- [ ] **Step 2: Rodar os testes para confirmar o RED**

Run: `node --test test/mac-usage-settings.test.mjs`

Expected: FAIL porque o item ainda roteia para `UsageView` e os arquivos/modelos não existem.

- [ ] **Step 3: Implementar modelo, store e tela**

Criar `UsageSettings.swift` com `UsageDisplayMode`, `UsageResetMode` e `DokkeUsageSettings`, incluindo inicializador a partir de `[String: Any]` que aplique defaults para campos ausentes.

Em `DockStore`, adicionar `@Published private(set) var usageSettings = DokkeUsageSettings()`, aplicar `cfg["usage"]` dentro de `applyConfig`, e implementar `updateUsageSettings` com `URLRequest` `PUT`, `Content-Type: application/json`, body `{ "usage": settings.jsonObject }`. Em resposta 200, ler `config` e chamar `applyConfig`; em erro, manter o estado anterior e preencher `lastError` com a chave de rede.

Em `ContentView`, manter o identificador `.usage` para não quebrar navegação, trocar o ícone para `gearshape`, usar `sidebar.usageSettings` no label e trocar o detalhe para `UsageSettingsView(store: store)`.

Criar `UsageSettingsView` como `ScrollView` com título, descrição e três grupos nativos de preferências. Usar `Toggle` para `enabled` e `Picker(...).pickerStyle(.menu)` para `display` e `reset`. As alterações devem salvar automaticamente via `Task { await store.updateUsageSettings(...) }`; a tela não pode instanciar `UsageView` nem apresentar dados de consumo.

Adicionar as chaves equivalentes em português e inglês: `sidebar.usageSettings`, `usage.settingsTitle`, `usage.settingsDescription`, `usage.settingsDisplay`, `usage.settingsDisplayUsed`, `usage.settingsDisplayRemaining`, `usage.settingsReset`, `usage.settingsResetCountdown`, `usage.settingsResetExact`, `usage.settingsEnabled`, `usage.settingsEnabledDescription`, `usage.settingsAppliesTo`, `usage.settingsSaveError`.

- [ ] **Step 4: Rodar os testes e compilar o app**

Run: `node --test test/mac-usage-settings.test.mjs test/native-usage-ui.test.mjs` e `swift build --package-path mac`

Expected: PASS e build Swift concluído.

### Task 3: Fazer o PWA consumir as preferências

**Files:**
- Modify: `public/index.html` — estado, aplicação de configuração, navegação dinâmica e apresentação dos cards.
- Modify: `test/ui.test.mjs` — comportamento real da terceira tela e dos controles de exibição.
- Modify: `test/usage.test.mjs` — contrato estático das preferências e fallback.

**Interfaces:**
- `normalizeUsageSettings(raw)` retorna os três valores públicos normalizados.
- `applyUsageSettings(raw)` atualiza `state.usageSettings`, dots e navegação.
- `screenNames()` retorna `['apps', 'recents', 'usage']` quando habilitado e `['apps', 'recents']` quando desligado.
- `usagePercent(entry)` retorna consumo ou restante conforme `state.usageSettings.display`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar aos testes PWA:

```js
test("PWA declara o contrato de configuração do Usage", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /function normalizeUsageSettings\(raw\)/);
  assert.match(html, /function applyUsageSettings\(raw\)/);
  assert.match(html, /function screenNames\(\)/);
  assert.match(html, /display === "remaining"/);
  assert.match(html, /reset === "exact"/);
});
```

Adicionar um cenário de browser que responda a `/api/apps` com `config.usage.enabled = false`, navegue pela tela e confirme que `document.querySelectorAll("#vdots .d").length === 2` e que `document.body.classList` nunca mantém `is-usage`. Em outro cenário, fornecer `display: "remaining"` e `reset: "exact"`, abrir Usage e conferir que o texto do card mostra o percentual invertido e a data/hora, não o countdown.

- [ ] **Step 2: Rodar os testes para confirmar o RED**

Run: `node --test --test-name-pattern='configuração Usage|terceira tela|remaining|exact' test/usage.test.mjs test/ui.test.mjs`

Expected: FAIL porque o PWA usa uma lista fixa de três telas e ignora `config.usage`.

- [ ] **Step 3: Implementar consumo e navegação dinâmica**

Adicionar `usageSettings` ao objeto `state` com defaults. Implementar `normalizeUsageSettings` e `applyUsageSettings`; chamar `applyUsageSettings(config.usage)` em `applyAppsPayload` e nos caminhos que aplicam `config` recebido por status/WebSocket.

Trocar a constante fixa `SCREEN_NAMES` por `screenNames()`. Fazer `renderVDots` reconstruir a quantidade de dots conforme `screenNames()`, `syncVDots` consultar os nomes atuais, e `screenIndex`/`goScreen` recusarem Usage quando desabilitado. Se a configuração desabilitar Usage durante essa tela, chamar `goScreen("recents")` antes de sincronizar as camadas.

Alterar `usagePercent` para retornar `utilization` quando `display === "used"` e `1 - utilization` quando `display === "remaining"`, sempre limitado entre 0 e 1. Em `usageLimitNode`, usar a parte `date` de `usageResetParts` quando `reset === "exact"`; manter `countdown` no default. Não alterar `usagePrimary`, `usageFiveHour`, `usageWeekly` ou a lógica de status.

- [ ] **Step 4: Rodar testes PWA e checar sintaxe**

Run: `node --test --test-name-pattern='Usage|usage|remaining|exact|terceira tela' test/usage.test.mjs test/ui.test.mjs` e `awk '/<script>/{inside=1; next} /<\/script>/{sub(/<\/script>.*/, ""); print; inside=0} inside' public/index.html | node --check`

Expected: PASS, sem regressão no scroll interno, dots, swipe vertical e atualização da Usage.

### Task 4: Integração final e validação no debug live

**Files:**
- Verify: `config.js`, `server.js`, `mac/Sources/UsageSettings.swift`, `mac/Sources/DockStore.swift`, `mac/Sources/ContentView.swift`, `public/index.html`.
- Test: `test/config-api.test.mjs`, `test/mac-usage-settings.test.mjs`, `test/native-usage-ui.test.mjs`, `test/usage.test.mjs`, `test/ui.test.mjs`.

**Interfaces:** Usa o endpoint e o modelo das tarefas anteriores; não adiciona outro armazenamento ou outro servidor.

- [ ] **Step 1: Rodar a suíte focada completa**

Run: `node --test test/config-api.test.mjs test/mac-usage-settings.test.mjs test/native-usage-ui.test.mjs test/usage.test.mjs` e `node --test --test-name-pattern='Usage|usage' test/ui.test.mjs`

Expected: todos os testes selecionados passam; testes de browser usam `channel: "chrome"` quando necessário.

- [ ] **Step 2: Recompilar e reiniciar apenas o debug live**

Run: `swift build --package-path mac` e `bash mac/dev.sh`

Expected: processo SwiftUI e servidor Node do worktree `/private/tmp/dokke-usage-mac-v028` sobem sem usar `dist`.

- [ ] **Step 3: Validar no A02**

No A02, abrir a nova tela nativa de configurações no Mac, desligar Usage e confirmar dois dots no PWA; religar, escolher `Restante` e `Horário exato`, abrir a terceira tela e confirmar percentual/barras invertidos e reset exato. Restaurar `Usage ligado`, `Usado` e `Contagem regressiva` ao final do teste.

- [ ] **Step 4: Fazer checagens finais sem integração Git**

Run: `git diff --check`, `curl -fsS http://127.0.0.1:3000/health` e `git status --short --branch`

Expected: diff sem whitespace error, health `{"ok":true,"service":"Dokke"}`, worktree preservado e nenhum commit/push/deploy realizado.
