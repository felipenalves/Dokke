import AppKit
import SwiftUI

struct AppPickerSheet: View {
  @EnvironmentObject private var store: DockStore
  @Environment(\.dismiss) private var dismiss
  let insertAt: Int?
  @State private var search = ""
  @State private var selectedTab = "Apps"
  @State private var websiteURL = ""
  @State private var pendingWebsiteURL = ""
  @State private var pendingWebsiteTitle = ""
  @State private var showWebsiteNamePrompt = false

  private let websiteSuggestions = [
    ("GitHub", "https://github.com"),
    ("YouTube", "https://youtube.com"),
    ("WhatsApp", "https://whatsapp.com"),
    ("Pinterest", "https://pinterest.com"),
    ("Threads", "https://threads.net"),
    ("TikTok", "https://tiktok.com"),
    ("LinkedIn", "https://linkedin.com"),
    ("ChatGPT", "https://chatgpt.com"),
    ("Documente", "https://documenteclub.vercel.app"),
  ]

  init(insertAt: Int? = nil) {
    self.insertAt = insertAt
  }

  private var filteredApps: [InstalledApp] {
    let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let sorted = store.installed.sorted {
      let aPinned = store.isPinned($0.name)
      let bPinned = store.isPinned($1.name)
      if aPinned != bPinned { return !aPinned && bPinned }
      return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
    }
    if q.isEmpty { return sorted }
    return sorted.filter { $0.name.lowercased().contains(q) }
  }

  var body: some View {
    ZStack {
      VStack(spacing: 0) {
      HStack(spacing: 10) {
        Picker("Tipo de peça", selection: $selectedTab) {
          Text("Apps").tag("Apps")
          Text("Website Links").tag("Website Links")
        }
        .labelsHidden()
        .pickerStyle(.segmented)
        .frame(maxWidth: .infinity)
        .accessibilityLabel("Tipo de peça")

        Button { dismiss() } label: {
          Image(systemName: "xmark")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.secondary)
            .frame(width: 28, height: 28)
            .background(Color.white.opacity(0.10), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Fechar")
      }
      .padding(.horizontal, 16)
      .padding(.top, 16)
      .padding(.bottom, 14)

      Divider()

      HStack(spacing: 12) {
        Image(systemName: selectedTab == "Apps" ? "square.grid.2x2" : "globe")
          .font(.system(size: 19, weight: .semibold))
          .foregroundStyle(.white.opacity(0.92))
          .frame(width: 42, height: 42)
          .background(Color.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        Text(selectedTab == "Apps" ? "Adicionar Apps" : "Adicionar links ao dock")
          .font(.system(size: 18, weight: .bold))
          .lineLimit(1)
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 16)
      .padding(.top, 16)
      .padding(.bottom, 12)

      if selectedTab == "Apps" {
        HStack(alignment: .center, spacing: 10) {
          Image(systemName: "chevron.down")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.secondary)
          Text("App Library")
            .font(.system(size: 16, weight: .semibold))
          Spacer(minLength: 12)
          HStack(spacing: 7) {
            Image(systemName: "magnifyingglass")
              .foregroundStyle(.secondary)
            TextField("Buscar apps...", text: $search)
              .textFieldStyle(.plain)
            if !search.isEmpty {
              Button { search = "" } label: {
                Image(systemName: "xmark.circle.fill")
                  .foregroundStyle(.secondary)
              }
              .buttonStyle(.plain)
            }
          }
          .padding(.horizontal, 10)
          .frame(width: 164, height: 32)
          .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
          .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
              .stroke(Color.accentColor.opacity(0.8), lineWidth: 1.2)
          )
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 10)

        if store.isPinnedLimitReached {
          Text("Limite de 5 páginas atingido. Remova uma peça para adicionar outra.")
            .font(.caption)
            .foregroundStyle(.orange)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }

        if store.installedLoading && !store.installedReady {
          ProgressView("Carregando apps…")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if store.loading && !store.installedReady {
          ProgressView("Carregando apps…")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if filteredApps.isEmpty {
          ContentUnavailableView(
            search.isEmpty ? "Nenhum app encontrado" : "Sem resultados",
            systemImage: "app.dashed",
            description: Text(search.isEmpty ? "O servidor não retornou apps instalados." : "Tente uma busca diferente.")
          )
        } else {
          ScrollView {
            LazyVStack(spacing: 8) {
              ForEach(filteredApps) { app in
                appRow(app)
              }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
          }
          .scrollIndicators(.hidden)
        }
      } else {
        websiteLinksView
      }
      }

      if showWebsiteNamePrompt {
        Color.black.opacity(0.48)
          .ignoresSafeArea()
        websiteNamePrompt
      }
    }
    .frame(width: 480, height: 620)
    .background(DokkeTheme.canvas)
  }

  private var websiteLinksView: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        Image(systemName: "globe")
          .foregroundStyle(.secondary)
        TextField("https://exemplo.com", text: $websiteURL)
          .textFieldStyle(.plain)
        Button("Adicionar") {
          beginWebsiteAdd(url: websiteURL)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.small)
        .disabled(websiteURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || showWebsiteNamePrompt)
      }
      .padding(.horizontal, 12)
      .frame(height: 56)
      .background(
        RoundedRectangle(cornerRadius: 11, style: .continuous)
          .fill(Color.white.opacity(0.035))
          .overlay(
            RoundedRectangle(cornerRadius: 11, style: .continuous)
              .stroke(Color.accentColor.opacity(0.85), lineWidth: 1.5)
          )
      )

      if store.isPinnedLimitReached {
        Text("Limite de 5 páginas atingido. Remova uma peça para adicionar outra.")
          .font(.caption)
          .foregroundStyle(.orange)
      }
      if let error = store.lastError, !error.isEmpty {
        Text(error)
          .font(.caption)
          .foregroundStyle(.red)
      }

      Text("Sugestões")
        .font(.headline)
        .padding(.top, 4)

      ScrollView {
        LazyVStack(spacing: 0) {
          ForEach(websiteSuggestions, id: \.1) { suggestion in
            websiteSuggestionRow(suggestion)
          }
        }
      }
      .scrollIndicators(.hidden)
    }
    .padding(.horizontal, 16)
    .padding(.bottom, 12)
  }

