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
    let value = usagePanelOverrides[language]?[key] ?? (language == .english ? english[key] : portuguese[key])
    return value ?? key
  }

  static func text(_ key: String, language: DokkeLanguage, _ values: [String: String]) -> String {
    values.reduce(text(key, language: language)) { result, pair in
      result.replacingOccurrences(of: "{" + pair.key + "}", with: pair.value)
    }
  }

  static func currentLanguage(defaults: UserDefaults = .standard) -> DokkeLanguage {
    if let saved = defaults.string(forKey: LanguageStore.defaultsKey),
       let language = DokkeLanguage(rawValue: saved) {
      return language
    }
    return Locale.preferredLanguages.first?.lowercased().hasPrefix("pt") == true ? .portuguese : .english
  }

  private static let usagePanelOverrides: [DokkeLanguage: [String: String]] = [
    .portuguese: [
      "usage.title": "Painel de Uso", "usage.online": "Online", "usage.stale": "Desatualizado", "usage.offline": "Offline",
      "usage.syncUnknown": "Sem horário de atualização", "usage.updatedNow": "Atualizado agora", "usage.updatedMinutes": "Atualizado há {value} min",
      "usage.resetLabel": "RESETA", "usage.fiveHourShort": "5 HORAS", "usage.weekShort": "SEMANA", "usage.trend": "Tendência de uso", "usage.trendPeak": "pico {value}", "usage.source": "Fonte: Dokke", "usage.unavailable": "Uso indisponível", "usage.unavailableBody": "Nenhuma fonte local retornou limites utilizáveis.", "usage.provider.claude": "Claude Code", "usage.activitySyncing": "Atualizando limites", "usage.activityWorking": "Processando...", "usage.activityWaiting": "Aguardando ação"
    ],
    .english: [
      "usage.title": "Usage Panel", "usage.online": "Online", "usage.stale": "Stale", "usage.offline": "Offline",
      "usage.syncUnknown": "Update time unavailable", "usage.updatedNow": "Updated now", "usage.updatedMinutes": "Updated {value} min ago",
      "usage.resetLabel": "RESETS", "usage.fiveHourShort": "5 HOURS", "usage.weekShort": "WEEK", "usage.trend": "Usage Trend", "usage.trendPeak": "peak {value}", "usage.source": "Source: Dokke", "usage.unavailable": "Usage unavailable", "usage.unavailableBody": "No local source returned usable limits.", "usage.provider.claude": "Claude Code", "usage.activitySyncing": "Updating limits", "usage.activityWorking": "Processing...", "usage.activityWaiting": "Waiting for action"
    ]
  ]

  private static let portuguese: [String: String] = [
    "aria.language": "Idioma",
    "sidebar.slots": "Slots", "sidebar.usage": "Uso", "sidebar.usageSettings": "Uso", "sidebar.connect": "Conectar", "sidebar.hide": "Ocultar sidebar", "sidebar.show": "Mostrar sidebar",
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
    "update.errorNetwork": "O GitHub não respondeu corretamente.", "update.errorInvalidRelease": "A release não contém um instalador macOS válido.", "update.errorDownload": "Não foi possível baixar a atualização.", "update.errorMissingApp": "O instalador não contém o Dokke.app.", "update.errorNotInstalled": "O Dokke precisa estar instalado como um aplicativo para ser atualizado.", "update.errorPermission": "Sem permissão para atualizar a pasta do Dokke. Mova o app para Aplicativos e tente novamente.", "update.errorChecksum": "A assinatura do download não confere com a release.", "update.errorMount": "Não foi possível montar o instalador.", "update.errorProcess": "Falha ao executar o instalador.",
    "error.PINNED_LIMIT_REACHED": "Limite de 5 páginas atingido", "error.REVISION_CONFLICT": "A configuração mudou; recarregue e tente novamente", "error.MIXED_PIECES_REQUIRES_NEW_CLIENT": "Essa configuração exige um cliente atualizado", "error.INVALID_PIECE_POSITION": "Posição inválida", "error.PIECE_SLOT_OCCUPIED": "Essa posição do dock já está ocupada", "error.INVALID_WEBSITE": "Website inválido", "error.PIECE_NOT_WEBSITE": "A peça não é um website", "error.PIECE_NOT_FOUND": "Peça não encontrada", "error.INVALID_REQUEST": "Solicitação inválida", "error.network": "Não foi possível conectar ao Dokke.", "error.server": "O servidor Dokke retornou um erro.", "error.health": "O servidor Dokke não respondeu corretamente.", "error.pin": "Falha ao fixar o app.", "error.remove": "Falha ao remover.", "error.openWebsite": "Não foi possível abrir o site.", "error.addWebsite": "Não foi possível adicionar o site.", "error.saveOrder": "Não foi possível salvar a ordem.", "error.generateCode": "Não foi possível gerar o código. O servidor está no ar?", "error.invalidURL": "URL inválida", "error.missingNode": "Node ou server.js não foi encontrado. Reinstale o Dokke pelo DMG mais recente.", "error.portConflict": "A porta 3000 já está ocupada por um serviço incompatível.", "error.portUnknown": "A porta 3000 está ocupada, mas o serviço não pôde ser identificado com segurança.", "error.serverExited": "O servidor encerrou inesperadamente. Veja /tmp/dokke-server.log.", "error.start": "Não foi possível iniciar o servidor.", "error.restartLimit": "O servidor falhou várias vezes e foi interrompido. Veja /tmp/dokke-server.log.",
    "sync.sent": "Enviado a {count} dispositivo{suffix}", "sync.savedNoDevice": "Salvo — nenhum dispositivo conectado ainda (abra o Dokke no celular)",
    "usage.title": "Uso", "usage.source": "Fonte: OpenUsage", "usage.localData": "Dados locais", "usage.updated": "atualizado às {time}", "usage.refresh": "Atualizar", "usage.loading": "Lendo limites...", "usage.focusHint": "Acompanhe quanto já foi usado e quando o limite reinicia.", "usage.providers": "Limites monitorados", "usage.unavailable": "OpenUsage indisponível", "usage.unavailableBody": "Inicie o OpenUsage no Mac para o Dokke ler os limites localmente. Nenhum número foi inventado.", "usage.noData": "Sem limite confiável", "usage.noDataBody": "Claude e Codex ainda não retornaram limites utilizáveis.", "usage.normal": "normal", "usage.attention": "atenção", "usage.exhausted": "esgotado", "usage.unknown": "sem dados", "usage.fiveHour": "Janela de 5 horas", "usage.session": "Sessão", "usage.weekly": "Semana", "usage.monthly": "Mês", "usage.credits": "Créditos", "usage.balance": "Saldo", "usage.reset": "reseta", "usage.resetUnknown": "reset desconhecido", "usage.estimated": "estimado", "usage.used": "{value} usado", "usage.usedShort": "usado", "usage.remaining": "restante", "usage.available": "disponível", "usage.moreLimits": "Mais limites", "usage.hideLimits": "Ocultar limites", "usage.provider.claude": "Claude", "usage.provider.codex": "Codex", "usage.pet.energized": "Token está tranquilo", "usage.pet.attentive": "Token está atento", "usage.pet.tired": "Token está cansado", "usage.pet.exhausted": "Token precisa recarregar", "usage.pet.neutral": "Token está aguardando dados", "usage.settingsTitle": "Configurações de uso", "usage.settingsDescription": "Escolha como o painel de uso aparece no PWA e nos dispositivos conectados.", "usage.settingsEnabled": "Mostrar painel de uso", "usage.settingsEnabledDescription": "Quando desativado, a tela de uso e seu indicador não aparecem nos dispositivos.", "usage.settingsProvider": "IA principal", "usage.settingsProviderDescription": "A IA escolhida aparece primeiro no painel de uso.", "usage.settingsDisplay": "Exibir porcentagem como", "usage.settingsDisplayUsed": "Usado", "usage.settingsDisplayRemaining": "Restante", "usage.settingsReset": "Mostrar reinício como", "usage.settingsResetCountdown": "Contagem regressiva", "usage.settingsResetExact": "Data e hora exatas", "usage.settingsSaving": "Salvando preferências…", "usage.settingsSaveError": "Não foi possível salvar as preferências de uso."
  ]

  private static let english: [String: String] = [
    "aria.language": "Language",
    "sidebar.slots": "Slots", "sidebar.usage": "Usage", "sidebar.usageSettings": "Usage", "sidebar.connect": "Connect", "sidebar.hide": "Hide sidebar", "sidebar.show": "Show sidebar",
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
    "update.errorNetwork": "GitHub did not respond correctly.", "update.errorInvalidRelease": "The release does not contain a valid macOS installer.", "update.errorDownload": "The update could not be downloaded.", "update.errorMissingApp": "The installer does not contain Dokke.app.", "update.errorNotInstalled": "Dokke must be installed as an application to update.", "update.errorPermission": "You do not have permission to update Dokke's folder. Move the app to Applications and try again.", "update.errorChecksum": "The download signature does not match the release.", "update.errorMount": "The installer could not be mounted.", "update.errorProcess": "The installer could not be executed.",
    "error.PINNED_LIMIT_REACHED": "Limit of 5 pages reached", "error.REVISION_CONFLICT": "The configuration changed; reload and try again", "error.MIXED_PIECES_REQUIRES_NEW_CLIENT": "This configuration requires an updated client", "error.INVALID_PIECE_POSITION": "Invalid position", "error.PIECE_SLOT_OCCUPIED": "That dock position is already occupied", "error.INVALID_WEBSITE": "Invalid website", "error.PIECE_NOT_WEBSITE": "This piece is not a website", "error.PIECE_NOT_FOUND": "Piece not found", "error.INVALID_REQUEST": "Invalid request", "error.network": "Could not connect to Dokke.", "error.server": "The Dokke server returned an error.", "error.health": "The Dokke server did not respond correctly.", "error.pin": "Failed to pin the app.", "error.remove": "Failed to remove.", "error.openWebsite": "Could not open the website.", "error.addWebsite": "Could not add the website.", "error.saveOrder": "Could not save the order.", "error.generateCode": "Could not generate the code. Is the server running?", "error.invalidURL": "Invalid URL", "error.missingNode": "Node or server.js was not found. Reinstall Dokke from the latest DMG.", "error.portConflict": "Port 3000 is already occupied by an incompatible service.", "error.portUnknown": "Port 3000 is occupied, but the service could not be identified safely.", "error.serverExited": "The server exited unexpectedly. See /tmp/dokke-server.log.", "error.start": "Could not start the server.", "error.restartLimit": "The server failed repeatedly and was stopped. See /tmp/dokke-server.log.",
    "sync.sent": "Sent to {count} device{suffix}", "sync.savedNoDevice": "Saved — no device connected yet (open Dokke on your phone)",
    "usage.title": "Usage", "usage.source": "Source: OpenUsage", "usage.localData": "Local data", "usage.updated": "updated at {time}", "usage.refresh": "Refresh", "usage.loading": "Reading limits...", "usage.focusHint": "Track how much is used and when the limit resets.", "usage.providers": "Monitored limits", "usage.unavailable": "OpenUsage unavailable", "usage.unavailableBody": "Start OpenUsage on the Mac so Dokke can read local limits. No number was invented.", "usage.noData": "No reliable limit", "usage.noDataBody": "Claude and Codex have not returned usable limits yet.", "usage.normal": "normal", "usage.attention": "attention", "usage.exhausted": "exhausted", "usage.unknown": "no data", "usage.fiveHour": "5-hour window", "usage.session": "Session", "usage.weekly": "Weekly", "usage.monthly": "Monthly", "usage.credits": "Credits", "usage.balance": "Balance", "usage.reset": "resets", "usage.resetUnknown": "reset unknown", "usage.estimated": "estimated", "usage.used": "{value} used", "usage.usedShort": "used", "usage.remaining": "remaining", "usage.available": "available", "usage.moreLimits": "More limits", "usage.hideLimits": "Hide limits", "usage.provider.claude": "Claude", "usage.provider.codex": "Codex", "usage.pet.energized": "Token is calm", "usage.pet.attentive": "Token is paying attention", "usage.pet.tired": "Token is tired", "usage.pet.exhausted": "Token needs a recharge", "usage.pet.neutral": "Token is waiting for data", "usage.settingsTitle": "Usage settings", "usage.settingsDescription": "Choose how the usage panel appears in the PWA and connected devices.", "usage.settingsEnabled": "Show usage panel", "usage.settingsEnabledDescription": "When disabled, the usage screen and its indicator are hidden on devices.", "usage.settingsProvider": "Main AI", "usage.settingsProviderDescription": "The selected AI appears first in the usage panel.", "usage.settingsDisplay": "Show percentage as", "usage.settingsDisplayUsed": "Used", "usage.settingsDisplayRemaining": "Remaining", "usage.settingsReset": "Show reset as", "usage.settingsResetCountdown": "Countdown", "usage.settingsResetExact": "Exact date and time", "usage.settingsSaving": "Saving preferences…", "usage.settingsSaveError": "Could not save usage preferences."
  ]
}
