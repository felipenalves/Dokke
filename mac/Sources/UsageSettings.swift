import SwiftUI

enum UsageDisplayMode: String, CaseIterable, Identifiable {
  case used
  case remaining

  var id: String { rawValue }
  var titleKey: String {
    switch self {
    case .used: return "usage.settingsDisplayUsed"
    case .remaining: return "usage.settingsDisplayRemaining"
    }
  }
}

enum UsageResetMode: String, CaseIterable, Identifiable {
  case countdown
  case exact

  var id: String { rawValue }
  var titleKey: String {
    switch self {
    case .countdown: return "usage.settingsResetCountdown"
    case .exact: return "usage.settingsResetExact"
    }
  }
}

struct DokkeUsageSettings: Equatable {
  var enabled: Bool
  var display: UsageDisplayMode
  var reset: UsageResetMode

  init(json: [String: Any]? = nil) {
    let object = json ?? [:]
    enabled = object["enabled"] as? Bool ?? true
    display = UsageDisplayMode(rawValue: object["display"] as? String ?? "") ?? .used
    reset = UsageResetMode(rawValue: object["reset"] as? String ?? "") ?? .countdown
  }

  var json: [String: Any] {
    [
      "enabled": enabled,
      "display": display.rawValue,
      "reset": reset.rawValue,
    ]
  }
}

struct UsageSettingsView: View {
  @ObservedObject var store: DockStore
  @EnvironmentObject private var languageStore: LanguageStore
  @State private var draft: DokkeUsageSettings
  @State private var saving = false
  @State private var saveTask: Task<Void, Never>?

  init(store: DockStore) {
    self.store = store
    _draft = State(initialValue: store.usageSettings)
  }

  private var language: DokkeLanguage { languageStore.selected }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        header
        settingsGroup

        if saving {
          Label(I18n.text("usage.settingsSaving", language: language), systemImage: "arrow.triangle.2.circlepath")
            .font(.caption)
            .foregroundStyle(.secondary)
        } else if let error = store.usageSettingsError {
          Label(error, systemImage: "exclamationmark.triangle")
            .font(.caption)
            .foregroundStyle(.red)
        }
      }
      .frame(maxWidth: 760, alignment: .leading)
      .padding(.horizontal, 36)
      .padding(.top, 58)
      .padding(.bottom, 32)
    }
    .scrollIndicators(.hidden)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(DokkeTheme.canvas)
    .onChange(of: store.usageSettings) { _, next in
      guard !saving else { return }
      if draft != next { draft = next }
    }
    .onChange(of: draft) { _, next in
      guard !saving else { return }
      scheduleSave(next)
    }
    .onDisappear {
      saveTask?.cancel()
    }
  }

  private var header: some View {
    HStack(alignment: .top, spacing: 14) {
      VStack(alignment: .leading, spacing: 7) {
        Text(I18n.text("usage.settingsTitle", language: language))
          .font(.system(size: 28, weight: .bold, design: .rounded))
          .foregroundStyle(.white)
        Text(I18n.text("usage.settingsDescription", language: language))
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.55))
          .fixedSize(horizontal: false, vertical: true)
      }
      Spacer(minLength: 12)
      Image(systemName: "gearshape.fill")
        .font(.system(size: 22, weight: .medium))
        .foregroundStyle(.white.opacity(0.55))
        .padding(.top, 4)
        .accessibilityHidden(true)
    }
  }

  private var settingsGroup: some View {
    VStack(alignment: .leading, spacing: 0) {
      settingRow {
        Toggle(isOn: $draft.enabled) {
          VStack(alignment: .leading, spacing: 3) {
            Text(I18n.text("usage.settingsEnabled", language: language))
              .font(.body.weight(.medium))
            Text(I18n.text("usage.settingsEnabledDescription", language: language))
              .font(.caption)
              .foregroundStyle(.secondary)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
        .toggleStyle(.switch)
      }

      Divider().overlay(Color.white.opacity(0.08))

      settingRow {
        Picker(I18n.text("usage.settingsDisplay", language: language), selection: $draft.display) {
          ForEach(UsageDisplayMode.allCases) { mode in
            Text(I18n.text(mode.titleKey, language: language)).tag(mode)
          }
        }
        .pickerStyle(.menu)
        .disabled(!draft.enabled)
      }

      Divider().overlay(Color.white.opacity(0.08))

      settingRow {
        Picker(I18n.text("usage.settingsReset", language: language), selection: $draft.reset) {
          ForEach(UsageResetMode.allCases) { mode in
            Text(I18n.text(mode.titleKey, language: language)).tag(mode)
          }
        }
        .pickerStyle(.menu)
        .disabled(!draft.enabled)
      }
    }
    .padding(.horizontal, 18)
    .background(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color.white.opacity(0.055))
    )
    .disabled(saving)
  }

  private func settingRow<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    content()
      .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
  }

  private func scheduleSave(_ next: DokkeUsageSettings) {
    saveTask?.cancel()
    saveTask = Task { @MainActor in
      try? await Task.sleep(nanoseconds: 180_000_000)
      guard !Task.isCancelled else { return }
      saving = true
      let confirmed = await store.updateUsageSettings(next)
      if !confirmed { draft = store.usageSettings }
      saving = false
    }
  }
}
