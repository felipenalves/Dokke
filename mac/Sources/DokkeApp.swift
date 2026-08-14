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
        .frame(minWidth: 840, idealWidth: 980, minHeight: 540, idealHeight: 628)
    }
    .windowResizability(.contentSize)
    .defaultSize(width: 980, height: 628)

    MenuBarExtra("Dokke", systemImage: "square.grid.2x2") {
      MenuBarView()
        .environmentObject(store)
        .environmentObject(server)
        .environmentObject(updater)
    }
  }
}
