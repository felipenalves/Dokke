import AppKit
import SwiftUI

private struct AppKitHoverTracker: NSViewRepresentable {
  @Binding var isHovered: Bool

  func makeCoordinator() -> Coordinator {
    Coordinator(isHovered: $isHovered)
  }

  func makeNSView(context: Context) -> TrackingView {
    let view = TrackingView()
    view.onHoverChanged = context.coordinator.setHovered
    return view
  }

  func updateNSView(_ nsView: TrackingView, context: Context) {
    context.coordinator.isHovered = $isHovered
    nsView.onHoverChanged = context.coordinator.setHovered
  }

  final class Coordinator {
    var isHovered: Binding<Bool>

    init(isHovered: Binding<Bool>) {
      self.isHovered = isHovered
    }

    func setHovered(_ hovered: Bool) {
      DispatchQueue.main.async { [weak self] in
        guard let self, self.isHovered.wrappedValue != hovered else { return }
        self.isHovered.wrappedValue = hovered
      }
    }
  }

  final class TrackingView: NSView {
    var onHoverChanged: ((Bool) -> Void)?
    private var hoverTrackingArea: NSTrackingArea?

    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      if window != nil {
        DockHoverCoordinator.shared.register(self)
      } else {
        DockHoverCoordinator.shared.unregister(self)
      }
    }

    override func updateTrackingAreas() {
      super.updateTrackingAreas()

      if let hoverTrackingArea {
        removeTrackingArea(hoverTrackingArea)
      }

      let area = NSTrackingArea(
        rect: bounds,
        options: [.mouseEnteredAndExited, .activeAlways],
        owner: self,
        userInfo: nil
      )
      addTrackingArea(area)
      hoverTrackingArea = area
    }

    override func mouseEntered(with event: NSEvent) {
      refreshHoverFromCursor()
    }

    override func mouseExited(with event: NSEvent) {
      onHoverChanged?(false)
    }

    func refreshHoverFromCursor() {
      guard let window, window.isVisible, !isHiddenOrHasHiddenAncestor, alphaValue > 0.01 else {
        onHoverChanged?(false)
        return
      }
      let windowPoint = window.convertPoint(fromScreen: NSEvent.mouseLocation)
      let localPoint = convert(windowPoint, from: nil)
      onHoverChanged?(bounds.contains(localPoint))
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
      nil
    }
  }
}

private final class DockHoverCoordinator {
  static let shared = DockHoverCoordinator()

  private struct WeakView {
    weak var view: AppKitHoverTracker.TrackingView?
  }

  private var views: [WeakView] = []
  private var monitor: Any?
  private var refreshTimer: Timer?

  func register(_ view: AppKitHoverTracker.TrackingView) {
    views.removeAll { $0.view == nil || $0.view === view }
    views.append(WeakView(view: view))
    startIfNeeded()
  }

  func unregister(_ view: AppKitHoverTracker.TrackingView) {
    views.removeAll { $0.view == nil || $0.view === view }
  }

  private func startIfNeeded() {
    guard monitor == nil, refreshTimer == nil else { return }
    monitor = NSEvent.addLocalMonitorForEvents(
      matching: [.mouseMoved, .leftMouseDragged, .otherMouseDragged, .scrollWheel, .leftMouseDown, .rightMouseDown, .otherMouseDown]
    ) { [weak self] event in
      self?.refreshAll()
      return event
    }
    refreshTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
      self?.refreshAll()
    }
  }

  private func refreshAll() {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      views.removeAll { $0.view == nil }
      for box in views {
        box.view?.refreshHoverFromCursor()
      }
    }
  }
}

private struct JiggleModifier: ViewModifier {
  let isActive: Bool
  let seed: Int
  @State private var isWiggling = false

  func body(content: Content) -> some View {
    content
      .rotationEffect(.degrees(isActive ? (isWiggling ? 2.2 : -2.2) : 0), anchor: .center)
      .animation(
        isActive
          ? .easeInOut(duration: 0.28 + Double(abs(seed) % 3) * 0.02).repeatForever(autoreverses: true)
          : .easeOut(duration: 0.22),
        value: isWiggling
      )
      .onAppear {
        guard isActive else { return }
        let delay = Double(abs(seed) % 7) * 0.038
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { isWiggling = true }
      }
      .onChange(of: isActive) { _, newValue in
        if newValue {
          let delay = Double(abs(seed) % 7) * 0.038
          DispatchQueue.main.asyncAfter(deadline: .now() + delay) { isWiggling = true }
        } else {
          isWiggling = false
        }
      }
  }
}

private struct HoverControlGlassModifier: ViewModifier {
  let isInteractive: Bool

  func body(content: Content) -> some View {
    if #available(macOS 26, *) {
      if isInteractive {
        content
          .glassEffect(.clear.interactive(), in: Circle())
      } else {
        content
          .glassEffect(.clear, in: Circle())
      }
    } else {
      content
        .background(.ultraThinMaterial, in: Circle())
    }
  }
}

