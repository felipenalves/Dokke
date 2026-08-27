# Dokke Windows Host Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar um host Windows instalável do Dokke, com a mesma composição visual do app Mac e integração nativa para descobrir, abrir e focar aplicativos Windows.

**Architecture:** Manter o servidor Node, o protocolo LAN, a autenticação por PIN e a PWA dos companions. Criar um shell desktop Windows que gerencia o ciclo de vida do servidor e uma UI desktop com o contrato visual do Mac. Isolar inventário, ícones, processos e ações de aplicativos em um adaptador Windows, sem misturar regras do Windows ao protocolo compartilhado.

**Tech Stack:** Node.js 20+, Electron para o shell desktop Windows, HTML/CSS/JavaScript para a UI desktop, `node:test`, Playwright para contrato visual/interação, empacotador Windows com instalador assinado.

---

### Task 1: Fixar o contrato de plataforma e os cenários de teste

**Files:**
- Create: `platform/platform-contract.js`
- Create: `platform/windows/apps.js`
- Create: `platform/windows/actions.js`
- Create: `test/windows-platform.test.mjs`
- Modify: `server.js`

**Step 1: Escrever os testes de contrato que falham**

Cobrir inventário com nome/caminho, deduplicação, abertura, foco com PID e
falha de ação sem derrubar o servidor.

**Step 2: Rodar os testes focados**

Run: `node --test test/windows-platform.test.mjs`

Expected: FAIL porque o adaptador Windows ainda não existe.

**Step 3: Implementar o contrato mínimo**

Definir as operações `listInstalledApps`, `listAppProcesses`, `getIconPng` e
`activateApp`, usando dependências injetáveis para que os testes não executem
PowerShell ou binários reais.

**Step 4: Rodar novamente**

Run: `node --test test/windows-platform.test.mjs`

Expected: PASS.

**Step 5: Commit local**

```bash
git add platform server.js test/windows-platform.test.mjs
git commit -m "feat: define Windows Dokke platform adapter"
```

O commit só deve ser feito após autorização explícita do Felipe.

### Task 2: Implementar descoberta de aplicativos Windows

**Files:**
- Modify: `platform/windows/apps.js`
- Modify: `test/windows-platform.test.mjs`
- Create: `test/windows-app-discovery.test.mjs`

**Step 1: Cobrir fontes e identidade**

Testar atalhos do menu Iniciar, caminhos conhecidos e exclusão de duplicatas,
sem depender do computador do desenvolvedor.

**Step 2: Rodar para confirmar o RED**

Run: `node --test test/windows-app-discovery.test.mjs`

Expected: FAIL nas regras ainda não implementadas.

**Step 3: Implementar o scanner assíncrono**

Usar um provider isolado para ler fontes do Windows, normalizar nome, caminho e
identidade, ordenar por nome e manter cache com invalidação controlada.

**Step 4: Validar com fixtures**

Run: `node --test test/windows-app-discovery.test.mjs`

Expected: PASS sem executar comandos destrutivos ou alterar instalações.

### Task 3: Implementar ícones, processos e ações Windows

**Files:**
- Modify: `platform/windows/apps.js`
- Modify: `platform/windows/actions.js`
- Create: `test/windows-actions.test.mjs`
- Modify: `server.js`

**Step 1: Escrever testes de abertura e foco**

Verificar que o caminho resolvido é usado, que PID inválido cai para abertura e
que erro de foco não encerra o servidor.

**Step 2: Implementar providers do Windows**

Encapsular leitura de processo, abertura, foco e extração/conversão de ícone.
Nenhum comando recebido pela rede pode ser executado diretamente.

**Step 3: Integrar as rotas existentes**

Preservar `/api/apps`, `/api/apps/installed`, `/api/apps/:name/icon` e
`/api/apps/:name/activate`, trocando somente o provider de plataforma.

**Step 4: Rodar testes do servidor**

Run: `npm test`

Expected: PASS no contrato atual e nos novos cenários Windows simulados.

### Task 4: Criar o shell desktop Windows

**Files:**
- Create: `windows/package.json`
- Create: `windows/src/main.js`
- Create: `windows/src/preload.js`
- Create: `windows/src/server-process.js`
- Create: `test/windows-host.test.mjs`

**Step 1: Escrever testes de ciclo de vida**

Verificar single instance, início do servidor, encerramento limpo, porta
ocupada, log de erro e abertura da janela principal.

**Step 2: Implementar o processo principal**

Criar a janela, iniciar o Node embutido, encaminhar eventos de saúde para a UI
e finalizar o servidor no encerramento do host.

**Step 3: Implementar bandeja e inicialização opcional**

Adicionar menu para abrir, mostrar status e sair. A inicialização com o
Windows deve ser explícita e reversível.

**Step 4: Rodar testes focados**

Run: `node --test test/windows-host.test.mjs`

Expected: PASS com providers simulados; a execução visual real será validada
em Windows.

### Task 5: Construir a UI desktop com paridade visual do Mac

**Files:**
- Create: `windows/renderer/index.html`
- Create: `windows/renderer/styles.css`
- Create: `windows/renderer/app.js`
- Create: `test/windows-desktop-ui.test.mjs`

**Step 1: Criar testes estruturais**

Verificar sidebar Apps/Conectar, grid 4×2, indicadores de página, app picker,
modo de reordenação e todos os elementos da tela Conectar.

**Step 2: Implementar a tela Apps**

Reproduzir estrutura, densidade, estados vazio/offline e ações de adicionar,
remover e reordenar do app Mac.

**Step 3: Implementar a tela Conectar**

Reproduzir PIN, QR Code, URL, copiar, abrir, status, dispositivos e
regeneração do PIN.

**Step 4: Validar comportamento com mock do servidor**

Run: `node --test test/windows-desktop-ui.test.mjs`

Expected: PASS nos contratos de DOM e acessibilidade.

**Step 5: Validar visualmente**

Executar Playwright em Windows com tamanhos de janela representativos e
comparar capturas com o checklist visual do app Mac. Registrar essa validação
separada dos testes estruturais.

### Task 6: Empacotar, instalar e atualizar

**Files:**
- Modify: `windows/package.json`
- Create: `windows/electron-builder.yml`
- Create: `windows/installer/README.md`
- Create: `test/windows-package.test.mjs`

**Step 1: Testar metadados do instalador**

Verificar nome, versão, arquitetura, arquivos embutidos, ícone, política de
dados do usuário e desinstalador.

**Step 2: Configurar build Windows**

Gerar instalador x64 sem exigir Node ao usuário. Manter os dados fora da pasta
de instalação e não embutir PIN ou configuração real.

**Step 3: Rodar o teste de pacote**

Run: `node --test test/windows-package.test.mjs`

Expected: PASS.

**Step 4: Validar em máquina Windows real**

Instalar, abrir, conectar companion, abrir app real, atualizar e desinstalar.
Registrar evidência de cada etapa.

### Task 7: Fechar release sem publicar

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/public/tutorial-dokke.html`

**Step 1: Atualizar documentação de disponibilidade**

Remover a indicação de Windows indisponível somente quando o instalador tiver
passado pelos critérios do PRD.

**Step 2: Rodar verificação completa**

Run: `npm test`

Run: `git diff --check`

Expected: testes PASS e nenhuma inconsistência de whitespace.

**Step 3: Entregar relatório de release**

Separar testes automatizados, build do instalador, inspeção visual e fluxo real
em Windows. Não fazer commit, push, release ou deploy sem pedido explícito.
