# Dokke Sidebar and Icon Hover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aproximar sidebar, cards e hover do Dokke macOS da referência Choclift aprovada.

**Architecture:** Manter o shell AppKit que desenha a moldura da sidebar e corrigir somente a composição SwiftUI. O cabeçalho será um overlay independente do layout principal; o carrossel mantém sua paginação e recebe geometria fixa; o hover continua local ao `DockIcon`.

**Tech Stack:** SwiftUI, AppKit, Swift 6, Node.js `node:test`.

---

### Task 1: Contratos visuais

**Files:**
- Modify: `test/mac-app-slides-ui.test.mjs`
- Modify: `test/mac-connection-ui.test.mjs`

**Step 1:** Adicionar assertions para cabeçalho sobreposto, página 458 × 288, padding 32/29, card 80 e hover com “Remove”.

**Step 2:** Rodar `node --test test/mac-app-slides-ui.test.mjs test/mac-connection-ui.test.mjs` e confirmar RED causado pelos valores ausentes.

### Task 2: Implementação mínima

**Files:**
- Modify: `mac/Sources/ContentView.swift`
- Modify: `mac/Sources/DockGridView.swift`
- Modify: `mac/Sources/DockIcon.swift`

**Step 1:** Mover o cabeçalho para overlay fixo, sem alterar a moldura AppKit.

**Step 2:** Aplicar altura 288 e padding 32/29 aos cards do carrossel.

**Step 3:** Aplicar overlay de hover clicável com blur, “−” e “Remove”.

**Step 4:** Repetir os testes direcionados até GREEN.

### Task 3: Validação renderizada

**Files:**
- Verify: `mac/dist/Dokke.app`

**Step 1:** Rodar `git diff --check` e `./mac/install.sh --build-only`.

**Step 2:** Fechar instâncias antigas, abrir exatamente `mac/dist/Dokke.app` e posicionar a janela em 980 × 628 pt.

**Step 3:** Capturar a janela e comparar sidebar, título, respiros, cards e fade com a referência.

**Step 4:** Não fazer commit ou push sem autorização explícita.
