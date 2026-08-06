import SwiftUI

@main
struct J5DockMacApp: App {
  @StateObject private var store = DockStore()
  @StateObject private var server = ServerManager()

  var body: some Scene {
    WindowGroup("Dokke") {
      ContentView()
        .environmentObject(store)
        .environmentObject(server)
        .frame(minWidth: 760, idealWidth: 800, minHeight: 500, idealHeight: 520)
    }
    .windowResizability(.contentSize)
    .defaultSize(width: 800, height: 520)

    MenuBarExtra("Dokke", systemImage: "square.grid.2x2") {
      MenuBarView()
        .environmentObject(store)
        .environmentObject(server)
    }
  }
}
