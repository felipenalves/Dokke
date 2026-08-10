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
  @Published var pinned: [String] = []
  @Published var installed: [InstalledApp] = []
  @Published var filter = ""
  @Published var loading = false
  @Published var devices = 0
  @Published var busyName: String?
  @Published var pinCode: String?
  @Published var pinError: String?

  private var timer: Timer?
  private var refreshTask: Task<Void, Never>?
  private var iconCache: [String: Image] = [:]

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

  deinit { timer?.invalidate() }

  static func normalizeBase(_ raw: String) -> String {
    var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    while s.hasSuffix("/") { s.removeLast() }
    if s.isEmpty { return "http://127.0.0.1:3000" }
    return s
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
    pinned.contains(name)
  }

  func refreshAll() async {
    loading = true
    defer { loading = false }
    await pingStatus()
    guard online else { return }
    await loadConfig()
    await loadInstalled()
    await loadPin()
    preloadIcons()
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
      pinError = "URL inválida"
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
        pinError = "Não foi possível gerar o código. O servidor está no ar?"
        return
      }
      pinCode = p
    } catch {
      pinError = error.localizedDescription
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
        online = false
        lastError = "status inválido"
        return
      }
      online = true
      lastError = nil
      if let d = obj["devices"] as? Int { devices = d }
      else if let d = obj["devices"] as? Double { devices = Int(d) }
      if let cfg = obj["config"] as? [String: Any], let p = cfg["pinned"] as? [String] {
        pinned = p
        preloadIcons()
      }
    } catch {
      await pingHealthOnly()
    }
  }

  private func pingHealthOnly() async {
    guard let url = URL(string: baseURL + "/health") else {
      online = false
      lastError = "URL inválida"
      return
    }
    do {
      let (data, resp) = try await session.data(from: url)
      guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
        online = false
        lastError = "offline"
        return
      }
      if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
         (obj["ok"] as? Bool) == true {
        online = true
        lastError = nil
      } else {
        online = false
        lastError = "health inválido"
      }
    } catch {
      online = false
      lastError = error.localizedDescription
    }
  }

  func loadConfig() async {
    guard let url = URL(string: baseURL + "/api/config") else { return }
    do {
      let (data, _) = try await session.data(from: url)
      guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let cfg = obj["config"] as? [String: Any],
            let p = cfg["pinned"] as? [String] else { return }
      pinned = p
    } catch {
      lastError = error.localizedDescription
    }
  }

  func loadInstalled() async {
    guard let url = URL(string: baseURL + "/api/apps/installed") else { return }
    do {
      let (data, _) = try await session.data(from: url)
      guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let apps = obj["apps"] as? [[String: Any]] else { return }
      installed = apps.compactMap { a in
        guard let name = a["name"] as? String else { return nil }
        return InstalledApp(
          name: name,
          path: a["path"] as? String,
          icon: (a["icon"] as? Bool) ?? true
        )
      }
    } catch {
      lastError = error.localizedDescription
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
    // otimista: UI reage na hora; server empurra pros devices via WS
    let prev = pinned
    if !pinned.contains(name) { pinned.append(name) }
    busyName = name
    defer { busyName = nil }
    guard let url = URL(string: baseURL + "/api/config/pinned") else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["app": name])
    req.timeoutInterval = 4
    do {
      let (data, resp) = try await session.data(for: req)
      let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
      guard code == 200,
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            (obj["ok"] as? Bool) == true else {
        pinned = prev
        lastError = "falha ao fixar"
        lastSyncNote = nil
        return
      }
      if let cfg = obj["config"] as? [String: Any], let p = cfg["pinned"] as? [String] {
        pinned = p
      }
      await afterPinPush()
    } catch {
      pinned = prev
      lastError = error.localizedDescription
      lastSyncNote = nil
    }
  }

  func unpin(_ name: String) async {
    let prev = pinned
    pinned = pinned.filter { $0 != name }
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
        pinned = prev
        lastError = "falha ao remover"
        lastSyncNote = nil
        return
      }
      if let cfg = obj["config"] as? [String: Any], let p = cfg["pinned"] as? [String] {
        pinned = p
      }
      await afterPinPush()
    } catch {
      pinned = prev
      lastError = error.localizedDescription
      lastSyncNote = nil
    }
  }

  func reorderPinned(from source: IndexSet, to destination: Int) {
    pinned.move(fromOffsets: source, toOffset: destination)
    Task { await savePinnedOrder() }
  }

  private func savePinnedOrder() async {
    guard let url = URL(string: baseURL + "/api/config/pinned") else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "PUT"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    // envia a lista NA ORDEM do drag (arrastada) — o servidor persiste e empurra pros devices via WS
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["pinned": pinned])
    req.timeoutInterval = 4
    do {
      let (data, resp) = try await session.data(for: req)
      let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
      guard code == 200,
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            (obj["ok"] as? Bool) == true else {
        lastError = "failed to save order"
        return
      }
      if let cfg = obj["config"] as? [String: Any], let p = cfg["pinned"] as? [String] {
        pinned = p
      }
    } catch {
      lastError = error.localizedDescription
    }
  }

  /// Persiste a ordem atual dos favoritos no servidor (chamado ao soltar o drag).
  func persistPinnedOrder() async {
    await savePinnedOrder()
  }

  /// Confirma devices escutando (WS) logo após pin — feedback rápido no Mac.
  private func afterPinPush() async {
    await pingStatus()
    if devices > 0 {
      lastSyncNote = "Enviado a \(devices) dispositivo\(devices == 1 ? "" : "s")"
    } else {
      lastSyncNote = "Salvo — nenhum device no WS ainda (abra o Dokke no seu celular)"
    }
  }

  func iconURL(for name: String) -> URL? {
    let path = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
    return URL(string: baseURL + "/api/apps/" + path + "/icon")
  }

  func cachedIcon(for name: String) -> Image? {
    iconCache[name]
  }

  func preloadIcons() {
    let names = pinned
    guard !names.isEmpty else { return }
    for name in names {
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
