# Apps Slides Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refinar a tela de slides de apps do Dokke para aproximá-la da referência enviada, sem alterar o comportamento de dados e drag-and-drop.

**Architecture:** Manter `DockGridView` como dono do estado visual da paginação. Reorganizar a composição em um carrossel horizontal de painéis fixos, com o próximo painel parcialmente visível e navegação declarativa via `scrollPosition`. Não criar view model novo.

**Tech Stack:** SwiftUI, Swift Package Manager, Node `node:test`.

---

### Task 1: Escrever o teste focado da tela de slides

**Files:**
- Create: `test/mac-app-slides-ui.test.mjs`
- Verify: `mac/Sources/DockGridView.swift`

**Step 1:** Assert that the source exposes the approved page structure, page counter, previous/next navigation, clickable indicators and initial page state.

**Step 2:** Run `node --test test/mac-app-slides-ui.test.mjs` and confirm RED against the current UI.

### Task 2: Reorganizar o layout do `DockGridView`

**Files:**
- Modify: `mac/Sources/DockGridView.swift`

**Step 1:** Keep the 8-item page partition and existing drag/drop actions.

**Step 2:** Remove the previous full-width nested stage, title, page counter and arrow controls.

**Step 3:** Add fixed-width warm dark panels in a horizontal carousel, keep the next panel partially visible, and make bottom indicators actionable.

### Task 3: Validate the Mac UI source and build

**Files:**
- Verify: `mac/Sources/DockGridView.swift`
- Verify: generated `mac/dist/Dokke.app`

**Step 1:** Run the focused test.

**Step 2:** Run `npm test`.

**Step 3:** Run `swift build -c release --product Dokke`.

**Step 4:** Run `./install.sh --build-only` and `plutil -lint` for the source and packaged plist.

Do not commit, push, publish or install the app automatically.
