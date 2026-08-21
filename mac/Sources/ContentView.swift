import SwiftUI
import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins

enum SidebarItem: String, CaseIterable, Identifiable {
  case apps = "Apps"
  case about = "About"

  var id: String { rawValue }

  var label: String {
    switch self {
    case .apps: return I18n.sidebarApps
    case .about: return I18n.sidebarAbout
    }
  }

  var icon: String {
    switch self {
    case .apps: return "app.fill"
    case .about: return "info.circle"
    }
  }
}

struct ContentView: View {
  @EnvironmentObject private var store: DockStore
  @EnvironmentObject private var updater: DokkeUpdateManager
  @State private var selection: SidebarItem? = .apps
  @State private var showingReleaseNotes = false

  var body: some View {
    VStack(spacing: 0) {
      if let release = updater.release {
        UpdateBanner(release: release, showingReleaseNotes: $showingReleaseNotes)
      }

      NavigationSplitView {
        sidebar
      } detail: {
        detail
      }
      .navigationTitle("Dokke")
    }
    .task {
      try? await Task.sleep(nanoseconds: 300_000_000)
      guard !Task.isCancelled else { return }
      await updater.check()
    }
    .sheet(isPresented: $showingReleaseNotes) {
      if let release = updater.release {
        ReleaseNotesView(release: release)
      }
    }
  }

