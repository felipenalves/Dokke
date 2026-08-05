import Foundation
import Combine

final class ServerManager: ObservableObject {
  @Published var isRunning = false
  private var process: Process?
  private let serverPath: String
  private let nodePath: String

  init() {
    let projectRoot = "/Users/felipealves/FelipeOS/projetos/Felipe.aiOS/projetos/j5-dock"
    serverPath = "\(projectRoot)/server.js"
    nodePath = "/opt/homebrew/bin/node"
    // Auto-start on init — WindowGroup onAppear may never fire for MenuBarExtra
    start()
  }

  func start() {
    guard !isRunning else { return }
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: nodePath)
    proc.arguments = [serverPath]

    // Log to file for debugging
    let logPath = "/tmp/dokke-server.log"
    FileManager.default.createFile(atPath: logPath, contents: nil)
    let logFile = FileHandle(forWritingAtPath: logPath)!
    proc.standardOutput = logFile
    proc.standardError = logFile

    proc.terminationHandler = { [weak self] _ in
      DispatchQueue.main.async {
        self?.isRunning = false
        self?.process = nil
      }
    }

    do {
      try proc.run()
      process = proc
      isRunning = true
      print("[dokke] server started pid=\(proc.processIdentifier)")
    } catch {
      print("[dokke] failed to start server: \(error)")
    }
  }

  func stop() {
    guard let proc = process, proc.isRunning else { return }
    proc.terminate()
    print("[dokke] server stopped")
    process = nil
    isRunning = false
  }

  deinit {
    stop()
  }
}
