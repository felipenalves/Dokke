# Paridade visual com o choclift

## Direção aprovada

Aproximar a tela Apps do Dokke da referência local do choclift sem copiar código ou assets proprietários. A composição atual do carrossel já tem a proporção, o peek lateral e a centralização vertical corretos; a melhoria deve completar a interação e a hierarquia visual que ainda diferem.

## Decisões

- Substituir a seleção azul automática da `List` por uma sidebar nativa composta por botões, usando uma cápsula cinza discreta para o item ativo.
- Manter `Apps` e `Conectar`, o título nativo `Dokke` e a largura compacta da sidebar.
- Adicionar `isReordering` ao `DockGridView`.
- Arrastar e soltar só fica ativo no modo `Reorder Pieces`; ao concluir, o botão muda para `Done` e o estado temporário é limpo.
- Posicionar `Reorder Pieces` no canto inferior direito do canvas, como no choclift.
- Preservar os tokens atuais do carrossel: 8 itens por página, card compacto, peek lateral, pontos clicáveis e alinhamento vertical central.
- Não adicionar a barra de emojis, atualização na tela Apps, novos assets ou alterações no protocolo.

## Critérios de aceite

- O item selecionado da sidebar não usa o azul padrão do macOS; usa fundo cinza translúcido e mantém contraste acessível.
- Fora do modo de reorganização, o arraste não inicia uma reordenação acidental.
- No modo de reorganização, os itens continuam sendo movidos entre posições, persistindo a ordem existente.
- O botão fica visível no canvas e não cobre o carrossel.
- A tela continua mantendo o carrossel centralizado e o próximo slide parcialmente visível.
- Testes Node, build Swift, bundle e captura visual passam.
