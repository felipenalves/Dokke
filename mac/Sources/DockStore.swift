import AppKit
import Foundation
import SwiftUI

struct InstalledApp: Identifiable, Hashable {
  var id: String { name }
  let name: String
  let path: String?
  let icon: Bool
}

@MainActor
final class DockStore: ObservableObject {
  @Published var baseURL: String = UserDefaults.standard.string(forKey: "j5.baseURL") ?? "http://127.0.0.1:3000" {
    didSet {
      let trimmed = Self.normalizeBase(baseURL)
      if trimmed != baseURL { baseURL = trimmed; return }
      UserDefaults.standard.set(baseURL, forKey: "j5.baseURL")
      debounceRefresh()
    }
  }
  @Published var online = false
  @Published var lastError: String?
  @Published var lastSyncNote: String?
  /// Fonte de verdade tipada do dock. `pinned` permanece como projeção legada.
  @Published private(set) var pieces: [DockPiece] = []
  @Published private(set) var revision = 0
  @Published var pinned: [String] = []
  @Published var installed: [InstalledApp] = []
  @Published private(set) var installedReady = false
  @Published private(set) var installedLoading = false
  @Published var filter = ""
  @Published var loading = false
  @Published var devices = 0
  @Published var busyName: String?
  @Published var pinCode: String?
  @Published var pinError: String?
  @Published var maxPinnedApps: Int = 40
  @Published var maxPinnedPieces: Int = 40

  private var timer: Timer?
  private var refreshTask: Task<Void, Never>?
  private var iconCache: [String: Image] = [:]
  private var nativeIconCache: [String: NSImage] = [:]
  private var iconAppearanceObservers: [NSObjectProtocol] = []
  private var appAppearanceObservation: NSKeyValueObservation?
  @Published private(set) var iconAppearanceRevision = 0