  private var sidebar: some View {
    List(SidebarItem.allCases, selection: $selection) { item in
      Label(item.label, systemImage: item.icon)
        .tag(item)
    }
    .listStyle(.sidebar)
    .navigationSplitViewColumnWidth(min: 160, ideal: 180, max: 220)
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

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        Text(I18n.aboutTitle)
          .font(.title.bold())

      VStack(alignment: .leading, spacing: 12) {
        HStack(spacing: 10) {
          Circle()
            .fill(store.online ? Color.green : Color.red.opacity(0.85))
            .frame(width: 10, height: 10)
          Text(store.online ? I18n.serverOnline : I18n.serverOffline)
            .font(.headline)
        }

        if !store.online, let err = server.lastError ?? store.lastError {
          Text(err)
            .font(.caption)
            .foregroundStyle(.red)
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )

      VStack(alignment: .leading, spacing: 10) {
        LabeledContent(I18n.devicesWS) {
          Text("\(store.devices)")
            .fontWeight(.semibold)
            .foregroundStyle(store.devices > 0 ? .green : .secondary)
        }
        LabeledContent(I18n.pinnedApps) {
          Text("\(store.pinned.count)")
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )

      VStack(alignment: .leading, spacing: 10) {
        Text(I18n.openOnOtherDevice)
          .font(.headline)
        if let ip = ServerManager.lanIPv4() {
          let localURL = "http://\(ip):3000"
          HStack(alignment: .center, spacing: 16) {
            QRCodeView(value: localURL)
              .frame(width: 132, height: 132)

            VStack(alignment: .leading, spacing: 10) {
              Text(I18n.scanOrOpenAddress)
                .font(.caption.weight(.semibold))
              Text(localURL)
                .font(.system(size: 15, weight: .semibold, design: .monospaced))
                .textSelection(.enabled)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
              HStack(spacing: 8) {
                Button {
                  NSPasteboard.general.clearContents()
                  NSPasteboard.general.setString(localURL, forType: .string)
                } label: {
                  Label(I18n.copyURL, systemImage: "doc.on.doc")
                }
                .buttonStyle(.bordered)
                Button {
                  if let url = URL(string: localURL) {
                    NSWorkspace.shared.open(url)
                  }
                } label: {
                  Label(I18n.open, systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.bordered)
              }
            }
          }
          Text(I18n.helpAndroidNetwork)
            .font(.caption)
            .foregroundStyle(.secondary)
          Text(I18n.helpPwaTunnel)
            .font(.caption)
            .foregroundStyle(.secondary)
        } else {
          Text(I18n.noNetworkIP)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )

      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text(I18n.updates)
            .font(.headline)
          Spacer()
          if updater.state == .checking {
            ProgressView().controlSize(.small)
          }
        }
        Text(I18n.installedVersion(updater.currentVersion))
          .font(.caption)
          .foregroundStyle(.secondary)
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
        if let release = updater.release {
          HStack(spacing: 8) {
            Label(I18n.newVersion(release.tag), systemImage: "arrow.down.circle.fill")
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(.orange)
            Button {
              showingReleaseNotes = true
            } label: {
              Label(I18n.changes, systemImage: "doc.text")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            Button {
              Task { await updater.downloadAndInstall() }
            } label: {
              Label(I18n.downloadAndInstall, systemImage: "arrow.down.circle.fill")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            .disabled(updater.isBusy)
          }
        } else if case .failed = updater.state {
          Button {
            Task { await updater.check() }
          } label: {
            Label(I18n.checkAgain, systemImage: "arrow.clockwise")
          }
          .buttonStyle(.bordered)
          .controlSize(.small)
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )
      .sheet(isPresented: $showingReleaseNotes) {
        if let release = updater.release {
          ReleaseNotesView(release: release)
        }
      }

      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text(I18n.accessCode)
            .font(.headline)
          Spacer()
          Button(I18n.generateNewCode) {
            Task { await store.resetPin() }
          }
          .buttonStyle(.link)
        }
        HStack(spacing: 8) {
          Text(store.pinCode ?? "—")
            .font(.system(size: 28, weight: .bold, design: .monospaced))
            .tracking(4)
          Text(I18n.typeOnDeviceHint)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        if let err = store.pinError {
          Text(err)
            .font(.caption)
            .foregroundStyle(.red)
        }
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 12)
          .fill(.quaternary)
      )

      VStack(alignment: .leading, spacing: 8) {
        Text("Base URL")
          .font(.headline)
        TextField("http://127.0.0.1:3000", text: $store.baseURL)
          .textFieldStyle(.roundedBorder)
      }

      Text(I18n.serverAutoStarts)
        .font(.caption)
        .foregroundStyle(.secondary)

      Button {
        Task { await store.refreshAll() }
      } label: {
        Label(I18n.refresh, systemImage: "arrow.clockwise")
      }
      .buttonStyle(.bordered)

      }
      .padding(20)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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

private struct UpdateBanner: View {
  @EnvironmentObject private var updater: DokkeUpdateManager
  let release: DokkeRelease
  @Binding var showingReleaseNotes: Bool

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "arrow.down.circle.fill")
        .font(.title3)
        .foregroundStyle(.orange)
      VStack(alignment: .leading, spacing: 2) {
        Text(I18n.newUpdateAvailable)
          .font(.subheadline.weight(.semibold))
        Text(I18n.readyToDownload(release.tag))
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Spacer(minLength: 12)
      Button {
        showingReleaseNotes = true
      } label: {
        Label(I18n.changes, systemImage: "doc.text")
      }
      .buttonStyle(.bordered)
      .controlSize(.small)
      Button {
        Task { await updater.downloadAndInstall() }
      } label: {
        if updater.state == .downloading {
          Label(I18n.downloading, systemImage: "arrow.down.circle")
        } else if updater.state == .installing {
          Label(I18n.installing, systemImage: "gearshape")
        } else {
          Label(I18n.downloadAndInstall, systemImage: "arrow.down.circle.fill")
        }
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.small)
      .disabled(updater.isBusy)
    }
    .padding(.horizontal, 20)
    .padding(.vertical, 10)
    .background(.orange.opacity(0.12))
    .overlay(alignment: .bottom) {
      Divider()
    }
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
          Text(I18n.whatChanged)
            .font(.title2.bold())
          Text("Dokke \(release.tag)")
            .foregroundStyle(.secondary)
        }
        Spacer()
        Button(I18n.close) {
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
  @EnvironmentObject private var store: DockStore
  @EnvironmentObject private var server: ServerManager

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(store.online ? I18n.dokkeOnline : I18n.dokkeOffline)
      Text(I18n.menuDevices(devices: store.devices, pinned: store.pinned.count))
        .foregroundStyle(.secondary)
      if let note = store.lastSyncNote {
        Text(note)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Divider()
      Button(I18n.refresh) {
        Task { await store.refreshAll() }
      }
      Divider()
      Button(I18n.quit) {
        server.stop()
        NSApplication.shared.terminate(nil)
      }
    }
    .padding(8)
  }
}
