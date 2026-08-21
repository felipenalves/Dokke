import Foundation

enum I18n {
  static var isPortuguese: Bool {
    let lang = Locale.preferredLanguages.first?.lowercased() ?? "en"
    return lang.hasPrefix("pt")
  }

  // Sidebar
  static var sidebarApps: String { isPortuguese ? "Apps" : "Apps" }
  static var sidebarAbout: String { isPortuguese ? "Sobre" : "About" }

  // AboutView / Status
  static var aboutTitle: String { isPortuguese ? "Sobre" : "About" }
  static var serverOnline: String { isPortuguese ? "Servidor Online" : "Server Online" }
  static var serverOffline: String { isPortuguese ? "Servidor Offline" : "Server Offline" }
  static var devicesWS: String { isPortuguese ? "Dispositivos (WS)" : "Devices (WS)" }
  static var pinnedApps: String { isPortuguese ? "Apps Fixados" : "Pinned Apps" }
  static var openOnOtherDevice: String { isPortuguese ? "Abrir em outro dispositivo" : "Open on another device" }
  static var scanOrOpenAddress: String { isPortuguese ? "Escaneie ou abra este endereço" : "Scan or open this address" }
  static var copyURL: String { isPortuguese ? "Copiar URL" : "Copy URL" }
  static var open: String { isPortuguese ? "Abrir" : "Open" }
  static var helpAndroidNetwork: String {
    isPortuguese
      ? "Android, iPad e navegadores: use o QR code ou copie a URL. O Mac e o dispositivo precisam estar na mesma rede."
      : "Android, iPad, and browsers: scan the QR code or copy the URL. The Mac and device must be on the same network."
  }
  static var helpPwaTunnel: String {
    isPortuguese
      ? "iPhone/iPad como PWA: use uma URL HTTPS do túnel indicado no tutorial antes de adicionar à Tela de Início."
      : "iPhone/iPad as PWA: use an HTTPS tunnel URL from the tutorial before adding to Home Screen."
  }
  static var noNetworkIP: String {
    isPortuguese ? "Sem IP de rede detectado (offline?)" : "No network IP detected (offline?)"
  }
  static var updates: String { isPortuguese ? "Atualizações" : "Updates" }
  static func installedVersion(_ ver: String) -> String {
    isPortuguese ? "Versão instalada: \(ver)" : "Installed version: \(ver)"
  }
  static func newVersion(_ tag: String) -> String {
    isPortuguese ? "Nova versão \(tag)" : "New version \(tag)"
  }
  static var changes: String { isPortuguese ? "Mudanças" : "Release Notes" }
  static var downloadAndInstall: String { isPortuguese ? "Baixar e instalar" : "Download and install" }
  static var checkAgain: String { isPortuguese ? "Verificar novamente" : "Check again" }
  static var accessCode: String { isPortuguese ? "Código de acesso" : "Access code" }
  static var generateNewCode: String { isPortuguese ? "Gerar novo código" : "Generate new code" }
  static var typeOnDeviceHint: String {
    isPortuguese
      ? "Digite no dispositivo (Android, iPhone) para acessar o dock."
      : "Enter on device (Android, iPhone) to access the dock."
  }
  static var serverAutoStarts: String {
    isPortuguese
      ? "O servidor inicia automaticamente ao abrir o Dokke."
      : "The server starts automatically when opening Dokke."
  }
  static var refresh: String { isPortuguese ? "Atualizar" : "Refresh" }

  // UpdateBanner
  static var newUpdateAvailable: String {
    isPortuguese ? "Nova atualização disponível" : "New update available"
  }
  static func readyToDownload(_ tag: String) -> String {
    isPortuguese
      ? "Dokke \(tag) está pronto para baixar e instalar."
      : "Dokke \(tag) is ready to download and install."
  }
  static var downloading: String { isPortuguese ? "Baixando..." : "Downloading..." }
  static var installing: String { isPortuguese ? "Instalando..." : "Installing..." }

  // ReleaseNotesView
  static var whatChanged: String { isPortuguese ? "O que mudou" : "What's New" }
  static var close: String { isPortuguese ? "Fechar" : "Close" }

