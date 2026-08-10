# Spec: instalador DMG no padrao ChatGPT

## Objetivo

Corrigir a tela de instalacao do macOS para reproduzir o padrao visual do instalador do ChatGPT:

- `Dokke.app` a esquerda.
- Uma seta decorativa no centro indicando o arrasto.
- Atalho `Applications` a direita.
- Fundo claro, limpo e discreto.
- Somente o app e o atalho visiveis como itens da janela.

A seta deve fazer parte do fundo visual da janela. Ela nao pode aparecer como um arquivo PNG clicavel.

## Problema atual

O gerador atual (`mac/package-dmg.sh`) coloca a seta como `Arraste para instalar.png`. Isso cria um terceiro item na janela e nao replica o comportamento esperado.

Tambem nao e suficiente apenas executar `set position` no Finder: em versoes atuais do macOS a ordenacao automatica pode ignorar as posicoes e colocar `Applications` antes de `Dokke`. A configuracao precisa ser persistida dentro do DMG.

Tentativas que falharam e nao devem ser mantidas:

- Usar um PNG visivel como terceiro item.
- Depender somente de `set background picture` via AppleScript do Finder, que retorna erro `-10006` neste ambiente.
- Depender somente de `set arrangement` via AppleScript, que tambem retorna `-10006` neste ambiente.

## Resultado visual esperado

Referencias de composicao para uma janela aproximada de `640x400`:

```text
┌──────────────────────────────────────────────┐
│  Dokke Installer                         ● ● ●│
│                                              │
│       [ Dokke.app ]      →      [Applications]│
│                                              │
└──────────────────────────────────────────────┘
```

Detalhes:

- Fundo proximo de `#f5f5f7`.
- Seta escura, simples e centralizada, sem texto adicional.
- App e Applications com os icones nativos do Finder.
- App e Applications alinhados no mesmo eixo vertical.
- Nao exibir `.png`, `.background`, arquivos auxiliares ou instrucoes como itens.
- O nome visual da janela pode ser `Dokke Installer`; o volume nao deve quebrar o fluxo de atualizacao existente.

## Escopo tecnico

Arquivos principais:

- `mac/package-dmg.sh`
- Novo asset de fundo em `mac/` ou `mac/assets/`
- `package.json`/`package-lock.json` somente se for necessario adicionar um gerador de DMG

O gerador deve:

1. Compilar o `Dokke.app` usando o fluxo atual.
2. Criar uma pasta de staging contendo apenas:
   - `Dokke.app`;
   - symlink `Applications` apontando para `/Applications`;
   - arquivo de fundo em pasta oculta `.background`.
3. Gerar e persistir a configuracao da janela no DMG, incluindo:
   - fundo;
   - visualizacao por icones;
   - posicao do app a esquerda;
   - posicao do Applications a direita;
   - tamanho e limites da janela.
4. Remover qualquer PNG/seta visivel da raiz do volume.
5. Comprimir o DMG no mesmo caminho de saida usado hoje.

Use um mecanismo que grave a configuracao no `.DS_Store` do volume ou um builder de DMG que suporte background e posicoes. Nao depender de preferencias do Finder do computador que executa o build.

## Nao fazer

- Nao alterar a UI interna do Dokke nesta tarefa.
- Nao alterar o fluxo de download/instalacao do atualizador.
- Nao criar um terceiro item para representar a seta.
- Nao fazer bump de versao, commit, push ou release como parte da implementacao.
- Nao substituir o icone real do `Dokke.app` nem o alias nativo de Applications.

## Criterios de aceite

- [ ] O DMG monta normalmente em macOS.
- [ ] A raiz do volume contem apenas `Dokke.app` e `Applications` visiveis.
- [ ] `Applications` continua sendo symlink para `/Applications`.
- [ ] A seta aparece no fundo da janela, nao como item selecionavel.
- [ ] `Dokke.app` fica a esquerda e `Applications` a direita em um Finder com preferencias padrao.
- [ ] A ordem nao depende de ordenacao alfabetica, preferencia global ou estado anterior do Finder.
- [ ] O fundo e as posicoes continuam presentes depois de desmontar e montar o DMG novamente.
- [ ] O DMG abre em uma janela compacta, com composicao equivalente a referencia do ChatGPT.
- [ ] O app dentro do DMG continua abrindo e o bundle continua contendo o servidor embutido.
- [ ] `bash -n mac/package-dmg.sh` passa.
- [ ] O teste de montagem confirma o conteudo esperado e nao encontra `Arraste para instalar.png`.

## Validacao sugerida

```bash
bash -n mac/package-dmg.sh
./mac/package-dmg.sh /tmp/Dokke-macOS-layout-test.dmg

MOUNT_POINT="$(hdiutil attach /tmp/Dokke-macOS-layout-test.dmg -nobrowse -noautoopen | awk '$NF ~ /^\/Volumes\// { print $NF; exit }')"
find "$MOUNT_POINT" -maxdepth 1 -mindepth 1 -print
test -d "$MOUNT_POINT/Dokke.app"
test -L "$MOUNT_POINT/Applications"
test "$(readlink "$MOUNT_POINT/Applications")" = "/Applications"
test ! -e "$MOUNT_POINT/Arraste para instalar.png"
hdiutil detach "$MOUNT_POINT" -force
```

A validacao visual deve ser feita uma unica vez pelo responsavel no DMG montado. Nao publicar a versao ate a tela corresponder ao resultado esperado.
