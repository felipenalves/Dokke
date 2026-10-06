# Dokke Usage Screen Archive Implementation Plan

> **For agentic workers:** Implementation is delegated to one worker for the connected removal across clients and server. The parent creates the archive branch first, then performs the independent final review.

**Goal:** Preserve the current Dokke with Usage on a local archive branch, then remove Usage from the active `develop` application.

**Architecture:** `archive/usage-screen` points to the current commit `da40485`. The active branch removes the feature end to end: PWA navigation and rendering, macOS views and state, server routes and configuration fields, provider collection, and feature-only assets/tests/docs. Shared app behavior remains.

**Tech Stack:** Node.js ESM, static PWA in `public/index.html`, Node HTTP/WebSocket server, SwiftUI macOS app, Node built-in test runner, Swift Package Manager.

**Spec:** `docs/superpowers/specs/2026-09-23-dokke-usage-screen-archive-design.md`

## Global Constraints

- Create the local `archive/usage-screen` branch at `da40485` before editing `develop`.
- Remove Usage from the active PWA/web experience and the macOS app.
- Remove only Usage-specific code; retain resources still used by other screens.
- Do not run a separate deletion or cleanup routine against user configuration files.
- Do not commit, push, open a PR, deploy, release, or update `main`.
- Work only in the nested Dokke repository; preserve all existing root-repository changes.

---

### Task 1: Preserve the complete Usage version

**Files:**
- No source files. Git ref only: `archive/usage-screen`.

**Interfaces:**
- Produces: local branch `archive/usage-screen` at `da40485ee2682a78aae6effa286e150f08c01bac`.

- [ ] Confirm nested repo is on `develop` and inspect its status before creating the ref.
- [ ] Confirm the archive branch name is unused, then create it without checking it out:

```sh
git branch archive/usage-screen da40485ee2682a78aae6effa286e150f08c01bac
```

- [ ] Verify the branch points at the exact source commit:

```sh
test "$(git rev-parse archive/usage-screen)" = "da40485ee2682a78aae6effa286e150f08c01bac"
```

### Task 2: Remove Usage from server and persisted app schema

**Files:**
- Modify: `config.js`
- Modify: `server.js`
- Modify: `test/config.test.mjs`
- Modify: `test/config-api.test.mjs`
- Modify: `test/status-ws.test.mjs`
- Delete after reference scan: `usage.js`, `usage/`, and tests exclusively for Usage data collection/API behavior
- Modify: `package.json` to remove the Usage-only mascot-hook installer script

**Interfaces:**
- Consumes: existing `normalizeConfig`, `makeApp`, and API test helpers.
- Produces: config/status responses with no Usage fields; no Usage endpoints or Usage source lifecycle.

- [ ] Update the config contract test to reject Usage defaults and legacy Usage fields in normalized output:

```js
test("normaliza a configuração sem incluir campos de Uso", () => {
  const config = normalizeConfig({ usage: { enabled: true }, usageProvider: "codex" });
  assert.equal(Object.hasOwn(config, "usage"), false);
  assert.equal(Object.hasOwn(config, "usageProvider"), false);
});
```

- [ ] Run the focused config test and confirm the new assertion fails against the current implementation:

```sh
node --test test/config.test.mjs
```

- [ ] Update `test/config-api.test.mjs` and `test/status-ws.test.mjs` so `GET /api/config`, `GET /api/apps`, `GET /api/status`, and WebSocket app status omit `usage` and `usageProvider`; assert `/api/usage` and `/api/usage/activity` return 404.
- [ ] Run the focused API and status-feed tests and confirm the removal assertions fail before implementation.
- [ ] Remove Usage defaults and normalizers from `config.js`; remove Usage imports, source construction/close lifecycle, payload fields, routes, event ingestion, and settings endpoints from `server.js`.
- [ ] Remove Usage-only source modules and tests only after `rg` confirms no remaining imports. Keep tests that cover non-Usage app APIs.
- [ ] Remove the Usage-only hook installer script from `package.json` and delete its source only if no remaining caller uses it.
- [ ] Run:

```sh
node --test test/config.test.mjs test/config-api.test.mjs test/status-ws.test.mjs
```