  private func websiteSuggestionRow(_ suggestion: (String, String)) -> some View {
    HStack(spacing: 12) {
      websiteIconPlate(rawURL: suggestion.1)

      VStack(alignment: .leading, spacing: 2) {
        Text(suggestion.0)
          .font(.system(size: 13, weight: .medium))
          .lineLimit(1)
        Text(suggestion.1)
          .font(.system(size: 10))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }

      Spacer(minLength: 8)

      if store.pieces.contains(where: { $0.type == .website && $0.url == suggestion.1 + "/" }) {
        Label("Adicionado", systemImage: "checkmark.circle.fill")
          .font(.caption)
          .foregroundStyle(.green)
      } else {
        Button("Adicionar") {
          beginWebsiteAdd(url: suggestion.1, suggestedTitle: suggestion.0)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.small)
        .disabled(store.isPinnedLimitReached || store.busyName != nil || showWebsiteNamePrompt)
      }
    }
    .padding(.horizontal, 12)
    .frame(maxWidth: .infinity, minHeight: 50)
    .background(DokkeTheme.page.opacity(0.68), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    .padding(.bottom, 8)
  }

  @ViewBuilder
  private func websiteIconPlate(rawURL: String) -> some View {
    ZStack {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.white.opacity(0.96))
      WebsiteFaviconView(rawURL: rawURL, imageSize: 22, fallbackSize: 13, imageCornerRadius: 7)
    }
    .frame(width: 30, height: 30)
  }

  private func beginWebsiteAdd(url rawURL: String, suggestedTitle: String? = nil) {
    let trimmedURL = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedURL.isEmpty else { return }
    store.lastError = nil
    pendingWebsiteURL = trimmedURL
    pendingWebsiteTitle = suggestedTitle ?? websiteTitle(for: trimmedURL)
    showWebsiteNamePrompt = true
  }

