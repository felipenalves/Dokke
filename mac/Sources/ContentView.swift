import SwiftUI
import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins

enum SidebarItem: String, CaseIterable, Identifiable {
  case apps = "Apps"
  case about = "Conectar"

  var id: String { rawValue }

  var icon: String {
    switch self {
    case .apps: return "square.grid.2x2.fill"
    case .about: return "info.circle"
    }
  }
}

struct ContentView: View {
  @EnvironmentObject private var store: DockStore
  @EnvironmentObject private var updater: DokkeUpdateManager
  @State private var selection: SidebarItem? = .apps
  @State private var isSidebarVisible = true
  @State private var hoveredSidebarItem: SidebarItem?
  @State private var trafficLightsClearance: CGFloat = 80
  @State private var trafficLightsMidY: CGFloat = 16
  private let headerHeight: CGFloat = 32
  private let sidebarChromeRadius: CGFloat = 20

  var body: some View {
    ZStack(alignment: .topLeading) {
      HStack(spacing: 0) {
        sidebar
          .frame(width: isSidebarVisible ? 208 : 0)
          .clipped()
          .opacity(isSidebarVisible ? 1 : 0)
        detail
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .ignoresSafeArea(.container, edges: .top)
    }
    .overlay(alignment: .topLeading) {
      header
    }
    .background(DokkeTheme.canvas.ignoresSafeArea())
    .background(TrafficLightsClearanceReader(inset: $trafficLightsClearance, midY: $trafficLightsMidY, isSidebarVisible: $isSidebarVisible))
    .ignoresSafeArea(.container, edges: .top)
    .preferredColorScheme(.dark)
    .animation(.easeOut(duration: 0.2), value: isSidebarVisible)
    .task {
      try? await Task.sleep(nanoseconds: 300_000_000)
      guard !Task.isCancelled else { return }
      await updater.check()
    }
  }

  private var header: some View {
    HStack(spacing: 0) {
      Color.clear
        .frame(width: isSidebarVisible ? 208 : trafficLightsClearance)
        .allowsHitTesting(false)

      if !isSidebarVisible {
        sidebarToggleButton
      }

      Text("Dokke")
        .font(.headline.weight(.semibold))
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, 6)
        .allowsHitTesting(false)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .frame(height: headerHeight)
    .offset(y: trafficLightsMidY - headerHeight / 2)
  }

  private var sidebarToggleButton: some View {
    Button {
      withAnimation(.easeOut(duration: 0.2)) {
        isSidebarVisible.toggle()
      }
    } label: {
      Image(systemName: "sidebar.left")
        .font(.system(size: 17, weight: .medium))
        .foregroundStyle(.white.opacity(0.9))
        .frame(width: 26, height: 26)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(isSidebarVisible ? "Ocultar sidebar" : "Mostrar sidebar")
  }

  private var customTrafficLights: some View {
    HStack(spacing: 8) {
      Circle()
        .fill(Color(red: 0.96, green: 0.23, blue: 0.21))
        .frame(width: 12, height: 12)
        .overlay(Circle().stroke(Color.black.opacity(0.15), lineWidth: 0.6))
        .onTapGesture { NSApp.keyWindow?.performClose(nil) }
      Circle()
        .fill(Color(red: 0.97, green: 0.73, blue: 0.11))
        .frame(width: 12, height: 12)
        .overlay(Circle().stroke(Color.black.opacity(0.15), lineWidth: 0.6))
        .onTapGesture { NSApp.keyWindow?.miniaturize(nil) }
      Circle()
        .fill(Color(red: 0.17, green: 0.77, blue: 0.28))
        .frame(width: 12, height: 12)
        .overlay(Circle().stroke(Color.black.opacity(0.15), lineWidth: 0.6))
        .onTapGesture { NSApp.keyWindow?.zoom(nil) }
    }
    .frame(width: 52, height: 12)
  }

  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 0) {
        Color.clear
          .frame(width: trafficLightsClearance)
          .allowsHitTesting(false)
        Spacer()
        sidebarToggleButton
          .padding(.trailing, 8)
      }
      .frame(height: headerHeight)
      .offset(y: trafficLightsMidY - headerHeight / 2 - 16)
      .padding(.top, 8)

      ForEach(SidebarItem.allCases, id: \.self) { item in
        Button {
          selection = item
        } label: {
          HStack(spacing: 6) {
            Image(systemName: item.icon)
              .font(.system(size: 12, weight: .medium))
              .frame(width: 14, height: 14)
            Text(item.rawValue)
              .font(.system(size: 13, weight: .medium))
            Spacer(minLength: 0)
          }
          .padding(.horizontal, 10)
          .frame(height: 28)
          .background(sidebarRowBackground(item))
          .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
          .contentShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .buttonStyle(.plain)
        .foregroundStyle(selection == item ? Color.white : Color.white.opacity(0.58))
        .padding(.leading, 16)
        .padding(.trailing, 16)
        .onHover { hovering in
          if hovering {
            hoveredSidebarItem = item
          } else if hoveredSidebarItem == item {
            hoveredSidebarItem = nil
          }
        }
        .accessibilityLabel(item.rawValue)
        .accessibilityValue(selection == item ? "Selecionado" : "")
      }
      Spacer()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background {
      if #available(macOS 26, *) {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Color.clear)
          .glassEffect(.regular, in: .rect(cornerRadius: 18))
      } else {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Color.clear)
      }
    }
    .overlay(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .strokeBorder(Color.white.opacity(0.14), lineWidth: 1)
    )
    .padding(.leading, 8)
    .padding(.top, 8)
    .padding(.bottom, 8)
    .padding(.trailing, 8)
  }

  private func sidebarRowBackground(_ item: SidebarItem) -> Color {
    if selection == item { return DokkeTheme.selection }
    if hoveredSidebarItem == item { return Color.white.opacity(0.08) }
    return .clear
  }

  @ViewBuilder
  private var detail: some View {
    switch selection {
    case .apps:
      DockGridView()
    case .about:
      AboutView()
    case .none:
      DockGridView()
    }
  }
}

