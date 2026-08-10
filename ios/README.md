# Dokke — iOS (SwiftUI)

Cliente nativo **SwiftUI** do Dokke: conversa com o servidor que roda no seu Mac
(o mesmo que o PWA/APK usam), na LAN. Inclui login por PIN **liquid glass**, launchpad
de apps fixados, lista de abertos e controle do OBS.

> A tela de auth segue o visual do app web (glass, passo-a-passo, botão **Conectar**).
> Deploy/compilação precisa de um Mac com **Xcode** (este ambiente aqui só tem Command
> Line Tools / SDK macOS — não há SDK iOS nem simulador).

---

## Estrutura

```
ios/
├── project.yml                 # manifest do XcodeGen
├── Dokke/
│   ├── Info.plist              # ATS (http LAN), Local Network, orientações
│   ├── dokke-icon.png          # ícone do app (login)
│   ├── DokkeApp.swift          # @main
│   ├── RootView.swift          # Login ↔ Main
│   ├── Models.swift            # espelha o JSON do server.js
│   ├── APIClient.swift         # URLSession + cookie auth + WebSocket
│   ├── DockStore.swift         # estado global + polling + WS
│   ├── UIShared.swift          # glass card, background, tile, botão
│   ├── LoginView.swift         # tela de auth (liquid glass)
│   ├── MainView.swift          # header + abas
│   ├── LaunchpadView.swift     # grid de apps fixados
│   ├── RecentsView.swift       # apps abertos
│   └── OBSView.swift           # cenas + gravar/live/parar
```

## Como rodar (caminho rápido — XcodeGen)

1. Instale o XcodeGen: `brew install xcodegen`
2. Gere o projeto:
   ```sh
   cd ios && xcodegen generate
   ```
3. Abra: `open Dokke.xcodeproj`
4. Escolha o scheme **Dokke**, um iPhone (simulador) e rode.

## Como rodar (sem XcodeGen — manual, ~5 min)

1. Xcode → **File → New → Project → iOS → App** (SwiftUI, nome **Dokke**).
2. Remova o `ContentView.swift` padrão e arraste todos os `.swift` de `ios/Dokke/`
   para o target **Dokke** (marque "Copy items if needed").
3. Adicione `dokke-icon.png` ao target (Resources).
4. No Info.plist do alvo, adicione:
   - `NSAppTransportSecurity > NSAllowsArbitraryLoads = YES`
   - `NSLocalNetworkUsageDescription` = "O Dokke precisa acessar a rede local para
     se conectar ao seu Mac e abrir os apps."
5. Rode.

## Configurando o servidor (IP do Mac)

- Na tela de login, toque em **Servidor** e informe `http://<IP-do-Mac>:3000`.
  Ex.: `http://192.168.1.10:3000`. O padrão é `http://192.168.1.2:3000`.
- No primeiro uso o iOS pede permissão de **Rede Local** (aceitar).

## Notas técnicas

- **Auth:** `POST /api/auth` devolve um cookie; o `URLSession` (com
  `HTTPCookieStorage.shared`) reenvia nos próximos `/api/*`. `401` → volta pro login.
- **Tempo real:** WebSocket `/ws` (`online` / `apps`) + polling leve de 4s.
- **Liquid glass:** usa `Material.ultraThin/regular` (funciona em iOS 18+). O efeito
  nativo `glassEffect` é iOS 26 — as barras/menus já o pegam automaticamente no SDK novo.
- **Orientação:** o app permite girar (o dock usa landscape). A tela de login é
  desenhada para retrato; se quiser **travar só o login em retrato no iOS**, é um
  follow-up (bloquear rotação e apresentar o card em retrato).
- **Assinatura:** para rodar no **simulador** não precisa de time. Pra **device físico**,
  defina seu `DEVELOPMENT_TEAM` no projeto.

## Segurança / limites

- Todo `/api/*` exige cookie válido; só o loopback do Mac lê `/api/pin` no servidor.
- O app guarda a URL do servidor em `UserDefaults`; não guarda o PIN.
