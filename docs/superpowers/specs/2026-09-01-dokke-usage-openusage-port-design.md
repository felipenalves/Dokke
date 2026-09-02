# Dokke Usage baseado no OpenUsage

## Objetivo

Remover a dependência do processo OpenUsage sem alterar o comportamento que o
Dokke precisa exibir. O backend Node do Dokke vai portar o fluxo comprovado do
OpenUsage: runtime por provider, coleta de quota ao vivo, leitura de histórico
local, normalização em métricas, agregação de tokens/custo, tendência diária e
cache last-good.

Esta é uma adaptação comportamental. Não é uma API nova inventada nem uma
leitura da porcentagem para estimar gasto.

## Fonte de verdade usada na adaptação

O comportamento será portado destes módulos do arquivo local do OpenUsage:

- `ProviderRuntime` e catálogo: um provider combina autenticação, cliente de
  uso, scanner local e mapper.
- `MetricLine`, `ProviderSnapshot` e `DailyUsageSeries`: formatos normalizados
  para progressos, valores, gráficos, tokens e custo.
- `ClaudeUsageMapper` e `CodexUsageMapper`: quota de 5 horas, semanal, reset e
  créditos.
- `ClaudeLogUsageScanner`, `CodexLogUsageScanner` e `GrokLogUsageScanner`:
  eventos locais, deduplicação, tokens e modelo.
- `AntigravityDbUsageScanner` e `AntigravityUsageMapper`: SQLite local,
  pools de quota e tokens quando a base contém eventos utilizáveis.
- `DailyUsageAccumulator`, `UsageHistoryAggregator` e `SpendTileMapper`:
  agregação por dia, por modelo, Today/Yesterday/Last 30 Days e Usage Trend.
- `ModelRates` e `ModelPricing`: custo por input, cache-write, cache-read e
  output, incluindo variantes de preço quando o evento permite.
- `WidgetDataStore` e `ProviderSnapshotCache`: refresh paralelo, TTL,
  persistência, stale-while-revalidate, deduplicação e backoff.

## Quota ao vivo

Cada adapter chama a mesma fonte que o OpenUsage chama e mapeia somente campos
presentes na resposta:

- Claude: `five_hour` vira `Session`; `seven_day` vira `Weekly`; cada linha usa
  `utilization`, `resets_at`, `used=utilization` e `limit=100`. `extra_usage`
  vira gasto em dólares quando habilitado e com créditos reportados.
- Codex: `rate_limit.primary_window` e `secondary_window` são classificados
  pela duração real (`limit_window_seconds`), com fallback histórico somente
  quando a duração não existe. Cada janela usa `usedPercent`, `reset_at` ou
  `reset_after_seconds`. `additional_rate_limits` permanece separado; créditos
  e créditos de reset não viram tokens.
- Antigravity: `RetrieveUserQuotaSummary` é a fonte autoritativa; os buckets
  permitidos são exatamente `gemini-5h`, `gemini-weekly`, `3p-5h` e
  `3p-weekly`. Se o resumo não existir, aplica o fallback documentado pelo
  OpenUsage, agrupando modelos pelo pior percentual de quota.
- Grok: a quota semanal e o pay-as-you-go vêm do endpoint de créditos usado pelo
  próprio provider. Falha no endpoint não produz quota inventada.

As durações canônicas são 5 horas, 7 dias e 30 dias. O reset será carregado como
timestamp; o cliente decide se exibe horário exato ou contagem regressiva.

## Histórico, tokens e gastos

Quota ao vivo e gasto histórico serão campos diferentes.

- Claude lê `<config>/projects/**/*.jsonl`, priorizando `CLAUDE_CONFIG_DIR`, e
  considera linhas com `usage`, timestamp, id, request id e modelo válidos.
  Deduplica `(message.id, requestId)`; em colisão prefere entrada não-sidechain,
  depois maior total de tokens e depois a que possui `speed`. Usa `costUSD`
  carregado pelo log; sem ele, aplica o preço do modelo.
- Codex lê `$CODEX_HOME/sessions/**/*.jsonl` e `archived_sessions/`. O modelo
  vem do último `turn_context`; `token_count` usa `last_token_usage` ou a
  diferença do `total_token_usage` acumulado. Replays de sessões-filhas e
  snapshots cumulativos repetidos são ignorados. Eventos duplicados em arquivos
  copiados contam uma vez.
- Grok lê os transcripts locais no formato que o scanner do OpenUsage valida.
  Usa custo carregado quando existir e catálogo de preços como fallback.
- Antigravity consulta os bancos locais descobertos pelo provider. Só conta
  eventos de geração com tokens válidos; transcripts sem geração não são
  transformados em uso.

Todos os eventos são normalizados para:

```js
{
  timestamp,
  model,
  tokens: {
    input,
    cacheWrite5m,
    cacheWrite1h,
    cacheRead,
    output,
    total
  },
  costUSD,
  pricingModel
}
```

O custo segue a mesma fórmula do OpenUsage:

```text
(input × inputRate)
+ (cacheWrite5m × cacheWriteRate)
+ (cacheWrite1h × inputRate × 2)
+ (cacheRead × cacheReadRate)
+ (output × outputRate)
```

O multiplicador de serviço rápido e as faixas de contexto longo só serão
aplicados quando o evento local carregar essa informação. Modelo sem preço não
entra nos totais; fica registrado em `unknownModels`, sem ser contado como zero.

## Agregação e tendência

O domínio comum será equivalente a `DailyUsageSeries`:

```js
{
  daily: [{
    date: "YYYY-MM-DD",
    totalTokens,
    costUSD,
    models: [{ model, totalTokens, costUSD }]
  }]
}
```

