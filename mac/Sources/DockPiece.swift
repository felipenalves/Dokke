import Foundation

enum DockPieceType: String, Hashable {
  case app
  case website
}

struct DockPiece: Identifiable, Hashable {
  let id: String
  let type: DockPieceType
  let name: String?
  let title: String?
  let url: String?
  let position: Int

  static func app(_ name: String, position: Int = 0) -> DockPiece {
    DockPiece(id: "app:\(name)", type: .app, name: name, title: nil, url: nil, position: position)
  }

  init(id: String, type: DockPieceType, name: String?, title: String?, url: String?, position: Int = 0) {
    self.id = id
    self.type = type
    self.name = name
    self.title = title
    self.url = url
    self.position = position
  }

  init?(json: [String: Any], fallbackPosition: Int = 0) {
    guard let typeValue = json["type"] as? String,
          let type = DockPieceType(rawValue: typeValue),
          let id = json["id"] as? String else { return nil }
    let position = (json["position"] as? Int) ?? fallbackPosition
    switch type {
    case .app:
      guard let name = json["name"] as? String, !name.isEmpty else { return nil }
      self.init(id: id, type: type, name: name, title: nil, url: nil, position: position)
    case .website:
      guard let title = json["title"] as? String,
            let url = json["url"] as? String,
            !title.isEmpty, !url.isEmpty else { return nil }
      self.init(id: id, type: type, name: nil, title: title, url: url, position: position)
    }
  }

  func atPosition(_ position: Int) -> DockPiece {
    DockPiece(id: id, type: type, name: name, title: title, url: url, position: position)
  }

  var displayTitle: String {
    switch type {
    case .app: return name ?? "App"
    case .website: return title ?? url ?? "Site"
    }
  }

  var appName: String? { type == .app ? name : nil }
}
