import AppKit
import Foundation
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
      DockHoverCoordinator.shared.invalidateLayout()
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
  private var needsRefresh = true
  private var lastMouseLocation: NSPoint?

  func register(_ view: AppKitHoverTracker.TrackingView) {
    views.removeAll { $0.view == nil || $0.view === view }
    views.append(WeakView(view: view))
    needsRefresh = true
    startIfNeeded()
    refreshAll(force: true)
  }

  func unregister(_ view: AppKitHoverTracker.TrackingView) {
    views.removeAll { $0.view == nil || $0.view === view }
    if views.isEmpty { stopIfNeeded() }
  }

  func invalidateLayout() {
    needsRefresh = true
    refreshAll(force: true)
  }

  private func startIfNeeded() {
    guard monitor == nil, refreshTimer == nil else { return }
    monitor = NSEvent.addLocalMonitorForEvents(
      matching: [.mouseMoved, .leftMouseDragged, .otherMouseDragged, .scrollWheel, .leftMouseDown, .rightMouseDown, .otherMouseDown]
    ) { [weak self] event in
      self?.refreshAll(force: event.type != .mouseMoved)
      return event
    }
    refreshTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
      self?.refreshAll()
    }
  }

  private func refreshAll(force: Bool = false) {
    views.removeAll { $0.view == nil }
    stopIfNeeded()
    guard !views.isEmpty else { return }

    let cursor = NSEvent.mouseLocation
    guard force || needsRefresh || cursor != lastMouseLocation else { return }
    needsRefresh = false
    lastMouseLocation = cursor
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.views.removeAll { $0.view == nil }
      self.stopIfNeeded()
      for box in self.views {
        box.view?.refreshHoverFromCursor()
      }
    }
  }

  private func stopIfNeeded() {
    guard views.isEmpty else { return }
    if let monitor {
      NSEvent.removeMonitor(monitor)
      self.monitor = nil
    }
    refreshTimer?.invalidate()
    refreshTimer = nil
    lastMouseLocation = nil
    needsRefresh = true
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

enum WebsiteFaviconSource {
  static func urls(for rawURL: String) -> [URL] {
    let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
    let candidate = trimmed.range(of: "^[a-z][a-z\\d+.-]*:", options: .regularExpression) == nil
      ? "https://\(trimmed)"
      : trimmed
    guard let siteURL = URL(string: candidate), let host = siteURL.host else { return [] }

    let normalizedHost = host.lowercased().replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression)
    var urls: [URL] = []
    var seen = Set<String>()

    func add(_ url: URL?) {
      guard let url, seen.insert(url.absoluteString).inserted else { return }
      urls.append(url)
    }

    switch normalizedHost {
    case "github.com":
      add(URL(string: "https://github.com/apple-touch-icon.png"))
    case "whatsapp.com":
      add(URL(string: "https://whatsapp.com/favicon.ico"))
    case "youtube.com":
      add(URL(string: "https://www.youtube.com/s/desktop/f13793d9/img/favicon_144x144.png"))
    case "pinterest.com":
      add(URL(string: "https://s.pinimg.com/webapp/logo_transparent_144x144-3da7a67b.png"))
    case "linkedin.com":
      add(URL(string: "https://www.linkedin.com/favicon.ico"))
    case "tiktok.com":
      add(URL(string: "https://www.tiktok.com/favicon.ico"))
    default:
      break
    }

    var components = URLComponents()
    components.scheme = "https"
    components.host = host
    components.path = "/apple-touch-icon.png"
    add(components.url)

    components.scheme = siteURL.scheme ?? "https"
    components.path = "/favicon.ico"
    add(components.url)

    var googleComponents = URLComponents()
    googleComponents.scheme = "https"
    googleComponents.host = "www.google.com"
    googleComponents.path = "/s2/favicons"
    googleComponents.queryItems = [
      URLQueryItem(name: "domain", value: normalizedHost),
      URLQueryItem(name: "sz", value: "128"),
    ]
    add(googleComponents.url)

    return urls
  }
}

@MainActor
final class WebsiteFaviconLoader: ObservableObject {
  @Published private(set) var image: NSImage?
  private var loadedURL = ""

  func load(rawURL: String) async {
    guard !rawURL.isEmpty, loadedURL != rawURL || image == nil else { return }
    loadedURL = rawURL
    image = nil

    guard let pageURL = WebsiteFaviconSource.pageURL(for: rawURL) else { return }
    let discovered = await discoveredIconURLs(from: pageURL)
    var candidates = discovered
    var seen = Set<URL>()
    candidates.append(contentsOf: WebsiteFaviconSource.urls(for: rawURL))

    for candidate in candidates where seen.insert(candidate).inserted {
      do {
        try Task.checkCancellation()
      } catch {
        return
      }
      guard let resolved = await image(from: candidate) else { continue }
      image = resolved
      return
    }
  }

