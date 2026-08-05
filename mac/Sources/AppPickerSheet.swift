import SwiftUI

struct AppPickerSheet: View {
  @EnvironmentObject private var store: DockStore
  @Environment(\.dismiss) private var dismiss
  @State private var search = ""

  private var filteredApps: [InstalledApp] {
    let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let sorted = store.installed.sorted {
      let aPinned = store.isPinned($0.name)
      let bPinned = store.isPinned($1.name)
      if aPinned != bPinned { return aPinned && !bPinned }
      return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
    }
    if q.isEmpty { return sorted }
    return sorted.filter { $0.name.lowercased().contains(q) }
  }

  var body: some View {
    VStack(spacing: 0) {
      HStack {
        Text("Adicionar Apps")
          .font(.headline)
        Spacer()
        Button("Concluir") { dismiss() }
          .buttonStyle(.borderedProminent)
      }
      .padding(16)

      Divider()

      HStack {
        Image(systemName: "magnifyingglass")
          .foregroundStyle(.secondary)
        TextField("Buscar apps...", text: $search)
          .textFieldStyle(.plain)
        if !search.isEmpty {
          Button { search = "" } label: {
            Image(systemName: "xmark.circle.fill")
              .foregroundStyle(.secondary)
          }
          .buttonStyle(.plain)
        }
      }
      .padding(10)
      .background(
        RoundedRectangle(cornerRadius: 8)
          .fill(.quaternary)
      )
      .padding(.horizontal, 16)
      .padding(.vertical, 8)

      Divider()

      if filteredApps.isEmpty {
        ContentUnavailableView(
          search.isEmpty ? "Nenhum app encontrado" : "Sem resultados",
          systemImage: "app.dashed",
          description: Text(search.isEmpty ? "O servidor não retornou apps instalados." : "Tente uma busca diferente.")
        )
      } else {
        List(filteredApps) { app in
          appRow(app)
        }
        .listStyle(.inset)
      }
    }
    .frame(width: 420, height: 480)
  }

  private func appRow(_ app: InstalledApp) -> some View {
    HStack(spacing: 10) {
      AsyncImage(url: store.iconURL(for: app.name)) { phase in
        switch phase {
        case .success(let img):
          img.resizable().scaledToFit()
        default:
          ZStack {
            RoundedRectangle(cornerRadius: 8).fill(.quaternary)
            Text(String(app.name.prefix(1))).font(.headline)
          }
        }
      }
      .frame(width: 32, height: 32)
      .clipShape(RoundedRectangle(cornerRadius: 8))

      Text(app.name)
        .lineLimit(1)

      Spacer()

      if store.isPinned(app.name) {
        Label("Adicionado", systemImage: "checkmark.circle.fill")
          .font(.caption)
          .foregroundStyle(.green)
      } else {
        Button("Adicionar") {
          Task { await store.pin(app.name) }
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .disabled(store.busyName == app.name)
      }
    }
  }
}
