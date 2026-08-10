# Dokke — App Android (wrapper WebView)

App fino que carrega a UI do **Dokke** (já construída em `../public/index.html`) em tela
cheia, sem a chrome do navegador. Reaproveita 100% do front-end — nenhum código da UI é
reescrito.

## O que faz
- WebView em tela cheia/imersiva, fundo preto (#0a0a12) combinando com o app.
- Carrega o servidor do Mac em `http://<ip-do-mac>:3000`.
- Aceita cert local (Tailscale) para não travar em HTTP/self-signed.
- Botão voltar do Android navega para trás dentro do app.
- Tela de "loading" enquanto carrega.
- Aviso de nova versão quando existe uma release mais recente no GitHub.
- Download iniciado somente após o toque do usuário; a instalação passa pelo instalador oficial do Android.
- **Login por código**: o dock pede o pin de 4 dígitos (aba "Sobre" do app Dokke no Mac)
  na primeira conexão; o cookie dura 180 dias.

## Configurar a URL do servidor
Edite `app/src/main/res/values/server_url.xml` com o IP do Mac na sua rede, ou
sobrescreva em runtime pela chave `server_url` em `SharedPreferences("prefs")`.

> **Auto-descoberta**: o app pergunta na rede via UDP broadcast (porta 3001, protocolo
> `dokke:discover`) e o servidor responde com o IP atual. Se o IP do Mac mudar (queda de
> luz, DHCP), o device acha o servidor sozinho e grava a URL nova — o IP do XML é só fallback.

## Build (precisa de Java + Android SDK)
```sh
cd android
./gradlew assembleDebug            # gera app/build/outputs/apk/debug/app-debug.apk
```

### Assinatura de release

`assembleRelease` exige uma keystore externa. O Gradle lê os quatro valores abaixo
por variáveis de ambiente ou por propriedades do Gradle (por exemplo,
`~/.gradle/gradle.properties`, que não deve ser commitado):

```properties
DOKKE_RELEASE_STORE_FILE=/caminho/seguro/dokke-release.keystore
DOKKE_RELEASE_STORE_PASSWORD=...
DOKKE_RELEASE_KEY_ALIAS=dokke
DOKKE_RELEASE_KEY_PASSWORD=...
```

Também é possível exportar os mesmos nomes no ambiente antes do build:

```sh
export DOKKE_RELEASE_STORE_FILE=/caminho/seguro/dokke-release.keystore
export DOKKE_RELEASE_STORE_PASSWORD='...'
export DOKKE_RELEASE_KEY_ALIAS='dokke'
export DOKKE_RELEASE_KEY_PASSWORD='...'
cd android && ./gradlew assembleRelease
```

Sem os quatro valores, o build de release falha claramente. Ele não gera debug
no lugar do release e não há keystore ou segredo no repositório. O arquivo
`../public/dokke.apk` atualmente versionado é um artefato legado assinado com
certificado Debug; não o use como APK de release nem o anexe a uma release.
(Se `./gradlew` não existir, gere com: `gradle wrapper --gradle-version 8.5`.)

## Instalar no J5 (via adb)
```sh
# USB: ative "Depuração USB" em Opções do desenvolvedor e plugue
adb install -r app/build/outputs/apk/debug/app-debug.apk
# Wi-Fi (alternativa):
adb tcpip 5555
adb connect <ip-do-j5>:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> Exigências nesta máquina: JDK 17+ e Android SDK (ANDROID_HOME). Hoje não estão
> instalados (sem `java`, sem `adb`), por isso o build/install fica pendente.
