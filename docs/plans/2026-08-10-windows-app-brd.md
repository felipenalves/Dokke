# BRD — Dokke para Windows

**Status:** rascunho para aprovação antes da implementação  
**Produto:** Dokke  
**Plataforma nova:** Windows 10 22H2 e Windows 11, 64 bits  
**Baseline funcional:** app Mac atual + servidor Node.js + PWA  
**Escopo desta etapa:** planejamento. Nenhum código do Windows foi implementado.

## 1. Resumo executivo

O Dokke para Windows será o mesmo produto do Dokke para Mac: um dock de aplicativos instalado no computador, sincronizado em tempo real com celulares e outros navegadores na mesma rede.

O usuário deve reconhecer o produto imediatamente. A disposição das telas, os nomes, o fluxo de fixar apps, a ordem dos apps, o status do servidor, o código de acesso, o link para outros dispositivos e o comportamento de atualização devem permanecer iguais ao Mac.

As diferenças ficam restritas às APIs do sistema operacional:

- bandeja de notificações do Windows no lugar do `MenuBarExtra` do macOS;
- catálogo de aplicativos do Windows no lugar de `/Applications`;
- abertura e foco de janelas usando APIs do Windows no lugar de `open` e AppleScript;
- extração de ícones `.exe`, atalhos e apps da Microsoft Store no lugar de `.icns`;
- armazenamento em `%APPDATA%\\Dokke` no lugar de `~/Library/Application Support/Dokke`;
- instalador Windows no lugar do `.app`/`.dmg`.

Não haverá conta, nuvem, redesign, sincronização pela internet ou nova funcionalidade exclusiva do Windows na primeira versão.

## 2. Problema e objetivo

### Problema

Hoje o host nativo do Dokke depende de APIs e formatos do macOS. Um usuário Windows consegue usar a PWA, mas não tem a mesma experiência de host: catálogo local de apps, ícones reais, abertura/foco de aplicativos, bandeja, inicialização do servidor e tela de configurações.

### Objetivo

Entregar um aplicativo desktop Windows instalável que seja funcionalmente equivalente ao app Mac e continue usando o mesmo servidor, protocolo, PWA e clientes Android/iPhone.

### Resultado esperado

Uma pessoa que já conhece o Dokke no Mac deve conseguir usar a versão Windows sem reaprender o produto. Uma pessoa que instalar a versão Windows deve conseguir:

1. abrir o Dokke e encontrar os aplicativos instalados;
2. fixar, remover e reordenar aplicativos;
3. clicar em um app no computador ou no celular para abri-lo/focá-lo no Windows;
4. acessar o dock por outro dispositivo da LAN sem configurar IP manualmente;
5. manter a configuração depois de reinstalar ou atualizar o Dokke.

## 3. Princípios do produto

| ID | Princípio |
|---|---|
| P-001 | Paridade funcional vem antes de redesign. |
| P-002 | O servidor Node.js e o contrato existente continuam sendo a base comum. |
| P-003 | Adaptação de plataforma não pode quebrar Mac, Android, PWA ou iPhone. |
| P-004 | O instalador não pode depender de Node.js instalado pelo usuário. |
| P-005 | A configuração não pode ser gravada dentro da pasta de instalação. |
| P-006 | Nenhum comando deve ser montado a partir de entrada livre do usuário. |
| P-007 | A aplicação deve funcionar na LAN sem exigir conta ou serviço externo. |
| P-008 | Toda promessa de “sem bugs” será tratada como cenário testável, não como afirmação abstrata. |

## 4. Usuários e casos de uso

### Usuário principal

Felipe ou qualquer usuário que mantenha vários aplicativos abertos no Windows e queira acessá-los rapidamente no computador e no celular.

### Casos de uso

| ID | Caso de uso | Resultado |
|---|---|---|
| US-001 | Instalar o Dokke pela primeira vez | O app abre, inicia o servidor e mostra o dock. |
| US-002 | Escolher apps para o dock | O usuário pesquisa o catálogo, fixa e vê o ícone real. |
| US-003 | Reorganizar o dock | A nova ordem aparece no Windows e nos dispositivos conectados. |
| US-004 | Abrir um app pelo celular | O Windows tenta focar a janela existente ou abre o app. |
| US-005 | Trocar de rede ou reiniciar o roteador | O Android encontra o host por descoberta UDP. |
| US-006 | Atualizar o Dokke | A configuração e o PIN são preservados. |
| US-007 | Diagnosticar indisponibilidade | A tela Sobre informa estado, URL, erro e quantidade de dispositivos. |

