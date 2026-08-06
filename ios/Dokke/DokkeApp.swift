import SwiftUI

@main
struct DokkeApp: App {
  @StateObject private var store = DockStore()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(store)
        .preferredColorScheme(.dark)
    }
  }
}
