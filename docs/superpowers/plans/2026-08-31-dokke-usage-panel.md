# Dokke Usage Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remodelar o Painel de Uso do DOKKE para a referência aprovada, com identidade de Claude/Codex, estado online honesto e métricas de 5 horas/semana em destaque no PWA e no app macOS.

**Architecture:** Manter o contrato OpenUsage existente e alterar apenas a apresentação. O renderizador web e `UsageView` nativo compartilharão a mesma hierarquia: título da página, cabeçalho do provedor, estado de atualização e dois limites de destaque. A fonte técnica continuará interna e estados desconhecidos não serão convertidos em `0%`.

**Tech Stack:** Vanilla JavaScript/CSS, SVG/asset local para marcas, SwiftUI, Node test runner, Playwright e `swift build`/testes nativos existentes.

**Spec:** `docs/superpowers/specs/2026-08-31-dokke-usage-panel-design.md`

---

### Task 1: Especificar os contratos visuais e de estado

**Files:**
- Modify: `test/ui.test.mjs`
- Modify: `test/native-usage-ui.test.mjs`

**Steps:**

1. Adicionar testes que exijam o texto `Painel de Uso`, a remoção de `Dados locais`/`Fonte: OpenUsage` da área principal e a presença do indicador de atualização.
2. Adicionar teste que exija marcas distintas para Claude e Codex e uma referência explícita ao asset/identidade OpenAI para Codex.
3. Adicionar teste que cubra `available/recent`, `stale` e `unavailable`: pulso verde somente no primeiro caso e texto offline nos demais.
4. Rodar os testes para observar as falhas esperadas antes de editar a UI.

### Task 2: Implementar a apresentação do PWA

**Files:**
- Modify: `public/index.html`

**Steps:**

1. Atualizar os textos de localização para `Painel de Uso` e estados de sincronização.
2. Trocar o hero atual por cabeçalho compacto e cards de 5 horas/semana alinhados à referência.
3. Manter o título de página como categoria e preservar o botão de atualizar.
4. Adicionar estado visual online/offline com animação curta e respeito a `prefers-reduced-motion`.
5. Usar logo local/embutida para Claude e Codex; não depender de rede para renderizar a marca.
6. Esconder fonte técnica e dados locais da hierarquia principal, mantendo detalhes somente quando necessários para diagnóstico.
7. Garantir `--` para métricas sem dado e preservar a posição de scroll após atualizar.
8. Rodar os testes web focados e corrigir apenas os contratos quebrados.

### Task 3: Alinhar a tela Usage nativa do macOS

**Files:**
- Modify: `mac/Sources/UsageView.swift`
- Modify: `mac/Sources/UsageModels.swift` only if the estado derivado precisar de uma regra compartilhada
- Modify: `mac/Sources/LanguageStore.swift` only for new localized strings

**Steps:**

1. Atualizar o cabeçalho para `Painel de Uso`, status de sincronização e botão refresh.
2. Substituir ícones genéricos por marcas locais de Claude e OpenAI/Codex.
3. Reorganizar os limites destacados para 5 horas como principal e semana como secundário.
4. Aplicar as cores e o pulso apenas ao estado disponível/recente.
5. Remover a exibição principal de `Dados locais` e `Fonte: OpenUsage`.
6. Rodar os testes nativos e a compilação do target macOS.

### Task 4: Verificação final

**Files:**
- Read-only verification of the modified web/native files and test files

**Steps:**

1. Rodar `node --test test/ui.test.mjs test/usage.test.mjs test/native-usage-ui.test.mjs test/mac-dev.test.mjs`.
2. Rodar `git diff --check` e a checagem de sintaxe do JavaScript inline.
3. Compilar o target macOS pelo fluxo já existente do worktree.
4. Fazer inspeção visual no PWA e no app macOS, incluindo estado normal, stale/offline e Codex.
5. Não fazer commit, push, deploy ou alteração de produção sem pedido explícito.
