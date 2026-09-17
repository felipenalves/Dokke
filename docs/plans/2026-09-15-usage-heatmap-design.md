# Usage heatmap design

## Objetivo

Substituir o gráfico de barras do segundo slide do Usage por uma leitura de atividade diária inspirada no GitHub e no Usage do Codex. O gráfico deve continuar ocupando todo o slide, adaptar-se ao viewport e preservar a cor visual atual do Dokke.

## Direção visual aprovada

- matriz CSS Grid com 7 linhas, uma para cada dia da semana;
- até 53 colunas semanais cobrindo os últimos 12 meses, com células pequenas e quadradas no padrão GitHub/Codex;
- células vazias em superfície escura/translúcida;
- intensidade crescente pela opacidade da cor atual do gráfico;
- legenda compacta “Menos” → “Mais”;
- cabeçalho com título, pico e período sem criar um painel adicional;
- eixo e células devem caber no card em landscape, portrait, tablet e desktop.

## Componentes e dados

`usageTrendNode(provider)` continua sendo a única entrada do componente. Os pontos diários são normalizados para semanas completas de sete dias e a série cobre até 365 dias. A grade renderiza apenas as colunas mais recentes que cabem no card, como no componente de referência; posições sem ponto recebem estado vazio. Cada célula recebe descrição acessível com data, valor e intensidade; o clique continua abrindo o detalhe do ponto correspondente quando houver dado.

O valor máximo do conjunto define a escala de intensidade. A célula usa a mesma variável de cor do gráfico atual e somente varia a opacidade, sem introduzir paleta nova.

## Responsividade e interação

O grid usa colunas semanais explícitas e células quadradas de tamanho fixo responsivo, em vez de esticar cada célula para preencher o card. Em telas estreitas, a janela visível reduz a quantidade de semanas sem criar overflow horizontal; em telas largas, até 12 meses aparecem. O card segue preenchendo a área útil do slide 2. A correção de snap do pager continua responsável por impedir que o slide de provedores apareça junto com a tendência.

## Validação

- teste estático para a matriz, legenda e contrato de intensidade;
- teste de UI para 390×844, 768×1024, 844×390 e 1280×800;
- validar que a grade não corta células nem cria overflow horizontal;
- validar que um ponto com dado mantém nome/valor acessível e que célula vazia não inventa valor.
