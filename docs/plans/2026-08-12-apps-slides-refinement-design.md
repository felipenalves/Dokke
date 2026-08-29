# Refinamento dos slides de Apps

## Direção aprovada

Refinar a tela `Apps` do Dokke seguindo a referência visual enviada, mantendo a lógica atual de 8 apps por slide, arrastar e soltar, abertura do seletor e paginação horizontal.

## Decisão de interface

- Usar a sidebar nativa com `Apps` e `Conectar`.
- Manter apenas o título nativo `Dokke` no topo do conteúdo principal.
- Usar um carrossel horizontal de painéis independentes, sem painel externo duplicado.
- Cada painel tem largura aproximada de 60–70% da área disponível, deixando o próximo slide parcialmente visível.
- Manter o grid 4x2 como unidade de cada painel.
- Usar somente pontos discretos no rodapé, com o ponto ativo destacado e clique para saltar entre painéis.
- Remover contador, setas e o título `Apps fixados`, pois não existem na referência.
- Preservar refresh, drag-and-drop, botão de adicionar e menu contextual dos apps.

## Fora do escopo

- Não alterar o protocolo, a ordenação dos apps, a quantidade de itens por slide ou o servidor.
- Não adicionar auto-start, Bonjour ou novos assets de marca.

## Critérios de aceite

- A tela continua exibindo 8 apps por slide.
- O usuário consegue navegar por swipe, pelos indicadores e pelos botões anterior/próxima.
- O slide atual é identificável por texto e indicador visual.
- A tela vazia, offline e o seletor de apps continuam funcionando.
- A suíte Node, o build Swift e o bundle do Mac passam.
