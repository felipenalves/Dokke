import Foundation
import SwiftUI

/// Estado global do app: auth, conexão com o Mac e dados do dock.
@MainActor
final class DockStore: ObservableObject {
  @Published var serverURL: String {
    didSet { UserDefaults.standard.set(serverURL, forKey: "DockServerURL") }
  }
  @Published var authed = false
  @Published var authError: String?
  @Published var authenticating = false
  @Published var loading = false

  @Published var online = false
  @Published var devices = 0
  @Published var pinned: [String] = []
  @Published var running: [RunningApp] = []
  @Published var installed: [InstalledApp] = []
  @Published var obs = ObsSnapshot()
  @Published var icons: [String: Data] = [:]

  private var client: DockAPIClient
  private var ws: URLSessionWebSocketTask?
  private var poll: Task<Void, Never>?

  init() {
    let saved = UserDefaults.standard.string(forKey: "DockServerURL") ?? "http://192.168.1.2:3000"
    self.serverURL = saved
    self.client = DockAPIClient(baseURLString: saved)
  }

  // MARK: - Config

  func setServer(_ raw: String) {
    let v = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !v.isEmpty else { return }
    serverURL = v
    client = DockAPIClient(baseURLString: v)
    // se trocar o servidor estando autenticado, limpa estado e re-autentica
    authed = false
    stopPolling()
  }

  // MARK: - Auth

  func login(pin: String) async {
    authenticating = true
    authError = nil
    defer { authenticating = false }
    do {
      try await client.login(pin: pin)
      authed = true
      startPolling()
    } catch {
      if case DockAPIError.rateLimited = error {
        authError = "Muitas tentativas — aguarde um pouco."
      } else if case DockAPIError.transport = error {
        authError = "Não foi possível alcançar o Mac. Confira o endereço."
      } else if case DockAPIError.notAuthed = error {
        authError = "Código errado."
      } else {
        authError = "Código errado."
      }
    }
  }

  func logout() {
    authed = false
    stopPolling()
    ws?.cancel()
    ws = nil
  }

  // MARK: - Comandos

  func activate(_ name: String) {
    Task { try? await client.activate(name) }
  }
  func pin(_ name: String) {
    Task { try? await client.pinApp(name); await refreshApps() }
  }
  func unpin(_ name: String) {
    Task { try? await client.unpin(name); await refreshApps() }
  }
  func obsAction(_ kind: String) {
    Task { try? await client.obsAction(kind); await refreshObs() }
  }
  func obsScene(_ scene: String) {
    Task { try? await client.obsScene(scene); await refreshObs() }
  }

  func refreshInstalled() async {
    if let a = try? await client.fetchInstalled() { installed = a }
  }

  // MARK: - Polling + WS

  private func startPolling() {
    stopPolling()
    poll = Task { [weak self] in
      while !Task.isCancelled {
        await self?.refreshAll()
        try? await Task.sleep(nanoseconds: 4_000_000_000)
      }
    }
    connectWS()
  }
  func stopPolling() {
    poll?.cancel()
    poll = nil
  }

  private func connectWS() {
    ws?.cancel()
    guard let t = client.makeWebSocket() else { return }
    ws = t
    t.resume()
    receiveLoop(t)
  }

  private func receiveLoop(_ t: URLSessionWebSocketTask) {
    t.receive { [weak self] res in
      Task { @MainActor in
        guard let self = self else { return }
        switch res {
        case .success(let msg):
          if case .string(let s) = msg { self.handleWS(s) }
          if self.ws === t { self.receiveLoop(t) }
        case .failure:
          if self.ws === t { self.ws = nil }
        }
      }
    }
  }

  private func handleWS(_ raw: String) {
    guard let d = raw.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return }
    switch obj["type"] as? String {
    case "online":
      online = (obj["online"] as? Bool) ?? online
    case "apps":
      if let p = obj["pinned"] as? [String] { pinned = p }
      if let r = obj["running"] as? [[String: Any]] {
        running = r.compactMap { dict -> RunningApp? in
          guard let name = dict["name"] as? String else { return nil }
          return RunningApp(name: name, pid: dict["pid"] as? Int, type: dict["type"] as? String)
        }
        preloadIcons(for: running.map { $0.name })
      }
    default:
      break
    }
  }

  // MARK: - Refresh

  func refreshAll() async {
    await withTaskGroup(of: Void.self) { group in
      group.addTask { await self.refreshStatus() }
      group.addTask { await self.refreshApps() }
      group.addTask { await self.refreshObs() }
    }
  }

  func refreshStatus() async {
    if let s = try? await client.fetchStatus() {
      online = s.ok == true
      devices = s.devices ?? 0
      if let p = s.config?.pinned { pinned = p }
    } else {
      online = false
    }
  }

  func refreshApps() async {
    if let p = try? await client.fetchApps() {
      online = true
      if let pinnedList = p.pinned { pinned = pinnedList }
      if let run = p.running {
        running = run
        preloadIcons(for: run.map { $0.name })
      }
    }
  }

  func refreshObs() async {
    if let s = try? await client.fetchObs() { obs = s }
  }

  // MARK: - Ícones

  func preloadIcons(for names: [String]) {
    for n in names where icons[n] == nil {
      Task { [weak self] in
        if let d = await self?.client.iconData(n), !d.isEmpty {
          self?.icons[n] = d
        }
      }
    }
  }
  func icon(_ name: String) -> Data? { icons[name] }
}