Expected: all remaining config/API tests pass and no Usage endpoints return a successful response.

### Task 3: Remove the Usage experience from the shared PWA

**Files:**
- Modify: `public/index.html`
- Modify: `public/sw.js`
- Modify: `test/ui.test.mjs`
- Add or update: `test/usage-removal.test.mjs`
- Delete after reference scan: Usage-only web tests, provider icons, mascot assets, and usage fixtures

**Interfaces:**
- Consumes: reduced app config and status payload from Task 2.
- Produces: existing app navigation without a Usage screen, polling, gestures, or settings.

- [ ] Add a regression test for the active PWA shell:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PWA não contém tela nem chamadas da área Uso", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /id=["']screenUsage["']/);
  assert.doesNotMatch(html, /is-usage|screenUsage/);
  assert.doesNotMatch(html, /\/api\/usage(?:\/|["'`])/);
});
```

- [ ] Run that focused test and confirm it fails against the current PWA.
- [ ] Remove Usage markup, styles, screen state, menu/gesture routing, API polling, activity synchronization, provider selection, and Usage-only localization from `public/index.html`.
- [ ] Remove Usage-only assets from the service-worker precache and bump its cache version using the existing versioning convention; retain any asset still referenced by another screen.
- [ ] Remove only Usage-specific tests from `test/ui.test.mjs` and Usage-only PWA test modules; preserve app, recents, website, and OBS coverage.
- [ ] Run:

```sh
node --test test/ui.test.mjs test/usage-removal.test.mjs
```

Expected: PWA removal assertions pass and the remaining screen navigation tests pass.

### Task 4: Remove Usage from the macOS app

**Files:**
- Modify: `mac/Sources/ContentView.swift`
- Modify: `mac/Sources/DockStore.swift`
- Modify: `mac/Sources/LanguageStore.swift`
- Modify: `test/native-usage-ui.test.mjs` or replace with a focused absence contract
- Delete after reference scan: `mac/Sources/UsageView.swift`, `UsageSettings.swift`, `UsageModels.swift`, and provider-only glyph/resources

**Interfaces:**
- Consumes: server payloads without Usage fields or endpoints.
- Produces: macOS sidebar and store without Usage navigation, preferences, polling, or models.

- [ ] Change the native UI contract to assert that `ContentView.swift` has no Usage sidebar item or view route, and that `DockStore.swift` has no `/api/usage` request or Usage state.
- [ ] Run the focused contract and confirm it fails against the current macOS sources.
- [ ] Remove the Usage destination from `SidebarItem`, remove Usage settings routing, then remove Usage-only store properties, API methods, polling, models, settings/view files, localization, and provider glyph code.
- [ ] Search all Swift sources/resources before deleting shared glyph or mascot files; keep anything used by slots, app picker, or connection UI.
- [ ] Run:

```sh
node --test test/native-usage-ui.test.mjs
cd mac && swift build
```

Expected: the native contract passes and the macOS target compiles.

### Task 5: Clean feature-only references and verify integration

**Files:**
- Modify as needed: `README.md`, `README.en.md`, changelog, website/docs content, release/package tests, fixtures, and service-worker asset list
- Delete only Usage-specific docs under `docs/plans/`, `docs/superpowers/`, and feature-only files identified by reference scan

**Interfaces:**
- Consumes: completed Node, PWA, and macOS removals.
- Produces: consistent product docs and a clean active build without Usage code paths.

- [ ] Search tracked active sources and user-facing docs for `screenUsage`, `/api/usage`, `usageProvider`, Usage-only setting keys, provider adapters, and Usage mascot hooks. Remove remaining active references while preserving historical context that the product docs do not expose as a current capability.
- [ ] Confirm every removed asset/module has no import, package resource, service-worker precache, or documentation link.
- [ ] Run the full Dokke test suite:

```sh
npm test
```

- [ ] Build macOS and run the parent repository check:

```sh
(cd mac && swift build)
npm --prefix ../.. run agent:check
```

- [ ] Run `git diff --check`; inspect the final nested-repo diff and confirm `git rev-parse archive/usage-screen` still resolves to the original `da40485` commit.
- [ ] Report any pre-existing root-repository changes separately; do not stage or commit anything.