## 5. Escopo

### Dentro da primeira versão Windows

- aplicativo desktop nativo com janela principal;
- navegação equivalente a `Apps` e `Sobre`;
- dock em grid com oito posições por página, paginação e estados vazio/offline;
- pesquisa de apps instalados;
- fixar, desfixar e reordenar por arrastar;
- ícones reais quando disponíveis e monograma como fallback;
- abertura de app e tentativa de foco da janela existente;
- ícone e menu na bandeja de notificações;
- servidor Node.js embutido no instalador;
- inicialização automática do servidor ao abrir o Dokke;
- encerramento controlado do servidor ao fechar o Dokke;
- configuração, PIN e cache fora da pasta de instalação;
- status do servidor, dispositivos WebSocket, apps fixados e URL da LAN;
- copiar URL da LAN para a área de transferência;
- regenerar PIN pelo host local;
- verificação de atualização;
- descoberta UDP na porta 3001;
- compatibilidade com o servidor/PWA/Android/iPhone atuais;
- instalador, atualização, desinstalação e recuperação após falha;
- logs locais para diagnóstico, sem telemetria por padrão.

### Fora da primeira versão

- sincronização entre computadores pela internet;
- login por conta, servidor em nuvem ou banco remoto;
- redesign do layout ou mudança de identidade visual;
- versão ARM nativa;
- suporte a Windows anterior ao Windows 10 22H2;
- publicação na Microsoft Store;
- novos controles do OBS que não existam no fluxo atual;
- execução de comandos arbitrários configurados pelo usuário;
- início automático do Windows sem o usuário ativar essa opção.

## 6. Paridade Mac → Windows

| Comportamento atual no Mac | Comportamento obrigatório no Windows | Adaptação permitida |
|---|---|---|
| Sidebar `Apps` / `Sobre` | Mesmas duas áreas, mesmos textos e estados | Controles visuais nativos do Windows |
| Grid 4×2, paginação e drag-and-drop | Mesmo número de posições, ordem e fluxo | Mouse, touchpad e teclado do Windows |
| App Picker com busca | Catálogo Windows pesquisável | Fonte do catálogo muda |
| Ícone `.icns` real | Ícone de `.exe`, atalho, MSIX/UWP ou fallback | API de ícone do Windows |
| `/Applications`, `/System/Applications` e `~/Applications` | Atalhos do Menu Iniciar + diretórios de instalação padrão + apps registrados | Não usar apenas busca em uma pasta |
| `lsappinfo` | Processos e janelas visíveis do Windows | APIs nativas de processo/janela |
| `open -a` | Shell launch do app ou AppUserModelId | Fallback de abertura quando não for possível focar |
| AppleScript/`osascript` para foco | `ShowWindow`/`SetForegroundWindow` e equivalente seguro | Windows pode negar foco em alguns casos |
| `MenuBarExtra` | Ícone na área de notificação | Menu de contexto do Windows |
| `NSPasteboard` | Clipboard do Windows | Mesmo comando “Copiar link” |
| `NSWorkspace` para abrir release | Navegador padrão do Windows | Mesma URL e mesma regra de versão |
| `.app` instalado | Instalador Windows assinado | Pacote independente do Node instalado |
| `UserDefaults`/Application Support | `%APPDATA%\\Dokke` | Configuração sobrevive à atualização |

### Regra para catálogo e identidade de apps

O Windows não pode usar somente o nome visível do aplicativo como identidade. Dois apps podem ter o mesmo nome ou o mesmo executável em caminhos diferentes.

O adaptador Windows deve expor internamente um identificador estável por app, formado por AppUserModelId, caminho normalizado ou identificador de atalho. O contrato legado de `pinned: string[]` deve continuar aceito para não quebrar clientes existentes; a evolução para metadados opcionais (`id`, `name`, `path`, `icon`, `source`) deve ser retrocompatível.

## 7. Requisitos funcionais

### Host e instalação

**FR-WIN-001 — Instalação independente**  
O instalador deve incluir o executável do Dokke, o servidor Node.js, `ws`, a PWA, ícones, arquivos de versão e dependências necessárias. Em uma instalação limpa, o usuário não deve precisar instalar Node.js, Git, Java ou ferramentas de desenvolvimento.

