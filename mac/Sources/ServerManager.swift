import Foundation
import AppKit
import Combine
import Darwin

final class ServerManager: ObservableObject {
  private enum ServerOwnership {
    case none
    case owned
    case adopted
  }

  private enum ServerPreflight {
    case available
    case adopted(version: String)
    case conflict(String)
  }

  @Published var isRunning = false
  @Published var lastError: String?
  private var process: Process?
  private var ownership: ServerOwnership = .none
  private var logFile: FileHandle?
  private var restartWork: DispatchWorkItem?
  private var restartFailures = 0
  private var intentionalStop = false
  private var isStarting = false

  private let serverPath: String?
  private let nodePath: String?
  private static let logPath = "/tmp/dokke-server.log"
  // Mantido em sincronia com package.json e Info.plist para execuções fora do
  // bundle, quando Bundle.main não expõe o Info.plist do app distribuído.
  private static let packageVersionFallback = "0.2.8"
  private let maxConsecutiveRestartFailures = 5
  private let restartDelay: TimeInterval = 3
  private let serverBaseURL = "http://127.0.0.1:3000"
  private let readinessAttempts = 20
  private let readinessDelayNanoseconds: UInt64 = 200_000_000
  private let session: URLSession = {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 1
    configuration.timeoutIntervalForResource = 1
    configuration.waitsForConnectivity = false
    return URLSession(configuration: configuration)
  }()

  init() {
    serverPath = Self.locateServer()
    nodePath = Self.locateNode()
    NotificationCenter.default.addObserver(
      forName: NSApplication.willTerminateNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.stop()
    }
    // Defer the first published state change until AppKit finishes mounting
    // the scene; publishing synchronously from App initialization can abort
    // SwiftUI with "setting value during update".
    DispatchQueue.main.async { [weak self] in
      self?.start()
    }
  }

  /// Localiza o server.js — por override (env/UserDefaults), depois no bundle e
  /// em caminhos relativos ao diretório atual para execução local.
  static func locateServer() -> String? {
    let fm = FileManager.default
    let currentDirectory = URL(fileURLWithPath: ".", isDirectory: true)
    let candidates: [String?] = [
      ProcessInfo.processInfo.environment["DOKKE_SERVER"],
      UserDefaults.standard.string(forKey: "dokke.serverPath"),
      Bundle.main.resourceURL?.appendingPathComponent("Dokke/server.js").path,
      currentDirectory.appendingPathComponent("server.js").path,
      currentDirectory.appendingPathComponent("../server.js").standardized.path,
    ]
    for c in candidates.compactMap({ $0 }) where fm.isReadableFile(atPath: c) {
      return c
    }
    return nil
  }

  /// Localiza o binário do node — node embutido no bundle (Contents/Resources/node-bin),
  /// depois override e caminhos comuns.
  static func locateNode() -> String? {
    let fm = FileManager.default
    let bundledNode = Bundle.main.resourceURL?
      .appendingPathComponent("node-bin", isDirectory: true)
      .appendingPathComponent("node", isDirectory: false)
      .path
    let candidates: [String?] = [
      bundledNode,
      ProcessInfo.processInfo.environment["DOKKE_NODE"],
      UserDefaults.standard.string(forKey: "dokke.nodePath"),
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "/opt/local/bin/node",
      "/usr/bin/node",
    ]
    for c in candidates.compactMap({ $0 }) where fm.isExecutableFile(atPath: c) {
      if canRunNode(at: c) { return c }
    }
    return nil
  }

  private static func openLog() -> FileHandle? {
    let fm = FileManager.default
    if let attrs = try? fm.attributesOfItem(atPath: logPath),
       let size = attrs[.size] as? NSNumber,
       size.intValue > 1_000_000 {
      try? fm.removeItem(atPath: logPath)
    }
    if !fm.fileExists(atPath: logPath) {
      fm.createFile(atPath: logPath, contents: nil)
    }
    guard let handle = FileHandle(forWritingAtPath: logPath) else { return nil }
    handle.seekToEndOfFile()
    return handle
  }

  private func appendLog(_ message: String) {
    guard let handle = logFile else { return }
    guard let data = message.data(using: .utf8) else { return }
    handle.write(data)
    handle.synchronizeFile()
  }

  private static func canRunNode(at path: String) -> Bool {
    let proc = Process()
    let pipe = Pipe()
    proc.executableURL = URL(fileURLWithPath: path)
    proc.arguments = ["--version"]
    proc.standardOutput = pipe
    proc.standardError = pipe
    do {
      try proc.run()
      proc.waitUntilExit()
      return proc.terminationStatus == 0
    } catch {
      return false
    }
  }

