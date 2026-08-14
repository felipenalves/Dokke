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
  var body: some View {
    NavigationSplitView {
      sidebar
    } detail: {
      detail
    }
    .navigationTitle("Dokke")
    .background(DokkeTheme.canvas.ignoresSafeArea())
    .toolbarBackground(DokkeTheme.canvas, for: .windowToolbar)
    .toolbarColorScheme(.dark, for: .windowToolbar)
    .task {
      try? await Task.sleep(nanoseconds: 300_000_000)
      guard !Task.isCancelled else { return }
      await updater.check()
    }
  }

  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 4) {
      ForEach(SidebarItem.allCases, id: \.self) { item in
        Button {
          selection = item
        } label: {
          Label(item.rawValue, systemImage: item.icon)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .foregroundStyle(selection == item ? Color.white : Color.white.opacity(0.58))
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(selection == item ? DokkeTheme.selection : .clear)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .accessibilityLabel(item.rawValue)
        .accessibilityValue(selection == item ? "Selecionado" : "")
      }
      Spacer()
    }
    .padding(.horizontal, 14)
    .padding(.top, 0)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .navigationSplitViewColumnWidth(min: 180, ideal: 200, max: 216)
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

        if !store.online, let err = server.lastError ?? store.lastError {
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
        Circle()
          .fill(store.online ? Color.green : Color.red.opacity(0.85))
          .frame(width: 8, height: 8)
        Text(store.online ? "Dokke online" : "Dokke offline")
          .fontWeight(.semibold)
      }
      Text("Dispositivos: \(store.devices) · Fixados: \(store.pinned.count)")
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
