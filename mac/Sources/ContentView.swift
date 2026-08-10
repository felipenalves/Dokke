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
  @EnvironmentObject private var updater: DokkeUpdateManager
  @State private var selection: SidebarItem? = .apps
  @State private var showingReleaseNotes = false

  var body: some View {
    VStack(spacing: 0) {
      if let release = updater.release {
        UpdateBanner(release: release, showingReleaseNotes: $showingReleaseNotes)
      }

      NavigationSplitView {
        sidebar
      } detail: {
        detail
      }
      .navigationTitle("Dokke")
    }
    .task {
      await updater.check()
    }
    .sheet(isPresented: $showingReleaseNotes) {
      if let release = updater.release {
        ReleaseNotesView(release: release)
      }
    }
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
  @EnvironmentObject private var updater: DokkeUpdateManager
  @State private var showingReleaseNotes = false

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
          if updater.state == .checking {
            ProgressView().controlSize(.small)
          }
        }
        Text("Versão instalada: \(updater.currentVersion)")
          .font(.caption)
          .foregroundStyle(.secondary)
        if let message = updater.statusMessage {
          if updater.release == nil {
            Text(message)
              .font(.caption)
              .foregroundStyle(.secondary)
          } else {
            Text(message)
              .font(.caption)
              .foregroundStyle(.orange)
          }
        }
        if let release = updater.release {
          HStack(spacing: 8) {
            Label("Nova versão \(release.tag)", systemImage: "arrow.down.circle.fill")
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(.orange)
            Button {
              showingReleaseNotes = true
            } label: {
              Label("Mudanças", systemImage: "doc.text")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            Button {
              Task { await updater.downloadAndInstall() }
            } label: {
              Label("Baixar e instalar", systemImage: "arrow.down.circle.fill")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            .disabled(updater.isBusy)
          }
        } else if case .failed = updater.state {
          Button {
            Task { await updater.check() }
          } label: {
            Label("Verificar novamente", systemImage: "arrow.clockwise")
          }
          .buttonStyle(.bordered)
          .controlSize(.small)
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )
      .sheet(isPresented: $showingReleaseNotes) {
        if let release = updater.release {
          ReleaseNotesView(release: release)
        }
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

private struct UpdateBanner: View {
  @EnvironmentObject private var updater: DokkeUpdateManager
  let release: DokkeRelease
  @Binding var showingReleaseNotes: Bool

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "arrow.down.circle.fill")
        .font(.title3)
        .foregroundStyle(.orange)
      VStack(alignment: .leading, spacing: 2) {
        Text("Nova atualização disponível")
          .font(.subheadline.weight(.semibold))
        Text("Dokke \(release.tag) está pronto para baixar e instalar.")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Spacer(minLength: 12)
      Button {
        showingReleaseNotes = true
      } label: {
        Label("Mudanças", systemImage: "doc.text")
      }
      .buttonStyle(.bordered)
      .controlSize(.small)
      Button {
        Task { await updater.downloadAndInstall() }
      } label: {
        if updater.state == .downloading {
          Label("Baixando...", systemImage: "arrow.down.circle")
        } else if updater.state == .installing {
          Label("Instalando...", systemImage: "gearshape")
        } else {
          Label("Baixar e instalar", systemImage: "arrow.down.circle.fill")
        }
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.small)
      .disabled(updater.isBusy)
    }
    .padding(.horizontal, 20)
    .padding(.vertical, 10)
    .background(.orange.opacity(0.12))
    .overlay(alignment: .bottom) {
      Divider()
    }
  }
}

private struct ReleaseNotesView: View {
  @Environment(\.dismiss) private var dismiss
  let release: DokkeRelease
  private let renderedNotes: AttributedString

  init(release: DokkeRelease) {
    self.release = release
    renderedNotes = (try? AttributedString(markdown: release.notes)) ?? AttributedString(release.notes)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text("O que mudou")
            .font(.title2.bold())
          Text("Dokke \(release.tag)")
            .foregroundStyle(.secondary)
        }
        Spacer()
        Button("Fechar") {
          dismiss()
        }
        .buttonStyle(.bordered)
      }

      ScrollView {
        Text(renderedNotes)
          .frame(maxWidth: .infinity, alignment: .leading)
          .textSelection(.enabled)
      }
    }
    .padding(24)
    .frame(width: 560, height: 420)
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
