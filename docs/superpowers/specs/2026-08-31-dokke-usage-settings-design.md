# Dokke Usage Settings

## Objetivo

Separar o painel visual de Usage, exibido no PWA/Android, das configurações que o usuário edita no app macOS. O Mac deve mostrar uma tela nativa de preferências e publicar essas preferências para os dispositivos conectados pelo servidor Dokke.

## Escopo aprovado

O item `Usage` da sidebar do Mac deixa de abrir o painel com provedores, cards, gráficos e mascote. Ele passa a abrir uma tela nativa chamada **Configurações de uso**, com três controles:

- **Mostrar Usage no PWA/Android**: habilitado por padrão; quando desligado, a terceira tela e seu dot deixam de existir.
- **Mostrar porcentagem como**: `Usado` ou `Restante`; `Usado` é o padrão atual.
- **Mostrar reset como**: `Contagem regressiva` ou `Horário exato`; `Contagem regressiva` é o padrão atual.

A tela nativa não exibe dados de consumo. Ela apenas edita preferências e informa que a configuração vale para PWA/Android conectados ao Dokke.

## Contrato compartilhado

O arquivo de configuração do servidor mantém `schemaVersion: 2` e passa a incluir:

```json
{
  "usage": {
    "enabled": true,
    "display": "used",
    "reset": "countdown"
  }
}
```

Valores ausentes ou inválidos são normalizados para esses defaults. O campo aparece em `GET /api/config`, `GET /api/apps` e nas mensagens de configuração já transmitidas pelo WebSocket.

O Mac salva alterações em `PUT /api/config/usage` usando o mesmo arquivo persistente e a mesma fila de escrita do restante da configuração. O endpoint aceita somente os valores enumerados, incrementa `revision` quando há alteração e responde com a configuração pública completa. Nenhum PIN ou segredo entra nesse contrato.

## Comportamento do PWA/Android

- O estado inicial usa os defaults até o primeiro payload de configuração.
- O payload de configuração atualiza as preferências sem exigir reinstalação ou rebuild do APK.
- Quando `enabled` é `false`, a navegação passa a ter somente `Apps` e `Apps abertos`; se o usuário estiver em Usage quando a configuração chegar, ele é levado para `Apps abertos`.
- Quando `display` é `remaining`, os percentuais e barras representam a parte restante, calculada como `1 - utilization`; status e seleção do limite primário continuam baseados no consumo real.
- Quando `reset` é `exact`, os cards exibem a data/hora de reset; quando é `countdown`, preservam a contagem regressiva atual.
- A lógica que prioriza a janela de 5 horas quando existente e usa o semanal como fallback permanece inalterada.

## Compatibilidade e estados

Clientes antigos ignoram o campo novo e continuam funcionando. O servidor continua devolvendo `usage` normalizado para que clientes novos tenham comportamento determinístico. Falha ao salvar no Mac mantém o último estado confirmado localmente e exibe erro traduzido; o PWA não inventa valores quando Usage está desligado ou quando os dados de consumo estão indisponíveis.

## Critérios de aceite

1. O Mac abre uma tela de configurações, não o painel visual de Usage.
2. Os três controles persistem no servidor e reaparecem após reiniciar o Mac.
3. O PWA/Android recebe a configuração sem rebuild e remove/recoloca a terceira tela conforme o toggle.
4. `Usado`/`Restante` altera percentuais e barras sem alterar o cálculo de status.
5. `Contagem regressiva`/`Horário exato` altera somente a apresentação do reset.
6. Os defaults preservam o comportamento atual quando `usage` não existe em um arquivo antigo.
