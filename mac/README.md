# J5 Dock (Mac)

App nativo SwiftUI — **instala como `.app`**, não roda via `swift run`.

- **Sidebar** — Apps / About navigation
- **Dock** — visual grid de pinned apps com ícones
- **Liquid Glass** — efeitos de vidro translúcido (macOS 26+, fallback pra 14-25)
- **Drag-to-reorder** — reordena apps no dock via drag-and-drop
- **App Picker** — busca e adiciona apps ao dock

## Instalar

```sh
cd mac
./install.sh          # → ~/Applications/J5 Dock.app
./install.sh --open   # instala e abre
./install.sh --system # → /Applications (opcional)
```

Depois: Launchpad / Spotlight → **J5 Dock**.

Pré-req: macOS 14+, Xcode CLT (`xcode-select --install`), server `node server.js` na pasta pai.

## Só gerar o .app (sem instalar)

```sh
./install.sh --build-only   # mac/dist/ — só dev; install normal não deixa copia em dist
```

Se o Launchpad mostrar **dois** "J5 Dock": era `~/Applications` + `mac/dist`. O install atual remove o de `dist`. Apaga à mão se sobrar: `rm -rf mac/dist/J5\ Dock.app`.

## Desinstalar

```sh
rm -rf ~/Applications/J5\ Dock.app
# ou: /Applications/J5\ Dock.app
```

## UI

- **Sidebar** — navegação entre Apps (dock) e About (status/config)
- **Dock Grid** — pinned apps como ícones em container translúcido, estilo dock
- **App Picker** — sheet com busca pra adicionar/remover apps
- **About** — status do servidor, device count, base URL, refresh
- **Menu Bar** — ícone de antena (verde/vermelho), dropdown com status

## API

| Método | Path |
|--------|------|
| GET | `/api/status` |
| GET | `/api/config` |
| GET | `/api/apps/installed` |
| GET | `/api/apps/:name/icon` |
| POST | `/api/config/pinned` `{ "app" }` |
| PUT | `/api/config/pinned` `{ "pinned": [] }` |
| DELETE | `/api/config/pinned/:app` |

Base URL default: `http://127.0.0.1:3000` (editável no About).

## Estrutura

```
mac/Sources/
├── J5DockMacApp.swift      # Entry point + MenuBarExtra
├── ContentView.swift       # NavigationSplitView + Sidebar + AboutView
├── DockGridView.swift      # Dock grid com Liquid Glass + drag-to-reorder
├── DockIcon.swift          # Ícone individual com hover + context menu
├── AppPickerSheet.swift    # Sheet de busca/adicionar apps
└── DockStore.swift         # Data model + API client
```
