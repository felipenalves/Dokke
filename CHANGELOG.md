# Changelog

## v0.2.7 — 11 de agosto de 2026

Esta versão concentra a rodada de correções de uso real em Android, iPhone e
iPad, com foco em deixar o Dokke mais fluido em aparelhos antigos e mais
previsível em diferentes orientações de tela.

### Gestos e navegação

- Corrigido o retorno da tela **Apps abertos** para a tela principal quando o
  gesto começa em cima de um ícone.
- O toque sobre um app só abre o app quando é realmente um toque; arrastes
  verticais não são mais confundidos com clique.
- O dock horizontal passou a usar o scroll nativo no Android, reduzindo o
  trabalho de JavaScript por frame em WebViews antigos.
- Ajustadas sensibilidade, velocidade e confirmação dos gestos para arrastes
  lentos e rápidos.
- Mantida a troca de slides da tela 1 sem reconstruir todo o HTML ao girar o
  dispositivo.

### Layout e renderização

- Corrigidas frestas e bordas brancas na safe area de iPhone e iPad.
- V-Dots permanecem no lado direito no modo deitado.
- Ícones da tela 2 seguem o mesmo espaçamento da tela 1.
- O landscape curto do Android agora tem margem vertical de segurança para o
  glass não ser cortado.
- Ícones reais dos apps são carregados com cache, pré-carregamento e resolução
  maior quando disponível.
- A identidade do app é resolvida pelo bundle do macOS, respeitando
  `CFBundleIconFile` e evitando ícones trocados ou monogramas temporários.

### Interação e estabilidade

- Adicionado feedback visual de toque nos cards.
- Bloqueado o menu nativo de salvar/arrastar imagem ao pressionar um ícone.
- Atualização da lista de apps abertos ficou mais rápida quando um app é
  fechado no Mac.
- Melhorada a comparação de versão e o fluxo de atualização do APK.
- O APK de release continua separado de builds Debug e usa incremento de
  `versionCode` para o Android aceitar a atualização.

### Distribuição

- Site atualizado para apontar para `v0.2.7` usando os links permanentes da
  release mais recente.
- Tutorial em slides atualizado para refletir o estado atual do projeto.
- Testes automatizados cobrindo os novos fluxos de gesto, ícones, PWA e
  atualização.

### Downloads

- [Dokke para macOS — DMG](https://github.com/felipenalves/Dokke/releases/download/v0.2.7/Dokke-macOS.dmg)
- [Dokke para Android — APK](https://github.com/felipenalves/Dokke/releases/download/v0.2.7/dokke.apk)

### Checksums SHA-256

```text
1cc3f6b49dd5ef0c8b1c4074e1c2280438040f270a9f0e33f2173037e97a1e15  Dokke-macOS.dmg
4d1a61a65ba2df805adcbafaa195081fb40dec121a2e3cec61b83faa789cbb7f  dokke.apk
```

### Validação

- 122 testes automatizados passando.
- `git diff --check` sem problemas.
- DMG macOS e APK Android gerados a partir desta versão.
- Checksums SHA-256 publicados junto dos artefatos do GitHub Release.

Relate bugs e proponha melhorias nas
[Issues e Discussions](https://github.com/felipenalves/Dokke/discussions) do
Dokke.