  /// Evita disparar refreshAll a cada tecla digitada no campo Base URL (aba Sobre).
  private func debounceRefresh() {
    refreshTask?.cancel()
    refreshTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 600_000_000)
      guard !Task.isCancelled else { return }
      await self?.refreshAll()
    }
  }
  private let session: URLSession = {
    let c = URLSessionConfiguration.ephemeral
    c.timeoutIntervalForRequest = 4
    c.timeoutIntervalForResource = 8
    c.waitsForConnectivity = false
    return URLSession(configuration: c)
  }()

  init() {
    baseURL = Self.normalizeBase(baseURL)
    observeIconAppearanceChanges()
    Task { [weak self] in
      try? await Task.sleep(nanoseconds: 300_000_000)
      guard !Task.isCancelled else { return }
      await self?.refreshAll()
    }
    // health + devices: leve e frequente p/ feedback de “dispositivos conectados”
    timer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: true) { [weak self] _ in
      Task { @MainActor in await self?.pingStatus() }
    }
  }

  deinit {
    timer?.invalidate()
    for observer in iconAppearanceObservers {
      NSWorkspace.shared.notificationCenter.removeObserver(observer)
    }
    appAppearanceObservation?.invalidate()
  }

  private func observeIconAppearanceChanges() {
    let names = [
      Notification.Name("NSWorkspaceIconAppearanceConfigurationDidChangeNotification"),
      Notification.Name("_NSWorkspaceIconAppearanceConfigurationDidChangeNotification")
    ]
    iconAppearanceObservers = names.map { name in
      NSWorkspace.shared.notificationCenter.addObserver(
        forName: name,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        Task { @MainActor [weak self] in
          self?.invalidateNativeIcons()
        }
      }
    }

    appAppearanceObservation = NSApplication.shared.observe(
      \NSApplication.effectiveAppearance,
      options: [.new]
    ) { [weak self] _, _ in
      Task { @MainActor [weak self] in
        self?.invalidateNativeIcons()
      }
    }
  }

  private func invalidateNativeIcons() {
    nativeIconCache.removeAll(keepingCapacity: true)
    iconAppearanceRevision &+= 1
    preloadIcons()
  }

  static func normalizeBase(_ raw: String) -> String {
    var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    while s.hasSuffix("/") { s.removeLast() }
    if s.isEmpty { return "http://127.0.0.1:3000" }
    return s
  }

  private var language: DokkeLanguage { I18n.currentLanguage() }

  private func localizedServerError(_ object: [String: Any]?, fallbackKey: String) -> String {
    if let code = object?["code"] as? String {
      let key = "error.\(code)"
      let translated = I18n.text(key, language: language)
      if translated != key { return translated }
    }
    return I18n.text(fallbackKey, language: language)
  }

  var filteredInstalled: [InstalledApp] {
    let q = filter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    // pinados primeiro, depois o resto (config rápida)
    let sorted = installed.sorted { a, b in
      let pa = isPinned(a.name)
      let pb = isPinned(b.name)
      if pa != pb { return pa && !pb }
      return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
    }
    if q.isEmpty { return sorted }
    return sorted.filter { $0.name.lowercased().contains(q) }
  }

  func isPinned(_ name: String) -> Bool {
    pieces.contains { $0.type == .app && $0.name == name }
  }

  var isPinnedLimitReached: Bool {
    pieces.count >= maxPinnedPieces
  }

  func isPiecePinned(_ id: String) -> Bool {
    pieces.contains { $0.id == id }
  }

  private var firstAvailablePosition: Int {
    let occupied = Set(pieces.map(\.position))
    return (0..<40).first { !occupied.contains($0) } ?? 0
  }

  private func applyPinnedLimits(_ object: [String: Any]?) {
    guard let limits = object?["limits"] as? [String: Any],
          let max = (limits["maxPinnedPieces"] as? Int) ?? (limits["maxPinnedApps"] as? Int),
          max > 0 else { return }
    if maxPinnedApps != max { maxPinnedApps = max }
    if maxPinnedPieces != max { maxPinnedPieces = max }
  }

  private func decodePieces(_ raw: Any?, fallback: [String] = []) -> [DockPiece] {
    if let rawPieces = raw as? [[String: Any]] {
      return rawPieces.enumerated().compactMap { index, object in
        DockPiece(json: object, fallbackPosition: index)
      }.sorted { $0.position < $1.position }
    }
    return fallback.enumerated().map { DockPiece.app($0.element, position: $0.offset) }
  }

  private func applyConfig(_ cfg: [String: Any]) {
    let p = cfg["pinned"] as? [String] ?? []
    let pinnedChanged = pinned != p
    let nextPieces = decodePieces(cfg["pieces"], fallback: p)
    if pieces != nextPieces { pieces = nextPieces }
    let nextRevision = (cfg["revision"] as? Int) ?? (cfg["revision"] as? Double).map(Int.init) ?? 0
    if revision != nextRevision { revision = nextRevision }
    // Mantém a projeção antiga para clientes/trechos que ainda a consomem.
    if pinnedChanged {
      pinned = p
      preloadIcons()
    }
    applyPinnedLimits(cfg)
  }

  func refreshAll() async {
    loading = true
    defer { loading = false }
    await pingStatus()
    guard online else { return }
    await loadConfig()
    await loadInstalled()
    await loadPin()
  }

  /// Código de acesso de 4 dígitos exibido na aba Sobre — só acessível de loopback.
  func loadPin() async {
    guard let url = URL(string: baseURL + "/api/pin") else { return }
    do {
      let (data, resp) = try await session.data(from: url)
      guard (resp as? HTTPURLResponse)?.statusCode == 200,
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let p = obj["pin"] as? String else { pinCode = nil; return }
      pinCode = p
    } catch { pinCode = nil }
  }

  /// Regenera o código — o device precisará digitar o novo (cookie antigo vira 401 → wall).
  func resetPin() async {
    pinError = nil
    guard let url = URL(string: baseURL + "/api/pin") else {
      pinError = I18n.text("error.invalidURL", language: language)
      return
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.timeoutInterval = 4
    do {
      let (data, resp) = try await session.data(for: req)
      guard (resp as? HTTPURLResponse)?.statusCode == 200,
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let p = obj["pin"] as? String else {
        pinError = I18n.text("error.generateCode", language: language)
        return
      }
      pinCode = p
    } catch {
      pinError = I18n.text("error.network", language: language)
    }
  }

  /// Health + contagem de devices no WS (devices escutando).
  func pingStatus() async {
    guard let url = URL(string: baseURL + "/api/status") else {
      // fallback health
      await pingHealthOnly()
      return
    }
    do {
      let (data, resp) = try await session.data(from: url)
      guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
        // servidor antigo sem /api/status
        await pingHealthOnly()
        return
      }
      guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            (obj["ok"] as? Bool) == true else {
        if online { online = false }
        let message = I18n.text("error.health", language: language)
        if lastError != message { lastError = message }
        return
      }
      if online != true { online = true }
      if lastError != nil { lastError = nil }
      // O primeiro refresh pode acontecer antes de o servidor terminar de subir.
      // O timer continua chamando este método; aproveite a primeira resposta
      // válida para preencher o código sem exigir sincronização manual.
      if pinCode == nil {
        await loadPin()
      }
      if !installedReady {
        await loadInstalled()
      }
      let nextDevices: Int?
      if let d = obj["devices"] as? Int { nextDevices = d }
      else if let d = obj["devices"] as? Double { nextDevices = Int(d) }
      else { nextDevices = nil }
      if let nextDevices, devices != nextDevices { devices = nextDevices }
      if let cfg = obj["config"] as? [String: Any], let p = cfg["pinned"] as? [String] {
        let pinnedChanged = pinned != p
        if pinnedChanged {
          pinned = p
          preloadIcons()
        }
        applyConfig(cfg)
      }
    } catch {
      await pingHealthOnly()
    }
  }

  private func pingHealthOnly() async {
    guard let url = URL(string: baseURL + "/health") else {
      if online { online = false }
      let message = I18n.text("error.invalidURL", language: language)
      if lastError != message { lastError = message }
      return
    }
    do {
      let (data, resp) = try await session.data(from: url)
      guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
        if online { online = false }
        let message = I18n.text("error.network", language: language)
        if lastError != message { lastError = message }
        return
      }
      if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
         (obj["ok"] as? Bool) == true {
        if online != true { online = true }
        if lastError != nil { lastError = nil }
      } else {
        if online { online = false }
        let message = I18n.text("error.health", language: language)
        if lastError != message { lastError = message }
      }
    } catch {
      if online { online = false }
      let message = I18n.text("error.network", language: language)
      if lastError != message { lastError = message }
    }
  }

  func loadConfig() async {
    guard let url = URL(string: baseURL + "/api/config") else { return }
    do {
      let (data, _) = try await session.data(from: url)
      guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let cfg = obj["config"] as? [String: Any] else { return }
      let p = cfg["pinned"] as? [String] ?? []
      if pinned != p { pinned = p }
      applyConfig(cfg)
    } catch {
      lastError = I18n.text("error.network", language: language)
    }
  }

  func loadInstalled() async {
    guard !installedLoading else { return }
    guard let url = URL(string: baseURL + "/api/apps/installed") else { return }
    installedLoading = true
    defer { installedLoading = false }
    do {
      let (data, _) = try await session.data(from: url)
      guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let apps = obj["apps"] as? [[String: Any]] else { return }
      let nextInstalled: [InstalledApp] = apps.compactMap { a in
        guard let name = a["name"] as? String else { return nil }
        return InstalledApp(
          name: name,
          path: a["path"] as? String,
          icon: (a["icon"] as? Bool) ?? true
        )
      }
      installedReady = true
      if installed != nextInstalled {
        installed = nextInstalled
        nativeIconCache.removeAll(keepingCapacity: true)
        preloadIcons()
      }
    } catch {
      lastError = I18n.text("error.network", language: language)
    }
  }

  func togglePin(_ name: String) async {
    if isPinned(name) {
      await unpin(name)
    } else {
      await pin(name)
    }
  }

  func pin(_ name: String) async {
    await pin(name, at: firstAvailablePosition)
  }

  /// Fixa um app no slot exato escolhido pelo usuário; os demais slots não mudam.
  func pin(_ name: String, at index: Int) async {
    guard !isPinned(name) else { return }
    if isPinnedLimitReached {
      lastError = I18n.text("error.PINNED_LIMIT_REACHED", language: language)
      lastSyncNote = lastError
      return
    }
    await pin(name, position: min(max(index, 0), 39))
  }

  private func pin(_ name: String, position: Int) async {
    // otimista: UI reage na hora; server empurra pros devices via WS
    let prev = pieces
    pieces.append(.app(name, position: position))
    pieces.sort { $0.position < $1.position }
    pinned = pieces.compactMap(\.appName)
    lastError = nil
    busyName = name
    defer { busyName = nil }
    guard let url = URL(string: baseURL + "/api/config/pinned") else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["app": name, "position": position])
    req.timeoutInterval = 4
    do {
      let (data, resp) = try await session.data(for: req)
      let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      if code == 409, let body = obj, body["code"] as? String == "PINNED_LIMIT_REACHED" {
        pieces = prev
        pinned = pieces.compactMap(\.appName)
        applyPinnedLimits(body)
        let message = localizedServerError(body, fallbackKey: "error.pin")
        lastError = message
        lastSyncNote = message
        return
      }
      guard code == 200,
            let body = obj,
            (body["ok"] as? Bool) == true else {
        pieces = prev
        pinned = pieces.compactMap(\.appName)
        lastError = localizedServerError(obj, fallbackKey: "error.pin")
        lastSyncNote = nil
        return
      }
      lastError = nil
      if let cfg = body["config"] as? [String: Any] { applyConfig(cfg) }
      await afterPinPush()
    } catch {
      pieces = prev
      pinned = pieces.compactMap(\.appName)
      lastError = I18n.text("error.network", language: language)
      lastSyncNote = nil
    }
  }

  func unpin(_ name: String) async {
    if name.hasPrefix("website:") {
      await removePiece(name)
      return
    }
    let prev = pieces
    pieces.removeAll { $0.type == .app && $0.name == name }
    pinned = pieces.compactMap(\.appName)
    busyName = name
    defer { busyName = nil }
    let enc = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
    guard let url = URL(string: baseURL + "/api/config/pinned/" + enc) else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "DELETE"
    req.timeoutInterval = 4
    do {
      let (data, resp) = try await session.data(for: req)
      let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
      guard code == 200,
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            (obj["ok"] as? Bool) == true else {
        pieces = prev
        pinned = pieces.compactMap(\.appName)
        lastError = localizedServerError(nil, fallbackKey: "error.remove")
        lastSyncNote = nil
        return
      }
      if let cfg = obj["config"] as? [String: Any] { applyConfig(cfg) }
      await afterPinPush()
    } catch {
      pieces = prev
      pinned = pieces.compactMap(\.appName)
      lastError = I18n.text("error.network", language: language)
      lastSyncNote = nil
    }
  }

  func reorderPinned(from source: IndexSet, to destination: Int) {
    var next = pieces
    next.move(fromOffsets: source, toOffset: destination)
    pieces = next
    pinned = pieces.compactMap(\.appName)
    Task { await savePinnedOrder() }
  }

  @discardableResult
  private func savePinnedOrder() async -> Bool {
    guard let url = URL(string: baseURL + "/api/config/pieces/order") else { return false }
    var req = URLRequest(url: url)
    req.httpMethod = "PUT"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["revision": revision, "ids": pieces.map(\.id)])
    req.timeoutInterval = 4
    do {
      let (data, resp) = try await session.data(for: req)
      let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
      let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      guard code == 200,
            let object,
            (object["ok"] as? Bool) == true else {
        lastError = code == 409
          ? localizedServerError(object, fallbackKey: "error.REVISION_CONFLICT")
          : localizedServerError(object, fallbackKey: "error.saveOrder")
        if let cfg = object?["config"] as? [String: Any] { applyConfig(cfg) }
        return false
      }
      if let cfg = object["config"] as? [String: Any] { applyConfig(cfg) }
      return true
    } catch {
      lastError = I18n.text("error.network", language: language)
      return false
    }
  }

  /// Persiste a ordem atual dos favoritos no servidor (chamado ao soltar o drag).
  func persistPinnedOrder() async {
    await savePinnedOrder()
  }

  func addWebsite(title: String?, url: String, at index: Int? = nil) async {
    lastError = nil
    busyName = url
    defer { busyName = nil }
    guard let endpoint = URL(string: baseURL + "/api/config/pieces") else { return }
    let targetPosition = index ?? firstAvailablePosition
    var req = URLRequest(url: endpoint)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: [
      "type": "website", "title": title ?? "", "url": url,
      "position": min(max(targetPosition, 0), 39),
    ])
    req.timeoutInterval = 4
    do {
      let (data, response) = try await session.data(for: req)
      let code = (response as? HTTPURLResponse)?.statusCode ?? 0
      guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
      guard code == 200, let cfg = object["config"] as? [String: Any], let pieceObject = object["piece"] as? [String: Any], DockPiece(json: pieceObject) != nil else {
        lastError = localizedServerError(object, fallbackKey: "error.addWebsite")
        return
      }
      applyConfig(cfg)
      await afterPinPush()
    } catch { lastError = I18n.text("error.network", language: language) }
  }

  func removePiece(_ id: String) async {
    guard let endpoint = URL(string: baseURL + "/api/config/pieces/" + (id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)) else { return }
    var req = URLRequest(url: endpoint)
    req.httpMethod = "DELETE"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["revision": revision])
    req.timeoutInterval = 4
    do {
      let (data, response) = try await session.data(for: req)
      let code = (response as? HTTPURLResponse)?.statusCode ?? 0
      guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
      if let cfg = object["config"] as? [String: Any] { applyConfig(cfg) }
      if code != 200 { lastError = localizedServerError(object, fallbackKey: "error.remove"); return }
      await afterPinPush()
    } catch { lastError = I18n.text("error.network", language: language) }
  }

  func openWebsite(_ id: String) async {
    guard let endpoint = URL(string: baseURL + "/api/pieces/" + (id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id) + "/open") else { return }
    var req = URLRequest(url: endpoint)
    req.httpMethod = "POST"
    req.timeoutInterval = 4
    do {
      let (data, response) = try await session.data(for: req)
      guard (response as? HTTPURLResponse)?.statusCode == 200 else {
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        lastError = localizedServerError(object, fallbackKey: "error.openWebsite")
        return
      }
      lastError = nil
    } catch { lastError = I18n.text("error.network", language: language) }
  }

  @discardableResult
  func reorderPieces(_ positions: [String: Int]) async -> Bool {
    await savePiecesOrder(positions)
  }

  private func savePiecesOrder(_ positions: [String: Int]) async -> Bool {
    guard let endpoint = URL(string: baseURL + "/api/config/pieces/order") else { return false }
    var req = URLRequest(url: endpoint)
    req.httpMethod = "PUT"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: [
      "revision": revision,
      "ids": pieces.map(\.id),
      "positions": positions,
    ])
    req.timeoutInterval = 4
    do {
      let (data, response) = try await session.data(for: req)
      let code = (response as? HTTPURLResponse)?.statusCode ?? 0
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      if let cfg = object?["config"] as? [String: Any] { applyConfig(cfg) }
      if code != 200 { lastError = localizedServerError(object, fallbackKey: "error.saveOrder"); return false }
      return true
    } catch { lastError = I18n.text("error.network", language: language); return false }
  }

  /// Confirma devices escutando (WS) logo após pin — feedback rápido no Mac.
  private func afterPinPush() async {
    await pingStatus()
    if devices > 0 {
      lastSyncNote = I18n.text("sync.sent", language: language, [
        "count": "\(devices)", "suffix": devices == 1 ? "" : "s"
      ])
    } else {
      lastSyncNote = I18n.text("sync.savedNoDevice", language: language)
    }
  }

  func iconURL(for name: String) -> URL? {
    let path = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
    return URL(string: baseURL + "/api/apps/" + path + "/icon")
  }

  func cachedIcon(for name: String) -> Image? {
    iconCache[name]
  }

  /// Mantém o NSImage nativo vivo. O AppKit pode atualizar suas representações
  /// quando o usuário troca Default, Dark, Clear ou Tinted no macOS 26.
  func nativeIcon(for name: String) -> NSImage? {
    guard let path = installed.first(where: { $0.name == name })?.path,
          FileManager.default.fileExists(atPath: path) else { return nil }
    if let cached = nativeIconCache[name] { return cached }

    // Alguns apps do macOS, como Safari, aparecem em /Applications como
    // symlink para um Cryptex. Pedir o ícone pelo link faz o AppKit adicionar
    // o badge de atalho; o caminho real preserva o ícone limpo do bundle.
    let iconPath = URL(fileURLWithPath: path).resolvingSymlinksInPath().path
    let icon: NSImage
    if #available(macOS 26, *) {
      // Tahoe: NSWorkspace.icon(forFile:) respeita o appearance atual e
      // retorna a variante Dark quando o app está em .dark (Dokke força dark).
      // Dark icons são quase pretos e somem no fundo escuro da página
      // (bug da imagem 1). Força o estilo Default/claro para manter contraste.
      if let lightAppearance = NSAppearance(named: .aqua) {
        var fetched: NSImage?
        lightAppearance.performAsCurrentDrawingAppearance {
          fetched = NSWorkspace.shared.icon(forFile: iconPath)
        }
        icon = fetched ?? NSWorkspace.shared.icon(forFile: iconPath)
      } else {
        icon = NSWorkspace.shared.icon(forFile: iconPath)
      }
    } else {
      icon = NSWorkspace.shared.icon(forFile: iconPath)
    }
    guard icon.isValid else { return nil }
    nativeIconCache[name] = icon
    return icon
  }

  func preloadIcons() {
    let names = pinned
    guard !names.isEmpty else { return }
    for name in names {
      if nativeIcon(for: name) != nil { continue }
      guard iconCache[name] == nil, let url = iconURL(for: name) else { continue }
      Task {
        guard let (data, _) = try? await session.data(from: url),
              let nsImage = NSImage(data: data) else { return }
        let image = Image(nsImage: nsImage)
        await MainActor.run { iconCache[name] = image }
      }
    }
  }
}
