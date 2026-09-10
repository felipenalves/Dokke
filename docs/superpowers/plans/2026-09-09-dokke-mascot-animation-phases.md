# Dokke Mascot Animation Phases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mascot strips with the nine supplied 16-frame sheets and run working/thinking start-loop-end phases plus varied idle cycles in PWA, Android WebView, and native macOS.

**Architecture:** Treat every source PNG as a 4×4 frame sheet. Remove isolated alpha speckles, trim each cell to its visible artwork, and place every pose on a fixed square canvas with one visual height and baseline; preserve RGBA accessories and aspect ratio. The PWA keeps one persistent per-provider animation controller that owns phase transitions and rerenders the same sprite layer; SwiftUI uses the same phase track definitions and timeline clock for its native token.

**Tech Stack:** PNG/RGBA preprocessing with Pillow and WebP strips, vanilla JavaScript, CSS spritesheets, SwiftUI `TimelineView`, Node test runner, Playwright, Swift Package Manager, Android Gradle Plugin.

**Spec:** `docs/superpowers/specs/2026-09-09-dokke-mascot-animation-track-design.md`

## Global Constraints

- Preserve complete 4×4 cells, including laptop, cup, and thinking bubbles.
- Every generated frame is a 256×256 transparent canvas with a 234px visible-artwork height, baseline 246px, uniform scale, and no nonuniform stretch.
- `working` and `syncing` use working start/loop/end; backend `waiting` uses thinking start/loop/end.
- Idle keeps `idle-principal` as the dominant loop, with occasional `idle-one`
  and `idle-coffee`; `idle-two` remains parked for a future replacement.
- `prefers-reduced-motion` slows the sprite loop to 50% but never freezes it.
- Every 16-frame track uses a 180ms frame duration (2.88s per loop).
- Keep one mascot layer, atomic `translate3d` frame changes, and global `--usage-mascot-scale`.
- Do not commit or push without explicit user authorization.

---

### Task 1: Generate and register the new mascot strips

**Files:**
- Create: `public/mascot/dokke-mascot-working-start-strip.webp`
- Create: `public/mascot/dokke-mascot-working-loop-strip.webp`
- Create: `public/mascot/dokke-mascot-working-end-strip.webp`
- Create: `public/mascot/dokke-mascot-thinking-start-strip.webp`
- Create: `public/mascot/dokke-mascot-thinking-loop-strip.webp`
- Create: `public/mascot/dokke-mascot-thinking-end-strip.webp`
- Create: `public/mascot/dokke-mascot-idle-one-strip.webp`
- Create: `public/mascot/dokke-mascot-idle-two-strip.webp`
- Create: `public/mascot/dokke-mascot-idle-coffee-strip.webp`
- Create: `mac/Sources/Resources/mascot/<same nine files>`
- Modify: `public/mascot/manifest.json`
- Modify: `mac/Sources/Resources/mascot/manifest.json`

**Interfaces:**
- Consumes: `/Users/felipealves/Downloads/Dokke-animation/*.png`, each 1254×1254 RGBA.
- Produces: nine 16-frame WebP strips, each frame exactly 256×256, and manifests documenting source, grid, normalization, output, and frame count.

- [x] **Step 1: Verify the source grid and alpha contract**

Run:

```bash
file /Users/felipealves/Downloads/Dokke-animation/*.png
```

Expected: nine RGBA PNGs, all 1254×1254.

- [x] **Step 2: Normalize each 4×4 cell to a shared visual box**

`scripts/prepare-mascot-assets.py` uses cell edges `round(i * 1254 / 4)`, removes isolated alpha speckles only for the crop mask, preserves disconnected accessories such as thought/cup bubbles, and fits the visible artwork into a 256×256 transparent canvas using a shared 234px artwork height and baseline 246px.

- [x] **Step 3: Encode WebP strips and mirror them into the Swift bundle**

Concatenate the 16 normalized canvases horizontally, encode with alpha-preserving WebP, and copy the same output bytes into both resource directories.

- [x] **Step 4: Update both manifests**

Record this shape for each track and the shared visual box:

```json
{
  "frames": 16,
  "canvas": [256, 256],
  "sourceGrid": [4, 4],
  "normalization": "trimmed-artwork-fixed-height-baseline-preserving-aspect",
  "visualBox": { "visualHeight": 234, "baseline": 246 },
  "source": "<source filename>",
  "output": "<strip filename>"
}
```

- [x] **Step 5: Verify generated dimensions, alpha, and common baseline**

Run an image audit that opens every output strip and checks width `4096`, height `256`, alpha channel present, 16 frame slices, and a common alpha bottom at 246px. Expected: all nine outputs pass.

### Task 2: Add PWA phase tracks and transition controller

**Files:**
- Modify: `public/index.html:2830-3015`
- Modify: `public/index.html:3860-3940`
- Test: `test/ui.test.mjs`
- Test: `test/usage.test.mjs`

