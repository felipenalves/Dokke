# Dokke Painel de Uso

## Decisão

Remodelar a tela de Usage do DOKKE para se aproximar da referência do Claude Code: um painel escuro, compacto e legível de relance. A tela continua sendo a terceira página da navegação e mantém o título de categoria, agora como **Painel de Uso**.

## Estrutura

- Cabeçalho com o título `Painel de Uso`, provedor ativo, identidade visual do provedor, status de conexão e botão de atualizar.
- Claude usa a identidade visual do Claude Code.
- Codex usa a marca oficial da OpenAI já empacotada no produto; não usar apenas um caractere genérico.
- Estado online é representado por uma bolinha verde com pulso discreto quando a última leitura foi bem-sucedida e recente.
- Estado stale/offline usa bolinha estática e texto explícito; o pulso nunca deve indicar conectividade que não foi confirmada.
- Dois cards de destaque em uma linha: `5 HOURS` à esquerda como principal e `WEEK` à direita como secundário.
- Cada card mostra percentual grande, barra de progresso fina, horário de reset e contagem regressiva.
- Status geral (`OK`, `ATTENTION`, `EXHAUSTED`) aparece em um pill compacto abaixo dos cards.
- Mascote/token permanece pequeno e contextual, sem competir com os limites.
- Dados da fonte (`OpenUsage`, `dados locais`) ficam fora da área principal; o cabeçalho mostra somente estado e momento da atualização.
- O botão `Atualizar` permanece disponível e preserva a posição de scroll.

## Direção visual

- Fundo opaco azul-marinho/preto, sem o grande painel laranja atual.
- Superfícies internas discretas, cantos moderados e pouca transparência.
- Verde para estado normal, coral para identidade/ênfase e vermelho/âmbar somente para atenção real.
- Tipografia prioriza o percentual e a contagem regressiva; labels ficam pequenas e em caixa alta.
- A UI deve continuar confortável em iPhone e no app macOS, sem criar um segundo carrossel horizontal dentro da terceira tela.

## Dados e estados

- Percentual desconhecido deve aparecer como `--`, nunca como `0%`.
- `Atualizado agora`/`Atualizado há X min` só aparece quando existe timestamp válido.
- Sem leitura bem-sucedida: estado `Offline` ou `Sem dados`, sem pulso verde e sem inventar números.
- A fonte técnica continua sendo usada internamente nesta fase, mas não é exposta no hero.

## Critérios de aceite

- A terceira tela se identifica como `Painel de Uso`.
- Claude e Codex têm marcas distintas no cabeçalho/carda de provedor.
- A logo do Codex é a da OpenAI, não `⌘`, `C` ou ícone de terminal.
- A bolinha verde pulsa somente no estado disponível/recente e deixa de pulsar em stale/offline.
- Os limites de 5 horas e semana permanecem imediatamente visíveis, com 5 horas em maior destaque.
- O botão de atualizar continua funcionando e não perde o scroll.
- O layout funciona no PWA e no app macOS sem alterar a navegação entre as três telas.
