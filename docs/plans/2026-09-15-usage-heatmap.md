# Usage Heatmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Usage trend bars with a responsive GitHub/Codex-style activity heatmap for up to 365 daily points, preserving Dokke's current color and interactions.

**Architecture:** Keep `usageTrendNode(provider)` as the single renderer. Normalize the provider's ordered daily points into complete weekly columns with seven fixed square cells per column, render only the latest columns that fit the available card width, and use a CSS custom property for opacity-based intensity. Preserve the existing pager and its slide snap correction.

**Tech Stack:** Vanilla JavaScript, CSS embedded in `public/index.html`, Node test runner, Playwright.

---

### Task 1: Add failing contracts for the heatmap

**Files:**
- Modify: `test/usage.test.mjs:308-335`
- Modify: `test/ui.test.mjs:573-640`

**Step 1: Write the failing static contract**

Add assertions that `usageTrendNode` creates `usage-trend-grid`, `usage-trend-cell`, `usage-trend-legend`, normalizes the series into complete weekly columns, fits visible columns to the card, and preserves the existing point label/value in an accessible cell description.

**Step 2: Write the failing responsive UI contract**

Extend the existing trend UI test to inspect the second slide at 390×844, 768×1024, 844×390, and 1280×800. Assert that:

- the grid has seven cells per visible week;
- the card remains inside the track width;
- the grid has no horizontal overflow;
- populated cells expose a date/value label;
- empty cells do not expose invented usage values;
- the heatmap still fills the available trend area.

**Step 3: Run the focused tests**

Run: `node --test --test-name-pattern='heatmap|tendência|trend' test/usage.test.mjs test/ui.test.mjs`

Expected: FAIL because the current renderer still creates `.usage-trend-bar` elements and has no heatmap grid.

### Task 2: Implement the normalized heatmap renderer

**Files:**
- Modify: `public/index.html:876-881`
- Modify: `public/index.html:4262-4304`

**Step 1: Replace the trend visual primitives**

Add styles for the grid, cells, weekday/month labels, legend and intensity levels. Use the current neutral graph color (`var(--ink)`) with opacity levels; keep empty cells dark and translucent. Use five explicit weekly columns and seven rows with small square cells, so the graph follows the GitHub/Codex density instead of stretching cells across the card.

**Step 2: Normalize points into weekly columns**

In `usageTrendNode(provider)`, keep the existing peak and max-value calculation, then pad the ordered point list to complete weekly columns. Measure the available card width and render only the latest columns that fit. For each visible position, create a cell with:

- `data-level` based on value/maxValue;
- `--trend-opacity` based on that level;
- `aria-label` and `title` only when a real point exists;
- an empty state when no point exists.

Do not invent dates or values for padded cells. Preserve the real point label and `valueLabel`.

**Step 3: Keep the trend summary readable**

Retain the title and peak in the compact header, add a weekday axis and a “Menos → Mais” legend, and keep the existing note below the grid when available.

**Step 4: Run the focused tests**

Run: `node --test --test-name-pattern='heatmap|tendência|trend' test/usage.test.mjs test/ui.test.mjs`

Expected: PASS, including the existing full-slide sizing and pager-isolation checks.

### Task 3: Refine responsive layout and verify regressions

**Files:**
- Modify: `public/index.html:1196-1250`
- Modify: `test/ui.test.mjs:517-640`

**Step 1: Tune the grid per viewport family**

Keep the second slide full-width/full-height. Allow the grid to grow vertically with the card, reduce auxiliary labels only at compact landscape heights, and prevent the grid from creating horizontal overflow. Respect `prefers-reduced-motion` by avoiding new cell animations.

**Step 2: Verify pager interaction**

Confirm that clicking the second dot shows only the heatmap, clicking the first dot shows only providers, and an interrupted horizontal drag is snapped to the nearest full slide.

**Step 3: Run the full validation**

Run: `npm test`

Expected: all tests pass with no failures.

**Step 4: Check the diff**

Run: `git diff --check`

Expected: no whitespace errors. Do not commit or push without explicit authorization.
