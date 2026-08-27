# PRD — Dokke Windows Host

**Status:** aprovado para especificação
**Data:** 18 de agosto de 2026
**Produto:** Dokke
**Plataforma:** Windows, host principal

## 1. Resumo

O Dokke Windows será a versão do Dokke para usuários que têm Windows como
computador principal. Ele executará o servidor local do Dokke, descobrirá os
aplicativos instalados, permitirá montar um dock personalizado e entregará
esse dock para celulares, tablets e navegadores na mesma rede.

O produto deve preservar o layout e a hierarquia do app para Mac. Windows não
será tratado como um novo produto visual: será outro host do mesmo Dokke.

## 2. Problema

O Dokke hoje depende do Mac como host. Isso exclui usuários Windows do fluxo
principal: instalar o host, escolher seus aplicativos e controlá-los de um
celular ou de outro dispositivo.

O problema a resolver não é apenas “rodar o servidor no Windows”. É entregar
uma instalação simples e uma experiência desktop reconhecível, capaz de:

- encontrar os aplicativos do usuário;
- mostrar ícones confiáveis;
- manter o dock sincronizado;
- abrir ou trazer aplicativos Windows para frente;
- conectar companions sem configuração manual de IP sempre que possível.

## 3. Objetivo

Permitir que um usuário Windows instale o Dokke, abra o host, conecte um
celular e controle aplicativos Windows pelo dock em até uma sessão de primeiro
uso, sem instalar Node.js ou configurar um serviço manualmente.

## 4. Não objetivos

Não fazem parte deste produto inicial:

- conta, login ou sincronização em nuvem;
- acesso remoto pela internet;
- Windows como companion;
- sincronização entre vários hosts;
- Microsoft Store como canal obrigatório;
- redesign da interface do Dokke;
- substituir ou reescrever o companion Android/iPhone;
- transformar o servidor em serviço permanente independente do app.

## 5. Usuário-alvo e caso principal

### Usuário-alvo

Pessoa que usa Windows no computador principal e tem um celular, tablet ou
navegador disponível para funcionar como superfície de controle.

### Job principal

“Quero deixar meus aplicativos mais usados acessíveis em um dock e acioná-los
por outro dispositivo sem precisar procurar janelas no computador.”

## 6. Princípios do produto

1. **Paridade estrutural:** o Windows mantém a composição do app Mac. “Mesmo
   layout” significa mesma estrutura, hierarquia, densidade, navegação e estados;
   não apenas cores semelhantes.
2. **Local-first:** o host funciona na rede local e não exige conta ou cloud.
3. **Zero dependência para o usuário:** Node.js e demais runtimes são
   empacotados no instalador.
4. **Integração nativa somente onde importa:** a camada Windows cuida de
   aplicativos, ícones, processos, bandeja, caminhos e instalação; o protocolo
   do Dokke permanece compartilhado.
5. **Falhas explicáveis:** servidor offline, firewall, rede diferente e app
   indisponível precisam gerar estados acionáveis.

## 7. Contrato visual obrigatório

O host Windows deve reproduzir a estrutura atual do app Mac:

- janela principal com título Dokke;
- sidebar com **Apps** e **Conectar**;
- item selecionado com o tratamento visual do app Mac;
- tela Apps com dock em grid de 4 colunas por 2 linhas, páginas, peek lateral
  e indicadores de página;
- módulo para adicionar app;
- modo explícito para reordenar itens;
- app picker com busca, ícone, estado “Adicionado” e ação “Adicionar”;
- tela Conectar com PIN, URL, QR Code, copiar URL, abrir URL, status do
  servidor, número de dispositivos e regeneração do PIN;
- estados equivalentes de carregando, vazio, offline, erro e sucesso.

Diferenças permitidas: menu da bandeja do Windows, atalhos de teclado,
permissões de firewall, caminhos de arquivos, ícones do sistema e linguagem do
instalador. A composição da aplicação não deve ser redesenhada para Windows.

## 8. Experiência principal

### 8.1 Instalação e primeiro lançamento

1. O usuário baixa um instalador Windows assinado.
2. O instalador instala o Dokke sem exigir Node.js.
3. O usuário abre o Dokke.
4. O host inicia o servidor local e mostra a tela Apps.
5. A tela Conectar exibe URL local, QR Code e PIN.
6. O usuário abre o Dokke em um celular ou navegador na mesma LAN.
7. O companion autentica com o PIN e recebe o dock.

Se a rede local estiver bloqueada, o produto deve explicar que o firewall ou a
rede precisa permitir a comunicação do Dokke. O usuário não deve receber
apenas uma tela vazia ou um timeout sem contexto.

### 8.2 Montagem do dock

