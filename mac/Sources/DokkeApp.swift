import SwiftUI

@main
struct DokkeApp: App {
  @StateObject private var store = DockStore()
  @StateObject private var server = ServerManager()
  @StateObject private var updater = DokkeUpdateManager()

  var body: some Scene {
    WindowGroup("Dokke", id: "main") {
      ContentView()
        .environmentObject(store)
        .environmentObject(server)
        .environmentObject(updater)
        .frame(minWidth: 1080, idealWidth: 1280, minHeight: 680, idealHeight: 760)
    }
    .windowResizability(.contentSize)
    .defaultSize(width: 1280, height: 760)

    MenuBarExtra("Dokke", systemImage: "square.grid.2x2") {
      MenuBarView()
        .environmentObject(store)
        .environmentObject(server)
        .environmentObject(updater)
    }
  }
}