  private func confirmWebsiteAdd() {
    let url = pendingWebsiteURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !url.isEmpty else { return }
    let title = pendingWebsiteTitle.trimmingCharacters(in: .whitespacesAndNewlines)
    Task {
      await store.addWebsite(title: title.isEmpty ? nil : title, url: url, at: insertAt)
      if store.lastError == nil {
        websiteURL = ""
        pendingWebsiteURL = ""
        pendingWebsiteTitle = ""
        showWebsiteNamePrompt = false
        dismiss()
      }
    }
  }

  private func cancelWebsiteAdd() {
    pendingWebsiteURL = ""
    pendingWebsiteTitle = ""
    showWebsiteNamePrompt = false
  }

  private func websiteTitle(for rawURL: String) -> String {
    let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
    let hasScheme = trimmed.range(of: "^[a-z][a-z\\d+.-]*:", options: .regularExpression) != nil
    let candidate = hasScheme ? trimmed : "https://\(trimmed)"
    guard let host = URL(string: candidate)?.host else { return "Weblink" }
    let domain = host.replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression)
    let label = domain.split(separator: ".", maxSplits: 1).first.map(String.init) ?? domain
    return label
      .replacingOccurrences(of: "-", with: " ")
      .replacingOccurrences(of: "_", with: " ")
      .localizedCapitalized
  }

  private var websiteNamePrompt: some View {
    VStack(spacing: 16) {
      WebsiteFaviconView(rawURL: pendingWebsiteURL, imageSize: 32, fallbackSize: 23, imageCornerRadius: 8)
        .padding(7)
      .frame(width: 48, height: 48)
      .background(Color.white.opacity(0.92), in: RoundedRectangle(cornerRadius: 11, style: .continuous))

      Text("Vamos dar um nome curto para o seu weblink.")
        .font(.system(size: 19, weight: .bold))
        .multilineTextAlignment(.center)
        .lineLimit(2)

      TextField("Nome do site", text: $pendingWebsiteTitle)
        .textFieldStyle(.roundedBorder)
        .onSubmit { confirmWebsiteAdd() }

      if let error = store.lastError, !error.isEmpty {
        Text(error)
          .font(.caption)
          .foregroundStyle(.red)
          .multilineTextAlignment(.center)
      }

      HStack(spacing: 12) {
        Button("Cancelar") { cancelWebsiteAdd() }
          .buttonStyle(.bordered)
          .controlSize(.small)
        Button("Adicionar") { confirmWebsiteAdd() }
          .buttonStyle(.borderedProminent)
          .controlSize(.small)
          .disabled(pendingWebsiteTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.busyName != nil)
      }
    }
    .padding(24)
    .frame(width: 340)
    .background(DokkeTheme.canvas, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .stroke(Color.white.opacity(0.20), lineWidth: 1)
    )
    .shadow(color: .black.opacity(0.28), radius: 22, y: 12)
  }

  private func appRow(_ app: InstalledApp) -> some View {
    HStack(spacing: 10) {
      Group {
        if let native = store.nativeIcon(for: app.name) {
          Image(nsImage: native)
            .resizable()
            .scaledToFit()
        } else {
          AsyncImage(url: store.iconURL(for: app.name)) { phase in
            switch phase {
            case .success(let img):
              img.resizable().scaledToFit()
            default:
              ZStack {
                RoundedRectangle(cornerRadius: 8).fill(.quaternary)
                Text(String(app.name.prefix(1))).font(.headline)
              }
            }
          }
        }
      }
      .frame(width: 34, height: 34)
      .clipShape(RoundedRectangle(cornerRadius: 8))

      Text(app.name)
        .lineLimit(1)

      Spacer()

      if store.isPinned(app.name) {
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 18, weight: .semibold))
          .foregroundStyle(.green)
          .accessibilityLabel("Adicionado")
      } else {
        Button("Adicionar") {
          Task {
            if let insertAt {
              await store.pin(app.name, at: insertAt)
            } else {
              await store.pin(app.name)
            }
            if store.lastError == nil {
              dismiss()
            }
          }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.small)
        .disabled(store.busyName == app.name || store.isPinnedLimitReached)
      }
    }
    .padding(.horizontal, 12)
    .frame(maxWidth: .infinity, minHeight: 50)
    .background(DokkeTheme.page.opacity(0.68), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}