1. O usuário abre o app picker.
2. O Dokke lista aplicativos instalados no Windows.
3. O usuário busca e adiciona um aplicativo.
4. O app aparece no dock com ícone ou fallback visual identificável.
5. O usuário entra no modo de reorganização e altera a ordem.
6. A ordem é persistida e sincronizada com os companions conectados.

### 8.3 Ação pelo companion

1. O usuário toca em um app no celular.
2. O host valida a sessão autenticada.
3. O Windows abre o app ou traz a instância em execução para frente.
4. O dock atualiza o estado de execução quando aplicável.
5. Em falha, o companion recebe uma mensagem compreensível e o host mantém o
   restante do dock funcional.

## 9. Requisitos funcionais do MVP

### RF-01 — Host desktop

O aplicativo deve abrir como host principal, iniciar o servidor Node embutido e
encerrar o processo do servidor quando o app for encerrado, respeitando o
mesmo ciclo de vida conceitual do app Mac.

### RF-02 — Interface desktop

O Windows deve entregar o contrato visual descrito na seção 7. A validação
deve comparar estrutura e estados com o app Mac, não somente existência de
textos.

### RF-03 — Inventário de aplicativos

O host deve descobrir aplicativos instalados de fontes normais do Windows,
identificar nome e caminho de lançamento e evitar duplicatas. A estratégia
exata de fontes será validada em uma prova técnica antes da implementação
definitiva.

### RF-04 — Ícones

O host deve tentar obter o ícone real do aplicativo. Quando isso falhar, deve
mostrar fallback consistente, sem quebrar o grid ou bloquear a adição.

### RF-05 — Dock

O usuário deve conseguir adicionar, remover e reordenar aplicativos. A ordem
deve persistir entre reinícios e ser refletida nos companions em tempo real.

### RF-06 — Execução e foco

O host deve abrir um aplicativo instalado e, quando houver instância em
execução identificável, tentar trazê-la para frente. Falhas de foco não podem
derrubar o servidor.

### RF-07 — Conexão

O host deve manter HTTP local, WebSocket, descoberta UDP e autenticação por PIN
compatíveis com o protocolo atual do Dokke. O companion não deve precisar de
um fluxo Windows específico.

### RF-08 — Conectar

A tela Conectar deve exibir PIN, URL, QR Code, copiar URL, abrir URL, status do
servidor, quantidade de dispositivos conectados e regeneração do PIN.

### RF-09 — Bandeja e ciclo de vida

O app deve oferecer acesso pela bandeja do Windows para abrir a janela,
verificar o estado do servidor e sair do Dokke. Inicialização com o Windows é
uma configuração explícita, não um serviço oculto.

### RF-10 — Atualização

O produto deve ter um caminho de atualização do instalador Windows e exibir
claramente a versão instalada. Atualização automática silenciosa não é
requisito do MVP.

### RF-11 — Diagnóstico

Falhas de inicialização, servidor encerrado, porta ocupada, ausência de
permissão e erro de conexão devem ser registradas em log local e expostas com
mensagem curta na interface.

### RF-12 — Desinstalação

O desinstalador deve remover o aplicativo e seus artefatos de instalação sem
apagar dados de usuário sem aviso. A política final para preservar ou remover
configuração deve ser definida antes do release.

## 10. Requisitos não funcionais

- Suporte inicial a Windows x64; versões mínimas exatas serão fechadas na
  prova técnica e documentadas no instalador.
- O usuário não precisa instalar Node.js, npm, Python ou ferramentas de build.
- O host deve funcionar sem conta e sem dependência de serviço externo para o
  fluxo local.
- A configuração deve ficar em diretório de dados do usuário, não dentro da
  pasta de instalação.
- O PIN deve continuar sendo tratado como segredo local e não pode aparecer em
  logs públicos ou em artefatos de release.
- O servidor deve escutar apenas o necessário para a LAN e o produto deve
  explicar a permissão de firewall quando solicitada.
- A interface deve suportar redimensionamento de janela sem cortar o grid,
  esconder a sidebar ou tornar Conectar inacessível.
- O host deve continuar responsivo durante descoberta de apps e carregamento
  de ícones; essas operações devem ser assíncronas e cacheáveis.
- Testes de contrato, testes do servidor, build do instalador e validação em
  uma máquina Windows real devem ser reportados separadamente.

## 11. Arquitetura de alto nível

```text
┌──────────────────────────────┐
│ Dokke Windows Host            │
│ shell desktop + tray          │
│ UI com contrato visual do Mac │
└──────────────┬───────────────┘
               │ inicia/gerencia
               ▼
┌──────────────────────────────┐
│ Node server embutido          │
│ HTTP + WebSocket + UDP + PIN  │
└──────────────┬───────────────┘
               │ LAN
               ▼
┌──────────────────────────────┐
│ Android / iPhone / navegador  │
│ companion do Dokke             │
└──────────────────────────────┘
```

