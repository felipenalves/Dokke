import SwiftUI

enum SidebarItem: String, CaseIterable, Identifiable {
  case apps = "Apps"
  case about = "Sobre"

  var id: String { rawValue }

  var icon: String {
    switch self {
    case .apps: return "app.fill"
    case .about: return "info.circle"
    }
  }
}

struct ContentView: View {
  @EnvironmentObject private var store: DockStore
  @State private var selection: SidebarItem? = .apps

  var body: some View {
    NavigationSplitView {
      sidebar
    } detail: {
      detail
    }
    .navigationTitle("Dokke")
  }

  private var sidebar: some View {
    List(SidebarItem.allCases, selection: $selection) { item in
      Label(item.rawValue, systemImage: item.icon)
        .tag(item)
    }
    .listStyle(.sidebar)
    .navigationSplitViewColumnWidth(min: 160, ideal: 180, max: 220)
  }

  @ViewBuilder
  private var detail: some View {
    switch selection {
    case .apps:
      DockGridView()
    case .about:
      AboutView()
    case .none:
      DockGridView()
    }
  }
}

struct AboutView: View {
  @EnvironmentObject private var store: DockStore
  @EnvironmentObject private var server: ServerManager

  @State private var update: (tag: String, htmlUrl: String)?
  @State private var updateChecking = false
  @State private var updateNote: String?

  private func compareVersion(_ a: String, _ b: String) -> Int {
    let pa = a.trimmingCharacters(in: CharacterSet(charactersIn: "vV"))
      .split(separator: ".")
      .map { Int($0) ?? 0 }
    let pb = b.trimmingCharacters(in: CharacterSet(charactersIn: "vV"))
      .split(separator: ".")
      .map { Int($0) ?? 0 }
    for i in 0..<3 {
      let av = i < pa.count ? pa[i] : 0
      let bv = i < pb.count ? pb[i] : 0
      if av != bv { return av > bv ? 1 : -1 }
    }
    return 0
  }

  private func checkUpdate() async {
    update = nil
    updateNote = nil
    updateChecking = true
    defer { updateChecking = false }
    do {
      let u = URL(string: "http://127.0.0.1:3000/api/version")!
      let (data, _) = try await URLSession.shared.data(from: u)
      let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
      let local = json?["local"] as? [String: Any]
      let latest = json?["latest"] as? [String: Any]
      guard let lt = latest,
            let tag = lt["tag"] as? String, !tag.isEmpty,
            let localTag = local?["tag"] as? String,
            compareVersion(tag, localTag) > 0 else {
        updateNote = "Você está na versão mais recente."
        return
      }
      update = (tag: tag, htmlUrl: (lt["htmlUrl"] as? String) ?? "https://github.com/felipenalves/Dokke/releases/latest")
    } catch {
      updateNote = "Não foi possível verificar atualizações (servidor fora do ar?)."
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      Text("Sobre")
        .font(.title.bold())

      VStack(alignment: .leading, spacing: 12) {
        HStack(spacing: 10) {
          Circle()
            .fill(store.online ? Color.green : Color.red.opacity(0.85))
            .frame(width: 10, height: 10)
          Text(store.online ? "Servidor Online" : "Servidor Offline")
            .font(.headline)
        }

        if let err = store.lastError, !store.online {
          Text(err)
            .font(.caption)
            .foregroundStyle(.red)
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )

      VStack(alignment: .leading, spacing: 10) {
        LabeledContent("Dispositivos (WS)") {
          Text("\(store.devices)")
            .fontWeight(.semibold)
            .foregroundStyle(store.devices > 0 ? .green : .secondary)
        }
        LabeledContent("Apps Fixados") {
          Text("\(store.pinned.count)")
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )

      VStack(alignment: .leading, spacing: 10) {
        Text("Conectar outros dispositivos")
          .font(.headline)
        if let ip = ServerManager.lanIPv4() {
          HStack(spacing: 8) {
            Text("http://\(ip):3000")
              .font(.system(size: 15, weight: .semibold, design: .monospaced))
              .textSelection(.enabled)
            Button {
              NSPasteboard.general.clearContents()
              NSPasteboard.general.setString("http://\(ip):3000", forType: .string)
            } label: {
              Image(systemName: "doc.on.doc")
            }
            .buttonStyle(.borderless)
            .help("Copiar link")
          }
        } else {
          Text("Sem IP de rede detectado (offline?)")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        Text("Abra este link no Android, iPad ou qualquer navegador para usar o dock sem instalar nada.")
          .font(.caption)
          .foregroundStyle(.secondary)
        Text("iPhone/iPad PWA: o iOS exige HTTPS — rode `cloudflared tunnel --url http://localhost:3000` e salve a URL no Safari.")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )

      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text("Atualizações")
            .font(.headline)
          Spacer()
          if updateChecking {
            ProgressView().controlSize(.small)
          }
        }
        if let note = updateNote {
          Text(note)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        if let upd = update {
          HStack(spacing: 8) {
            Label("Nova versão \(upd.tag) disponível", systemImage: "arrow.down.circle.fill")
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(.orange)
            Button("Baixar") {
              if let u = URL(string: upd.htmlUrl) {
                NSWorkspace.shared.open(u)
              }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
          }
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )
      .task {
        await checkUpdate()
      }

      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text("Código de acesso")
            .font(.headline)
          Spacer()
          Button("Gerar novo código") {
            Task { await store.resetPin() }
          }
          .buttonStyle(.link)
        }
        HStack(spacing: 8) {
          Text(store.pinCode ?? "—")
            .font(.system(size: 28, weight: .bold, design: .monospaced))
            .tracking(4)
          Text("Digite no dispositivo (Android, iPhone) para acessar o dock.")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        if let err = store.pinError {
          Text(err)
            .font(.caption)
            .foregroundStyle(.red)
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )

      VStack(alignment: .leading, spacing: 8) {
        Text("Base URL")
          .font(.headline)
        TextField("http://127.0.0.1:3000", text: $store.baseURL)
          .textFieldStyle(.roundedBorder)
      }

      Text("O servidor inicia automaticamente ao abrir o Dokke.")
        .font(.caption)
        .foregroundStyle(.secondary)

      Button {
        Task { await store.refreshAll() }
      } label: {
        Label("Atualizar", systemImage: "arrow.clockwise")
      }
      .buttonStyle(.bordered)

      Spacer()
    }
    .padding(20)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct MenuBarView: View {
  @EnvironmentObject private var store: DockStore
  @EnvironmentObject private var server: ServerManager

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(store.online ? "Dokke online" : "Dokke offline")
      Text("Dispositivos: \(store.devices) · Fixados: \(store.pinned.count)")
        .foregroundStyle(.secondary)
      if let note = store.lastSyncNote {
        Text(note)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Divider()
      Button("Atualizar") {
        Task { await store.refreshAll() }
      }
      Divider()
      Button("Sair") {
        server.stop()
        NSApplication.shared.terminate(nil)
      }
    }
    .padding(8)
  }
}