private struct TrafficLightsClearanceReader: NSViewRepresentable {
  @Binding var inset: CGFloat
  @Binding var midY: CGFloat
  @Binding var isSidebarVisible: Bool

  func makeNSView(context: Context) -> ReaderView {
    let view = ReaderView()
    view.onChange = { nextInset, nextMidY in
      DispatchQueue.main.async {
        if abs(inset - nextInset) > 0.5 {
          inset = nextInset
        }
        if abs(midY - nextMidY) > 0.5 {
          midY = nextMidY
        }
      }
    }
    view.isSidebarVisible = isSidebarVisible
    return view
  }

  func updateNSView(_ nsView: ReaderView, context: Context) {
    nsView.onChange = { nextInset, nextMidY in
      DispatchQueue.main.async {
        if abs(inset - nextInset) > 0.5 {
          inset = nextInset
        }
        if abs(midY - nextMidY) > 0.5 {
          midY = nextMidY
        }
      }
    }
    nsView.isSidebarVisible = isSidebarVisible
    nsView.publish()
  }

  final class ReaderView: NSView {
    var onChange: ((CGFloat, CGFloat) -> Void)?
    var isSidebarVisible: Bool = true
    private var resizeObserver: NSObjectProtocol?
    private var originalTrafficLightFrames: [NSWindow.ButtonType: NSRect] = [:]

    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      if let resizeObserver {
        NotificationCenter.default.removeObserver(resizeObserver)
        self.resizeObserver = nil
      }
      publish()
      if let window {
        resizeObserver = NotificationCenter.default.addObserver(
          forName: NSWindow.didResizeNotification,
          object: window,
          queue: .main
        ) { [weak self] _ in
          self?.publish()
        }
      }
      DispatchQueue.main.async { [weak self] in
        self?.publish()
      }
    }

    override func layout() {
      super.layout()
      publish()
    }

    deinit {
      if let resizeObserver {
        NotificationCenter.default.removeObserver(resizeObserver)
      }
    }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    func publish() {
      guard let window,
            let zoom = window.standardWindowButton(.zoomButton),
            let close = window.standardWindowButton(.closeButton),
            let contentView = window.contentView
      else { return }

      let dx: CGFloat = 12
      let dy: CGFloat = -10
      for type in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] as [NSWindow.ButtonType] {
        guard let btn = window.standardWindowButton(type) else { continue }
        if originalTrafficLightFrames[type] == nil {
          originalTrafficLightFrames[type] = btn.frame
        }
        if let original = originalTrafficLightFrames[type] {
          var frame = original
          frame.origin.x = original.origin.x + dx
          frame.origin.y = original.origin.y + dy
          if btn.frame != frame { btn.frame = frame }
        }
      }

      let zoomRect = zoom.convert(zoom.bounds, to: contentView)
      let inset = ceil(zoomRect.maxX + 10)
      guard inset > 40 else { return }

      let closeRect = close.convert(close.bounds, to: contentView)
      let midY = contentView.isFlipped ? closeRect.midY : (contentView.bounds.height - closeRect.midY)
      guard midY > 4, midY < 80 else { return }