struct DockIcon: View {
  @EnvironmentObject private var store: DockStore
  let name: String
  let allowsRemoval: Bool
  var isReordering: Bool = false
  @State private var isHovered = false

  private let iconSize: CGFloat = 68
  private let iconCardSize: CGFloat = 80
  private let cornerRadius: CGFloat = 20
  private let hoverBlurRadius: CGFloat = 4

  private var iconCardBorder: some View {
    RoundedRectangle(cornerRadius: 28, style: .continuous)
      .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
  }

  private var iconCardSurface: some View {
    RoundedRectangle(cornerRadius: 28, style: .continuous)
      .fill(Color.white.opacity(0.07))
      .overlay(
        RoundedRectangle(cornerRadius: 28, style: .continuous)
          .fill(DokkeTheme.page.opacity(0.26))
      )
      .overlay(iconCardBorder)
  }

  var body: some View {
    VStack(spacing: 8) {
      ZStack(alignment: .topLeading) {
        iconCardSurface
        .frame(width: iconCardSize, height: iconCardSize)

        iconWithEffects
          .padding(6)
          .zIndex(1)

        if allowsRemoval && isHovered {
          Button {
            Task { await store.unpin(name) }
          } label: {
            ZStack {
              RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color.black.opacity(0.10))
              iconCardBorder

              VStack(spacing: 3) {
                ZStack {
                  Circle()
                    .fill(Color.black.opacity(0.64))
                  Capsule()
                    .fill(Color.white)
                    .frame(width: 10, height: 2)
                }
                .frame(width: 22, height: 22)
                .modifier(HoverControlGlassModifier(isInteractive: true))

                Text("Remover")
                  .font(.system(size: 9, weight: .semibold))
                  .foregroundStyle(.white)
              }
            }
            .frame(width: iconCardSize, height: iconCardSize)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .help("Remover app fixado")
          .accessibilityLabel("Remover app fixado")
          .frame(width: iconCardSize, height: iconCardSize)
          .zIndex(5)
        }
      }
      .frame(width: iconCardSize, height: iconCardSize)
      .contentShape(Rectangle())
      .overlay {
        if allowsRemoval || isReordering {
          AppKitHoverTracker(isHovered: $isHovered)
            .frame(width: iconCardSize, height: iconCardSize)
        }
      }
      .overlay {
        if isReordering && isHovered {
          ZStack {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
              .fill(Color.black.opacity(0.10))
            iconCardBorder
            VStack(spacing: 3) {
              ZStack {
                Circle()
                  .fill(Color.black.opacity(0.64))
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                  .font(.system(size: 13, weight: .semibold))
                  .foregroundStyle(.white)
              }
                .frame(width: 22, height: 22)
                .modifier(HoverControlGlassModifier(isInteractive: false))
              Text("Mover")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.white)
            }
          }
          .frame(width: iconCardSize, height: iconCardSize)
          .contentShape(Rectangle())
          .zIndex(5)
          .allowsHitTesting(false)
        }
      }

      Text(name)
        .font(.system(size: 11))
        .lineLimit(1)
        .truncationMode(.middle)
        .frame(width: 88)
        .foregroundStyle(.primary)
        .multilineTextAlignment(.center)
    }
    .frame(width: iconCardSize, height: iconCardSize + 24)
    .contentShape(Rectangle())
    .onTapGesture { /* future: launch app */ }
    .contextMenu {
      Button("Remover do Dock") {
        Task { await store.unpin(name) }
      }
    }
  }

  @ViewBuilder
  private var iconWithEffects: some View {
    iconImage
      .modifier(JiggleModifier(isActive: isReordering, seed: name.hashValue))
      .frame(width: iconSize, height: iconSize)
      .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
      .blur(radius: isHovered ? hoverBlurRadius : 0)
      .shadow(color: .black.opacity(isHovered ? 0.18 : 0.1), radius: isHovered ? 8 : 4, y: isHovered ? 4 : 2)
      .scaleEffect(isHovered ? 1.08 : 1.0, anchor: .center)
      .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isHovered)
  }

  @ViewBuilder
  private var iconImage: some View {
    if let native = store.nativeIcon(for: name) {
      Image(nsImage: native)
        .resizable()
        .scaledToFit()
    } else if let cached = store.cachedIcon(for: name) {
      cached.resizable().scaledToFit()
    } else {
      AsyncImage(url: store.iconURL(for: name)) { phase in
        switch phase {
        case .success(let img):
          img.resizable().scaledToFit()
        default:
          ZStack {
            RoundedRectangle(cornerRadius: cornerRadius)
              .fill(Color.white.opacity(0.14))
            Text(String(name.prefix(1)))
              .font(.title.bold())
              .foregroundStyle(.white)
          }
        }
      }
    }
  }
}