O núcleo de protocolo e sincronização deve ser reaproveitado. A integração de
plataforma deve ser isolada em um adaptador Windows para inventário, ícones,
processos e ações de abertura/foco. A UI desktop Windows deve implementar o
contrato visual do Mac sem alterar a experiência PWA dos companions.

## 12. Segurança e privacidade

- Sem conta e sem coleta de dados necessária para o uso local.
- APIs de mutação protegidas por PIN e sessão autenticada.
- Loopback pode ser usado pelo host desktop para operações administrativas
  locais.
- O PIN não deve ser embutido no instalador nem versionado.
- Ações recebidas pela LAN devem validar origem/sessão conforme o contrato
  atual do servidor.
- O app não deve executar comandos arbitrários enviados pelo companion; cada
  ação deve resolver para um aplicativo previamente descoberto ou fixado.

## 13. Critérios de aceite do MVP

O MVP só é aceito quando todos os fluxos abaixo forem demonstrados em uma
máquina Windows limpa ou com ambiente controlado:

1. Instalar e abrir o Dokke sem Node.js instalado.
2. Ver a mesma composição de Apps e Conectar do app Mac.
3. Iniciar o servidor e mostrar status online.
4. Encontrar aplicativos Windows instalados no app picker.
5. Adicionar, remover e reordenar pelo desktop.
6. Persistir a configuração após fechar e reabrir o app.
7. Conectar um companion pela URL/QR Code e PIN.
8. Ver a alteração do dock no companion sem recarregamento manual.
9. Abrir pelo companion pelo menos um aplicativo Windows real.
10. Mostrar estado de erro útil para servidor offline, porta ocupada ou falha
    de rede.
11. Gerar instalador e desinstalador verificáveis.
12. Executar testes automatizados e registrar separadamente a validação visual
    e a validação em Windows real.

## 14. Métricas de sucesso

Na primeira versão, medir por teste de release e feedback dos usuários:

- taxa de instalação que chega a “servidor online”;
- taxa de primeiro companion conectado;
- taxa de abertura bem-sucedida de app Windows pelo companion;
- quantidade de falhas de inventário, ícone e foco;
- tempo entre instalação e primeiro app fixado;
- quantidade de erros de firewall/porta sem resolução;
- crashes do host e reinícios inesperados do servidor.

Não adicionar telemetria obrigatória apenas para medir essas métricas. O
primeiro ciclo pode usar roteiro de QA, logs locais anonimizados pelo usuário e
relatos de Issues/Discussions.

## 15. Riscos e decisões abertas

| Tema | Risco | Decisão necessária |
|---|---|---|
| Inventário | Apps podem estar em fontes diferentes e aparecer duplicados | Definir fontes prioritárias e regra de identidade |
| Ícones | Nem todo atalho expõe ícone de forma uniforme | Definir fallback e cache |
| Foco | Restrições do Windows podem impedir trazer janela à frente | Aceitar abrir nova instância quando foco falhar |
| Firewall | UDP/HTTP podem ser bloqueados por perfil de rede | Definir mensagem e instrução de permissão |
| Instalador | Distribuição fora da Store pode gerar alerta de confiança | Definir assinatura e canal inicial |
| Atualização | Substituição do app pode falhar com processo aberto | Definir fluxo de encerramento e rollback |
| Dados | Desinstalação pode apagar ou preservar PIN/configuração | Fechar política antes do release |
| Paridade | A interface Mac é nativa SwiftUI | Criar checklist visual e capturas comparáveis |

## 16. Fases

### Fase 0 — prova técnica

Validar descoberta de apps, ícones, processos, abertura/foco, firewall,
empacotamento do Node e ciclo de vida do host em uma máquina Windows real.

### Fase 1 — MVP funcional

Implementar host, adaptador Windows, tela desktop com paridade visual,
conexão LAN, dock persistente, instalador e logs.

### Fase 2 — endurecimento

Repetir testes em diferentes versões/configurações do Windows, resolver casos
de duplicação e ícones, validar atualização, desinstalação, firewall e
recuperação após crash.

### Fase 3 — release público

Publicar somente depois de validar o instalador, o fluxo de primeiro uso e o
controle de um aplicativo real por companion.

## 17. Definição de pronto do produto

O Dokke Windows está pronto quando o instalador, o host, o adaptador Windows,
a UI com paridade visual e o protocolo LAN passam pelos critérios de aceite em
uma máquina Windows real, com evidência separada para testes automatizados,
build/empacotamento, inspeção visual e uso ponta a ponta.
