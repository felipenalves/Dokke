# AGENTS.md — Dokke

Estas regras complementam o `AGENTS.md` do repositório pai. O Dokke é um
repositório aninhado e tem ciclo próprio de teste, release e publicação.

## Escopo

- O Dokke é o dock que roda um servidor Node no Mac e entrega a PWA/APK para
  Android, iPhone e navegador na rede local.
- O Mac é o host; não transformar o J5 em daemon do Dokke nem deixar serviço
  permanente no Mac fora do fluxo existente do app.
- Não misturar commits deste repositório com o monorepo pai.

## Desenvolvimento e verificação

- Trabalhar em `develop`; `main` é reservado para release.
- Transferências para `main` acontecem por PR autorizado; o trabalho normal
  permanece em `develop`.
- Após mudanças Node/PWA, rodar `npm test`.
- Após mudanças Swift/macOS, rodar `npm test` e `cd mac && swift build`.
- Testes de contrato que leem Swift comprovam estrutura; não substituem
  inspeção visual renderizada quando a tarefa for visual.
- Alterações Android devem ser verificadas no dispositivo real quando o
  comportamento depender de WebView, teclado, viewport, ADB ou descoberta.
- Não aumentar timeout nem alterar expectativa para esconder falha: investigar
  a causa e manter o teste focado no contrato real.

## Segurança e release

- Nunca commitar PIN real, token, senha, keystore ou credencial de instalação.
- Não editar `SECURITY.md` para resolver uma tarefa comum.
- Não publicar APK Debug. Release exige validação do DMG montado, assinatura
  do APK, checksums e `npm audit` conforme o fluxo existente.
- O mínimo de release é: `npm test`; `cd mac && swift build -c release
  --product Dokke`; `cd mac && ./package-dmg.sh`; e, para Android, `cd
  android && ./gradlew assembleRelease` com os quatro valores de assinatura
  externos documentados em `android/README.md`. Conferir o APK com
  `keytool -printcert -jarfile public/dokke.apk` e publicar SHA-256 dos
  artefatos entregues.
- Em macOS, `npm test` pode recriar artefatos em `mac/dist`; revisar o diff
  antes de finalizar e separar artefatos locais de alterações do produto.
- Não fazer commit, push, PR, deploy ou release sem pedido explícito do Felipe.
- Preservar alterações de outros agentes; revisar `git status` antes de editar
  e commitar somente o conjunto autorizado.