**FR-WIN-002 — Inicialização do host**  
Ao abrir o Dokke, o app deve iniciar o servidor local, aguardar o healthcheck e carregar a interface. Se a porta 3000 estiver ocupada, deve exibir erro acionável e não iniciar uma segunda instância silenciosa.

**FR-WIN-003 — Encerramento controlado**  
Ao fechar o Dokke, o processo filho do servidor deve ser encerrado. O app não deve deixar um `node.exe` órfão nem abrir serviço permanente do Windows sem opt-in explícito.

**FR-WIN-004 — Instância única**  
Ao abrir o Dokke novamente quando ele já estiver aberto, a instância existente deve ser ativada e nenhuma segunda janela, servidor ou processo de descoberta deve ser criado.

### Dock e catálogo

**FR-WIN-005 — Grid equivalente**  
O host deve mostrar os apps fixados em grid 4×2 por página, com paginação, estado vazio, estado offline e botão de adicionar equivalentes ao Mac.

**FR-WIN-006 — Catálogo pesquisável**  
O app picker deve listar apps disponíveis no Menu Iniciar e instalações convencionais, ordenar por nome, filtrar enquanto o usuário digita e indicar quais estão fixados.

**FR-WIN-007 — Fixar e desfixar**  
Fixar ou desfixar no Windows deve persistir no servidor e refletir nos clientes conectados por WebSocket em até 1 segundo após a resposta bem-sucedida.

**FR-WIN-008 — Reordenação**  
O usuário deve mover um app com arrastar-e-soltar usando mouse ou touchpad. A ordem confirmada deve sobreviver ao fechamento e reaparecer igual na PWA.

**FR-WIN-009 — Ícones**  
O host deve carregar o ícone real quando o sistema fornecer um. Se não houver ícone legível, deve mostrar o monograma existente sem quebrar o grid ou a lista.

**FR-WIN-010 — Abertura e foco**  
Ao clicar em um app, se houver uma janela correspondente, o Dokke deve tentar trazê-la para frente. Se não houver, deve abrir o app. Falhas individuais devem gerar estado de erro compreensível e não derrubar o servidor.

### Rede e sincronização

**FR-WIN-011 — API e WebSocket**  
O Windows deve consumir e preservar os endpoints atuais: `/health`, `/api/status`, `/api/apps`, `/api/apps/installed`, `/api/apps/:name/icon`, `/api/config`, `/api/config/pinned`, `/api/pin`, `/api/version` e `/ws`.

**FR-WIN-012 — Descoberta LAN**  
O servidor Windows deve responder a `dokke:discover` na porta UDP 3001 com o IP correto da interface que recebeu a consulta. Interfaces virtuais, loopback e endereços fora da sub-rede não podem ser anunciados como LAN principal.

**FR-WIN-013 — Firewall**  
Na primeira execução, o instalador ou o host deve orientar a liberação do Dokke somente em redes privadas. O produto deve funcionar quando a rede estiver marcada como pública sem expor uma porta silenciosamente; nesse caso, deve informar como corrigir.

**FR-WIN-014 — Autenticação**  
As regras atuais do PIN de quatro dígitos, cookie, bloqueio por tentativas e confiança de loopback devem permanecer. O PIN não pode aparecer em endpoints acessíveis pela LAN.

### Tela Sobre e operação

**FR-WIN-015 — Status**  
A tela Sobre deve mostrar servidor online/offline, erro recente, quantidade de dispositivos WebSocket e quantidade de apps fixados.

**FR-WIN-016 — Conexão**  
A tela Sobre deve mostrar o endereço LAN detectado, permitir copiar o link e informar que outros dispositivos acessam a PWA pelo navegador.

**FR-WIN-017 — PIN**  
O host local deve ler o PIN, mostrar o código e permitir regenerá-lo. A regeneração deve invalidar os cookies antigos.

**FR-WIN-018 — Atualização**  
O app deve comparar versões semanticamente. Deve avisar somente quando a versão publicada for maior que a local, nunca por diferença textual entre `v0.1.0` e `0.1.0`.

**FR-WIN-019 — Bandeja**  
O menu da bandeja deve mostrar estado online/offline, quantidade de dispositivos, quantidade de apps fixados, comando para abrir a janela principal e comando para encerrar o Dokke.

## 8. Requisitos não funcionais

**NFR-WIN-001 — Compatibilidade:** Windows 10 22H2 e Windows 11 x64, com DPI de 100%, 125%, 150% e 200%.

