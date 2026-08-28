# Dokke icon appearance design

## Goal

Deliver the Dokke icon through the native Apple Icon Composer pipeline on macOS 26 and retain correct fallbacks for older macOS and the web app.

## Current state

- `assets/branding/dokke-icon/Dokke.icon` is the source document exported from Icon Composer.
- The Mac app currently declares only `AppIcon.icns`, so its bundle has no compiled appearance-aware resource.
- The PWA currently exposes one default favicon and one default `apple-touch-icon`.
- The six flattened PNG exports remain useful as design previews and web fallbacks, but they are not the native appearance source.

## Decisions

1. Keep `Dokke.icon` versioned as the source of truth for the native Mac icon.
2. Compile the source with Apple `actool` into `Contents/Resources/Assets.car`, using `CFBundleIconName=Dokke`.
3. Keep a legacy `Dokke.icns` fallback and use it through `CFBundleIconFile` for systems that do not consume the Icon Composer resource.
4. Never copy the raw `.icon` source into the finished app as the only icon resource.
5. Add a light/default and dark browser favicon using `prefers-color-scheme`.
6. Keep the iOS Home Screen `apple-touch-icon` stable on the default export because Web Clips consume static PNGs; do not claim native iOS appearance switching for a PWA.
7. If the local machine has no Xcode `actool`, the build remains usable with the legacy fallback and reports that the adaptive native resource was skipped. A release build that must ship the adaptive Mac icon must run where `actool` from Xcode 26 is available.

## Acceptance criteria

- The app bundle contains `Assets.car`, `Dokke.icns`, and `CFBundleIconName=Dokke` when `actool` is available.
- The app bundle contains the legacy `Dokke.icns` even when `actool` is unavailable.
- The raw `Dokke.icon` document is not copied into the finished bundle.
- The browser receives default/light and dark favicon declarations.
- The Service Worker precaches the new dark favicon.
- Existing default icon synchronization tests remain valid.
- Static tests cover the packaging contract and PWA declarations.
- `npm test`, `git diff --check`, and the Mac build verification are run; pre-existing DMG ABI failures are reported separately if they remain.
