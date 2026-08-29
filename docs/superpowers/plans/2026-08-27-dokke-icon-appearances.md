# Dokke Icon Appearances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the Icon Composer source for the native macOS app and add appearance-aware browser favicon delivery while preserving legacy and iOS PWA fallbacks.

**Architecture:** `Dokke.icon` remains the native source. The Mac packer compiles it with `actool` when a full Xcode toolchain is available, writes `Assets.car`, and always stages a legacy `Dokke.icns`. The PWA uses static default assets for installation and media-qualified default/dark favicon links for browser chrome.

**Tech Stack:** Bash packaging, SwiftPM macOS app, Apple Icon Composer/`actool`, PNG assets, HTML manifest, Service Worker, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-27-dokke-icon-appearances-design.md`

## Global Constraints

- Preserve all unrelated working-tree changes.
- Do not copy the raw `Dokke.icon` directory into the finished app bundle.
- Keep `Dokke.icns` as the legacy fallback and keep the existing default asset synchronization contract.
- The PWA Home Screen icon remains static default; only browser favicon selection follows the light/dark media preference.
- If `actool` is unavailable, build with the legacy fallback and emit an explicit warning.
- Do not commit or push without explicit authorization.

---

### Task 1: Lock the icon source and packaging contract with tests

**Files:**
- Modify: `test/brand-icon-assets.test.mjs`
- Create: `test/mac-icon-appearance.test.mjs`
- Modify: `test/package-dmg.test.mjs`

**Interfaces:**
- Consumes: `assets/branding/dokke-icon/Dokke.icon`, `mac/install.sh`, and `mac/Info.plist`.
- Produces: static assertions for the Icon Composer source, plist keys, `actool` invocation, fallback naming, and raw-source exclusion.

- [ ] **Step 1: Write the failing source and packaging assertions**

  Add assertions that:

  ```js
  const iconDocument = path.join(root, "assets", "branding", "dokke-icon", "Dokke.icon");
  assert.ok(existsSync(path.join(iconDocument, "icon.json")));
  assert.ok(existsSync(path.join(iconDocument, "Assets")));
  assert.match(readFileSync(path.join(iconDocument, "icon.json"), "utf8"), /supported-platforms/);
  assert.match(readFileSync(path.join(root, "mac", "Info.plist"), "utf8"), /CFBundleIconName/);
  assert.match(readFileSync(path.join(root, "mac", "Info.plist"), "utf8"), /<string>Dokke<\/string>/);
  assert.match(readFileSync(path.join(root, "mac", "install.sh"), "utf8"), /actool/);
  assert.match(readFileSync(path.join(root, "mac", "install.sh"), "utf8"), /Dokke\.icon/);
  assert.match(readFileSync(path.join(root, "mac", "install.sh"), "utf8"), /Assets\.car/);
  assert.match(readFileSync(path.join(root, "mac", "install.sh"), "utf8"), /Dokke\.icns/);
  assert.match(readFileSync(path.join(root, "mac", "install.sh"), "utf8"), /raw.*icon|\.icon.*not.*bundle/i);
  ```

  Add the public UI assertions:

  ```js
  assert.match(html, /rel="icon"[^>]+media="\(prefers-color-scheme: light\)"/);
  assert.match(html, /rel="icon"[^>]+media="\(prefers-color-scheme: dark\)"/);
  assert.match(sw, /icon-192-dark\.png/);
  ```

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run:

  ```bash
  node --test test/mac-icon-appearance.test.mjs test/brand-icon-assets.test.mjs test/ui.test.mjs test/package-dmg.test.mjs
  ```

  Expected: failure because the plist, packer, dark web asset, and favicon declarations are not implemented yet.

### Task 2: Compile the appearance-aware native Mac icon

**Files:**
- Modify: `mac/Info.plist`
- Modify: `mac/install.sh`

**Interfaces:**
- Consumes: `assets/branding/dokke-icon/Dokke.icon` and existing `mac/AppIcon.icns`.
- Produces: `Contents/Resources/Assets.car`, `Contents/Resources/Dokke.icns`, and plist metadata that selects `Dokke` on supported macOS versions.

- [ ] **Step 1: Add native icon metadata**

  Keep the existing legacy key but point it to `Dokke.icns`, then add:

  ```xml
  <key>CFBundleIconFile</key>
  <string>Dokke.icns</string>
  <key>CFBundleIconName</key>
  <string>Dokke</string>
  ```

- [ ] **Step 2: Add tool discovery and fallback staging**

  In `mac/install.sh`, resolve `actool` first through `xcrun --find actool` and then through `/Applications/Xcode.app/Contents/Developer/usr/bin/actool`. Before attempting compilation, always copy the existing `AppIcon.icns` to `Contents/Resources/Dokke.icns` so older systems have a valid icon.

- [ ] **Step 3: Compile `Dokke.icon` when the tool exists**

  Run the compiler against the source document and the bundle resources:

  ```bash
  actool assets/branding/dokke-icon/Dokke.icon \
    --compile "$APP_BUNDLE/Contents/Resources" \
    --app-icon Dokke \
    --enable-on-demand-resources NO \
    --development-region pt-BR \
    --target-device mac \
    --platform macosx \
    --minimum-deployment-target 14.0 \
    --enable-icon-stack-fallback-generation=disabled \
    --include-all-app-icons \
    --errors --warnings \
    --output-partial-info-plist /dev/null
  ```

  Do not copy `Dokke.icon` into `Contents/Resources`; `Assets.car` is the compiled resource consumed by the bundle.

- [ ] **Step 4: Keep builds usable without Xcode**

  If no `actool` is found, print:

  ```text
  warn: actool ausente — usando Dokke.icns; o ícone adaptativo exige Xcode 26.
  ```

  Continue the build with `Dokke.icns` rather than silently claiming that the adaptive icon was packaged.

- [ ] **Step 5: Run the native packaging tests**

  Run:

  ```bash
  node --test test/mac-icon-appearance.test.mjs test/brand-icon-assets.test.mjs
  ```

  Expected: PASS for source, plist, fallback, and compiler contract.

### Task 3: Add light/dark browser favicon delivery

**Files:**
- Create: `public/icon-192-dark.png`
- Modify: `public/index.html`
- Modify: `public/sw.js`
- Modify: `test/ui.test.mjs`

**Interfaces:**
- Consumes: `assets/branding/dokke-icon/Icon-dokke-iOS-Dark-1024@1x.png` and existing default PWA icon.
- Produces: browser favicon selection based on `prefers-color-scheme` and cache coverage for the new asset.

- [ ] **Step 1: Add the dark web icon from the versioned export**

  Resize the existing 1024px Dark export to 192px using the macOS image tool:

  ```bash
  sips -Z 192 \
    assets/branding/dokke-icon/Icon-dokke-iOS-Dark-1024@1x.png \
    --out public/icon-192-dark.png
  ```

- [ ] **Step 2: Add media-qualified favicon links**

  Keep the default favicon as the fallback and add these links in `public/index.html`:

  ```html
  <link rel="icon" type="image/png" href="/icon-192.png" media="(prefers-color-scheme: light)">
  <link rel="icon" type="image/png" href="/icon-192-dark.png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/icon-192.png">
  ```

- [ ] **Step 3: Version the Service Worker cache**

  Increment the `CACHE` identifier and add `/icon-192-dark.png` to `PRECACHE` so an installed PWA does not continue serving a missing or old favicon.

- [ ] **Step 4: Run PWA tests**

  Run:

  ```bash
  node --test test/ui.test.mjs test/website-pieces-ui.test.mjs
  ```

  Expected: PASS with both favicon links and the cache entry present.

### Task 4: Build and verify the final bundle contract

**Files:**
- Modify: none beyond Tasks 1–3.

**Interfaces:**
- Consumes: all changes from the prior tasks.
- Produces: a verified `mac/dist/Dokke.app` when the local toolchain permits compilation, or a verified fallback-only bundle with an explicit warning.

- [ ] **Step 1: Run focused tests**

  ```bash
  node --test test/mac-icon-appearance.test.mjs test/brand-icon-assets.test.mjs test/ui.test.mjs test/package-dmg.test.mjs
  ```

- [ ] **Step 2: Build the Mac app**

  ```bash
  bash mac/install.sh --build-only
  ```

- [ ] **Step 3: Inspect the generated bundle**

  ```bash
  find mac/dist/Dokke.app/Contents/Resources -maxdepth 1 -name 'Assets.car' -o -name 'Dokke.icns'
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIconName' mac/dist/Dokke.app/Contents/Info.plist
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' mac/dist/Dokke.app/Contents/Info.plist
  test ! -e mac/dist/Dokke.app/Contents/Resources/Dokke.icon
  ```

- [ ] **Step 4: Run the complete verification set**

  ```bash
  npm test
  git diff --check
  ```

  Record any existing `package-dmg` failure caused by the known `macos-alias` Node ABI mismatch separately from this icon work.