**NFR-WIN-002 — Desempenho:** janela utilizável em até 5 segundos após o clique no ícone, em uma máquina de referência com SSD e 8 GB de RAM; servidor respondendo ao healthcheck em até 3 segundos.

**NFR-WIN-003 — Robustez:** queda do servidor, mudança de IP, suspensão/retorno do computador, encerramento do app alvo e ausência de ícone não podem derrubar o Dokke.

**NFR-WIN-004 — Privacidade:** sem telemetria, analytics ou chamadas remotas além da verificação de release já existente, que deve ter timeout e falha silenciosa.

**NFR-WIN-005 — Segurança:** não aceitar certificados inválidos por padrão, não executar shell concatenado, validar IDs/caminhos, limitar corpos HTTP e manter headers de segurança existentes.

**NFR-WIN-006 — Persistência:** configuração, PIN, logs e cache devem ficar em diretórios de dados do usuário e sobreviver a atualização e reinstalação sem apagar a configuração.

**NFR-WIN-007 — Acessibilidade:** controles navegáveis por teclado, foco visível, textos sem corte em DPI alto, contraste suficiente e suporte ao tema claro/escuro do Windows.

**NFR-WIN-008 — Manutenção:** código específico do Windows deve ficar isolado do núcleo do servidor e dos clientes atuais. O adaptador deve ser testável sem depender de uma máquina Windows em cada teste unitário.

## 9. Dados e persistência

| Dado | Local Windows | Regra |
|---|---|---|
| Configuração do dock | `%APPDATA%\\Dokke\\config.json` | Não gravar no diretório do instalador. |
| PIN | `%APPDATA%\\Dokke\\.j5-pin` | Permissões somente para o usuário atual. |
| Logs | `%LOCALAPPDATA%\\Dokke\\logs` | Rotação e limite de tamanho. |
| Cache de ícones | `%LOCALAPPDATA%\\Dokke\\cache` | Pode ser recriado sem perda de configuração. |
| Preferências da janela | `%APPDATA%\\Dokke\\settings.json` | Tamanho/posição válidos devem ser restaurados com fallback seguro. |

### Migração

- atualização da versão Windows para outra versão Windows deve manter configuração e PIN;
- desinstalar e reinstalar deve manter configuração quando o usuário escolher preservar dados;
- não haverá migração automática de caminhos de apps do Mac, porque esses caminhos não existem no Windows;
- nomes fixados vindos do contrato legado devem ser reconciliados com o catálogo Windows e sinalizados quando não houver correspondência única;
- uma atualização nunca deve substituir um `config.json` válido por um arquivo vazio ou de exemplo.

## 10. Arquitetura de implementação recomendada

### Decisão de stack

Construir o host Windows em **C# com WPF sobre .NET 8**, usando APIs nativas do Windows somente no adaptador de plataforma. O servidor Node.js continua embutido e compartilhado.

Motivos da decisão:

- bom suporte a Windows 10 e Windows 11;
- APIs maduras para processos, janelas, ícones, clipboard, bandeja e instalador;
- menos dependências de runtime do que uma segunda camada web para a janela principal;
- facilidade para reproduzir a estrutura do SwiftUI: sidebar, grid, sheet/app picker e tela Sobre;
- separação clara entre UI, cliente HTTP/WebSocket e adaptadores Windows.

### Componentes

| Componente | Responsabilidade |
|---|---|
| `WindowsApp` | Entrada, janela única, ciclo de vida e bandeja. |
| `WindowsViewModel` | Estado equivalente ao `DockStore`. |
| `WindowsPlatformAdapter` | Catálogo, ícones, processos e foco de janela. |
| `ServerHost` | Iniciar, monitorar e encerrar o Node embutido. |
| `DokkeServer` | Servidor atual com ajustes cross-platform mínimos. |
| `WindowsInstaller` | Instalação, atualização, atalhos, permissões e desinstalação. |
| Clientes existentes | PWA, APK e acesso por navegador; sem reescrita de UI. |

### Limite de mudança no núcleo

O código atual de `public/`, autenticação, WebSocket e API deve ser reaproveitado. As adaptações necessárias devem ficar em `apps.js`, `actions.js`, no gerenciamento de dados de `server.js` e em um adaptador Windows separado. A versão Mac deve continuar passando seus testes e build sem alteração comportamental.