  private func discoveredIconURLs(from pageURL: URL) async -> [URL] {
    var request = URLRequest(url: pageURL)
    request.timeoutInterval = 6
    request.setValue("text/html,application/xhtml+xml", forHTTPHeaderField: "Accept")
    request.setValue("Mozilla/5.0 Dokke/1.0", forHTTPHeaderField: "User-Agent")

    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let httpResponse = response as? HTTPURLResponse,
            (200..<400).contains(httpResponse.statusCode),
            let html = String(data: data, encoding: .utf8) else { return [] }
      let baseURL = httpResponse.url ?? pageURL
      return Self.parseIconLinks(from: html, baseURL: baseURL)
    } catch {
      return []
    }
  }

  private func image(from url: URL) async -> NSImage? {
    var request = URLRequest(url: url)
    request.timeoutInterval = 6
    request.setValue("image/avif,image/webp,image/png,image/x-icon,image/*;q=0.8", forHTTPHeaderField: "Accept")

    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let httpResponse = response as? HTTPURLResponse,
            (200..<400).contains(httpResponse.statusCode) else { return nil }
      return NSImage(data: data)
    } catch {
      return nil
    }
  }

  private struct IconLink {
    let url: URL
    let score: Int
  }

  private static func parseIconLinks(from html: String, baseURL: URL) -> [URL] {
    guard let linkRegex = try? NSRegularExpression(
      pattern: "<link\\b[^>]*>",
      options: [.caseInsensitive]
    ) else { return [] }
    let linkRange = NSRange(html.startIndex..<html.endIndex, in: html)
    let attributeRegex = try? NSRegularExpression(
      pattern: "(href|rel|sizes|type)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))",
      options: [.caseInsensitive]
    )
    var links: [IconLink] = []

    for match in linkRegex.matches(in: html, range: linkRange) {
      guard let tagRange = Range(match.range, in: html),
            let attributeRegex else { continue }
      let tag = String(html[tagRange])
      let tagNSRange = NSRange(tag.startIndex..<tag.endIndex, in: tag)
      var attributes: [String: String] = [:]

      for attribute in attributeRegex.matches(in: tag, range: tagNSRange) {
        guard let keyRange = Range(attribute.range(at: 1), in: tag) else { continue }
        let key = String(tag[keyRange]).lowercased()
        let valueRange = [2, 3, 4].compactMap { Range(attribute.range(at: $0), in: tag) }.first
        if let valueRange {
          attributes[key] = String(tag[valueRange])
        }
      }

      let rels = Set((attributes["rel"] ?? "").lowercased().split { $0 == " " || $0 == "\t" })
      let isIcon = rels.contains("icon") || rels.contains("shortcut") || rels.contains("apple-touch-icon") || rels.contains("apple-touch-icon-precomposed")
      guard isIcon, let href = attributes["href"], !href.isEmpty,
            !href.lowercased().hasPrefix("data:"),
            !(attributes["type"] ?? "").lowercased().contains("svg"),
            !href.lowercased().contains(".svg"),
            let url = URL(string: href, relativeTo: baseURL)?.absoluteURL else { continue }

      let sizes = (attributes["sizes"] ?? "").split(separator: " ").compactMap { token -> Int? in
        let dimension = token.split(separator: "x").compactMap { Int($0) }
        return dimension.max()
      }.max() ?? 0
      let isAppleTouch = rels.contains("apple-touch-icon") || rels.contains("apple-touch-icon-precomposed")
      links.append(IconLink(url: url, score: sizes + (isAppleTouch ? 1_000 : 0)))
    }

    var seen = Set<URL>()
    return links
      .sorted { $0.score > $1.score }
      .compactMap { seen.insert($0.url).inserted ? $0.url : nil }
      .prefix(8)
      .map { $0 }
  }
}

extension WebsiteFaviconSource {
  static func pageURL(for rawURL: String) -> URL? {
    let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    let candidate = trimmed.range(of: "^[a-z][a-z\\d+.-]*:", options: .regularExpression) == nil
      ? "https://\(trimmed)"
      : trimmed
    return URL(string: candidate)
  }
}

struct WebsiteFaviconView: View {
  let rawURL: String
  let imageSize: CGFloat
  let fallbackSize: CGFloat
  let imageCornerRadius: CGFloat
  @StateObject private var loader = WebsiteFaviconLoader()

