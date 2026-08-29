# Dokke #19 — suporte a inglês e detecção de idioma

## Status

Implementada na branch isolada; integração ainda depende de autorização explícita.

## Contexto

A issue [#19](https://github.com/felipenalves/Dokke/issues/19) pede uma forma de
escolher o idioma e solicita inglês para quem não entende português. A PR #20
do autor da issue implementa uma primeira versão, mas foi aberta sobre um
`main` antigo e não pode ser aplicada por substituição de arquivos: ela remove
ou regride contratos visuais que já existem no `develop`.

Serão reaproveitados somente os insights da PR:

- dicionários explícitos para `pt-BR` e `en`;
- detecção inicial pelo idioma do dispositivo/navegador;
- toggle PT/EN na landing.

## Objetivos

- Disponibilizar inglês em toda a interface funcional do Dokke.
- Manter português brasileiro como idioma padrão do produto.
- Detectar automaticamente o idioma do dispositivo/navegador no PWA e APK.
- Permitir escolha manual e persistente do idioma no app macOS e na landing.
- Traduzir textos estáticos, estados dinâmicos, mensagens de erro,
  confirmações, ações e rótulos de acessibilidade.
- Preservar o layout, os gestos, a autenticação, a sincronização e os contratos
  visuais atuais do `develop`.

## Escopo

### Idiomas e precedência

Os únicos idiomas suportados nesta etapa são:

- `pt-BR`: Português (Brasil);
- `en`: English.

A escolha inicial segue esta ordem:

1. idioma do navegador no PWA/APK/landing ou idioma preferido do sistema no macOS;
2. `pt-BR` quando o ambiente não puder ser lido.

Qualquer idioma que não comece por `pt` cai em inglês na detecção automática.
O PWA/APK não exibe seletor manual: a detecção é refeita ao abrir a interface.
O app macOS e a landing mantêm suas escolhas manuais locais, iniciando pela
detecção automática quando ainda não há preferência salva. Não será criada
sincronização de idioma no servidor.

### PWA e APK

O APK continua usando a mesma interface web; portanto, a tradução do cliente
Android vem do PWA. A camada nativa Android só entra no escopo se a auditoria
encontrar texto visível fora da WebView.

O `public/index.html` terá:

- dicionário PT/EN com as mesmas chaves nos dois idiomas;
- função de detecção baseada em `navigator.language`;
- atualização de `document.documentElement.lang`;
- nenhum controle manual de idioma no shell pré-login ou autenticado;
- o APK reaproveita a mesma detecção porque carrega a interface web na WebView;
- atualização sem recarregar a página de:
  - login e erros de autenticação;
  - dock, apps abertos, estados online/offline e limites;
  - modal de fixar, confirmação de remoção e toasts;
  - drawer do OBS, cenas, gravação, live e confirmação de encerramento;
  - banner de atualização e suas ações;
  - `aria-label`, `aria-labelledby`, títulos e rótulos de controles.

As traduções não receberão nomes de apps, URLs ou mensagens vindas do servidor
como HTML. Valores dinâmicos serão interpolados como texto; quando houver
ênfase visual, a marcação ficará no template, não dentro do dicionário.

### App macOS

O macOS terá uma preferência explícita persistida em `UserDefaults`, com duas
opções visíveis: `Português` e `English`. A detecção do idioma do sistema só
define o valor inicial quando ainda não existe uma escolha salva.

Implementação prevista:

- criar um `LanguageStore` observável, injetado no ambiente do app;
- substituir o `I18n` baseado somente em `Locale.preferredLanguages` por
  traduções dependentes do valor selecionado;
- adicionar o `Picker` de idioma na tela existente de `Conectar`, sem criar uma
  nova navegação ou redesenhar a sidebar;
- fazer todas as views (`Slots`, `Conectar`, picker, dock, menu bar, atualização
  e diálogos) reagirem à troca imediatamente;
- manter mensagens de erro e textos técnicos traduzidos, com nomes de apps,
  URLs, PINs e números fora do dicionário.

Não será usado `NSLocalizedString` nem catálogo de localização nesta etapa:
o produto tem apenas dois idiomas, as strings já são pequenas e o código atual
é SwiftUI sem infraestrutura de recursos localizada.

### Landing/docs e README

Na landing em `docs/`:

- manter a estrutura e o CSS visual atuais;
- detectar o idioma pelo navegador usando `navigator.language` quando não houver
  preferência salva;
- adicionar um toggle PT/EN no header existente e persistir a escolha local;
- traduzir a cópia da página, textos de navegação, FAQ, roadmap e labels;
- manter os links e o conteúdo factual sincronizados entre os idiomas;
- garantir que o toggle não estoure o header em viewport móvel.

No repositório:

- manter `README.md` em português;
- adicionar `README.en.md` em inglês;
- adicionar links de troca entre os dois READMEs;
- não alterar instruções técnicas ou prometer suporte que não exista.

## Contrato de layout

A mudança de idioma não é uma oportunidade para refazer a interface.

- O grid, paginação, safe area, gesto, cards, drawer e modal do PWA permanecem
  com a geometria atual.
- A detecção automática não cria área reservada nem altera o cartão de conexão;
  safe area, teclado Android e viewport móvel continuam com a geometria atual.
- A sidebar, a largura da janela, os semáforos e o canvas do macOS não mudam.
  O `Picker` entra como uma linha na tela `Conectar`.
- O header da landing recebe somente o toggle; nenhuma seção ou animação atual
  será removida para acomodá-lo.

## Critérios de aceitação

- [ ] O PWA/APK detecta `pt-BR` em dispositivo/navegador configurado em português.
- [ ] O PWA/APK detecta inglês em dispositivo/navegador configurado em outro idioma.
- [ ] O PWA/APK não exibe seletor manual e refaz a detecção ao abrir.
- [ ] Todos os fluxos funcionais do PWA têm texto nos dois idiomas, inclusive
      erros, confirmações, toasts e acessibilidade.
- [ ] O macOS oferece `Português` e `English` na tela `Conectar`.
- [ ] A escolha do macOS sobrevive ao relançamento do app e atualiza as views
      observáveis sem reiniciar.
- [ ] A landing detecta PT/EN ao abrir, oferece seletor manual persistente e mantém layout responsivo.
- [ ] README em português e inglês têm links de troca e instruções coerentes.
- [ ] Nenhuma mudança altera autenticação, API, WebSocket, ordenação, limites,
      abertura de apps, OBS ou comportamento de websites.

## Testes e verificação

### Testes automatizados

Adicionar cobertura focada em `test/issue-19-i18n.test.mjs` para:

- paridade de chaves entre os dicionários PT/EN do PWA;
- detecção automática, fallback de idioma e atualização do atributo `lang`;
- ausência de controle manual de idioma no PWA/APK;
- ausência de textos funcionais críticos fora do caminho de tradução;
- paridade de chaves da landing;
- existência do `LanguageStore`, do `Picker` e da persistência no macOS;
- detecção automática, toggle e persistência manual na landing;
- preservação dos seletores/contratos visuais atuais.

Executar, na branch de implementação:

```sh
npm test
cd mac && swift build
cd ../docs && npm run build
git diff --check
```

### Verificação manual

Depois dos testes de código, validar no browser real o PWA e a landing em PT e EN,
incluindo abertura, login, modal, recents, OBS, banner e viewport móvel com safe
area. Na landing, validar a detecção, a troca manual, a persistência e o header
responsivo. No macOS, validar a troca, relançamento e menu bar. A build estática
e os testes de contrato não substituem essa inspeção visual.

## Fora do escopo

- tradução do servidor, API, logs internos ou nomes de apps do usuário;
- novos idiomas além de PT-BR e inglês;
- sincronização de idioma entre dispositivos;
- redesign ou substituição integral dos arquivos atuais pela PR #20;
- merge/aprovação da PR #20;
- commit, push, release ou deploy sem autorização separada.

## Resultado esperado

Issue #19 atendida com uma implementação integrada ao `develop`: inglês
detectado automaticamente no PWA/APK, selecionável e persistente no macOS e
landing, sem perder as alterações visuais e funcionais que já foram construídas
depois da base usada pela PR comunitária.
