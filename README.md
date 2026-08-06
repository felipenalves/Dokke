# Dokke

Gerenciador de dock de apps — controle seus apps fixados de qualquer dispositivo.

A ideia nasceu de um Galaxy J5 velho parado em casa. A vontade era fazer algo útil com ele, e nasceu o Dokke: um sistema de dock que sincroniza apps entre um Mac e qualquer dispositivo com navegador (Android, iOS, outro Mac).

## Como funciona

```
┌─────────────┐      WebSocket       ┌─────────────┐
│  Mac (Dokke) │ ◄──────────────────► │  J5 / Phone  │
│  SwiftUI app │      HTTP API       │  PWA no Chrome│
└──────┬──────┘                      └──────────────┘
       │
       ▼
  Node.js server (porta 3000)
  - serve a PWA (index.html)
  - gerencia config (pinned apps)
  - WebSocket push em tempo real
  - ícones de apps do macOS
```

1. O **Mac app** (Dokke) gerencia seus apps — fixa, remove, reordena
2. O **server Node.js** sincroniza tudo via WebSocket
3. O **device** (J5, qualquer Android, iPhone) recebe as mudanças em tempo real
4. Um toque no device ativa o app no Mac

## Stacks

| Camada | Tecnologia |
|--------|-----------|
| Mac app | Swift, SwiftUI, MenuBarExtra, Liquid Glass (macOS 26+) |
| Server | Node.js, `ws` (WebSocket), HTTP puro (zero deps) |
| PWA | HTML/CSS/JS vanilla, CSS Grid, backdrop-filter blur |
| Android | Kotlin, WebView wrapper |
| Sync | WebSocket (push em tempo real, sem polling) |

## Quick start

### Mac app (recomendado)

```sh
# Pré-requisitos: macOS 14+, Xcode CLT
git clone https://github.com/felipenalves/Dokke.git
cd Dokke
cd mac && ./install.sh --open
```

O app inicia o server automaticamente. Fechar o app mata o server.

### Terminal

```sh
npm install
node server.js
# → http://localhost:3000
```

### Android

Abra `http://<ip-do-mac>:3000` no Chrome do Android → Menu → "Adicionar à tela inicial".

Ou build o APK:

```sh
cd android
./gradlew assembleDebug
# APK em app/build/outputs/apk/debug/
```

## Mac app

- **Sidebar** — navegação entre Apps e Sobre
- **Dock Grid** — apps fixados em grid 4×2 com Liquid Glass
- **App Picker** — busca e adiciona apps do macOS
- **Drag-to-reorder** — reordena apps via drag-and-drop
- **Ícones reais** — serve os .icns do macOS, com cache em memória
- **Menu Bar** — ícone `square.grid.2x2`, status online/offline
- **Auto-start** — server sobe ao abrir o app, morre ao fechar

## API

| Método | Path | O que faz |
|--------|------|-----------|
| GET | `/health` | healthcheck (público) |
| GET | `/api/status` | status + devices conectados |
| GET | `/api/apps` | apps fixados + processos rodando |
| GET | `/api/apps/installed` | todos os apps instalados no Mac |
| GET | `/api/apps/:name/icon` | ícone PNG do app (128px, cacheado) |
| GET | `/api/config` | config corrente |
| POST | `/api/config/pinned` | fixa um app (`{"app":"nome"}`) |
| PUT | `/api/config/pinned` | substitui lista inteira (`{"pinned":[]}`) |
| DELETE | `/api/config/pinned/:app` | desfixa um app |
| POST | `/api/apps/:name/activate` | ativa o app no Mac |
| POST | `/api/obs/record` · `/api/obs/stream` · `/api/obs/stop-all` | controle OBS |
| POST | `/api/obs/scene` | troca cena (`{"scene":"nome"}`) |
| GET | `/api/obs/state` | estado OBS (cenas, gravação, streaming) |

## Autenticação (pin de acesso)

O servidor escuta em todas as interfaces (os dispositivos J5 acessam pela rede), então todo
`/api/*` exige um **pin de 4 dígitos** — exceto `/health`, `/api/probe` e `/api/auth`.
Requests vindos de **loopback** (o app Dokke no Mac) passam direto.

- O pin é gerado no primeiro boot e fica em `.j5-pin` (fixo até regenerar).
- **Aba "Sobre" no app Dokke**: mostra o código e o botão "Gerar novo código" (regenerar
  invalida o cookie dos dispositivos — o J5 pedirá o código novo na próxima ação).
- **Dispositivo J5**: ao abrir o dock, digite o código na tela de acesso; o cookie dura 180 dias.
- Brute-force: 5 tentativas erradas por IP → bloqueio de 60s.

| Método | Path | Quem acessa | O que faz |
|--------|------|-------------|-----------|
| POST | `/api/auth` | qualquer (público) | login `{"pin":"1234"}` → `Set-Cookie` |
| GET | `/api/pin` | só loopback | lê o código (exibido na aba Sobre) |
| POST | `/api/pin` | só loopback | regenera o código |

## OBS WebSocket (standby)

Suporte a controle do OBS (cenas, gravação, streaming) via WebSocket está planejado mas ainda não implementado. Quando disponível:

| env | Default | O que faz |
|-----|---------|-----------|
| `OBS_WS_PASSWORD` | — | senha do servidor WebSocket do OBS |
| `OBS_WS_HOST` | `127.0.0.1` | host do OBS |
| `OBS_WS_PORT` | `4455` | porta do OBS |

## Testes

```sh
npm test
```

Node 24, `node --test`, zero deps além de `ws`.

## Licença

MIT
