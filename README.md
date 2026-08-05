# Dokke

Dashboard touch para o mini PC J5: apps fixados, atalhos e controle do OBS (cenas, gravação, streaming) via WebSocket.

## Setup

Requisitos: Node 24.

```
npm install
```

## Rodar (macOS)

Abra o app **Dokke** — ele inicia o server automaticamente. Fechar o app mata o server.

## OBS WebSocket

No OBS:

1. **Tools → WebSocket Server Settings** (Ferramentas → Configurações do servidor WebSocket).
2. Marque **“Enable WebSocket server”** (Ativar servidor WebSocket).
3. Porta padrão: **4455**.
4. Defina uma **senha** (“Server Password”).

Passa a senha pro j5-dock via env:

| env | default | o que faz |
|-----|---------|-----------|
| `OBS_WS_PASSWORD` | — | senha do servidor WebSocket do OBS. Sem ela o painel OBS fica **offline**. |
| `OBS_WS_HOST` | `127.0.0.1` | host do OBS (pra remote, use ex.: Tailscale IP). |
| `OBS_WS_PORT` | `4455` | porta do servidor WebSocket do OBS. |

## Rodar (terminal)

```sh
OBS_WS_PASSWORD=sua-senha node server.js
```

ou, usando o script (env vem do shell):

```sh
export OBS_WS_PASSWORD=sua-senha
./run.sh
```

O servidor responde em `http://0.0.0.0:3000`.

## HTTPS / PWA no celular

PWA precisa de HTTPS pra instalar no mobile. Opção mais simples: **Tailscale serve** (HTTPS grátis via Let's Encrypt, sem abrir porta).

```sh
# No Mac (servidor do j5-dock):
tailscale serve --bg 3000
```

Isso expõe `https://<nome-da-mac>.ts.net/` com cert automático. No Galaxy J5:

1. Abra `https://<nome-da-mac>.ts.net/` no Chrome.
2. Menu → "Adicionar à tela inicial" (ou "Instalar app").
3. O PWA aparece como app standalone.

O servidor j5-dock segue rodando em HTTP local — o `tailscale serve` termina o HTTPS na borda.

**Cert local alternativo** (se não usar Tailscale): passe os caminhos dos arquivos PEM:

```sh
HTTPS_CERT=./cert.pem HTTPS_KEY=./key.pem node server.js
```

Sem essas envs, o servidor sobe em HTTP puro (comportamento padrão).

**Seja honesto sobre o comportamento:** sem `OBS_WS_PASSWORD` (ou com OBS fechado / senha errada) o painel OBS no app mostra **offline** (`connected: false`) — o daemon sobe normalmente, não quebra e não tenta reconectar sozinho.

## Acessar da J5 de verdade

Abra no kiosk da J5 (navegador em tela cheia):

- `http://<ip-do-mac>:3000` — mesmo Wi-Fi.
- Via **Tailscale**: `http://<tailscale-ip>:3000`, e aí o `OBS_WS_HOST` pode apontar pro `localhost` do Mac via Tailscale magicDNS, se preferir.

Dica de kiosk Android: **WebKiosk**, **Fulminate**, ou só o modo “Tela inteira” do Chrome — qualquer um serve, é um HTML só.

## API

| Método | Path                | O que faz                          |
|--------|---------------------|-------------------------------------|
| GET    | `/health`           | healthcheck (`{ok:true}`)           |
| GET    | `/api/apps`         | apps fixados + processos rodando     |
| GET    | `/api/config`       | config corrente                     |
| POST   | `/api/config/pinned`| fixa um app (`{app:"nome"}`)        |
| DELETE | `/api/config/pinned/:app` | desfixa um app              |
| POST   | `/api/apps/:name/activate` | ativa o app (`{pid?}`)     |
| GET    | `/api/obs/state`    | cenas atuais, gravando, transmitindo |
| POST   | `/api/obs/scene`    | troca cena (`{scene:"nome"}`)        |
| POST   | `/api/obs/record`   | alterna gravação                     |
| POST   | `/api/obs/stream`   | alterna transmissão                  |
| POST   | `/api/obs/stop-all` | para gravação e stream               |

`/api/obs/*` com o OBS offline responde `{ok:false, connected:false}` (ou `connected:false` no state) — a UI mostra o placeholder offline.

## Testes

```bash
npm test
```

Node 24, `node --test`, zero deps além de `ws`.