      onChange?(inset, midY)
    }
  }
}

struct AboutView: View {
  @EnvironmentObject private var store: DockStore
  @EnvironmentObject private var server: ServerManager
  @EnvironmentObject private var updater: DokkeUpdateManager
  @State private var showingReleaseNotes = false
  @State private var showingResetPinConfirmation = false
  private let aboutContentMaxWidth: CGFloat = 980

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        VStack(alignment: .leading, spacing: 4) {
          Text("Conectar outro dispositivo")
            .font(.title.bold())
          Text("Use o código abaixo no app ou navegador que você quer conectar ao Dokke.")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        VStack(spacing: 16) {
          Text("Código de acesso")
            .font(.headline)
          AccessCodeView(code: store.pinCode) {
            showingResetPinConfirmation = true
          }
          if let err = store.pinError {
            Text(err)
              .font(.caption)
              .foregroundStyle(.red)
          }
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(
          RoundedRectangle(cornerRadius: 16)
            .fill(.quaternary)
        )

        VStack(alignment: .leading, spacing: 16) {
          Text("Abrir em outro dispositivo")
            .font(.headline)
          if let ip = ServerManager.lanIPv4() {
            let localURL = "http://\(ip):3000"
            HStack(alignment: .center, spacing: 16) {
              QRCodeView(value: localURL)
                .frame(width: 112, height: 112)

              VStack(alignment: .leading, spacing: 10) {
                Text("Escaneie ou abra este endereço")
                  .font(.caption.weight(.semibold))
                Text(localURL)
                  .font(.system(size: 14, weight: .semibold, design: .monospaced))
                  .textSelection(.enabled)
                  .lineLimit(1)
                  .minimumScaleFactor(0.7)
                HStack(spacing: 8) {
                  Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(localURL, forType: .string)
                  } label: {
                    Label("Copiar URL", systemImage: "doc.on.doc")
                  }
                  .buttonStyle(.bordered)
                  Button {
                    if let url = URL(string: localURL) {
                      NSWorkspace.shared.open(url)
                    }
                  } label: {
                    Label("Abrir", systemImage: "arrow.up.right.square")
                  }
                  .buttonStyle(.bordered)
                }
              }
            }
            Text("O Mac e o dispositivo precisam estar na mesma rede. Para iPhone/iPad, use uma URL HTTPS do túnel antes de adicionar à Tela de Início.")
              .font(.caption)
              .foregroundStyle(.secondary)
          } else {
            Text("Sem IP de rede detectado (offline?)")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
          RoundedRectangle(cornerRadius: 16)
            .fill(.quaternary)
        )

        HStack(spacing: 16) {
          HStack(spacing: 8) {
            Circle()
              .fill(store.online ? Color.green : Color.red.opacity(0.85))
              .frame(width: 9, height: 9)
            Text(store.online ? "Servidor online" : "Servidor offline")
              .font(.subheadline.weight(.semibold))
          }
          Text("\(store.devices) dispositivos")
          Text("\(store.pinned.count) fixados")
          Spacer()
        }
        .font(.caption)
        .foregroundStyle(.secondary)

        if let err = server.lastError ?? store.lastError {
          Text(err)
            .font(.caption)
            .foregroundStyle(.red)
        }

        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Text("Atualizações")
              .font(.subheadline.weight(.semibold))
            Spacer()
            if updater.state == .checking {
              ProgressView().controlSize(.small)
            }
          }
          if let release = updater.release {
            HStack(spacing: 8) {
              Label("Nova versão \(release.tag)", systemImage: "arrow.down.circle.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.orange)
              Spacer()
              Button("Mudanças") {
                showingReleaseNotes = true
              }
              .buttonStyle(.bordered)
              .controlSize(.small)
              Button("Baixar e instalar") {
                Task { await updater.downloadAndInstall() }
              }
              .buttonStyle(.borderedProminent)
              .controlSize(.small)
              .disabled(updater.isBusy)
            }
          } else {
            HStack {
              Text("Versão instalada: \(updater.currentVersion)")
                .font(.caption)
                .foregroundStyle(.secondary)
              Spacer()
              Button("Verificar atualizações") {
                Task { await updater.check() }
              }
              .buttonStyle(.bordered)
              .controlSize(.small)
              .disabled(updater.isBusy)
            }
          }
          if let message = updater.statusMessage {
            if updater.release == nil {
              Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
            } else {
              Text(message)
                .font(.caption)
                .foregroundStyle(.orange)
            }
          }
        }
        .padding(.top, 4)
      }
      .padding(28)
      .frame(maxWidth: aboutContentMaxWidth, alignment: .leading)
      .frame(maxWidth: .infinity, alignment: .center)
    }
    .padding(.top, 40)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(DokkeTheme.canvas.ignoresSafeArea())
    .confirmationDialog("Gerar novo código?", isPresented: $showingResetPinConfirmation, titleVisibility: .visible) {
      Button("Gerar novo código", role: .destructive) {
        Task { await store.resetPin() }
      }
      Button("Cancelar", role: .cancel) {}
    } message: {
      Text("Os dispositivos conectados precisarão digitar o novo código.")
    }
    .sheet(isPresented: $showingReleaseNotes) {
      if let release = updater.release {
        ReleaseNotesView(release: release)
      }
    }
  }
}

