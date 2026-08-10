# Design — Tela 2 v03 "Dock em escada"

Data: 2026-08-05 · Status: aprovado

## Objetivo

Substituir a fileira horizontal "Time Travel" da tela 2 por uma **pilha vertical em cascata**
(deck de cartas): apps empilhados um sobre o outro, como o dock do macOS em escada, com
separador `|` e fila circular infinita.

## Comportamento

- **Cascata descendo**: card 1 (app aberto mais recente) fica **no topo da escada** — na
  frente, maior, com nome — e 2, 3, 4 descem atrás dele (escala ~0.78 / 0.60 / 0.45,
  escurecidos, cada um deslocado ~36% do card pra baixo do anterior). Até 4 cards visíveis.
- **Fila circular infinita**: `[abertos] | [pinados] | [abertos]…` (wrap nos dois sentidos).
  Divisor `|` fino estilo dock (barra vertical) nas duas fronteiras de seção, como card da fila.
- **Ordem**: abertos = `state.running` (Foreground, ordem do payload = ordem do Mac),
  dedupe contra pinados (aberto que é pinado entra só em abertos). Depois do `|`: pinados
  (ordem de `state.pinned`). Sem abertos → fila começa no primeiro pinado. Sem nada → empty
  state atual.
- **Recentes**: por ora = pinados (sem histórico; server não muda).
- **Interação**: arrasto vertical sobre os cards roda a pilha (translateY via rAF,
  rubber-band não existe — wrap é infinito; snap ~180ms `cubic-bezier(.22,.61,.36,1)` por
  módulo da fila). Arrasto fora dos cards continua trocando de tela (gestos atuais intactos).
  Tap no card = focar app; long-press = pin/unpin (inalterados).
- **Blur**: `body.swiping` durante o arrasto da pilha (reuso do fix de performance).
- **Cosmética**: título "App Time Travel" → "Recentes"; hint de long-press removido; chip
  OBS e empty state continuam iguais.

## Arquitetura

- **Dados**: fila `q[]` montada no render: `[...abertos, DIV, ...pinados, DIV]`.
- **Render deck** (`renderDeck`): todos os cards da fila como filhos absolutos de `.deck`;
  cada card posicionado no slot `(i - cur)`: `translateY(slot * STEP)`, `scale`/`opacity`/
  `zIndex` por slot (slot 0 = frente = z mais alto). Divisor é um item de fila tipo `divider`.
- **Drag**: transform no container `.deck`; no release, `cur = mod(cur - round(dy/STEP), q.length)`
  e re-render (reconstrução é contínua porque conteúdo é periódico por módulo).
- **Gestos**: `.deck` com handlers próprios de pointer + `stopPropagation` no pointerdown
  (impede que o swipe de tela assuma); capture no próprio deck.
- **Rebuild**: mantém o hook atual (onde `renderRecents` é chamado em mudança de estado);
  reset de `cur` para 0.
- **Remoção**: `layoutTimeTravel`, `centerTimeTravel`, `bindTimeTravel`, `.favrow`/
  `.favscroll` saem; testes `ui.test.mjs` que referenciam strings do Time Travel são
  atualizados.

## Verificação

- `npm test` verde (asserts atualizados).
- Loop `measure/jank.mjs` segue sem frames perdidos.
- Probe manual: rota infinita nos dois sentidos, snap, dedupe, long-press pin, tap foca app,
  swipe fora dos cards troca de tela.