- Dia usa o calendário local do Mac.
- A janela é hoje mais os 30 dias anteriores.
- `Today`, `Yesterday` e `Last 30 Days` só aparecem quando há tokens ou custo
  real; dia vazio não vira `$0` fabricado.
- A tendência usa tokens por dia, soma dias repetidos e preenche dias sem uso
  com zero, mantendo a distância temporal correta.
- O custo exibido pode ser estimado pelo catálogo, mas tokens continuam
  medidos. A resposta informa a fonte e os modelos sem preço.

## Cache e atualização

O backend terá um equivalente Node do `WidgetDataStore` +
`ProviderSnapshotCache`:

- refresh periódico de 5 minutos;
- refresh manual com `force` ignorando TTL e backoff;
- providers em paralelo, um refresh por provider;
- timeout individual de 10 segundos;
- último snapshot válido preservado em falha;
- snapshot carregado do disco imediatamente com `stale: true` até atualizar;
- backoff de falha de 5 minutos;
- persistência JSON atômica em `~/Library/Application Support/Dokke`;
- cache somente de dados normalizados, sem credenciais, prompts ou conteúdo de
  conversa.

O cache de histórico de arquivos será indexado por caminho, tamanho e mtime,
como o scanner incremental do OpenUsage. Arquivo inalterado não será parseado
novamente; a agregação barata será refeita quando a janela de dias deslizar.

## Contrato do Dokke

`GET /api/usage` continua sendo o endpoint principal. O formato existente será
preservado e ampliado de forma aditiva:

```json
{
  "ok": true,
  "source": "dokke",
  "sourceState": "available|partial|unavailable",
  "updatedAt": "2026-09-01T18:10:00.000Z",
  "providers": {
    "claude": {
      "id": "claude",
      "name": "Claude",
      "plan": "Pro",
      "status": "normal|attention|exhausted|unknown",
      "mascot": "energized|attentive|tired|exhausted|neutral",
      "stale": false,
      "refreshedAt": "2026-09-01T18:10:00.000Z",
      "resources": {
        "session": {
          "used": 32,
          "limit": 100,
          "format": "percent",
          "resetsAt": "2026-09-01T23:10:00.000Z",
          "periodDurationMs": 18000000
        },
        "weekly": {
          "used": 61,
          "limit": 100,
          "format": "percent",
          "resetsAt": "2026-09-08T18:10:00.000Z",
          "periodDurationMs": 604800000
        }
      },
      "trend": {
        "days": [],
        "totalTokens": 0,
        "totalCostUSD": null,
        "estimated": false,
        "unknownModels": []
      },
      "history": {
        "today": null,
        "yesterday": null,
        "last30Days": null,
        "byModel": []
      }
    }
  },
  "errors": []
}
```

`refreshedAt` permanece obrigatório para os clientes atuais. `fetchedAt` pode
ser adicionado depois, mas não substitui esse campo.

`sourceState: "partial"` será tratado como estado utilizável pelos clientes;
ele significa que ao menos um provider trouxe dados. Quando nenhum provider
tem dados, usa-se `unavailable`. `providers` é sempre um objeto, nunca array.

O endpoint `/api/usage/activity` não faz parte da primeira migração de quota e
histórico. Atividade do mascote continua separada até existir uma fonte real de
eventos; não será inferida de seleção de card, refresh de tela ou mudança de
porcentagem.

## Segurança

- APIs continuam atrás da autenticação atual do Dokke.
- Processos auxiliares recebem executável e argumentos fixos, sem shell
  interpolation.
- Caminhos ficam restritos aos diretórios conhecidos dos providers; symlinks e
  arquivos fora da raiz permitida são rejeitados.
- Leitura de JSONL, SQLite e cache tem limites de tamanho, timeout e quantidade
  de eventos.
- Cache e arquivos derivados usam permissões privadas e não armazenam tokens.
- Logs registram somente provider, tipo de erro e contagem; nunca conteúdo,
  argumentos, caminhos completos ou credenciais.
- O payload de `/api/usage` não inclui tokens de autenticação, cookies,
  prompts, respostas ou texto de conversa.

## Migração

1. Criar o domínio comum e fixtures sanitizadas derivadas dos formatos reais do
   OpenUsage.
2. Portar scanner, deduplicação, tokens, pricing, agregador diário e tendência.
3. Portar os mappers de quota de Claude, Codex, Antigravity e Grok.
4. Criar o store persistente e integrar refresh/backoff sem remover a fonte
   atual.
5. Atualizar `/api/usage` para produzir o contrato Dokke com `source: "dokke"`.
6. Atualizar testes PWA, Swift e Node para `partial`, `refreshedAt`, histórico
   e recursos reais.
7. Validar sem processo OpenUsage ativo; só depois remover URL, normalizador e
   chamadas OpenUsage.

## Critérios de aceite

- Com OpenUsage parado, Codex e Claude retornam quota de 5 horas e semanal
  quando as fontes locais/autenticadas estão disponíveis.
- Antigravity e Grok usam os mesmos endpoints, banco, logs e regras de pooling
  documentados no OpenUsage; sem fonte, retornam `unknown`/sem dados.
- Reset exato e duração da janela são preservados.
- Tokens e custo aparecem por dia, período e modelo sem dupla contagem.
- Usage Trend tem 31 pontos de calendário, com zeros somente nos dias sem uso
  dentro de uma série que realmente possui uso.
- Modelo sem preço não infla tokens, custo ou tendência e aparece em aviso de
  modelo desconhecido.
- Falha parcial preserva os demais providers e o último snapshot válido.
- Clientes macOS e PWA aceitam `sourceState: "partial"` e preservam
  `refreshedAt`.
- O payload não contém credenciais nem conteúdo de conversa.
- `npm test` passa; após tocar Swift, `cd mac && swift build` passa.
