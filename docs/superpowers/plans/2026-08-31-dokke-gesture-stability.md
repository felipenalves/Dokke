# Dokke Gesture Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rapid screen and Launchpad swipes reliable and keep the Usage screen scrollable and position-stable on the Android WebView.

**Architecture:** Keep the existing pointer-event pager. Track the destination of an active vertical or horizontal snap so an interrupted gesture is rebased from the destination already chosen. Give Usage a native vertical-scroll path and only promote an edge gesture to the screen pager; preserve the old scroll offset when Usage re-renders.

**Tech Stack:** Vanilla JavaScript, CSS touch-action/overflow, Playwright, Node test runner, Android ADB.

**Spec:** `docs/superpowers/specs/2026-08-31-dokke-gesture-stability.md`

## Global Constraints

- Keep the implementation in the existing PWA pager and Usage renderer; do not add a gesture library.
- Do not change the OpenUsage data contract.
- Do not modify the macOS native Usage screen for a PWA-only scroll problem.
- Validate with automated browser tests and a real A02 touch pass.

---

### Task 1: Regression tests for rapid navigation

**Files:**
- Modify: `test/ui.test.mjs`
- Test: `test/ui.test.mjs`

**Interfaces:**
- Consumes: existing `startServer`, Playwright browser setup, and the PWA pointer-event surface.
- Produces: failing tests for post-settle vertical swipes and interrupted horizontal snaps.

- [ ] **Step 1: Write the failing tests**

Add browser tests that dispatch a second vertical swipe from a `MutationObserver` immediately after `is-recents` is committed, and dispatch two horizontal swipes with a 0 ms interval from `#launchpad`. Assert `usage` and Launchpad page index `2` respectively.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-name-pattern='cooldown|horizontal' test/ui.test.mjs`

Expected: the vertical test remains on `recents`, and the horizontal test stops at page index `1`.

### Task 2: Regression tests for Usage scrolling

**Files:**
- Modify: `test/ui.test.mjs`
- Test: `test/ui.test.mjs`

**Interfaces:**
- Consumes: `/api/usage` route mocking and the existing Usage renderer.
- Produces: failing tests for native scrolling and refresh scroll preservation.

- [ ] **Step 1: Write the failing tests**

Mock an available Codex/Claude Usage response, navigate to Usage, append controlled overflow, then assert a wheel scroll changes `scrollTop` without changing `is-usage`. Set `scrollTop` to `300`, click refresh, and assert the new `.usage-scroll` retains `300`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-name-pattern='Usage.*scroll|Usage.*refresh' test/ui.test.mjs`

Expected: the wheel leaves `scrollTop` at `0`, and refresh resets `scrollTop` to `0`.

### Task 3: Implement deterministic pager state

**Files:**
- Modify: `public/index.html:3224-3577`

**Interfaces:**
- Consumes: `settleTarget`, `settleTo`, `finishSettle`, `hCommit`, and the pointer handlers.
- Produces: immediate vertical swipe acceptance, interrupted horizontal snap rebasing, and no cooldown that rejects a valid next gesture.

- [ ] **Step 1: Track horizontal snap destination**

Store the target page when `animateHorizontalSnap` starts. When `stopHorizontalSnap` cancels an active snap, place `#launchpad` on that target page before reading `currentPage()` for the new pointerdown.

- [ ] **Step 2: Remove the valid-gesture cooldown gate**

Stop rejecting pointer moves and commits solely because the previous transition finished less than 80 ms ago. Existing `settling` and active-snap state remain the concurrency guards.

- [ ] **Step 3: Run navigation tests**

Run: `node --test --test-name-pattern='swipes verticais|cooldown|horizontal|gesto vertical' test/ui.test.mjs`

Expected: all selected navigation tests pass.

### Task 4: Implement Usage native scroll and scroll preservation

**Files:**
- Modify: `public/index.html:83-167,2410-2563,3393-3542`

**Interfaces:**
- Consumes: `.usage-scroll`, the three-screen pointer pager, `renderUsage`, and `loadUsage`.
- Produces: native Usage scrolling, edge handoff to the screen pager, and stable scroll position across refresh.

- [ ] **Step 1: Enable Usage vertical scrolling**

Set `body.is-usage .screens` and `.usage-scroll` to `touch-action: pan-y`. Track a Usage scroll gesture without pointer capture; allow the browser to scroll while the content can consume the direction, and promote only edge gestures to the existing pager.

- [ ] **Step 2: Preserve the old scroll offset**

Read the old `.usage-scroll.scrollTop` before replacing the Usage root and restore it after mounting the new scroll container.

- [ ] **Step 3: Run Usage tests**

Run: `node --test --test-name-pattern='Usage.*scroll|Usage.*refresh' test/ui.test.mjs test/usage.test.mjs`

Expected: scroll changes within Usage, edge navigation remains available, and refresh preserves the offset.

### Task 5: Full verification and A02 pass

**Files:**
- Read-only verification of: `public/index.html`, `test/ui.test.mjs`, `test/usage.test.mjs`, `test/native-usage-ui.test.mjs`

**Interfaces:**
- Consumes: completed PWA implementation and test contracts.
- Produces: reproducible evidence for browser, syntax, build, and A02 touch validation.

- [ ] **Step 1: Run focused and related tests**

Run: `node --test test/ui.test.mjs test/usage.test.mjs test/native-usage-ui.test.mjs`.

- [ ] **Step 2: Run static checks**

Run: `git diff --check` and extract the inline script from `public/index.html` through line `</script>` for `node --input-type=module --check`.

- [ ] **Step 3: Validate the A02**

Reload the source-served Dokke on the connected `SM-A022M`, perform rapid vertical and horizontal gestures, and confirm the Usage content can scroll when overflow is present. Do not reset `gfxinfo`.
