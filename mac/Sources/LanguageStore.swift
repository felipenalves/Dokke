import Foundation
import Combine

enum DokkeLanguage: String, CaseIterable, Identifiable {
  case portuguese = "pt-BR"
  case english = "en"

  var id: String { rawValue }
  var displayName: String {
    switch self {
    case .portuguese: return "Português"
    case .english: return "English"
    }
  }
}

final class LanguageStore: ObservableObject {
  static let defaultsKey = "dokke_language"

  @Published private(set) var selected: DokkeLanguage
  private let defaults: UserDefaults

  init(defaults: UserDefaults = .standard, preferredLanguages: [String] = Locale.preferredLanguages) {
    self.defaults = defaults
    if let saved = defaults.string(forKey: Self.defaultsKey),
       let language = DokkeLanguage(rawValue: saved) {
      selected = language
    } else if preferredLanguages.first?.lowercased().hasPrefix("pt") == true {
      selected = .portuguese
    } else {
      selected = .english
    }
  }

  func select(_ language: DokkeLanguage) {
    guard selected != language else {
      defaults.set(language.rawValue, forKey: Self.defaultsKey)
      return
    }
    selected = language
    defaults.set(language.rawValue, forKey: Self.defaultsKey)
  }
}

enum I18n {
  static func text(_ key: String, language: DokkeLanguage) -> String {
    let value = language == .english ? english[key] : portuguese[key]
    return value ?? key
  }

  static func text(_ key: String, language: DokkeLanguage, _ values: [String: String]) -> String {
    values.reduce(text(key, language: language)) { result, pair in
      result.replacingOccurrences(of: "{" + pair.key + "}", with: pair.value)
    }
  }

  private static let portuguese: [String: String] = [
    "aria.language": "Idioma",
    "sidebar.slots": "Slots", "sidebar.connect": "Conectar", "sidebar.hide": "Ocultar sidebar", "sidebar.show": "Mostrar sidebar",
    "sidebar.selected": "Selecionado", "connect.title": "Conectar outro dispositivo", "connect.description": "Use o código abaixo no app ou navegador que você quer conectar ao Dokke.",
    "connect.accessCode": "Código de acesso", "connect.openOther": "Abrir em outro dispositivo", "connect.scan": "Escaneie ou abra este endereço",
    "connect.copyURL": "Copiar URL", "connect.open": "Abrir", "connect.network": "O Mac e o dispositivo precisam estar na mesma rede. Para iPhone/iPad, use uma URL HTTPS do túnel antes de adicionar à Tela de Início.",
    "connect.noIP": "Sem IP de rede detectado (offline?)", "connect.online": "Servidor online", "connect.offline": "Servidor offline", "connect.devices": "{count} dispositivos", "connect.pinned": "{count} fixados",
    "updates.title": "Atualizações", "updates.new": "Nova versão {version}", "updates.changes": "Mudanças", "updates.install": "Baixar e instalar", "updates.installed": "Versão instalada: {version}", "updates.check": "Verificar atualizações",
    "confirm.newCode": "Gerar novo código?", "confirm.newCodeAction": "Gerar novo código", "confirm.cancel": "Cancelar", "confirm.newCodeMessage": "Os dispositivos conectados precisarão digitar o novo código.",
    "accessCode.instruction": "Digite este código no dispositivo conectado", "release.changed": "O que mudou", "release.close": "Fechar",
    "menu.device": "Dispositivo: {count}", "menu.pinned": "Fixados: {count}", "menu.open": "Abrir Dokke", "menu.sync": "Sincronizar agora", "menu.update": "Atualização {version} disponível", "menu.quit": "Sair", "menu.version": "Versão {version}",
    "grid.drag": "Arraste para mover um ícone de posição.", "grid.page": "Página {page}", "grid.reorder.done": "Concluir", "grid.reorder": "Reorganizar apps", "grid.reorderHelp": "Concluir reorganização", "grid.offline": "Servidor Offline", "grid.offlineDescription": "Inicie o servidor Dokke e verifique a conexão na aba Conectar.",
    "grid.add": "Adicionar app na posição {position}", "grid.move": "Mover app para a posição {position}", "grid.limit": "Limite de 5 páginas atingido", "grid.addHere": "Adicionar app nesta posição",
    "picker.type": "Tipo de peça", "picker.apps": "Apps", "picker.websites": "Website Links", "picker.close": "Fechar", "picker.addApps": "Adicionar Apps", "picker.addLinks": "Adicionar links ao dock", "picker.library": "App Library", "picker.search": "Buscar apps...", "picker.limit": "Limite de 5 páginas atingido. Remova uma peça para adicionar outra.", "picker.loading": "Carregando apps…", "picker.none": "Nenhum app encontrado", "picker.noResults": "Sem resultados", "picker.serverEmpty": "O servidor não retornou apps instalados.", "picker.searchDifferent": "Tente uma busca diferente.", "picker.url": "https://exemplo.com", "picker.add": "Adicionar", "picker.suggestions": "Sugestões", "picker.added": "Adicionado", "picker.nameHint": "Vamos dar um nome curto para o seu weblink.", "picker.siteName": "Nome do site",
    "icon.remove": "Remover", "icon.removeWebsite": "Remover site fixado", "icon.removeApp": "Remover app fixado", "icon.move": "Mover", "icon.removeDock": "Remover do Dock",
    "update.checking": "Verificando atualizações...", "update.available": "Nova versão disponível.", "update.downloading": "Baixando a atualização...", "update.installing": "Instalando a atualização...", "update.current": "Você está na versão mais recente.",
    "update.errorNetwork": "O GitHub não respondeu corretamente.", "update.errorInvalidRelease": "A release não contém um instalador macOS válido.", "update.errorDownload": "Não foi possível baixar a atualização.", "update.errorMissingApp": "O instalador não contém o Dokke.app.", "update.errorNotInstalled": "O Dokke precisa estar instalado como um aplicativo para ser atualizado.", "update.errorPermission": "Sem permissão para atualizar a pasta do Dokke. Mova o app para Aplicativos e tente novamente.", "update.errorChecksum": "A assinatura do download não confere com a release.", "update.errorMount": "Não foi possível montar o instalador.", "update.errorProcess": "Falha ao executar o instalador."
  ]

