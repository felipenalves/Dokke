import Foundation

enum DockAPIError: LocalizedError {
  case badURL
  case notAuthed
  case rateLimited
  case server(Int)
  case transport(String)

  var errorDescription: String? {
    switch self {
    case .badURL: return "URL inválida"
    case .notAuthed: return "Não autenticado"
    case .rateLimited: return "Muitas tentativas — aguarde."
    case .server(let c): return "Erro do servidor (\(c))"
    case .transport(let s): return s
    }
  }
}

/// Cliente HTTP + WebSocket para o servidor Dokke (o "Mac dokke" na LAN).
struct DockAPIClient {
  let baseURLString: String
  private let session: URLSession

  init(baseURLString: String) {
    self.baseURLString = baseURLString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let cfg = URLSessionConfiguration.ephemeral
    cfg.timeoutIntervalForRequest = 6
    cfg.timeoutIntervalForResource = 15
    // guarda o cookie do /api/auth e reenvia nos próximos /api/*
    cfg.httpCookieStorage = HTTPCookieStorage.shared
    cfg.httpShouldSetCookies = true
    cfg.httpCookieAcceptPolicy = .always
    self.session = URLSession(configuration: cfg)
  }

  private func url(_ path: String) throws -> URL {
    guard let u = URL(string: baseURLString + path) else { throw DockAPIError.badURL }
    return u
  }

  private func send(_ req: URLRequest) async throws -> Data {
    let data: Data
    let resp: URLResponse
    do {
      (data, resp) = try await session.data(for: req)
    } catch let e as URLError {
      throw DockAPIError.transport(e.localizedDescription)
    } catch {
      throw DockAPIError.transport((error as NSError).localizedDescription)
    }
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    if code == 401 || code == 403 { throw DockAPIError.notAuthed }
    if code == 429 { throw DockAPIError.rateLimited }
    guard (200...299).contains(code) else { throw DockAPIError.server(code) }
    return data
  }

  func get(_ path: String) async throws -> Data { try await send(URLRequest(url: url(path))) }

  func post(_ path: String, body: [String: Any]? = nil) async throws -> Data {
    var req = URLRequest(url: try url(path))
    req.httpMethod = "POST"
    req.timeoutInterval = 6
    if let body {
      req.setValue("application/json", forHTTPHeaderField: "Content-Type")
      req.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    return try await send(req)
  }

  func delete(_ path: String) async throws -> Data {
    var req = URLRequest(url: try url(path))
    req.httpMethod = "DELETE"
    req.timeoutInterval = 6
    return try await send(req)
  }

  // MARK: - Endpoints

  func login(pin: String) async throws {
    _ = try await post("/api/auth", body: ["pin": pin])
  }

  func fetchStatus() async throws -> DockStatus {
    let d = try await get("/api/status")
    return try JSONDecoder().decode(DockStatus.self, from: d)
  }

  func fetchApps() async throws -> DockAppsPayload {
    let d = try await get("/api/apps")
    return try JSONDecoder().decode(DockAppsPayload.self, from: d)
  }

  func activate(_ name: String) async throws {
    let n = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
    _ = try await post("/api/apps/\(n)/activate")
  }

  func pinApp(_ name: String) async throws {
    _ = try await post("/api/config/pinned", body: ["app": name])
  }

  func unpin(_ name: String) async throws {
    let n = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
    _ = try await delete("/api/config/pinned/\(n)")
  }

  func fetchInstalled() async throws -> [InstalledApp] {
    struct R: Decodable { let apps: [InstalledApp]? }
    let d = try await get("/api/apps/installed")
    return (try? JSONDecoder().decode(R.self, from: d))?.apps ?? []
  }

  func fetchObs() async throws -> ObsSnapshot {
    let d = try await get("/api/obs/state")
    guard let obj = try JSONSerialization.jsonObject(with: d) as? [String: Any] else {
      return ObsSnapshot()
    }
    var snap = ObsSnapshot()
    snap.connected = (obj["connected"] as? Bool) ?? false
    if let st = obj["state"] as? [String: Any] {
      snap.recording = (st["recording"] as? Bool) ?? false
      snap.streaming = (st["streaming"] as? Bool) ?? false
      snap.scene = st["scene"] as? String
      if let scenes = st["scenes"] as? [[String: Any]] {
        snap.scenes = scenes.compactMap { $0["name"] as? String }
      }
    }
    return snap
  }

  func obsAction(_ kind: String) async throws {
    _ = try await post("/api/obs/\(kind)")
  }

  func obsScene(_ scene: String) async throws {
    _ = try await post("/api/obs/scene", body: ["scene": scene])
  }

  func iconData(_ name: String) async -> Data? {
    let n = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
    guard let u = try? url("/api/apps/\(n)/icon") else { return nil }
    guard let (d, _) = try? await session.data(from: u) else { return nil }
    return d.isEmpty ? nil : d
  }

  func makeWebSocket() -> URLSessionWebSocketTask? {
    let ws = baseURLString
      .replacingOccurrences(of: "http://", with: "ws://")
      .replacingOccurrences(of: "https://", with: "wss://")
    guard let u = URL(string: ws + "/ws") else { return nil }
    return session.webSocketTask(with: u)
  }
}
