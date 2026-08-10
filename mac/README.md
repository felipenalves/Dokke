# Dokke (Mac)

App nativo SwiftUI — **instala como `.app`**, não roda via `swift run`.

- **Sidebar** — Apps / Sobre navigation
- **Dock Grid** — apps fixados em grid 4×2 com Liquid Glass
- **App Picker** — busca e adiciona apps do macOS
- **Drag-to-reorder** — reordena apps no dock via drag-and-drop
- **Menu Bar** — ícone `square.grid.2x2`, status online/offline
- **Auto-start** — server sobe ao abrir o app
- **Atualizações** — verifica releases ao abrir, mostra as mudanças e instala o DMG com confirmação

## Instalar

```sh
cd mac
./install.sh          # → ~/Applications/Dokke.app
./install.sh --open   # instala e abre
./install.sh --system # → /Applications (opcional)
./package-dmg.sh      # gera um DMG com Dokke + atalho Aplicativos
```

O servidor embutido copia uma allowlist fixa de `public/`: `index.html`,
`manifest.webmanifest`, `sw.js`, os ícones PWA, `version.json` e `dokke.apk`.
Backups ignorados (`*.bak`), logs e saídas locais não entram no `.app` nem no
DMG. A regressão pode ser executada com:

```sh
node --test test/package-dmg.test.mjs
```

Depois: Launchpad / Spotlight → **Dokke**.

## Atualizar

Ao abrir, o Dokke consulta a release mais recente no GitHub. Quando há uma versão nova, um banner aparece em qualquer tela do app. **Mudanças** mostra as notas da release; **Baixar e instalar** baixa o DMG, valida o SHA-256 publicado pelo GitHub, substitui o app atual e reabre a versão nova.

O app precisa estar em uma pasta com permissão de escrita, normalmente `/Applications` ou `~/Applications`.

Pré-req: macOS 14+, Xcode CLT (`xcode-select --install`), server `node server.js` na pasta pai.

### Auditoria de dependências de build

`npm audit --omit=dev` deve permanecer limpo. A auditoria completa atualmente
aponta dois HIGH em `image-size`, transitivo de `appdmg`, usado somente durante
a geração do DMG; o runtime usa `ws` e não recebe essa dependência. Não há
correção compatível: o `appdmg` atual (`0.6.6`) exige a linha vulnerável, e
`npm audit fix --force` troca para `appdmg@0.1.0`, que é uma quebra incompatível
com o spec atual e com o Node suportado. O audit completo permanece visível e
não é mascarado.

## Desinstalar

```sh
rm -rf ~/Applications/Dokke.app
```

## Estrutura

```
mac/Sources/
├── DokkeApp.swift            # Entry point + MenuBarExtra
├── ContentView.swift       # NavigationSplitView + Sidebar + AboutView
├── DockGridView.swift      # Dock grid com Liquid Glass + drag-to-reorder
├── DockIcon.swift          # Ícone individual com hover + context menu
├── AppPickerSheet.swift    # Sheet de busca/adicionar apps
├── DockStore.swift         # Data model + API client + icon cache
└── ServerManager.swift     # Child process management do server
```
