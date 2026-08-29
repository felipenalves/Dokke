# Dokke macOS — refinamento visual do sidebar e cards

## Contrato aprovado

- Sidebar fixa em 208 pt, com a moldura existente envolvendo os semáforos.
- Cabeçalho sobreposto no topo: ícone do sidebar dentro da coluna e “Dokke” no começo do conteúdo.
- Navegação preserva os itens Apps e Conectar, a seleção azul e os respiros da referência Choclift.
- Cada página do carrossel mede 458 × 288 pt, usa raio 28 e padding interno de 32 pt horizontal e 29 pt vertical.
- Cada card de ícone mede 80 × 80 pt e mantém o ícone em 64 pt.
- No hover, o card aplica material desfocado sobre o ícone e mostra “−” + “Remove”; clicar no overlay remove o app.
- Emojis não fazem parte do escopo. Paginação, reorder, persistência e conteúdo dos apps permanecem inalterados.

## Validação

O contrato estrutural será coberto por testes de fonte Swift. A aprovação visual exige build do `mac/dist/Dokke.app`, abertura desse binário e captura real da janela no tamanho padrão de 980 × 628 pt.
