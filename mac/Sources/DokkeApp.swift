import SwiftUI
import AppKit

struct WindowStyleConfigurator: NSViewRepresentable {
  func makeNSView(context: Context) -> NSView {
    WindowStyleView()
  }

  func updateNSView(_ nsView: NSView, context: Context) {}

  private final class WindowStyleView: NSView {
    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      guard let window else { return }
      configure(window)
    }

    private func configure(_ window: NSWindow) {
      if !window.titlebarAppearsTransparent { window.titlebarAppearsTransparent = true }
      if window.titleVisibility != .hidden { window.titleVisibility = .hidden }
      if window.titlebarSeparatorStyle != .none { window.titlebarSeparatorStyle = .none }
      window.styleMask.insert(.fullSizeContentView)
    }
  }
}

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
        .background(WindowStyleConfigurator())
        .frame(minWidth: 840, idealWidth: 980, minHeight: 540, idealHeight: 628)
    }
    .windowStyle(.hiddenTitleBar)
    .windowResizability(.contentMinSize)
    .defaultSize(width: 980, height: 628)

    MenuBarExtra("Dokke", systemImage: "square.grid.2x2") {
      MenuBarView()
        .environmentObject(store)
        .environmentObject(server)
        .environmentObject(updater)
    }
  }
}
