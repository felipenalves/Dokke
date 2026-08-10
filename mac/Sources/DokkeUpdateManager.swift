import AppKit
import Combine
import CryptoKit
import Foundation

struct DokkeRelease: Identifiable {
  let tag: String
  let notes: String
  let dmgURL: URL
  let sha256: String
  let htmlURL: URL

  var id: String { tag }
}

enum DokkeUpdateState: Equatable {
  case idle
  case checking
  case available
  case downloading
  case installing
  case upToDate
  case failed(String)
}

@MainActor
final class DokkeUpdateManager: ObservableObject {
  @Published private(set) var state: DokkeUpdateState = .idle
  @Published private(set) var release: DokkeRelease?

  let currentVersion: String

  private let repositoryAPI = URL(string: "https://api.github.com/repos/felipenalves/Dokke/releases/latest")!
  private let fileManager = FileManager.default

  init() {
    currentVersion = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "0.0.0"
  }

  var isBusy: Bool {
    switch state {
    case .checking, .downloading, .installing: return true
    default: return false
    }
  }

  var statusMessage: String? {
    switch state {
    case .idle: return nil
    case .checking: return "Verificando atualizações..."
    case .available: return "Nova versão disponível."
    case .downloading: return "Baixando a atualização..."
    case .installing: return "Instalando a atualização..."
    case .upToDate: return "Você está na versão mais recente."
    case .failed(let message): return message
    }
  }