private struct AccessCodeView: View {
  let code: String?
  let onRegenerate: () -> Void

  private var digits: [String] {
    let characters = Array((code ?? "").prefix(4))
    return (0..<4).map { index in
      index < characters.count ? String(characters[index]) : "—"
    }
  }

  var body: some View {
    VStack(spacing: 14) {
      HStack(spacing: 10) {
        ForEach(Array(digits.enumerated()), id: \.offset) { _, digit in
          Text(digit)
            .font(.system(size: 42, weight: .bold, design: .monospaced))
            .frame(width: 64, height: 76)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
      }
      Text("Digite este código no dispositivo conectado")
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.secondary)
      Button("Gerar novo código", action: onRegenerate)
        .buttonStyle(.link)
    }
    .frame(maxWidth: .infinity)
  }
}

private struct QRCodeView: View {
  let value: String

  var body: some View {
    Group {
      if let image = makeImage(from: value) {
        Image(nsImage: image)
          .interpolation(.none)
          .resizable()
          .scaledToFit()
      } else {
        Image(systemName: "qrcode")
          .font(.system(size: 58))
          .foregroundStyle(.secondary)
      }
    }
    .padding(10)
    .background(.white)
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private func makeImage(from value: String) -> NSImage? {
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(value.utf8)
    filter.correctionLevel = "M"
    guard let output = filter.outputImage else { return nil }

    let scaled = output.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
    let context = CIContext()
    guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
    return NSImage(cgImage: cgImage, size: NSSize(width: scaled.extent.width, height: scaled.extent.height))
  }
}

private struct ReleaseNotesView: View {
  @Environment(\.dismiss) private var dismiss
  let release: DokkeRelease
  private let renderedNotes: AttributedString

  init(release: DokkeRelease) {
    self.release = release
    renderedNotes = (try? AttributedString(markdown: release.notes)) ?? AttributedString(release.notes)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text("O que mudou")
            .font(.title2.bold())
          Text("Dokke \(release.tag)")
            .foregroundStyle(.secondary)
        }
        Spacer()
        Button("Fechar") {
          dismiss()
        }
        .buttonStyle(.bordered)
      }

      ScrollView {
        Text(renderedNotes)
          .frame(maxWidth: .infinity, alignment: .leading)
          .textSelection(.enabled)
      }
    }
    .padding(24)
    .frame(width: 560, height: 420)
  }
}

struct MenuBarView: View {
  @Environment(\.openWindow) private var openWindow
  @EnvironmentObject private var store: DockStore
  @EnvironmentObject private var server: ServerManager
  @EnvironmentObject private var updater: DokkeUpdateManager

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 8) {
        Image(systemName: "circle.fill")
          .font(.system(size: 8, weight: .semibold))
          .foregroundStyle(store.online ? Color.green : Color.red)
        Text(store.online ? "Dokke online" : "Dokke offline")
          .fontWeight(.semibold)
          .foregroundStyle(.primary)
      }
      Text("Dispositivos: \(store.devices) · Fixados: \(store.pinned.count)")
        .font(.caption)
        .foregroundStyle(.secondary)
      if let note = store.lastSyncNote {
        Text(note)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Divider()
      Button("Abrir Dokke") {
        openWindow(id: "main")
      }
      Button("Sincronizar agora") {
        Task { await store.refreshAll() }
      }
      if let release = updater.release {
        Divider()
        Text("Atualização \(release.tag) disponível")
          .font(.caption.weight(.semibold))
        Button("Baixar e instalar") {
          Task { await updater.downloadAndInstall() }
        }
        .disabled(updater.isBusy)
      } else {
        Button("Verificar atualizações") {
          Task { await updater.check() }
        }
        .disabled(updater.isBusy)
      }
      Divider()
      Button("Sair") {
        server.stop()
        NSApplication.shared.terminate(nil)
      }
    }
    .padding(8)
  }
}