  // MenuBarView
  static var dokkeOnline: String { isPortuguese ? "Dokke online" : "Dokke online" }
  static var dokkeOffline: String { isPortuguese ? "Dokke offline" : "Dokke offline" }
  static func menuDevices(devices: Int, pinned: Int) -> String {
    isPortuguese
      ? "Dispositivos: \(devices) · Fixados: \(pinned)"
      : "Devices: \(devices) · Pinned: \(pinned)"
  }
  static var quit: String { isPortuguese ? "Sair" : "Quit" }

  // DockGridView
  static var pinnedAppsTitle: String { isPortuguese ? "Apps fixados" : "Pinned Apps" }
  static var add: String { isPortuguese ? "Adicionar" : "Add" }
  static var addAppsHelp: String { isPortuguese ? "Adicionar apps ao dock" : "Add apps to dock" }
  static var noPinnedApps: String { isPortuguese ? "Nenhum app fixado" : "No pinned apps" }
  static var clickPlusToAdd: String {
    isPortuguese ? "Clique em + para adicionar apps ao dock" : "Click + to add apps to the dock"
  }
  static var addAppsButton: String { isPortuguese ? "Adicionar Apps" : "Add Apps" }
  static var offlineServerDesc: String {
    isPortuguese
      ? "Inicie o servidor Dokke e verifique o URL em About."
      : "Start the Dokke server and check the URL in About."
  }

  // AppPickerSheet
  static var addAppsSheetTitle: String { isPortuguese ? "Adicionar Apps" : "Add Apps" }
  static var done: String { isPortuguese ? "Concluir" : "Done" }
  static var searchAppsPlaceholder: String { isPortuguese ? "Buscar apps..." : "Search apps..." }
  static var noAppsFound: String { isPortuguese ? "Nenhum app encontrado" : "No apps found" }
  static var noResults: String { isPortuguese ? "Sem resultados" : "No results" }
  static var noInstalledAppsDesc: String {
    isPortuguese ? "O servidor não retornou apps instalados." : "Server did not return installed apps."
  }
  static var tryDifferentSearch: String {
    isPortuguese ? "Tente uma busca diferente." : "Try a different search."
  }
  static var added: String { isPortuguese ? "Adicionado" : "Added" }

  // DockIcon
  static var removeFromDock: String { isPortuguese ? "Remover do Dock" : "Remove from Dock" }

  // DokkeUpdateManager
  static var checkingUpdates: String { isPortuguese ? "Verificando atualizações..." : "Checking for updates..." }
  static var newVersionAvailable: String { isPortuguese ? "Nova versão disponível." : "New version available." }
  static var downloadingUpdate: String { isPortuguese ? "Baixando a atualização..." : "Downloading update..." }
  static var installingUpdate: String { isPortuguese ? "Instalando a atualização..." : "Installing update..." }
  static var upToDate: String { isPortuguese ? "Você está na versão mais recente." : "You are on the latest version." }
  static var noReleaseNotes: String { isPortuguese ? "Sem notas de versão." : "No release notes." }
  static var gitHubBadResponse: String {
    isPortuguese ? "O GitHub não respondeu corretamente." : "GitHub did not respond properly."
  }
  static var invalidMacRelease: String {
    isPortuguese
      ? "A release não contém um instalador macOS válido."
      : "The release does not contain a valid macOS installer."
  }
  static var downloadFailed: String {
    isPortuguese ? "Não foi possível baixar a atualização." : "Could not download update."
  }
  static var dmgNoApp: String {
    isPortuguese ? "O instalador não contém o Dokke.app." : "The installer does not contain Dokke.app."
  }
  static var mustBeInstalledApp: String {
    isPortuguese
      ? "O Dokke precisa estar instalado como um aplicativo para ser atualizado."
      : "Dokke must be installed as an application to be updated."
  }
  static var noPermissionUpdate: String {
    isPortuguese
      ? "Sem permissão para atualizar a pasta do Dokke. Mova o app para Aplicativos e tente novamente."
      : "No permission to update Dokke folder. Move the app to Applications and try again."
  }
}
