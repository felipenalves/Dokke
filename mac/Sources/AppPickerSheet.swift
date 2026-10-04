import AppKit
import SwiftUI

struct AppPickerSheet: View {
  @EnvironmentObject private var store: DockStore
  @EnvironmentObject private var languageStore: LanguageStore
  @Environment(\.dismiss) private var dismiss
  let insertAt: Int?
  @State private var search = ""
  @State private var shortcutSearch = ""
  @FocusState private var isSearchFocused: Bool
  @FocusState private var isShortcutEmojiFocused: Bool
  @State private var selectedTab = "Apps"
  @State private var websiteURL = ""
  @State private var pendingWebsiteURL = ""
  @State private var pendingWebsiteTitle = ""
  @State private var showWebsiteNamePrompt = false
  @State private var pendingShortcutName = ""
  @State private var pendingShortcutEmoji = "🖱️"
  @State private var shortcutAddError: String?
  @State private var showShortcutEmojiPrompt = false

  private static let appsAppIcon = applicationIcon(forBundleIdentifier: "com.apple.apps.launcher")
  private static let shortcutsAppIcon = applicationIcon(forBundleIdentifier: "com.apple.shortcuts")
  private static let safariAppIcon = applicationIcon(forBundleIdentifier: "com.apple.Safari")

