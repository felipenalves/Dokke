# Local Network Permission Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the packaged Dokke Mac app explain and trigger macOS Local Network permission on first network access.

**Architecture:** Keep the existing Node child process and UDP discovery flow. Add the privacy usage description to the Mac bundle's `Info.plist`; macOS attributes local-network operations performed by an app's helper process to the containing app. Add a source-level regression test so future bundles cannot omit the description.

**Tech Stack:** Swift Package Manager, macOS app bundle, XML `Info.plist`, Node `node:test`.

---

### Task 1: Add the regression test

**Files:**
- Create: `test/mac-local-network.test.mjs`
- Test: `mac/Info.plist`

**Step 1: Write the failing test**

Read `mac/Info.plist` as text and assert that it contains the `NSLocalNetworkUsageDescription` key and a non-empty Portuguese explanation mentioning the local network and device connection.

**Step 2: Run the test to verify it fails**

Run from `projetos/j5-dock`:

```sh
node --test test/mac-local-network.test.mjs
```

Expected: FAIL because the current plist has no `NSLocalNetworkUsageDescription` entry.

### Task 2: Add the permission description to the Mac bundle

**Files:**
- Modify: `mac/Info.plist`

**Step 1: Write the minimal implementation**

Add:

```xml
<key>NSLocalNetworkUsageDescription</key>
<string>O Dokke precisa acessar a rede local para que seus dispositivos encontrem e se conectem ao servidor do Mac.</string>
```

Do not add Bonjour declarations or change the server startup path; Dokke uses UDP discovery and already starts that flow when the app opens.

**Step 2: Run the focused test**

```sh
node --test test/mac-local-network.test.mjs
```

Expected: PASS.

### Task 3: Validate source and packaged app

**Files:**
- Verify: `mac/Info.plist`, generated `mac/dist/Dokke.app/Contents/Info.plist`

**Step 1: Validate plist syntax**

```sh
plutil -lint mac/Info.plist
```

Expected: `mac/Info.plist: OK`.

**Step 2: Run the full Node suite**

```sh
npm test
```

Expected: all tests pass.

**Step 3: Build the Swift release binary**

```sh
cd mac && swift build -c release --product Dokke
```

Expected: exit status 0.

**Step 4: Build the app bundle and verify the embedded key**

```sh
cd mac && ./install.sh --build-only
plutil -p mac/dist/Dokke.app/Contents/Info.plist | rg NSLocalNetworkUsageDescription
```

Expected: the generated bundle contains the same usage description.

Do not commit, push, publish a release, or delete existing artifacts as part of this fix.
