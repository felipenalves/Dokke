import Foundation

// MARK: - Modelos que espelham o JSON do server.js (Dokke)

struct RunningApp: Codable, Identifiable, Hashable {
  var id: String { name }
  let name: String
  let pid: Int?
  let type: String?
}

struct DockAppsPayload: Decodable {
  let pinned: [String]?
  let running: [RunningApp]?
  let v: String?
}

struct DockStatus: Decodable {
  let ok: Bool?
  let service: String?
  let devices: Int?
  let pinned: Int?

  struct AppConfig: Decodable {
    let pinned: [String]?
  }
  let config: AppConfig?
}

struct InstalledApp: Codable, Identifiable, Hashable {
  var id: String { name }
  let name: String
}

/// Snapshot do estado do OBS (parsed manualmente a partir de /api/obs/state).
struct ObsSnapshot: Equatable {
  var connected = false
  var recording = false
  var streaming = false
  var scene: String?
  var scenes: [String] = []
}
