# Dokke-Owned Usage Backend (superseded)

> Superseded by `2026-09-01-dokke-usage-openusage-port-design.md`, which ports the concrete OpenUsage collection and aggregation behavior instead of describing a generic adapter architecture.

## Objetivo

Remover a dependência do OpenUsage como fonte de uso do Dokke. O servidor Node do Dokke passa a coletar, normalizar, armazenar e servir os dados de uso das IAs que já são exibidos pela tela Usage.

O OpenUsage será usado apenas como referência de arquitetura. A implementação do Dokke será própria, em Node, sem copiar código literal e sem acoplar o produto ao processo ou à API local do OpenUsage.

## Escopo desta mudança

- Criar um catálogo interno de providers.
- Criar adapters isolados para autenticação, coleta de limites, histórico local e normalização.
- Criar um store de snapshots com cache, TTL, stale-while-revalidate, timeout e backoff de falha.
- Manter `/api/usage` como contrato da PWA e do app macOS.
- Acrescentar atividade do provider (`idle`, `thinking`, `working`) como dado separado de quota.
- Fazer o mascote reagir ao estado de atividade do provider selecionado.
- Preservar as alterações visuais já existentes em `public/index.html`, sem reescrever a tela.

Fora do escopo:

- Banco remoto, conta de usuário ou sincronização externa.
- Alteração do fluxo de login dos CLIs.
- Exposição de tokens, refresh tokens, cookies ou conteúdo de conversas.
- Transformar o J5 em daemon permanente.
- Trocar o contrato visual da tela Usage nesta etapa.

## Arquitetura

```text
ProviderCatalog
  └── ProviderAdapter
        ├── credentials()
        ├── fetchUsage()
        ├── readHistory()
        ├── detectActivity()
        └── normalize()

UsageCoordinator
  ├── refresh scheduling
  ├── in-flight deduplication
  ├── timeout and failure backoff
  └── provider enablement

UsageStore
  ├── last-good snapshots
  ├── TTL cache
  ├── stale metadata
  └── atomic persistence

ActivityStore
  ├── provider activity state
  ├── event timestamps
  ├── debounce/heartbeat
  └── separate activity API projection

Dokke API
  ├── GET /api/usage
  └── GET /api/usage/activity
```

### Provider adapter

Cada provider implementa uma interface comum e não expõe detalhes de autenticação ou formato bruto ao servidor:

```js
{
  id,
  displayName,
  async hasCredentials(),
  async fetchUsage({ signal }),
  async readHistory({ since, signal }),
  async detectActivity({ now }),
  normalize({ live, history, activity, now })
}
```

O adapter pode usar API do próprio provider, arquivos locais, SQLite ou processos auxiliares. A fonte varia por IA; o contrato normalizado não varia.

### Snapshot normalizado

O store mantém um snapshot por provider:

```js
{
  id: "codex",
  name: "Codex",
  plan: "Plus",
  status: "normal|attention|exhausted|unknown",
  mascot: "energized|attentive|tired|exhausted|neutral",
  activity: "idle|thinking|working",
  activitySince: "2026-09-01T19:38:43.517Z",
  lastEventAt: "2026-09-01T19:38:45.517Z",
  resources: {},
  trend: null,
  stale: false,
  fetchedAt: "2026-09-01T19:38:43.517Z",
  source: "dokke",
  errors: []
}
```

Quota e atividade são independentes. Um provider pode estar com quota normal e atividade `working`, ou sem quota disponível e atividade `idle`.

### Cache e atualização

- Snapshot bem-sucedido é persistido atomicamente em arquivo privado do Dokke.
- Snapshot anterior é carregado imediatamente no início do processo.
- Snapshot expirado continua disponível com `stale: true` enquanto ocorre o refresh.
- Refresh periódico mantém a cadência existente do Dokke.
- Providers são atualizados em paralelo, mas cada provider possui no máximo um refresh em andamento.
- Falha não apaga o último snapshot válido.
- Timeout de um provider não bloqueia os demais.
- Falha repetida entra em backoff curto; refresh manual ignora o backoff.
- Dados de atividade têm TTL curto e não devem ser confundidos com o TTL de quota.

