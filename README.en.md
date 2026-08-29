<p align="center">
  <img src="docs/public/dokke-icon.png" width="120" alt="Dokke">
</p>

<h1 align="center">Dokke</h1>

<p align="center"><a href="README.md">Leia este README em português</a></p>

<p align="center">
  <b>An app dock that syncs from your Mac to any device on your LAN.</b><br>
  It started with an old Galaxy J5 — today it runs on Android, iPhone, or any browser.
</p>

Dokke is an app dock manager: pin, reorder, and open Mac apps from another device on the same network.

## Installation

For a no-terminal installation, open the [installation page](https://dokke.vercel.app/).

### Mac — main host

[Download Dokke for macOS](https://github.com/felipenalves/Dokke/releases/latest/download/Dokke-macOS.dmg), open the `.dmg`, drag Dokke to Applications, and launch it.

The Mac is the host: it runs the server and makes the dock available to other devices on the same network.

> If macOS blocks the first launch, open **System Settings → Privacy & Security → Security → Open Anyway → Open**. Dokke is distributed outside the App Store.

### Android

[Download the APK](https://github.com/felipenalves/Dokke/releases/latest/download/dokke.apk) and install it. Then open Dokke on the Mac and use the URL and PIN shown in the **Connect** tab.

### iPhone

iPhone uses the browser PWA. Open the URL shown in the Mac app in Safari and choose **Add to Home Screen**. iPhone requires an HTTPS URL; the installation page describes the current path.

> Windows is not available yet. The installation page will show a button when an installable version exists.

## How it works

1. The **Mac app** manages pinned apps and runs the local server.
2. The **Node.js server** syncs the dock through WebSocket and serves the PWA.
3. The **device** receives changes in real time.
4. Tapping an app on the device opens it on the Mac.
5. UDP discovery finds the Mac on the local network without manual IP configuration.

## Stack

| Layer | Technology |
|---|---|
| Mac app | Swift, SwiftUI, MenuBarExtra, Liquid Glass (macOS 26+) |
| Server | Node.js, `ws`, plain HTTP |
| PWA | Vanilla HTML/CSS/JS, CSS Grid, backdrop-filter blur |
| Android | Kotlin, WebView wrapper |
| Sync | WebSocket and UDP discovery |

## Development

For source builds, use macOS 14+, Xcode Command Line Tools, and Node.js 20+:

```sh
git clone https://github.com/felipenalves/Dokke.git
cd Dokke
cd mac && ./install.sh --open
```

Run the server directly:

```sh
npm install
node server.js
# → http://localhost:3000
```

The Mac app starts the server automatically. The Connect tab shows the URL and PIN for other devices.

## Features

- **Mac app:** sidebar, 4×2 dock grid, app picker, drag-to-reorder, native icons, menu bar, and automatic server startup.
- **PWA/APK:** pinned apps, open apps, long-press to pin, real-time updates, and automatic UI refresh.
- **Language:** choose Português or English in the PWA, Mac app, and documentation. The local choice persists on that device.

## Authentication

All `/api/*` routes require a 4-digit PIN, except `/health`, `/api/probe`, and `/api/auth`. Requests from loopback (the Dokke app on the Mac) are allowed directly.

The PIN is generated on first boot and can be regenerated from the Mac app's **Connect** tab. Regenerating it invalidates device cookies; connected devices will request the new code.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Public health check |
| GET | `/api/apps` | Pinned apps and running processes |
| GET | `/api/apps/installed` | Installed Mac apps |
| POST | `/api/config/pinned` | Pin an app |
| PUT | `/api/config/pinned` | Replace the pinned list |
| DELETE | `/api/config/pinned/:app` | Unpin an app |
| POST | `/api/apps/:name/activate` | Activate an app on the Mac |

## Tests

```sh
npm test
```

See the [Portuguese README](README.md) for the complete reference and current release notes.
