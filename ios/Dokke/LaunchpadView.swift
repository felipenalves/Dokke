import SwiftUI

struct LaunchpadView: View {
  @EnvironmentObject private var store: DockStore
  private let columns = [GridItem(.adaptive(minimum: 84), spacing: 16)]

  var body: some View {
    ScrollView {
      if store.pinned.isEmpty {
        VStack(spacing: 14) {
          Image(systemName: "app.dashed")
            .font(.system(size: 40))
            .foregroundColor(.white.opacity(0.4))
          Text("Nenhum app fixado")
            .font(.headline)
            .foregroundColor(.white.opacity(0.8))
          Text("Adicione apps no Dokke do Mac para aparecerem aqui.")
            .font(.subheadline)
            .foregroundColor(.white.opacity(0.5))
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 320)
      } else {
        LazyVGrid(columns: columns, spacing: 22) {
          ForEach(store.pinned, id: \.self) { name in
            AppTile(
              name: name,
              isRunning: store.running.contains { $0.name == name },
              data: store.icon(name)
            ) {
              store.activate(name)
            }
            .contextMenu {
              Button(role: .destructive) {
                store.unpin(name)
              } label: {
                Label("Remover do dock", systemImage: "pin.slash")
              }
            }
          }
        }
        .padding(20)
      }
    }
    .refreshable {
      await store.refreshAll()
    }
    .onAppear {
      Task { await store.refreshInstalled() }
    }
  }
}
