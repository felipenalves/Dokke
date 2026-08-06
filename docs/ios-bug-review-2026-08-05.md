# Revisão do app iOS (Dokke) — bugs encontrados

Data: 2026-08-05
Escopo: `ios/` (app SwiftUI cliente do servidor j5-dock), revisão estática pós-commit `06fee53`.

## Como a revisão foi feita

1. **Leitura do código Swift** (`ios/Dokke/*.swift`) — APIClient, DockStore, views e models.
2. **Conferência dos shapes de resposta do servidor** (`server.js`, `obs.js`, `apps.js`) contra os models decodificados no app:
   - `/api/status` → `{ ok, service, devices, pinned, config: { pinned } }` — bate com `DockStatus` ✓
   - `/api/apps` → `{ pinned, running: [{ name, pid, type }] }` — bate com `DockAppsPayload`/`RunningApp` ✓
   - WS `apps` / `online` — bate com `handleWS` ✓
   - `/api/obs/state` → `{ ok, connected, state: { scenes, scene, recording, streaming } }` — bate com `fetchObs`/`ObsSnapshot` ✓
3. **Verificação de plist e config** (`Info.plist`, `project.yml`) — onde estavam os problemas mais graves.
4. **Build não executado**: máquina sem Xcode (só CommandLineTools) — revisão 100% estática.

## Bugs

### 1. CRÍTICO — `Info.plist` sem ATS e sem permissão de rede local → app não conecta

Arquivo: `ios/Dokke/Info.plist`

O app conecta em `http://192.168.1.2:3000` (HTTP puro na LAN), mas o plist não tem:

- `NSAppTransportSecurity` (bloqueio de HTTP do iOS) — sem ele, toda request falha com "cleartext HTTP blocked" e o app nunca chega no servidor.
- `NSLocalNetworkUsageDescription` — iOS 14+ exige essa chave para acessar a rede local; sem ela a conexão com o IP da LAN falha silenciosamente.

Nota: o `android/README.md` documenta o problema de HTTP/cert local no Android; o lado iOS não recebeu tratamento equivalente.

Necessário adicionar ao plist:
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
<key>NSLocalNetworkUsageDescription</key>
<string>Conecta ao servidor Dokke na sua rede local.</string>
```

### 2. MÉDIO — 401 não desloga o app

Arquivo: `ios/Dokke/DockStore.swift` (refreshStatus/refreshApps/refreshObs)

Se o pin for regenerado no Mac (ou o cookie for invalidado), o poll de 4s cai em loop de 401 e o app fica preso na MainView com status "Desconectado" — nunca volta para o LoginView. O PWA do servidor reabre a tela de login nesse caso; o app iOS não tem lógica equivalente.

Falta: tratar `DockAPIError.notAuthed` nas refs → `authed = false`.

### 3. MÉDIO-BAIXO — WebSocket nunca reconecta

Arquivo: `ios/Dokke/DockStore.swift` (receiveLoop)

No `case .failure`, o WS é anulado (`ws = nil`) e não existe nenhuma reconexão. Se o Mac reiniciar, o Wi-Fi mudar ou o servidor reiniciar, o push (ex.: pin/unpin < 1s) morre até o usuário relogar. O poll HTTP de 4s mantém os dados básicos, mas o push WS fica morto.

Falta: reconexão com backoff.

### 4. BAIXO — código morto: `installed` / `refreshInstalled`

Arquivo: `ios/Dokke/DockStore.swift`

`@Published var installed` e `refreshInstalled()` não são consumidos por nenhuma view (LaunchpadView usa `pinned`; a lista de instalados não aparece em lugar nenhum).

### 5. NOTA — assinatura

Arquivo: `ios/project.yml`

`DEVELOPMENT_TEAM: ""` — precisa ser preenchido para rodar em device físico (simulador funciona sem).

## Próximos passos sugeridos

1. Plist: ATS + local network (desbloqueia o app).
2. 401 → deslogar (tratar `notAuthed` nas refs).
3. Reconexão de WS com backoff.
4. Remover ou usar o código morto de `installed`.
5. Definir DEVELOPMENT_TEAM e validar build com Xcode.
