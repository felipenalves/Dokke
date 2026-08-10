import Foundation
import AppKit
import Combine

final class ServerManager: ObservableObject {
  @Published var isRunning = false
  @Published var lastError: String?
  private var process: Process?
  private var logFile: FileHandle?
  private var restartWork: DispatchWorkItem?
  private var restartFailures = 0
  private var intentionalStop = false

  private let serverPath: String?
  private let nodePath: String?

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
    // Auto-start on init — WindowGroup onAppear may never fire for MenuBarExtra
    start()
  }

  /// Localiza o server.js — por override (env/UserDefaults), depois por caminhos
  /// relativos conhecidos, e por último o caminho de dev desta máquina.
  static func locateServer() -> String? {
    let fm = FileManager.default
    let candidates: [String?] = [
      ProcessInfo.processInfo.environment["DOKKE_SERVER"],
      UserDefaults.standard.string(forKey: "dokke.serverPath"),
      fm.currentDirectoryPath + "/server.js",
      Bundle.main.resourceURL?.appendingPathComponent("Dokke/server.js").path,
      "/Users/felipealves/FelipeOS/projetos/Felipe.aiOS/projetos/j5-dock/server.js", // fallback dev
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
    guard !isRunning else { return }
    guard let serverPath, let nodePath else {
      lastError = "Node ou server.js não foi encontrado. Reinstale o Dokke pelo DMG mais recente."
      print("[dokke] server.js ou node não encontrado — defina DOKKE_SERVER / DOKKE_NODE (env) ou dokke.serverPath / dokke.nodePath (UserDefaults)")
      return
    }
    intentionalStop = false
    lastError = nil
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: nodePath)
    proc.arguments = [serverPath]

    // Log to file for debugging
    let logPath = "/tmp/dokke-server.log"
    FileManager.default.createFile(atPath: logPath, contents: nil)
    logFile = FileHandle(forWritingAtPath: logPath)
    proc.standardOutput = logFile
    proc.standardError = logFile

    proc.terminationHandler = { [weak self] process in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        self.logFile = nil
        self.process = nil
        self.isRunning = false
        if !self.intentionalStop && process.terminationStatus != 0 {
          self.lastError = "O servidor não conseguiu iniciar (código \(process.terminationStatus)). Veja /tmp/dokke-server.log."
        }
        if !self.intentionalStop { self.scheduleRestart() }
      }
    }

    do {
      try proc.run()
      process = proc
      isRunning = true
      restartFailures = 0
      print("[dokke] server started pid=\(proc.processIdentifier)")
    } catch {
      lastError = "Não foi possível iniciar o servidor: \(error.localizedDescription)"
      print("[dokke] failed to start server: \(error)")
    }
  }

  func stop() {
    intentionalStop = true
    restartWork?.cancel()
    restartWork = nil
    guard let proc = process, proc.isRunning else {
      process = nil
      logFile = nil
      return
    }
    proc.terminate()
    print("[dokke] server stopped")
    process = nil
    logFile = nil
    isRunning = false
  }

  /// Reinicia o servidor após crash — 3s de espera, desiste após 5 falhas seguidas.
  private func scheduleRestart() {
    restartWork?.cancel()
    let work = DispatchWorkItem { [weak self] in
      guard let self = self, !self.intentionalStop, !self.isRunning else { return }
      self.start()
      if self.isRunning {
        self.restartFailures = 0
      } else {
        self.restartFailures += 1
        if self.restartFailures >= 5 { return }
        self.scheduleRestart()
      }
    }
    restartWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: work)
  }

  deinit {
    stop()
  }
}