  /// IP IPv4 da LAN (en0/en1) — mostrado na aba Sobre como link de acesso dos devices.
  static func lanIPv4() -> String? {
    var addr: String?
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0 else { return nil }
    defer { freeifaddrs(ifaddr) }
    var ptr = ifaddr
    while ptr != nil {
      let interface = ptr!.pointee
      let family = interface.ifa_addr.pointee.sa_family
      if family == UInt8(AF_INET) {
        let name = String(cString: interface.ifa_name)
        if name.hasPrefix("en") && !name.contains("awdl") {
          var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
          getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                      &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
          let h = String(cString: host)
          if !h.hasPrefix("169.254") {
            addr = h
            break
          }
        }
      }
      ptr = interface.ifa_next
    }
    return addr
  }

  func start() {
    guard !isRunning, !isStarting else { return }
    intentionalStop = false
    isStarting = true
    lastError = nil
    logFile = Self.openLog()
    appendLog("\n[startup] \(Date()) node=\(nodePath ?? "<missing>") server=\(serverPath ?? "<missing>")\n")

    Task { @MainActor [weak self] in
      guard let self else { return }
      let preflight = await self.preflightExistingServer()
      guard !self.intentionalStop else {
        self.finishStartupLog()
        self.isStarting = false
        return
      }
      switch preflight {
      case .adopted(let version):
        self.ownership = .adopted
        self.isRunning = true
        self.isStarting = false
        self.appendLog("[adopted] version=\(version)\n")
        self.finishStartupLog()
        print("[dokke] adopted compatible server version=\(version)")
      case .conflict(let message):
        self.ownership = .none
        self.isRunning = false
        self.isStarting = false
        self.lastError = message
        self.appendLog("[startup-conflict] \(message)\n")
        self.finishStartupLog()
        print("[dokke] server conflict: \(message)")
      case .available:
        guard let serverPath = self.serverPath, let nodePath = self.nodePath else {
          self.isStarting = false
          self.lastError = I18n.text("error.missingNode", language: I18n.currentLanguage())
          self.appendLog("[startup-error] Node ou server.js não foi encontrado\n")
          self.finishStartupLog()
          print("[dokke] server.js ou node não encontrado — defina DOKKE_SERVER / DOKKE_NODE (env) ou dokke.serverPath / dokke.nodePath (UserDefaults)")
          return
        }
        self.launchOwnedServer(serverPath: serverPath, nodePath: nodePath)
      }
    }
  }

  /// Nunca encerra quem já ocupa a porta: adota apenas o host que responde os
  /// dois contratos públicos do Dokke; qualquer outra resposta vira conflito.
  private func preflightExistingServer() async -> ServerPreflight {
    guard let healthURL = URL(string: serverBaseURL + "/health"),
          let versionURL = URL(string: serverBaseURL + "/api/version") else {
      return .conflict(I18n.text("error.invalidURL", language: I18n.currentLanguage()))
    }
    do {
      let (healthData, healthResponse) = try await session.data(from: healthURL)
      guard let healthHTTP = healthResponse as? HTTPURLResponse,
            healthHTTP.statusCode == 200,
            let health = try JSONSerialization.jsonObject(with: healthData) as? [String: Any],
            (health["ok"] as? Bool) == true,
            health["service"] as? String == "Dokke" else {
        return .conflict(I18n.text("error.portConflict", language: I18n.currentLanguage()))
      }

      let (versionData, versionResponse) = try await session.data(from: versionURL)
      guard let versionHTTP = versionResponse as? HTTPURLResponse,
            versionHTTP.statusCode == 200,
            let version = try JSONSerialization.jsonObject(with: versionData) as? [String: Any],
            (version["ok"] as? Bool) == true,
            let local = version["local"] as? [String: Any],
            let tag = local["tag"] as? String,
            Self.isCompatibleDokkeVersion(tag) else {
        return .conflict(I18n.text("error.portConflict", language: I18n.currentLanguage()))
      }
      return .adopted(version: tag)
    } catch {
      if Self.isNoLocalListenerError(error) {
        return .available
      }
      return .conflict(I18n.text("error.portUnknown", language: I18n.currentLanguage()))
    }
  }

  private static func isCompatibleDokkeVersion(_ tag: String) -> Bool {
    guard let candidate = normalizedVersionTag(tag) else { return false }
    return candidate == bundledVersionTag
  }

  private static var bundledVersionTag: String {
    let bundleVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    return normalizedVersionTag(bundleVersion ?? packageVersionFallback)
      ?? normalizedVersionTag(packageVersionFallback)!
  }

  /// O endpoint publica `vX.Y.Z`; normalize também o bundle para não adotar
  /// outra versão apenas porque ambos começam com `v`.
  private static func normalizedVersionTag(_ value: String) -> String? {
    let raw = value.trimmingCharacters(in: .whitespacesAndNewlines)
    let version = raw.hasPrefix("v") ? String(raw.dropFirst()) : raw
    let parts = version.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 3,
          let major = Int(parts[0]),
          let minor = Int(parts[1]),
          let patch = Int(parts[2]),
          major >= 0, minor >= 0, patch >= 0 else {
      return nil
    }
    return "v\(major).\(minor).\(patch)"
  }

