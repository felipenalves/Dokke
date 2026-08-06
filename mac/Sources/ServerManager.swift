import Foundation
import AppKit
import Combine

final class ServerManager: ObservableObject {
  @Published var isRunning = false
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
      ProcessInfo.processInfo.environment["J5_DOCK_SERVER"],
      UserDefaults.standard.string(forKey: "j5.serverPath"),
      fm.currentDirectoryPath + "/server.js",
      Bundle.main.resourceURL?.appendingPathComponent("j5-dock/server.js").path,
      "/Users/felipealves/FelipeOS/projetos/Felipe.aiOS/projetos/j5-dock/server.js", // fallback dev
    ]
    for c in candidates.compactMap({ $0 }) where fm.isReadableFile(atPath: c) {
      return c
    }
    return nil
  }

  /// Localiza o binário do node — override, depois os caminhos comuns.
  static func locateNode() -> String? {
    let fm = FileManager.default
    let candidates = [
      ProcessInfo.processInfo.environment["J5_NODE"],
      UserDefaults.standard.string(forKey: "j5.nodePath"),
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "/opt/local/bin/node",
      "/usr/bin/node",
    ]
    for c in candidates.compactMap({ $0 }) where fm.isExecutableFile(atPath: c) {
      return c
    }
    return nil
  }

  func start() {
    guard !isRunning else { return }
    guard let serverPath, let nodePath else {
      print("[dokke] server.js ou node não encontrado — defina J5_DOCK_SERVER / J5_NODE (env) ou j5.serverPath / j5.nodePath (UserDefaults)")
      return
    }
    intentionalStop = false
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: nodePath)
    proc.arguments = [serverPath]

    // Log to file for debugging
    let logPath = "/tmp/dokke-server.log"
    FileManager.default.createFile(atPath: logPath, contents: nil)
    logFile = FileHandle(forWritingAtPath: logPath)
    proc.standardOutput = logFile
    proc.standardError = logFile

    proc.terminationHandler = { [weak self] _ in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        self.logFile = nil
        self.process = nil
        self.isRunning = false
        if !self.intentionalStop { self.scheduleRestart() }
      }
    }

    do {
      try proc.run()
      process = proc
      isRunning = true
      restartFailures = 0
      print("[dokke] server started pid=\(proc.processIdentifier)")
      enableTailscaleServe()
    } catch {
      print("[dokke] failed to start server: \(error)")
    }
  }

  /// Publica localhost:3000 em HTTPS no tailnet (cert Tailscale) p/ PWA no iPhone.
  private func enableTailscaleServe() {
    let candidates = [
      "/opt/homebrew/bin/tailscale",
      "/usr/local/bin/tailscale",
      "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
    ]
    guard let bin = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else {
      print("[dokke] tailscale CLI não encontrado — PWA iOS fica só em http://LAN")
      return
    }
    let p = Process()
    p.executableURL = URL(fileURLWithPath: bin)
    p.arguments = ["serve", "--bg", "3000"]
    p.standardOutput = FileHandle.nullDevice
    p.standardError = FileHandle.nullDevice
    do {
      try p.run()
      print("[dokke] tailscale serve --bg 3000")
    } catch {
      print("[dokke] tailscale serve falhou: \(error)")
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
