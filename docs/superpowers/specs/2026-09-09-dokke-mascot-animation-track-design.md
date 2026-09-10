# Dokke Mascot Animation Phases

## Objetivo

Substituir os sprites atuais do mascote por sheets mais suaves e dar ao
renderer uma máquina de estados que represente começo, permanência e fim de
`working` e `thinking`, além de ciclos variados de idle.

## Assets aprovados

Os PNGs em `/Users/felipealves/Downloads/Dokke-animation` são sheets RGBA de
1254×1254 com grade 4×4, totalizando 16 frames por arquivo. Cada frame será
normalizado para um canvas quadrado de 256×256, suficiente para renderizar o
mascote em alta densidade no PWA e no macOS:

- `working-start.png`, `working-loop.png`, `working-end.png`;
- `thinking-start.png`, `thinking-loop.png`, `thinking-end.png`;
- `idle1.png`, `idle2.png`, `idle-coffe.png`.

Cada célula deve preservar o frame completo, incluindo acessórios desconectados
como balões e copos. O script remove ruído alpha isolado apenas para encontrar
o recorte e normaliza o artwork inteiro para 234px de altura visível, com
baseline em 246px. A escala preserva a proporção, sem esticar X/Y e sem cortar
laptop, copo ou balão.

## Contrato de comportamento

- Entrar em `working`: executar `working-start` uma vez e continuar em
  `working-loop` enquanto a atividade permanecer `working` ou `syncing`.
- Sair de `working`: executar `working-end` uma vez e então entrar no estado
  solicitado.
- Entrar em `thinking`: executar `thinking-start` uma vez e continuar em
  `thinking-loop` enquanto a atividade backend estiver `waiting`.
- Sair de `thinking`: executar `thinking-end` uma vez e então entrar no estado
  solicitado.
- Se a atividade mudar durante um start/end, a transição visual atual termina
  sem reiniciar ou deixar timers órfãos; o destino mais recente será usado ao
  concluir a fase.
- `idle-principal` permanece como idle padrão. `idle-one` e `idle-coffee` entram
  de forma ocasional e retornam ao idle principal; `idle-two` fica fora do
  runtime até ser substituído.
- O estado `waiting` do backend será exposto visualmente como `thinking`.
- O loop continua em WebView com `prefers-reduced-motion`; nesse modo a
  velocidade cai para 50%, sem congelar o primeiro frame.
- Cada frame dura 180ms; uma track de 16 frames completa um ciclo em 2,88s.
- A troca de frame continua direta por `translate3d`; duas camadas persistentes
  só são usadas na troca de asset/fase para evitar flash, com crossfade curto e
  sem recriar o mascote a cada frame.

## Implementação

- Usar `scripts/prepare-mascot-assets.py` para gerar strips WebP nomeados por
  comportamento para cada uma das nove sheets e copiá-los para `public/mascot`
  e `mac/Sources/Resources/mascot`.
- Atualizar `public/mascot/manifest.json` com canvas, grid, normalização, fonte,
  contagem de frames e arquivos de saída de cada fase.
- Reestruturar o renderer PWA em tracks `start`, `loop`, `end` e `idle`, com
  relógio absoluto por provider e um controlador persistente de transições.
- Preservar o texto de status atual: `working`/`syncing` continuam distintos
  na UI, enquanto `waiting` mostra o texto de pensamento.
- Atualizar o mascote SwiftUI para carregar os mesmos strips, reconhecer
  `working`, `syncing`, `waiting` e `idle`, e usar a mesma sequência temporal.
- Manter `--usage-mascot-scale` como único controle de escala visual.
- Remover referências funcionais aos strips antigos e ao mascote procedural.

## Aceite

1. As nove sheets fornecidas geram 16 frames válidos cada, com dimensões
   uniformes e transparência preservada.
2. `working` executa start, loop e end; o loop permanece ativo durante trabalho
   prolongado e não fica preso em um frame.
3. `waiting` executa thinking-start, thinking-loop e thinking-end com os balões
   preservados.
4. Idle mantém idle-principal como base, usa idle-one/café ocasionalmente sem
   trocar de tamanho ou comprimir o personagem, e não registra idle-two.
5. O PWA e o APK/WebView mantêm os frames em movimento com movimento reduzido.
6. O mascote nativo macOS compila e acompanha os mesmos estados.
7. Testes de transição, loop, assets, PWA/native, `swift build` e
   `assembleDebug` passam. A validação visual física do APK será reportada
   separadamente quando o A02 estiver conectado.