## 11. Critérios de aceite

Os critérios abaixo são o contrato mínimo para declarar a versão Windows pronta. Cada um deverá virar teste automatizado ou roteiro manual identificado antes do desenvolvimento terminar.

| ID | Dado / Quando / Então |
|---|---|
| AC-WIN-001 | Dado um Windows limpo, quando o usuário instala e abre o Dokke, então o host abre sem Node instalado e o healthcheck local responde. |
| AC-WIN-002 | Dado o host aberto, quando o usuário fecha e abre novamente, então existe uma única instância do host e um único servidor. |
| AC-WIN-003 | Dado um catálogo com apps Win32, MSIX e atalhos, quando o usuário pesquisa, então os apps aparecem com nome, identidade estável e ação de abrir. |
| AC-WIN-004 | Dado um app com ícone e outro sem ícone, quando o catálogo e o grid são renderizados, então o primeiro mostra o ícone real e o segundo mostra monograma sem layout quebrado. |
| AC-WIN-005 | Dado um app fixado, quando o usuário reordena e reinicia o Dokke, então a ordem permanece igual. |
| AC-WIN-006 | Dado um celular autenticado na mesma LAN, quando um app é fixado/desfixado no Windows, então a mudança aparece no celular em até 1 segundo. |
| AC-WIN-007 | Dado um app já aberto, quando o usuário toca nele no celular, então o Dokke tenta focar a janela; dado o app fechado, então tenta abri-lo. |
| AC-WIN-008 | Dado um IP antigo salvo no cliente Android, quando o roteador troca o IP do Windows, então a descoberta UDP encontra o novo host. |
| AC-WIN-009 | Dado o Windows em rede pública, quando o host inicia, então não abre acesso LAN silencioso e informa a configuração de firewall necessária. |
| AC-WIN-010 | Dado o app instalado, quando o usuário atualiza ou reinstala preservando dados, então config, PIN e preferências permanecem. |
| AC-WIN-011 | Dado o servidor fora do ar, quando a janela abre, então o usuário vê estado offline e uma ação de recuperação; a UI não trava. |
| AC-WIN-012 | Dado um release `v0.2.0` e local `v0.1.0`, quando a verificação roda, então o aviso aparece; para local `v0.2.0`, não aparece. |
| AC-WIN-013 | Dado DPI de 200%, quando todas as telas são abertas, então não há texto cortado, botão inacessível ou sobreposição. |
| AC-WIN-014 | Dado que o Windows bloqueia a tentativa de trazer uma janela para frente, quando o usuário ativa o app, então o Dokke continua vivo e informa a falha sem executar comando arbitrário. |
| AC-WIN-015 | Dado que o app Windows e o Mac estão na mesma release, quando ambos usam a mesma PWA, então o protocolo atual continua funcionando sem mudança manual no cliente. |

## 12. Plano de execução

### Fase 0 — Contrato e referência

- congelar a lista de comportamentos do Mac que será usada como referência;
- criar testes de contrato para API, WebSocket, autenticação e persistência;
- definir fixture de catálogo Windows com Win32, MSIX, atalho quebrado e nome duplicado;
- validar os requisitos em AC-WIN-001 a AC-WIN-015.

### Fase 1 — Núcleo cross-platform

- separar descoberta de apps e ativação do código específico do macOS;
- implementar adaptador Windows para catálogo, ícones, processos e foco;
- mover dados do host para diretório de usuário de forma segura;
- manter contrato legado e adicionar metadados opcionais de identidade;
- preservar o adaptador Mac e rodar a suíte existente.

### Fase 2 — Host desktop Windows

- construir janela equivalente ao Mac;
- implementar sidebar, grid, picker, drag-and-drop, Sobre e estados offline;
- implementar tray, instância única e ciclo de vida do Node;
- integrar HTTP, WebSocket, PIN, versão e clipboard.

### Fase 3 — Instalador e distribuição

- gerar instalador x64 assinado;
- embutir Node e dependências sem incluir `node_modules` de desenvolvimento;
- implementar atualização preservando dados;
- validar SmartScreen, firewall, desinstalação e reinstalação;
- publicar artefato separado na release do Dokke.

### Fase 4 — Matriz de validação