  private static func applicationIcon(forBundleIdentifier bundleIdentifier: String) -> NSImage? {
    guard let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleIdentifier) else { return nil }
    return NSWorkspace.shared.icon(forFile: appURL.path)
  }

  private let websiteSuggestions = [
    ("GitHub", "https://github.com"),
    ("YouTube", "https://youtube.com"),
    ("WhatsApp", "https://whatsapp.com"),
    ("Pinterest", "https://pinterest.com"),
    ("Threads", "https://threads.net"),
    ("TikTok", "https://tiktok.com"),
    ("LinkedIn", "https://linkedin.com"),
    ("ChatGPT", "https://chatgpt.com"),
    ("X", "https://x.com"),
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

  private var filteredShortcuts: [String] {
    let q = shortcutSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let sorted = store.shortcuts.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    if q.isEmpty { return sorted }
    return sorted.filter { $0.lowercased().contains(q) }
  }

  private var pickerTabSelector: some View {
    HStack(spacing: 4) {
      pickerTabButton(
        title: I18n.text("picker.apps", language: languageStore.selected),
        selection: "Apps",
        icon: Self.appsAppIcon,
        fallbackSystemName: "square.grid.2x2.fill"
      )
      pickerTabButton(
        title: I18n.text("picker.websites", language: languageStore.selected),
        selection: "Website Links",
        icon: Self.safariAppIcon,
        fallbackSystemName: "safari.fill"
      )
      pickerTabButton(
        title: I18n.text("picker.shortcuts", language: languageStore.selected),
        selection: "Shortcuts",
        icon: Self.shortcutsAppIcon,
        fallbackSystemName: "bolt.fill"
      )
    }
    .padding(6)
    .frame(height: 84)
    .background(Color.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
  }

  private func pickerTabButton(
    title: String,
    selection: String,
    icon: NSImage?,
    fallbackSystemName: String
  ) -> some View {
    let isSelected = selectedTab == selection
    return Button {
      selectedTab = selection
    } label: {
      VStack(spacing: 4) {
        Group {
          if let icon {
            Image(nsImage: icon)
              .resizable()
              .scaledToFit()
          } else {
            Image(systemName: fallbackSystemName)
              .resizable()
              .scaledToFit()
              .padding(2)
          }
        }
        .frame(width: 30, height: 30)

        Text(title)
          .font(.system(size: 15, weight: .semibold))
          .lineLimit(1)
          .minimumScaleFactor(0.85)
      }
      .frame(maxWidth: .infinity)
      .frame(height: 72)
      .background(
        isSelected ? Color.white.opacity(0.13) : Color.clear,
        in: RoundedRectangle(cornerRadius: 16, style: .continuous)
      )
    }
    .buttonStyle(.plain)
    .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(title)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }

  var body: some View {
    ZStack {
      VStack(spacing: 0) {
        HStack(spacing: 10) {
          pickerTabSelector
            .frame(maxWidth: .infinity)

          Button { dismiss() } label: {
            Image(systemName: "xmark")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(.secondary)
              .frame(width: 28, height: 28)
              .background(Color.white.opacity(0.10), in: Circle())
          }
          .buttonStyle(.plain)
          .accessibilityLabel(I18n.text("picker.close", language: languageStore.selected))
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 14)

        Divider()

        Group {
          if selectedTab == "Apps" {
            HStack(alignment: .center, spacing: 10) {
              Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
              Text(I18n.text("picker.library", language: languageStore.selected))
                .font(.system(size: 16, weight: .semibold))
              Spacer(minLength: 12)
              HStack(spacing: 7) {
                Image(systemName: "magnifyingglass")
                  .foregroundStyle(.secondary)
                TextField(I18n.text("picker.search", language: languageStore.selected), text: $search)
                  .textFieldStyle(.plain)
                  .focused($isSearchFocused)
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
                  .stroke(isSearchFocused ? Color.accentColor.opacity(0.75) : Color.white.opacity(0.14), lineWidth: 1)
              )
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)

            if store.isPinnedLimitReached {
              Text(I18n.text("picker.limit", language: languageStore.selected))
                .font(.caption)
                .foregroundStyle(.orange)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }

            if store.installedLoading && !store.installedReady {
              ProgressView(I18n.text("picker.loading", language: languageStore.selected))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.loading && !store.installedReady {
              ProgressView(I18n.text("picker.loading", language: languageStore.selected))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredApps.isEmpty {
              ContentUnavailableView(
                search.isEmpty ? I18n.text("picker.none", language: languageStore.selected) : I18n.text("picker.noResults", language: languageStore.selected),
                systemImage: "app.dashed",
                description: Text(search.isEmpty ? I18n.text("picker.serverEmpty", language: languageStore.selected) : I18n.text("picker.searchDifferent", language: languageStore.selected))
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
          } else if selectedTab == "Website Links" {
            websiteLinksView
          } else {
            shortcutsView
          }
        }
        .padding(.top, 16)
      }
      .disabled(showWebsiteNamePrompt || showShortcutEmojiPrompt)
      .accessibilityHidden(showWebsiteNamePrompt || showShortcutEmojiPrompt)

      if showWebsiteNamePrompt || showShortcutEmojiPrompt {
        Color.black.opacity(0.48)
          .ignoresSafeArea()
        if showShortcutEmojiPrompt {
          shortcutEmojiPrompt
        } else {
          websiteNamePrompt
        }
      }
    }
    .frame(width: 480, height: 620)
    .background(DokkeTheme.canvas)
    .task(id: selectedTab) {
      if selectedTab == "Shortcuts" { await store.loadShortcuts() }
    }
  }

  private var shortcutsView: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        Image(systemName: "magnifyingglass")
          .foregroundStyle(.secondary)
        TextField(I18n.text("picker.shortcutSearch", language: languageStore.selected), text: $shortcutSearch)
          .textFieldStyle(.plain)
          .focused($isSearchFocused)
        if !shortcutSearch.isEmpty {
          Button { shortcutSearch = "" } label: {
            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
          }
          .buttonStyle(.plain)
        }
      }
      .padding(.horizontal, 10)
      .frame(height: 34)
      .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(isSearchFocused ? Color.accentColor.opacity(0.75) : Color.white.opacity(0.14), lineWidth: 1)
      )

      if store.isPinnedLimitReached {
        Text(I18n.text("picker.limit", language: languageStore.selected))
          .font(.caption)
          .foregroundStyle(.orange)
          .frame(maxWidth: .infinity, alignment: .leading)
      }

      if store.shortcutsLoading && !store.shortcutsReady {
        ProgressView(I18n.text("picker.shortcutsLoading", language: languageStore.selected))
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else if filteredShortcuts.isEmpty {
        ContentUnavailableView(
          shortcutSearch.isEmpty ? I18n.text("picker.shortcutNone", language: languageStore.selected) : I18n.text("picker.noResults", language: languageStore.selected),
          systemImage: "bolt.slash",
          description: Text(shortcutSearch.isEmpty
            ? (store.lastError ?? I18n.text("picker.shortcutsEmpty", language: languageStore.selected))
            : I18n.text("picker.searchDifferent", language: languageStore.selected))
        )
      } else {
        ScrollView {
          LazyVStack(spacing: 8) {
            ForEach(filteredShortcuts, id: \.self) { shortcut in
              shortcutRow(shortcut)
            }
          }
          .padding(.bottom, 12)
        }
        .scrollIndicators(.hidden)
      }
    }
    .padding(.horizontal, 16)
    .padding(.bottom, 12)
  }

  private func shortcutRow(_ shortcut: String) -> some View {
    HStack(spacing: 10) {
      Group {
        if let appIcon = Self.shortcutsAppIcon {
          Image(nsImage: appIcon)
            .resizable()
            .scaledToFit()
        } else {
          ZStack {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
              .fill(Color.accentColor.opacity(0.18))
            Image(systemName: "square.stack.3d.up.fill")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(Color.accentColor)
          }
        }
      }
      .frame(width: 34, height: 34)
      .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

      Text(shortcut)
        .lineLimit(1)
      Spacer()
      if store.isShortcutPinned(shortcut) {
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 18, weight: .semibold))
          .foregroundStyle(.green)
          .accessibilityLabel(I18n.text("picker.added", language: languageStore.selected))
      } else {
        Button(I18n.text("picker.add", language: languageStore.selected)) {
          beginShortcutAdd(shortcut)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.small)
        .disabled(store.busyName == shortcut || store.isPinnedLimitReached || showShortcutEmojiPrompt)
      }
    }
    .padding(.horizontal, 12)
    .frame(maxWidth: .infinity, minHeight: 50)
    .background(DokkeTheme.page.opacity(0.68), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
  }

  private var websiteLinksView: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        Image(systemName: "globe")
          .foregroundStyle(.secondary)
        TextField(I18n.text("picker.url", language: languageStore.selected), text: $websiteURL)
          .textFieldStyle(.plain)
        Button(I18n.text("picker.add", language: languageStore.selected)) {
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
      Text(I18n.text("picker.limit", language: languageStore.selected))
          .font(.caption)
          .foregroundStyle(.orange)
      }
      if let error = store.lastError, !error.isEmpty {
        Text(error)
          .font(.caption)
          .foregroundStyle(.red)
      }

      Text(I18n.text("picker.suggestions", language: languageStore.selected))
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
        Label(I18n.text("picker.added", language: languageStore.selected), systemImage: "checkmark.circle.fill")
          .font(.caption)
          .foregroundStyle(.green)
      } else {
        Button(I18n.text("picker.add", language: languageStore.selected)) {
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

  private func beginShortcutAdd(_ name: String) {
    store.lastError = nil
    shortcutAddError = nil
    pendingShortcutName = name
    pendingShortcutEmoji = "🖱️"
    showShortcutEmojiPrompt = true
    DispatchQueue.main.async { isShortcutEmojiFocused = true }
  }

  private func confirmShortcutAdd() {
    let name = pendingShortcutName.trimmingCharacters(in: .whitespacesAndNewlines)
    let emoji = pendingShortcutEmoji.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty, !emoji.isEmpty else { return }
    Task {
      let added = await store.addShortcut(name, emoji: emoji, at: insertAt)
      if added {
        shortcutAddError = nil
        pendingShortcutName = ""
        pendingShortcutEmoji = "🖱️"
        isShortcutEmojiFocused = false
        showShortcutEmojiPrompt = false
        dismiss()
      } else {
        shortcutAddError = store.lastError ?? I18n.text("error.addShortcut", language: languageStore.selected)
      }
    }
  }

  private func cancelShortcutAdd() {
    guard store.busyName != pendingShortcutName else { return }
    pendingShortcutName = ""
    pendingShortcutEmoji = "🖱️"
    shortcutAddError = nil
    isShortcutEmojiFocused = false
    showShortcutEmojiPrompt = false
  }

  private func openShortcutEmojiPalette() {
    isShortcutEmojiFocused = true
    DispatchQueue.main.async {
      (NSApp.keyWindow?.firstResponder as? NSTextView)?.selectAll(nil)
      NSApp.orderFrontCharacterPalette(nil)
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

      Text(I18n.text("picker.nameHint", language: languageStore.selected))
        .font(.system(size: 19, weight: .bold))
        .multilineTextAlignment(.center)
        .lineLimit(2)

      TextField(I18n.text("picker.siteName", language: languageStore.selected), text: $pendingWebsiteTitle)
        .textFieldStyle(.roundedBorder)
        .onSubmit { confirmWebsiteAdd() }

      if let error = store.lastError, !error.isEmpty {
        Text(error)
          .font(.caption)
          .foregroundStyle(.red)
          .multilineTextAlignment(.center)
      }

      HStack(spacing: 12) {
        Button(I18n.text("confirm.cancel", language: languageStore.selected)) { cancelWebsiteAdd() }
          .buttonStyle(.bordered)
          .controlSize(.small)
        Button(I18n.text("picker.add", language: languageStore.selected)) { confirmWebsiteAdd() }
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

  private var shortcutEmojiPrompt: some View {
    VStack(spacing: 18) {
      HStack(spacing: 12) {
        TextField("", text: $pendingShortcutEmoji)
          .textFieldStyle(.plain)
          .font(.system(size: 30))
          .multilineTextAlignment(.center)
          .frame(width: 48, height: 48)
          .focused($isShortcutEmojiFocused)
          .accessibilityLabel(I18n.text("picker.chooseEmoji", language: languageStore.selected))
          .simultaneousGesture(TapGesture().onEnded { openShortcutEmojiPalette() })
          .onChange(of: pendingShortcutEmoji) { _, value in
            let selectedEmoji = String(value.suffix(1))
            if selectedEmoji != value { pendingShortcutEmoji = selectedEmoji }
          }

        Rectangle()
          .fill(Color.white.opacity(0.24))
          .frame(width: 1, height: 24)

        Button(action: openShortcutEmojiPalette) {
          Image(systemName: "chevron.down")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(.secondary)
            .frame(width: 32, height: 40)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(I18n.text("picker.chooseEmoji", language: languageStore.selected))
      }
      .padding(.horizontal, 12)
      .frame(height: 58)
      .background(Color.white.opacity(0.09), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

      Text("\(I18n.text("picker.shortcutEmojiHint", language: languageStore.selected)) “\(pendingShortcutName)”")
        .font(.system(size: 19, weight: .bold))
        .multilineTextAlignment(.center)
        .lineLimit(3)

      if let error = shortcutAddError ?? store.lastError, !error.isEmpty {
        Text(error)
          .font(.caption)
          .foregroundStyle(.red)
          .multilineTextAlignment(.center)
      }

      HStack(spacing: 12) {
        shortcutEmojiActionButton(
          I18n.text("confirm.cancel", language: languageStore.selected),
          prominent: false,
          minWidth: 70,
          disabled: store.busyName == pendingShortcutName,
          action: cancelShortcutAdd
        )
        shortcutEmojiActionButton(
          I18n.text("picker.add", language: languageStore.selected),
          prominent: true,
          minWidth: 54,
          disabled: pendingShortcutEmoji.isEmpty || store.busyName != nil,
          action: confirmShortcutAdd
        )
      }
    }
    .padding(24)
    .frame(width: 360)
    .background(DokkeTheme.canvas, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .stroke(Color.white.opacity(0.20), lineWidth: 1)
    )
    .shadow(color: .black.opacity(0.28), radius: 22, y: 12)
  }

  private func shortcutEmojiActionButton(
    _ title: String,
    prominent: Bool,
    minWidth: CGFloat,
    disabled: Bool,
    action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      Text(title)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(Color.white.opacity(prominent ? 1 : 0.9))
        .frame(minWidth: minWidth)
        .frame(height: 30)
        .background(prominent ? Color.accentColor : Color.white.opacity(0.10), in: Capsule())
    }
    .buttonStyle(.plain)
    .disabled(disabled)
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
          .accessibilityLabel(I18n.text("picker.added", language: languageStore.selected))
      } else {
        Button(I18n.text("picker.add", language: languageStore.selected)) {
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
