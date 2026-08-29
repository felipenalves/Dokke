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

private enum MenuBarIconImage {
  static let image: NSImage = {
    let image = NSImage(
      size: NSSize(width: 18, height: 18),
      flipped: true
    ) { rect in
      let cell = min(rect.width / 12.5, rect.height / 5)
      let glyphWidth = cell * 5
      let gap = cell * 2.5
      let originX = (rect.width - (glyphWidth * 2 + gap)) / 2
      let originY = (rect.height - cell * 5) / 2
      let pixels: [(Int, Int)] = [
        (0, 0), (4, 0),
        (1, 1), (3, 1),
        (2, 2),
        (1, 3), (3, 3),
        (0, 4), (4, 4)
      ]

      NSColor.black.setFill()
      for glyph in 0..<2 {
        let glyphX = originX + CGFloat(glyph) * (glyphWidth + gap)
        for (x, y) in pixels {
          NSBezierPath(
            rect: NSRect(
              x: glyphX + CGFloat(x) * cell,
              y: originY + CGFloat(y) * cell,
              width: cell,
              height: cell
            )
          ).fill()
        }
      }
      return true
    }
    image.isTemplate = true
    return image
  }()
}

private struct MenuBarIcon: View {
  var body: some View {
    Image(nsImage: MenuBarIconImage.image)
      .renderingMode(.template)
      .foregroundStyle(.primary)
    .frame(width: 18, height: 18)
  }
}

@main
struct DokkeApp: App {
  @StateObject private var store = DockStore()
  @StateObject private var server = ServerManager()
  @StateObject private var updater = DokkeUpdateManager()
  @StateObject private var languageStore = LanguageStore()

  var body: some Scene {
    Window("Dokke", id: "main") {
      ContentView()
        .environmentObject(store)
        .environmentObject(server)
        .environmentObject(updater)
        .environmentObject(languageStore)
        .background(WindowStyleConfigurator())
        .frame(minWidth: 840, idealWidth: 980, minHeight: 540, idealHeight: 628)
    }
    .windowStyle(.hiddenTitleBar)
    .windowResizability(.contentMinSize)
    .defaultSize(width: 980, height: 628)

    MenuBarExtra {
      MenuBarView()
        .environmentObject(store)
        .environmentObject(server)
        .environmentObject(updater)
        .environmentObject(languageStore)
    } label: {
      MenuBarIcon()
        .accessibilityLabel("Dokke")
    }
  }
}