  private static let english: [String: String] = [
    "aria.language": "Language",
    "sidebar.slots": "Slots", "sidebar.connect": "Connect", "sidebar.hide": "Hide sidebar", "sidebar.show": "Show sidebar",
    "sidebar.selected": "Selected", "connect.title": "Connect another device", "connect.description": "Use the code below in the app or browser you want to connect to Dokke.",
    "connect.accessCode": "Access code", "connect.openOther": "Open on another device", "connect.scan": "Scan or open this address",
    "connect.copyURL": "Copy URL", "connect.open": "Open", "connect.network": "Your Mac and device must be on the same network. For iPhone/iPad, use an HTTPS tunnel URL before adding it to the Home Screen.",
    "connect.noIP": "No network IP detected (offline?)", "connect.online": "Server online", "connect.offline": "Server offline", "connect.devices": "{count} devices", "connect.pinned": "{count} pinned",
    "updates.title": "Updates", "updates.new": "New version {version}", "updates.changes": "Changes", "updates.install": "Download and install", "updates.installed": "Installed version: {version}", "updates.check": "Check for updates",
    "confirm.newCode": "Generate a new code?", "confirm.newCodeAction": "Generate new code", "confirm.cancel": "Cancel", "confirm.newCodeMessage": "Connected devices will need to enter the new code.",
    "accessCode.instruction": "Enter this code on the connected device", "release.changed": "What changed", "release.close": "Close",
    "menu.device": "Device: {count}", "menu.pinned": "Pinned: {count}", "menu.open": "Open Dokke", "menu.sync": "Sync now", "menu.update": "Update {version} available", "menu.quit": "Quit", "menu.version": "Version {version}",
    "grid.drag": "Drag to move an icon.", "grid.page": "Page {page}", "grid.reorder.done": "Done", "grid.reorder": "Reorder apps", "grid.reorderHelp": "Finish reordering", "grid.offline": "Server Offline", "grid.offlineDescription": "Start the Dokke server and check the connection in the Connect tab.",
    "grid.add": "Add app at position {position}", "grid.move": "Move app to position {position}", "grid.limit": "Limit of 5 pages reached", "grid.addHere": "Add app in this position",
    "picker.type": "Piece type", "picker.apps": "Apps", "picker.websites": "Website Links", "picker.close": "Close", "picker.addApps": "Add Apps", "picker.addLinks": "Add links to dock", "picker.library": "App Library", "picker.search": "Search apps...", "picker.limit": "Limit of 5 pages reached. Remove a piece to add another.", "picker.loading": "Loading apps…", "picker.none": "No app found", "picker.noResults": "No results", "picker.serverEmpty": "The server returned no installed apps.", "picker.searchDifferent": "Try a different search.", "picker.url": "https://example.com", "picker.add": "Add", "picker.suggestions": "Suggestions", "picker.added": "Added", "picker.nameHint": "Let's give your weblink a short name.", "picker.siteName": "Site name",
    "icon.remove": "Remove", "icon.removeWebsite": "Remove pinned site", "icon.removeApp": "Remove pinned app", "icon.move": "Move", "icon.removeDock": "Remove from Dock",
    "update.checking": "Checking for updates...", "update.available": "New version available.", "update.downloading": "Downloading update...", "update.installing": "Installing update...", "update.current": "You are up to date.",
    "update.errorNetwork": "GitHub did not respond correctly.", "update.errorInvalidRelease": "The release does not contain a valid macOS installer.", "update.errorDownload": "The update could not be downloaded.", "update.errorMissingApp": "The installer does not contain Dokke.app.", "update.errorNotInstalled": "Dokke must be installed as an application to update.", "update.errorPermission": "You do not have permission to update Dokke's folder. Move the app to Applications and try again.", "update.errorChecksum": "The download signature does not match the release.", "update.errorMount": "The installer could not be mounted.", "update.errorProcess": "The installer could not be executed."
  ]
}