**Interfaces:**
- Consumes: activity states `working`, `syncing`, `waiting`, and `idle`; nine strip URLs and 16-frame manifests.
- Produces: `usageMascotAnimationFor(providerId, activity)`, phase-aware `usageMascotRun`, and a persistent controller in `state.usageMascotAnimations`.

- [x] **Step 1: Add failing transition tests**

Add Playwright tests that assert:

```js
assert.equal(await page.locator('[data-activity="working"] .usage-mascot-phase').getAttribute('data-phase'), 'start');
await page.waitForTimeout(2200);
assert.equal(await page.locator('[data-activity="working"] .usage-mascot-phase').getAttribute('data-phase'), 'loop');
```

Add equivalent tests for `waiting` with `thinking-start` to `thinking-loop`, and activity exit into the matching `*-end` phase. Add a reduced-motion test that observes two different frame indices.

- [x] **Step 2: Define explicit PWA phase tracks**

Use 16 frames per phase with explicit 180ms frame durations, finite `start`/`end` tracks, and looping `loop` tracks. Keep reduced-motion rate at `0.5` by scaling elapsed animation time and scheduled delays.

- [x] **Step 3: Implement persistent per-provider phase state**

Store the current visual activity, phase, destination activity, start time, and transition token per provider. On activity entry select `start`; on stable activity select `loop`; on exit select `end`; when `end` completes, advance to the latest destination. Ignore callbacks whose transition token is stale or whose sprite is disconnected.

- [x] **Step 4: Map backend waiting to thinking**

Change mascot selection so `working`/`syncing` select the working sequence, `waiting` selects the thinking sequence, and all other supported states select idle. Preserve current status text and accessibility labels.

- [x] **Step 5: Implement idle ambient selection**

Keep `idle-principal` as the dominant ambient cycle. Insert `idle-one` or
`idle-coffee` occasionally, then return to the principal cycle without changing
canvas size; do not register `idle-two` in the runtime until its replacement is
approved.

- [x] **Step 6: Verify the PWA tests turn green**

Run:

```bash
node --test --test-name-pattern='Usage .*mascote|Usage .*thinking|Usage .*idle' test/ui.test.mjs
node --test test/usage.test.mjs
```

Expected: all selected tests pass and no old procedural writing overlay or legacy mascot strip is referenced.

### Task 3: Mirror the phased tracks in native macOS SwiftUI

**Files:**
- Modify: `mac/Sources/UsageView.swift:804-1000`
- Test: `test/native-usage-ui.test.mjs`

**Interfaces:**
- Consumes: the nine bundled WebP strips and native activity strings.
- Produces: native phase-aware `TokenMascot`, `MascotAnimationTrack`, and `SpriteMascotFrame` rendering with one timeline.

- [x] **Step 1: Add failing native contract tests**

Assert that native source names all nine phase strips, maps `waiting` to thinking, and exposes explicit start/loop/end durations instead of only a single working strip.

- [x] **Step 2: Add native track definitions**

Load each strip through `MascotImageLoader`. Define `MascotAnimationTrack` with phase, frame count, frame duration, and loop flag. Use a 12fps `TimelineView` and `reduceMotion` rate `0.5` without pausing the sprite sequence.

- [x] **Step 3: Add native activity transitions**

Use `onChange(of: activity)` and a transition token to play outgoing end before the requested state start. Keep idle principal/one/coffee ambient selection deterministic for previews and tests; leave idle two parked.

- [x] **Step 4: Verify native contracts and compile**

Run:

```bash
node --test test/native-usage-ui.test.mjs
swift build
```

Expected: native tests and Swift build pass.

### Task 4: Cross-platform verification and handoff

**Files:**
- Verify: `public/mascot/manifest.json`
- Verify: `mac/Sources/Resources/mascot/manifest.json`
- Verify: `android/app/build/outputs/apk/debug/app-debug.apk`

- [x] **Step 1: Run the complete focused mascot suite**

Run:

```bash
node --test test/usage.test.mjs test/native-usage-ui.test.mjs
node --test --test-name-pattern='Usage .*mascote|Usage .*thinking|Usage .*idle' test/ui.test.mjs
```

- [x] **Step 2: Check server MIME, normalized assets, and current worktree**

Run `curl -I` for all nine WebPs and confirm `Content-Type: image/webp`; confirm the serving process cwd is `/private/tmp/dokke-token-mascot-current`.

- [x] **Step 3: Build the Android debug APK**

Run:

```bash
ANDROID_HOME=/Users/felipealves/Library/Android/sdk ANDROID_SDK_ROOT=/Users/felipealves/Library/Android/sdk ./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL` and a current `app-debug.apk`.

- [ ] **Step 4: Perform visual validation when A02 is available**

Install the current debug APK, open Usage, exercise idle → working → idle and idle → thinking → idle, and verify start, loop, end, no frame freeze, no size oscillation, and preserved thinking bubbles. If ADB is unavailable, report build-only validation and do not claim physical APK verification.