- Windows 10 22H2 x64;
- Windows 11 x64;
- DPI 100/125/150/200%;
- rede Wi-Fi, Ethernet e troca de IP;
- rede pública e privada;
- PC em suspensão e retorno;
- apps Win32, Store/MSIX, atalhos e processos com múltiplas janelas;
- PWA no Chrome/Edge, APK Android e navegador de outro computador;
- instalação limpa, upgrade, downgrade bloqueado e desinstalação.

## 13. Riscos e mitigação

| Risco | Impacto | Mitigação obrigatória |
|---|---|---|
| Windows pode negar foco de janela | Clique parece não funcionar | Tentar foco, verificar resultado, oferecer abertura e registrar diagnóstico. |
| Apps Store não se comportam como `.exe` | Catálogo ou abertura incompletos | Usar AppUserModelId/atalho registrado; fixture de teste para MSIX. |
| Firewall bloqueia LAN | Celular não conecta | Detectar rede, orientar regra privada e testar descoberta separadamente. |
| Dois apps têm o mesmo nome | App errado é aberto | Persistir identidade estável, não somente texto visível. |
| Instalação substitui config | Perda de dock/PIN | Dados fora do bundle e teste de upgrade obrigatório. |
| Node ou dependência não inicia | Host fica offline | Node embutido, healthcheck, log local e erro acionável. |
| Mudança cross-platform quebra Mac | Regressão em produto existente | Adaptadores isolados e suíte Mac obrigatória no gate. |
| Instalador não assinado | SmartScreen reduz confiança | Assinatura de código antes da release pública. |

## 14. Definição de pronto

A versão Windows só está pronta quando:

- AC-WIN-001 a AC-WIN-015 têm prova automatizada ou roteiro manual executado;
- a suíte Node atual continua passando;
- o build Mac continua passando;
- o instalador funciona em Windows 10 22H2 e Windows 11 x64;
- nenhum processo `node.exe` ou Dokke fica órfão após fechar o app;
- a configuração sobrevive a upgrade e reinstalação;
- PWA, Android e outro navegador continuam sincronizando;
- o instalador está assinado e o comportamento de firewall foi validado;
- não existem bugs críticos ou altos conhecidos sem decisão explícita de aceite;
- a release inclui instruções de instalação, requisitos e procedimento de diagnóstico.

## 15. Suposições e perguntas abertas

### Suposições registradas

- **ASM-WIN-001:** a primeira distribuição Windows será x64 para Windows 10 22H2 e Windows 11.
- **ASM-WIN-002:** o nome, identidade e fluxo do produto continuam sendo Dokke.
- **ASM-WIN-003:** o servidor local continua na porta 3000 e a descoberta UDP na porta 3001.
- **ASM-WIN-004:** o primeiro host Windows não terá início automático junto com o Windows; o usuário abre o Dokke quando quiser.
- **ASM-WIN-005:** o instalador será distribuído fora da Microsoft Store e deverá ser assinado.

### Perguntas que precisam de decisão antes da Fase 1

- **Q-WIN-001:** existe certificado de assinatura de código para a release Windows? Sem ele, a distribuição pública terá alerta do SmartScreen.
- **Q-WIN-002:** o catálogo inicial deve incluir apenas apps visíveis no Menu Iniciar ou também executáveis portáteis encontrados em diretórios escolhidos pelo usuário? A recomendação é Menu Iniciar + instalações padrão; busca arbitrária fica fora da primeira versão.
- **Q-WIN-003:** a reinstalação deve preservar dados automaticamente ou mostrar uma escolha explícita? A recomendação é preservar automaticamente e oferecer “remover dados” na desinstalação.
- **Q-WIN-004:** o comportamento de “fechar o Dokke encerra o servidor” permanece igual ao Mac? O BRD assume que sim.

## 16. Arquivos de referência no repositório

- `server.js` — servidor HTTP, WebSocket, descoberta UDP, autenticação e persistência;
- `apps.js` — catálogo e ícones específicos do macOS que precisam de adaptador;
- `actions.js` — abertura/foco específicos do macOS que precisam de adaptador;
- `config.js` e `auth.js` — persistência e PIN;
- `public/index.html` — cliente PWA e contrato de sincronização;
- `mac/Sources/DockStore.swift` — referência de estado e operações do host;
- `mac/Sources/DockGridView.swift` — referência visual e de reordenação;
- `mac/Sources/ContentView.swift` — referência de Sobre, conexão e atualização;
- `mac/Sources/ServerManager.swift` — referência do ciclo de vida do servidor;
- `mac/install.sh` — referência do empacotamento independente.

