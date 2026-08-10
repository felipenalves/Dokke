# Spec: Instalador DMG layout

> feature: instalador-dmg-layout
> status: auditada

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - US-xxx = história de usuário · AC-xxx = critério de aceite
    ASM-xxx = suposição · Q-xxx = pergunta em aberto
    São códigos de rastreio: ligam a especificação às tarefas e aos testes.
  - Toda história de usuário precisa de pelo menos um critério de aceite.
  - Todo critério de aceite precisa de Dado/Quando/Então completos.
  - Os códigos são únicos no projeto inteiro (nunca reutilize um número).
  - Suposições e Perguntas em aberto são OBRIGATÓRIAS: se não há nenhuma,
    escreva "Nenhuma." — mas desconfie: quase toda feature esconde uma.
-->

## Contexto

O instalador do Dokke precisa abrir no macOS como uma janela de arrastar para instalar: o app à esquerda, Applications à direita e uma seta desenhada no fundo, sem terceiro arquivo visível.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-001 — Instalação visualmente clara

Como pessoa instalando o Dokke, quero uma janela limpa e previsível, para entender imediatamente que devo arrastar o app para Applications.

#### AC-001 — DMG monta normalmente

- **Dado** um DMG gerado pelo instalador
- **Quando** a pessoa o monta no macOS
- **Então** o volume é anexado sem erro

#### AC-002 — Só os dois itens da instalação ficam visíveis

- **Dado** o volume montado
- **Quando** a pessoa olha a raiz da janela
- **Então** vê apenas `Dokke.app` e `Applications` como itens visíveis

#### AC-003 — Applications continua sendo o atalho nativo

- **Dado** o volume montado
- **Quando** a pessoa inspeciona `Applications`
- **Então** ele é um symlink que aponta para `/Applications`

#### AC-004 — A seta pertence ao fundo

- **Dado** o volume montado
- **Quando** a pessoa seleciona os itens da janela
- **Então** a seta não aparece como arquivo selecionável e o fundo contém a referência visual da seta

#### AC-005 — Os itens ficam no eixo correto

- **Dado** um Finder com preferências padrão
- **Quando** a janela do DMG abre
- **Então** `Dokke.app` fica à esquerda e `Applications` à direita, alinhados verticalmente

#### AC-006 — O layout não usa ordenação global

- **Dado** um computador com ordenação alfabética ou preferências anteriores
- **Quando** o DMG é montado
- **Então** o layout continua usando posições persistidas e não a ordenação global do Finder

#### AC-007 — A configuração sobrevive a remontagem

- **Dado** um DMG que foi desmontado
- **Quando** ele é montado novamente
- **Então** o fundo, a visualização e as posições continuam presentes

#### AC-008 — A janela é compacta

- **Dado** a janela do instalador
- **Quando** ela é aberta
- **Então** seus limites são equivalentes a aproximadamente 640×400 e a composição é limpa

#### AC-009 — O app empacotado continua completo

- **Dado** o `Dokke.app` dentro do DMG
- **Quando** o bundle é inspecionado
- **Então** ele permanece executável e contém o `server.js` embutido

#### AC-010 — O script continua sintaticamente válido

- **Dado** o script `mac/package-dmg.sh`
- **Quando** `bash -n` é executado
- **Então** a validação termina com sucesso

#### AC-011 — O artefato não reintroduz a seta como PNG visível

- **Dado** o conteúdo montado do DMG
- **Quando** a raiz do volume é inspecionada
- **Então** não existe `Arraste para instalar.png`, nem outro PNG auxiliar visível

#### AC-012 — O bundle público não carrega arquivos locais ignorados

- **Dado** que `public/` pode conter backups, logs ou artefatos locais ignorados
- **Quando** o app macOS é empacotado
- **Então** o bundle inclui somente os arquivos públicos necessários ao runtime

#### AC-013 — O instalador usa uma allowlist pública explícita

- **Dado** o script `mac/install.sh`
- **Quando** ele prepara o bundle do servidor
- **Então** copia somente a allowlist pública declarada, sem copiar `public/` inteiro

## Fora de escopo

- Alterar a UI interna do Dokke.
- Alterar o fluxo de download/instalação do atualizador.
- Fazer bump de versão, commit, push ou release.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | O builder `appdmg` é aceitável para persistir o `.DS_Store` do volume | confirmada | Builder validado em DMG montado no macOS |
| ASM-002 | A altura configurada no appdmg exclui a barra de título | confirmada | 378pt de conteúdo + 22pt de barra = 400pt |

## Perguntas em aberto

Nenhuma.
