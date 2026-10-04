# Dokke Intel and Apple Silicon DMG Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build, validate, and publish native Intel and Apple Silicon Dokke DMGs from the same tagged source.

**Architecture:** GitHub Actions builds on native Intel and Apple Silicon runners after reviewed branch pushes, checks the packaged app and embedded Node architecture, verifies the DMG checksum and runtime health endpoint, then uploads artifacts. Both architecture builds use Node.js 24.21.0 so their app bundles can be merged into a universal compatibility DMG at the legacy `Dokke-macOS.dmg` URL. The build workflow has no PR trigger because an internal PR can change the workflow file it executes. A separate manual workflow on the default `main` branch rebuilds an existing version tag already merged to `main`; it verifies the signed Android APK against source version metadata and the latest published signer/version, serializes publishing, and grants `contents: write` only to the final publish job. GitHub tag rules must protect `v*` from updates and deletion because a workflow cannot make its final tag check atomic with release creation. New website downloads direct users to choose their architecture.

**Tech Stack:** GitHub Actions, macOS runners, Swift, Node.js, `hdiutil`, `lipo`, GitHub CLI.

---

### Task 1: Specify the workflow contract

**Files:**
- Create: `test/macos-dmg-workflow.test.mjs`
- Test: `test/macos-dmg-workflow.test.mjs`

**Steps:**
1. Assert native Intel and Apple Silicon runners map to `x86_64` and `arm64`.
2. Assert watched paths include the adaptive icon source and app/server inputs.
3. Assert Actions use immutable commit SHAs, the native build has no editable PR trigger, and release is manually dispatched from `main` for a version-matched tag.
4. Assert the workflow verifies both architecture and packaged server health before uploading artifacts.

### Task 2: Add packaged DMG verification

**Files:**
- Create: `mac/verify-dmg.sh`
- Create: `mac/smoke-packaged-server.mjs`
- Test: `test/macos-dmg-workflow.test.mjs`

**Steps:**
1. Verify the DMG checksum and image, mount it read-only, and assert the app, IconHelper, and embedded Node match the target architecture.
2. Run the packaged server through its embedded Node runtime and assert `/health` returns the expected Dokke response.
3. Ensure cleanup detaches the image and removes temporary user data on success or failure.

### Task 3: Build and release both architectures

**Files:**
- Create: `.github/workflows/macos-dmg.yml`
- Test: `test/macos-dmg-workflow.test.mjs`

**Steps:**
1. Add a read-only push workflow with focused source path filters and no PR trigger.
2. Build and package on native macOS Intel and Apple Silicon runners using pinned Actions.
3. Upload checksum-verified DMG artifacts and app bundles with read-only permissions.
4. Add a separate manual release workflow whose definition must exist on the default branch; validate that the selected version tag is already merged to `main` and matches the macOS, Android, and signed APK versions.
5. Rebuild and verify both architectures from the validated tag, merge native app executables into a universal legacy DMG, then create one GitHub release containing the Android APK, both architecture DMGs, the universal compatibility DMG, and checksums. Only this final publish job has `contents: write`.

### Task 4: Validate locally and review

**Files:**
- Review the complete diff in the nested Dokke repository.

**Steps:**
1. Run the workflow contract tests and `npm test`.
2. Build the current Apple Silicon DMG in `mac/dist` and run the same image, checksum, architecture, and packaged runtime checks.
3. Run `swift build` and `git diff --check`; confirm generated `mac/dist` artifacts remain ignored.
4. Complete an independent read-only review before pushing changes or dispatching a release.
