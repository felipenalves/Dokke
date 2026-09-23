# Dokke: arquivar Uso e retirar do aplicativo

## Objetivo

Manter uma versão completa do Dokke com a tela Uso e retirar esse recurso do
aplicativo principal. O público do Dokke usa o app para acessar e controlar os
apps do Mac; monitoramento de cotas de ferramentas de IA fica fora desse fluxo.

## Estado de partida

- Repositório: `projetos/j5-dock`, remoto `origin`.
- Branch de trabalho: `develop`, em `da40485` (`feat(usage): heatmap de atividade
  365 dias no lugar das barras de tendencia`), limpa e 10 commits locais à frente
  de `origin/develop`.
- Não existe um segundo worktree registrado pelo Git.

## Arquivamento

Antes de editar `develop`, criar a branch local `archive/usage-screen` apontando
para `da40485`. Essa branch conserva o projeto completo e a implementação de Uso
exatamente como estão. Não copiar os arquivos para dentro do Dokke ativo: isso
duplicaria fontes na branch principal e permitiria que código arquivado entrasse
no build por engano.

A branch de arquivo é local e não será enviada ao remoto nesta tarefa. Não fazer
commit, push, PR, release ou deploy.

## Limite da remoção

Na `develop`, remover Uso da experiência de produto em todas as superfícies que
compartilham a implementação:

- PWA/web usada em Android, iPhone e navegador: tela, navegação, gestos,
  preferências e estilos/scripts exclusivos.
- macOS: destino da sidebar, tela de preferências, modelos, estado, polling e
  chamadas de API exclusivos de Uso.
- servidor Node: fonte de dados, coleta de atividade, endpoints e campos de
  configuração usados somente por Uso.
- arquivos de suporte: integrações, hooks, ícones, fixtures, testes e documentação
  que só existem para esse recurso.

Remover somente peças exclusivas de Uso. Manter utilitários e recursos
compartilhados que continuem sendo usados por outras telas. Não alterar as demais
funções, o visual geral nem o propósito do Dokke.

Configurações antigas de Uso não devem aparecer em respostas públicas, eventos
WebSocket ou na interface nova. Não introduzir uma rotina separada para apagar
arquivos de configuração do usuário.

## Critérios de aceite

1. A versão em `develop` não apresenta tela, destino de navegação ou preferências
   de Uso no PWA nem no app macOS.
2. A versão ativa não inicia coleta/polling de dados de Uso e não expõe endpoints
   ou campos de configuração usados exclusivamente por esse recurso.
3. As demais funções e a navegação existente do Dokke continuam disponíveis.
4. `archive/usage-screen` continua apontando para o estado completo de `da40485`,
   com a tela e o código de Uso recuperáveis sem cherry-pick ou reconstrução.
5. Testes e verificações relevantes passam, incluindo `npm test`, `cd mac &&
   swift build` e `npm run agent:check` no repositório pai.

## Fora de escopo

- Alterar a oferta ou o posicionamento público do Dokke.
- Projetar uma nova tela para substituir Uso.
- Publicar qualquer mudança ou atualizar `main`.