  /// Apenas recusa de conexão no loopback significa porta livre. Timeout,
  /// resposta malformada e qualquer outro erro permanecem conflito seguro.
  private static func isNoLocalListenerError(_ error: Error) -> Bool {
    let nsError = error as NSError
    if nsError.domain == NSURLErrorDomain,
       nsError.code == NSURLErrorCannotConnectToHost {
      return true
    }
    guard let underlying = nsError.userInfo[NSUnderlyingErrorKey] as? NSError else {
      return false
    }
    return underlying.domain == NSPOSIXErrorDomain && underlying.code == Int(ECONNREFUSED)
  }

  private func launchOwnedServer(serverPath: String, nodePath: String) {
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: nodePath)
    proc.arguments = [serverPath]

    proc.standardOutput = logFile
    proc.standardError = logFile

    proc.terminationHandler = { [weak self] process in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        guard let current = self.process, current === process, self.ownership == .owned else { return }
        self.appendLog("[exit] status=\(process.terminationStatus)\n")
        self.failOwnedAttempt(
          process,
          message: I18n.text("error.serverExited", language: I18n.currentLanguage()),
          terminate: false
        )
      }
    }

    do {
      try proc.run()
      process = proc
      ownership = .owned
      print("[dokke] server launched pid=\(proc.processIdentifier)")
      Task { @MainActor [weak self, weak proc] in
        guard let self, let proc else { return }
        await self.confirmOwnedServerReady(proc)
      }
    } catch {
      process = nil
      isStarting = false
      isRunning = false
      ownership = .none
      appendLog("[startup-error] \(error.localizedDescription)\n")
      print("[dokke] failed to start server: \(error)")
      handleOwnedFailure(I18n.text("error.start", language: I18n.currentLanguage()))
      finishStartupLog()
    }
  }

  /// Limpa a tentativa antes de encerrar/reagendar. Assim, timeout de
  /// readiness não depende do terminationHandler eventual para contabilizar a
  /// falha e não deixa processo/ownership obsoletos no estado da UI.
  private func failOwnedAttempt(_ proc: Process, message: String, terminate: Bool = true) {
    guard let current = process, current === proc, ownership == .owned else { return }
    process = nil
    ownership = .none
    isStarting = false
    isRunning = false
    if terminate && proc.isRunning {
      proc.terminate()
    }
    guard !intentionalStop else {
      finishStartupLog()
      return
    }
    handleOwnedFailure(message)
    finishStartupLog()
  }

  private func confirmOwnedServerReady(_ proc: Process) async {
    for _ in 0..<readinessAttempts {
      guard process === proc, ownership == .owned, !intentionalStop else { return }
      if case .adopted = await preflightExistingServer() {
        guard process === proc, ownership == .owned else { return }
        isStarting = false
        isRunning = true
        restartFailures = 0
        appendLog("[ready] pid=\(proc.processIdentifier)\n")
        print("[dokke] server ready pid=\(proc.processIdentifier)")
        return
      }
      try? await Task.sleep(nanoseconds: readinessDelayNanoseconds)
    }

    guard process === proc, ownership == .owned, !intentionalStop else { return }
    appendLog("[startup-error] bind não confirmado\n")
    failOwnedAttempt(proc, message: I18n.text("error.server", language: I18n.currentLanguage()))
  }

  private func finishStartupLog() {
    logFile?.closeFile()
    logFile = nil
  }

  func stop() {
    intentionalStop = true
    restartWork?.cancel()
    restartWork = nil
    let proc = process
    process = nil
    let wasOwned = ownership == .owned
    ownership = .none
    isStarting = false
    isRunning = false
    finishStartupLog()
    guard wasOwned, let proc, proc.isRunning else { return }
    proc.terminate()
    print("[dokke] server stopped")
  }

  /// Reinicia o servidor após crash — 3s de espera, desiste após 5 falhas seguidas.
  private func handleOwnedFailure(_ message: String) {
    lastError = message
    restartFailures += 1
    guard restartFailures <= maxConsecutiveRestartFailures else {
      lastError = I18n.text("error.restartLimit", language: I18n.currentLanguage())
      appendLog("[restart-limit] failures=\(restartFailures)\n")
      return
    }
    scheduleRestart()
  }

  private func scheduleRestart() {
    restartWork?.cancel()
    let work = DispatchWorkItem { [weak self] in
      guard let self = self, !self.intentionalStop, !self.isRunning, !self.isStarting, self.ownership == .none else { return }
      self.start()
    }
    restartWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + restartDelay, execute: work)
  }

  deinit {
    stop()
  }
}