  func check() async {
    await Task.yield()
    guard !isBusy else { return }
    state = .checking

    do {
      var request = URLRequest(url: repositoryAPI)
      request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
      request.setValue("Dokke/\(currentVersion)", forHTTPHeaderField: "User-Agent")
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw UpdateError.network("O GitHub não respondeu corretamente.")
      }

      let dto = try JSONDecoder().decode(GitHubReleaseDTO.self, from: data)
      guard compareVersion(dto.tagName, currentVersion) > 0 else {
        release = nil
        state = .upToDate
        return
      }

      guard let asset = dto.assets.first(where: { $0.name == "Dokke-macOS.dmg" }),
            let digest = asset.digest?.replacingOccurrences(of: "sha256:", with: "")
      else {
        throw UpdateError.invalidRelease("A release não contém um instalador macOS válido.")
      }

      release = DokkeRelease(
        tag: dto.tagName,
        notes: dto.body?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Sem notas de versão.",
        dmgURL: asset.browserDownloadURL,
        sha256: digest.lowercased(),
        htmlURL: dto.htmlURL
      )
      state = .available
    } catch {
      state = .failed(error.localizedDescription)
    }
  }

  func downloadAndInstall() async {
    guard let release, !isBusy else { return }
    state = .downloading

    let workspace = fileManager.temporaryDirectory
      .appendingPathComponent("dokke-update-\(UUID().uuidString)", isDirectory: true)
    var handedOff = false

    do {
      try fileManager.createDirectory(at: workspace, withIntermediateDirectories: true)
      let request = URLRequest(url: release.dmgURL)
      let (downloadedURL, response) = try await URLSession.shared.download(for: request)
      guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw UpdateError.network("Não foi possível baixar a atualização.")
      }

      let dmgURL = workspace.appendingPathComponent("Dokke-macOS.dmg")
      try fileManager.moveItem(at: downloadedURL, to: dmgURL)
      try verifySHA256(of: dmgURL, expected: release.sha256)

      let mountPoint = try mountDMG(at: dmgURL)
      var mounted = true
      defer {
        if mounted { try? detachDMG(at: mountPoint) }
      }

      let sourceApp = mountPoint.appendingPathComponent("Dokke.app", isDirectory: true)
      guard fileManager.fileExists(atPath: sourceApp.path) else {
        throw UpdateError.invalidRelease("O instalador não contém o Dokke.app.")
      }

      let stagedApp = workspace.appendingPathComponent("Dokke.app", isDirectory: true)
      try fileManager.copyItem(at: sourceApp, to: stagedApp)
      try detachDMG(at: mountPoint)
      mounted = false

      let targetApp = Bundle.main.bundleURL.standardizedFileURL
      guard targetApp.lastPathComponent == "Dokke.app" else {
        throw UpdateError.install("O Dokke precisa estar instalado como um aplicativo para ser atualizado.")
      }
      guard fileManager.isWritableFile(atPath: targetApp.deletingLastPathComponent().path) else {
        throw UpdateError.install("Sem permissão para atualizar a pasta do Dokke. Mova o app para Aplicativos e tente novamente.")
      }

      try scheduleReplacement(stagedApp: stagedApp, targetApp: targetApp, workspace: workspace)
      handedOff = true
      state = .installing
      NSApplication.shared.terminate(nil)
    } catch {
      if !handedOff { try? fileManager.removeItem(at: workspace) }
      state = .failed(error.localizedDescription)
    }
  }

  private func compareVersion(_ lhs: String, _ rhs: String) -> Int {
    let left = lhs.trimmingCharacters(in: CharacterSet(charactersIn: "vV"))
      .split(separator: ".").map { Int($0) ?? 0 }
    let right = rhs.trimmingCharacters(in: CharacterSet(charactersIn: "vV"))
      .split(separator: ".").map { Int($0) ?? 0 }
    for index in 0..<3 {
      let a = index < left.count ? left[index] : 0
      let b = index < right.count ? right[index] : 0
      if a != b { return a > b ? 1 : -1 }
    }
    return 0
  }

  private func verifySHA256(of file: URL, expected: String) throws {
    let digest = SHA256.hash(data: try Data(contentsOf: file))
      .map { String(format: "%02x", $0) }
      .joined()
    guard digest.caseInsensitiveCompare(expected) == .orderedSame else {
      throw UpdateError.invalidRelease("A assinatura do download não confere com a release.")
    }
  }

  private func mountDMG(at dmg: URL) throws -> URL {
    let data = try runProcess("/usr/bin/hdiutil", arguments: ["attach", "-nobrowse", "-readonly", "-plist", dmg.path])
    guard let plist = try PropertyListSerialization.propertyList(from: data, options: [], format: nil) as? [String: Any],
          let entities = plist["system-entities"] as? [[String: Any]],
          let mountPath = entities.compactMap({ $0["mount-point"] as? String }).first
    else {
      throw UpdateError.install("Não foi possível montar o instalador.")
    }
    return URL(fileURLWithPath: mountPath, isDirectory: true)
  }

  private func detachDMG(at mountPoint: URL) throws {
    _ = try runProcess("/usr/bin/hdiutil", arguments: ["detach", mountPoint.path, "-force"])
  }

  private func runProcess(_ executable: String, arguments: [String]) throws -> Data {
    let process = Process()
    let pipe = Pipe()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = pipe
    process.standardError = pipe
    try process.run()
    process.waitUntilExit()
    let output = pipe.fileHandleForReading.readDataToEndOfFile()
    guard process.terminationStatus == 0 else {
      let message = String(data: output, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
      throw UpdateError.process(message?.isEmpty == false ? message! : "Falha ao executar o instalador.")
    }
    return output
  }

  private func scheduleReplacement(stagedApp: URL, targetApp: URL, workspace: URL) throws {
    let scriptURL = workspace.appendingPathComponent("install-update.sh")
    let script = """
    #!/bin/sh
    set -eu
    STAGED="$1"
    TARGET="$2"
    WORKSPACE="$3"
    PID="$4"
    while /bin/kill -0 "$PID" 2>/dev/null; do /bin/sleep 1; done
    TEMP="$TARGET.new"
    /bin/rm -rf "$TEMP"
    /usr/bin/ditto "$STAGED" "$TEMP"
    /bin/rm -rf "$TARGET"
    /bin/mv "$TEMP" "$TARGET"
    /usr/bin/open "$TARGET"
    /bin/rm -rf "$WORKSPACE"
    """
    try script.write(to: scriptURL, atomically: true, encoding: .utf8)
    try fileManager.setAttributes([.posixPermissions: NSNumber(value: Int16(0o700))], ofItemAtPath: scriptURL.path)

    let helper = Process()
    helper.executableURL = URL(fileURLWithPath: "/bin/sh")
    helper.arguments = [scriptURL.path, stagedApp.path, targetApp.path, workspace.path, "\(ProcessInfo.processInfo.processIdentifier)"]
    helper.standardOutput = FileHandle.nullDevice
    helper.standardError = FileHandle.nullDevice
    try helper.run()
  }
}

private struct GitHubReleaseDTO: Decodable {
  let tagName: String
  let htmlURL: URL
  let body: String?
  let assets: [GitHubAssetDTO]

  enum CodingKeys: String, CodingKey {
    case tagName = "tag_name"
    case htmlURL = "html_url"
    case body
    case assets
  }
}

private struct GitHubAssetDTO: Decodable {
  let name: String
  let browserDownloadURL: URL
  let digest: String?

  enum CodingKeys: String, CodingKey {
    case name
    case browserDownloadURL = "browser_download_url"
    case digest
  }
}

private enum UpdateError: LocalizedError {
  case network(String)
  case invalidRelease(String)
  case install(String)
  case process(String)

  var errorDescription: String? {
    switch self {
    case .network(let message), .invalidRelease(let message), .install(let message), .process(let message): return message
    }
  }
}
