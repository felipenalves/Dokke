# Choclift Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completar a paridade da tela Apps do Dokke com a referência choclift, adicionando sidebar cinza e reorganização explícita sem alterar o carrossel já refinado.

**Architecture:** Manter `ContentView` como dono da navegação e `DockGridView` como dono do estado de paginação e edição. A sidebar será uma composição SwiftUI simples dentro do `NavigationSplitView`; o modo de edição será um estado local que controla os modificadores de drag/drop e o botão inferior.

**Tech Stack:** SwiftUI, Swift Package Manager, Node `node:test`.

---

### Task 1: Escrever os testes de paridade

**Files:**
- Modify: `test/mac-app-slides-ui.test.mjs`
- Verify: `mac/Sources/ContentView.swift`, `mac/Sources/DockGridView.swift`

**Step 1:** Assert that the sidebar uses explicit selection styling and that the dock exposes `isReordering`, `Reorder Pieces`, and `Done`.

**Step 2:** Run `node --test test/mac-app-slides-ui.test.mjs` and confirm the new assertions fail against the current source.

### Task 2: Implementar a sidebar visual

**Files:**
- Modify: `mac/Sources/ContentView.swift`

**Step 1:** Replace the default selected-row blue behavior with buttons bound to the existing `selection` state.

**Step 2:** Apply the gray rounded selection background, preserving labels, icons, accessibility labels, and split-view width.

**Step 3:** Run the focused test.

### Task 3: Implementar o modo Reorder Pieces

**Files:**
- Modify: `mac/Sources/DockGridView.swift`

**Step 1:** Add local reorder state and reset transient drag state when leaving the mode.

**Step 2:** Attach drag/drop only while reordering is active, preserving the current `DropDelegate` and persistence call.

**Step 3:** Add the bottom trailing button with `Reorder Pieces` and `Done` labels.

**Step 4:** Run the focused test and the Swift build.

### Task 4: Validar o bundle e a referência visual

**Files:**
- Verify: `mac/dist/Dokke.app`

**Step 1:** Run `npm test`.

**Step 2:** Run `swift build -c release --product Dokke`.

**Step 3:** Run `./install.sh --build-only` and validate both plists.

**Step 4:** Open the generated bundle, capture Apps, confirm the gray sidebar, centered carousel, peek and bottom-right reorder button.

Não fazer commit, push, publicação ou instalação automática.
