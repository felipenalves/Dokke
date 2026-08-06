# J5 Dock — App Android (wrapper WebView)

App fino que carrega a UI do **j5-dock** (já construída em `../public/index.html`) em tela
cheia, sem a chrome do navegador. Reaproveita 100% do front-end — nenhum código da UI é
reescrito.

## O que faz
- WebView em tela cheia/imersiva, fundo preto (#0a0a12) combinando com o app.
- Carrega o servidor do Mac em `http://<ip-do-mac>:3000`.
- Aceita cert local (Tailscale) para não travar em HTTP/self-signed.
- Botão voltar do Android navega para trás dentro do app.
- Tela de "loading" enquanto carrega.
- **Login por código**: o dock pede o pin de 4 dígitos (aba "Sobre" do app Dokke no Mac)
  na primeira conexão; o cookie dura 180 dias.

## Configurar a URL do servidor
Edite `app/src/main/res/values/server_url.xml` com o IP do Mac na sua rede, ou
sobrescreva em runtime pela chave `server_url` em `SharedPreferences("prefs")`.

## Build (precisa de Java + Android SDK)
```sh
cd android
./gradlew assembleDebug            # gera app/build/outputs/apk/debug/app-debug.apk
```
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