  init(rawURL: String, imageSize: CGFloat, fallbackSize: CGFloat, imageCornerRadius: CGFloat) {
    self.rawURL = rawURL
    self.imageSize = imageSize
    self.fallbackSize = fallbackSize
    self.imageCornerRadius = imageCornerRadius
  }

  var body: some View {
    Group {
      if let image = loader.image {
        resolvedImage(image)
      } else {
        fallbackGlyph
      }
    }
    .task(id: rawURL) {
      await loader.load(rawURL: rawURL)
    }
  }

  private func resolvedImage(_ image: NSImage) -> some View {
    Image(nsImage: image)
      .resizable()
      .interpolation(.high)
      .scaledToFit()
      .frame(width: imageSize, height: imageSize)
      .clipShape(RoundedRectangle(cornerRadius: imageCornerRadius, style: .continuous))
  }

  private var fallbackGlyph: some View {
    Image(systemName: "globe")
      .font(.system(size: fallbackSize, weight: .medium))
      .foregroundStyle(.black.opacity(0.58))
  }
}

struct DockIcon: View {
  @EnvironmentObject private var store: DockStore
  let piece: DockPiece
  let allowsRemoval: Bool
  var isReordering: Bool = false
  @State private var isHovered = false

  private var name: String {
    piece.type == .app ? (piece.name ?? piece.displayTitle) : piece.id
  }

  init(piece: DockPiece, allowsRemoval: Bool, isReordering: Bool = false) {
    self.piece = piece
    self.allowsRemoval = allowsRemoval
    self.isReordering = isReordering
  }

  init(name: String, allowsRemoval: Bool, isReordering: Bool = false) {
    self.init(piece: .app(name), allowsRemoval: allowsRemoval, isReordering: isReordering)
  }

  private let iconSize: CGFloat = 68
  private let iconCardSize: CGFloat = 80
  private let cornerRadius: CGFloat = 20
  private let hoverBlurRadius: CGFloat = 4

  private var iconCardBorder: some View {
    RoundedRectangle(cornerRadius: 28, style: .continuous)
      .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
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
          .help(piece.type == .website ? "Remover site fixado" : "Remover app fixado")
          .accessibilityLabel(piece.type == .website ? "Remover site fixado" : "Remover app fixado")
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

      Text(piece.displayTitle)
        .font(.system(size: 12, weight: .semibold))
        .lineLimit(1)
        .truncationMode(.tail)
        .frame(width: 88)
        .foregroundStyle(.primary)
        .multilineTextAlignment(.center)
    }
    .frame(width: iconCardSize, height: iconCardSize + 24)
    .contentShape(Rectangle())
    .onTapGesture {
      guard piece.type == .website else { return }
      Task { await store.openWebsite(piece.id) }
    }
    .contextMenu {
      Button("Remover do Dock") {
        Task { await store.unpin(name) }
      }
    }
  }

  @ViewBuilder
  private var iconWithEffects: some View {
    iconImage
      .modifier(JiggleModifier(isActive: isReordering, seed: piece.id.hashValue))
      .frame(width: iconSize, height: iconSize)
      .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
      .blur(radius: isHovered ? hoverBlurRadius : 0)
      .shadow(color: .black.opacity(isHovered ? 0.18 : 0.1), radius: isHovered ? 8 : 4, y: isHovered ? 4 : 2)
      .scaleEffect(isHovered ? 1.08 : 1.0, anchor: .center)
      .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isHovered)
  }

  @ViewBuilder
  private var iconImage: some View {
    switch piece.type {
    case .app:
      let name = piece.name ?? piece.displayTitle
      if let native = store.nativeIcon(for: name) {
        Image(nsImage: native).resizable().scaledToFit()
      } else if let cached = store.cachedIcon(for: name) {
        cached.resizable().scaledToFit()
      } else {
        AsyncImage(url: store.iconURL(for: name)) { phase in
          fallbackIcon(phase: phase, label: name)
        }
    }
    case .website:
      websiteIconImage
    }
  }

  @ViewBuilder
  private var websiteIconImage: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color.white.opacity(0.96))
      WebsiteFaviconView(
        rawURL: piece.url ?? "",
        imageSize: 40,
        fallbackSize: 22,
        imageCornerRadius: 10
      )
      .frame(width: 50, height: 50)
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
    .frame(width: 56, height: 56)
  }

  @ViewBuilder
  private func fallbackIcon(phase: AsyncImagePhase, label: String) -> some View {
    switch phase {
    case .success(let image): image.resizable().scaledToFit()
    default:
      ZStack {
        RoundedRectangle(cornerRadius: cornerRadius).fill(Color.white.opacity(0.14))
        Text(label).font(.title.bold()).foregroundStyle(.white)
      }
    }
  }
}
