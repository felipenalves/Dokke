import SwiftUI

struct MainView: View {
  @EnvironmentObject private var store: DockStore
  @State private var tab = 0

  var body: some View {
    ZStack {
      AppBackground()

      VStack(spacing: 0) {
        header
        TabView(selection: $tab) {
          LaunchpadView()
            .tag(0)
            .tabItem { Label("Apps", systemImage: "square.grid.2x2") }
          RecentsView()
            .tag(1)
            .tabItem { Label("Abertos", systemImage: "clock") }
          OBSView()
            .tag(2)
            .tabItem { Label("OBS", systemImage: "video") }
        }
      }
    }
  }

  private var header: some View {
    HStack(spacing: 10) {
      Circle()
        .fill(store.online ? Color(red: 0.19, green: 0.82, blue: 0.345) : Color.red.opacity(0.8))
        .frame(width: 10, height: 10)
        .shadow(color: store.online ? .green.opacity(0.5) : .clear, radius: 4)
      Text(store.online ? "Conectado" : "Desconectado")
        .font(.subheadline.weight(.semibold))
        .foregroundColor(.white.opacity(0.9))

      Spacer()

      if store.devices > 0 {
        Label("\(store.devices)", systemImage: "iphone")
          .font(.caption)
          .foregroundColor(.white.opacity(0.6))
      }

      Button {
        store.logout()
      } label: {
        Image(systemName: "rectangle.portrait.and.arrow.right")
          .foregroundColor(.white.opacity(0.6))
      }
      .buttonStyle(.plain)
      .help("Sair")
    }
    .padding(.horizontal, 20)
    .padding(.top, 8)
    .padding(.bottom, 4)
  }
}