### Atividade do modelo

O estado `working` não será inferido pela seleção do card nem pela atualização da quota.

Ordem de confiabilidade para a primeira implementação:

1. Evento recente do runner/log local do provider.
2. Processo CLI do provider em execução, quando identificável com segurança.
3. `thinking` após início detectado sem evento de saída.
4. `idle` após debounce sem novo evento.

O detector precisa registrar `lastEventAt` e aplicar uma janela de expiração. Se a fonte ficar indisponível, o estado volta a `idle` ou `unknown`, nunca permanece `working` indefinidamente.

O mascote consome apenas `provider.activity`. A animação de escrita será disparada enquanto o estado for `working`; troca de provider e toque no mascote continuam sendo reações distintas.

### API

`GET /api/usage` continua sendo o endpoint principal e passa a retornar dados produzidos pelo Dokke:

```json
{
  "ok": true,
  "source": "dokke",
  "sourceState": "available|partial|unavailable",
  "updatedAt": "2026-09-01T19:38:43.517Z",
  "providers": {
    "codex": {
      "id": "codex",
      "name": "Codex",
      "plan": "Plus",
      "activity": "working",
      "activitySince": "2026-09-01T19:38:43.517Z",
      "lastEventAt": "2026-09-01T19:38:45.517Z",
      "resources": {},
      "trend": null,
      "stale": false,
      "fetchedAt": "2026-09-01T19:38:43.517Z"
    }
  },
  "errors": []
}
```

`GET /api/usage/activity` retorna uma projeção pequena para atualizações rápidas do mascote:

```json
{
  "ok": true,
  "updatedAt": "2026-09-01T19:38:45.517Z",
  "providers": {
    "codex": {
      "activity": "working",
      "activitySince": "2026-09-01T19:38:43.517Z",
      "lastEventAt": "2026-09-01T19:38:45.517Z"
    }
  }
}
```

O endpoint de atividade não retorna credenciais, texto de prompt, conteúdo de log ou dados de conversa.

## Providers iniciais

A primeira fase deve substituir a dependência mantendo o comportamento que o Dokke já espera:

- Codex: limites via sessão local/auth da instalação e histórico em `$CODEX_HOME/sessions` quando disponível.
- Claude: limites via credencial local do Claude Code e histórico em `CLAUDE_CONFIG_DIR`/`.claude/projects` quando disponível.
- Antigravity e Grok: adapters com as fontes locais já identificadas no projeto; se a fonte não existir, retornar `unknown`/`No data` sem inventar valor.

Cada adapter entra com fixtures sanitizadas e teste de normalização antes de ser ligado ao catálogo.

## Segurança e privacidade

- Ler somente as credenciais já mantidas pelos próprios providers.
- Não registrar tokens, cookies, prompts ou caminhos sensíveis em logs.
- Persistir somente snapshots normalizados e eventos mínimos necessários para atividade/histórico.
- Manter o acesso da API sujeito à autenticação já aplicada pelo servidor Dokke.
- Não abrir uma nova porta local nem expor a API para a LAN.

## Migração

1. Implementar domínio, adapters, store e testes sem remover o adapter OpenUsage imediatamente.
2. Adicionar uma flag interna de seleção de fonte apenas para testes e fallback temporário.
3. Ligar `/api/usage` ao store Dokke e validar PWA, macOS e A02.
4. Remover URL, normalizador e chamadas do OpenUsage após a coleta própria cobrir os providers iniciais.
5. Manter `/api/usage` estável para não quebrar os clientes existentes.

## Critérios de aceite

- Dokke retorna uso sem processo OpenUsage ativo.
- Uma falha de um provider não apaga os dados dos outros nem o último snapshot válido.
- O payload não contém tokens ou conteúdo de conversas.
- A tela Usage mantém o layout atual e passa a usar `source: "dokke"`.
- O mascote entra em escrita somente quando o provider selecionado está `working`.
- Trocar de provider não deixa o estado `working` preso no card anterior.
- `npm test` passa; a validação final inclui compilação macOS e teste no A02.
