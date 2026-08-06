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
          Text("Digite no dispositivo J5 para acessar o dock.")
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
