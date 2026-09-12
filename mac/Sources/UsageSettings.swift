import AppKit
import Foundation
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

private extension UsageProviderOrder {
  var manageURL: URL? {
    switch self {
    case .claude:
      return URL(string: "https://claude.ai/settings/usage")
    case .codex:
      return URL(string: "https://chatgpt.com/#settings/Account")
    case .antigravity:
      return URL(string: "https://antigravity.google")
    case .grok:
      return URL(string: "https://grok.com")
    }
  }
}

struct DokkeUsageSettings: Equatable {
  var enabled: Bool
  var display: UsageDisplayMode
  var reset: UsageResetMode
  var showPace: Bool
  /// Nil mantém o comportamento legado: todos os providers conhecidos ficam habilitados.
  var providers: [String]?
  /// Ordem visual dos cards; não controla quais contas estão habilitadas.
  var providerOrder: [String]?

  init(json: [String: Any]? = nil) {
    let object = json ?? [:]
    enabled = object["enabled"] as? Bool ?? true
    display = UsageDisplayMode(rawValue: object["display"] as? String ?? "") ?? .used
    reset = UsageResetMode(rawValue: object["reset"] as? String ?? "") ?? .countdown
    showPace = object["showPace"] as? Bool ?? true
    let known = Set(UsageProviderOrder.allCases.map(\.rawValue))
    func normalize(_ raw: Any?) -> [String]? {
      guard let values = raw as? [String] else { return nil }
      return values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
        .filter { known.contains($0) }
    }
    providers = normalize(object["providers"])
    providerOrder = normalize(object["providerOrder"])
  }

  var json: [String: Any] {
    var result: [String: Any] = [
      "enabled": enabled,
      "display": display.rawValue,
      "reset": reset.rawValue,
      "showPace": showPace,
    ]
    if let providers { result["providers"] = providers }
    if let providerOrder { result["providerOrder"] = providerOrder }
    return result
  }

  var enabledProviderIds: [String] {
    providers ?? UsageProviderOrder.allCases.map(\.rawValue)
  }

  func isProviderEnabled(_ id: String) -> Bool {
    enabledProviderIds.contains(id)
  }
}

struct UsageSettingsView: View {
  @ObservedObject var store: DockStore
  @EnvironmentObject private var languageStore: LanguageStore
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var draft: DokkeUsageSettings
  @State private var saving = false
  @State private var saveTask: Task<Void, Never>?
  @State private var pendingSave: DokkeUsageSettings?
  @State private var draggedAccountID: String?

  init(store: DockStore) {
    self.store = store
    _draft = State(initialValue: store.usageSettings)
  }

  private var language: DokkeLanguage { languageStore.selected }

  private func isAccountEnabledForSettings(_ kind: UsageProviderOrder) -> Bool {
    if let providers = draft.providers {
      return providers.contains(kind.rawValue)
    }
    // Legacy configs had no explicit provider list. Preserve their visible
    // accounts until the first toggle materialises an explicit selection.
    return provider(for: kind)?.hasUsableUsageData == true
  }

  private var connectedAccountKinds: [UsageProviderOrder] {
    guard store.usage != nil else { return [] }
    return orderedAccountKinds.filter { isAccountEnabledForSettings($0) }
  }

  private var disconnectedAccountKinds: [UsageProviderOrder] {
    let connected = Set(connectedAccountKinds.map(\.rawValue))
    return orderedAccountKinds.filter { !connected.contains($0.rawValue) }
  }

  private var orderedAccountKinds: [UsageProviderOrder] {
    let fallback = UsageProviderOrder.allCases
    let preferredIDs = draft.providerOrder ?? []
    let preferred = preferredIDs.compactMap { UsageProviderOrder(rawValue: $0) }
    return preferred + fallback.filter { !preferred.contains($0) }
  }

  private func provider(for kind: UsageProviderOrder, in snapshot: UsageSnapshot) -> UsageProvider? {
    switch kind {
    case .claude:
      return snapshot.providers["claude"] ?? snapshot.providers["anthropic"]
    case .codex, .antigravity, .grok:
      return snapshot.providers[kind.rawValue]
    }
  }

  private func provider(for kind: UsageProviderOrder) -> UsageProvider? {
    guard let snapshot = store.usage else { return nil }
    return provider(for: kind, in: snapshot)
  }

  private func accountToggle(_ kind: UsageProviderOrder) -> Binding<Bool> {
    Binding(
      get: { isAccountEnabledForSettings(kind) },
      set: { setAccountEnabled(kind, enabled: $0) }
    )
  }

  private func setAccountEnabled(_ kind: UsageProviderOrder, enabled: Bool) {
    // This switch controls which account appears on the device. It must not
    // launch a provider website: authentication belongs to the provider's own
    // credential flow, while this setting only changes Dokke's selection.
    // A missing list is the legacy default, but the settings UI only knows
    // which accounts are currently available from the usage snapshot. Keep
    // those providers enabled and add only the account the user selected;
    // materialising every known id would turn one click into four switches on.
    var ids = draft.providers ?? connectedAccountKinds.map(\.rawValue)
    if enabled {
      if !ids.contains(kind.rawValue) { ids.append(kind.rawValue) }
    } else {
      ids.removeAll { $0 == kind.rawValue }
    }
    draft.providers = ids
    var order = orderedAccountKinds.map(\.rawValue)
    if enabled {
      // Enabling an account is an append operation. Preserve the current
      // order of active accounts and keep inactive accounts after them.
      order.removeAll { $0 == kind.rawValue }
      let activeIDs = order.filter { ids.contains($0) }
      let inactiveIDs = order.filter { !ids.contains($0) }
      draft.providerOrder = activeIDs + [kind.rawValue] + inactiveIDs
    } else if draft.providerOrder == nil {
      draft.providerOrder = order
    }
  }

  private func moveAccount(_ movedID: String, onto targetID: String) -> Bool {
    guard movedID != targetID,
          let from = orderedAccountKinds.firstIndex(where: { $0.rawValue == movedID }),
          let target = orderedAccountKinds.firstIndex(where: { $0.rawValue == targetID })
    else { return false }
    var order = orderedAccountKinds.map(\.rawValue)
    let moved = order.remove(at: from)
    order.insert(moved, at: min(target, order.count))
    withAnimation(reduceMotion ? nil : .snappy(duration: 0.24)) {
      draft.providerOrder = order
    }
    return true
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        header
        visibilityGroup
        accountsGroup
        appearanceGroup

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
      .padding(.bottom, 32)
    }
    .scrollIndicators(.hidden)
    .padding(.top, 58)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(DokkeTheme.canvas.ignoresSafeArea())
    .onChange(of: store.usageSettings) { _, next in
      guard draft != next, !saving else { return }
      saveTask?.cancel()
      pendingSave = nil
      draft = next
    }
    .task {
      await store.loadConfig()
      await store.loadUsage(force: true)
    }
    .onChange(of: draft) { _, next in
      guard next != store.usageSettings else { return }
      if saving {
        pendingSave = next
      } else {
        scheduleSave(next)
      }
    }
    .onDisappear {
      saveTask?.cancel()
    }
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 7) {
      Text(I18n.text("usage.settingsTitle", language: language))
        .font(.system(size: 28, weight: .bold, design: .rounded))
        .foregroundStyle(.white)
      Text(I18n.text("usage.settingsDescription", language: language))
        .font(.subheadline)
        .foregroundStyle(.white.opacity(0.55))
        .fixedSize(horizontal: false, vertical: true)
    }
  }

  private var accountsGroup: some View {
    VStack(alignment: .leading, spacing: 0) {
      if store.usage == nil {
        if let error = store.usageError {
          VStack(alignment: .leading, spacing: 8) {
            Label(error, systemImage: "exclamationmark.triangle")
              .font(.caption)
              .foregroundStyle(.secondary)
            Button(I18n.text("usage.settingsRetry", language: language)) {
              Task { await store.loadUsage(force: true) }
            }
            .controlSize(.small)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.vertical, 16)
        } else {
          HStack(spacing: 8) {
            ProgressView()
              .controlSize(.small)
            Text(I18n.text("usage.settingsAccountsLoading", language: language))
              .font(.caption)
              .foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.vertical, 16)
        }
      } else {
        if !connectedAccountKinds.isEmpty {
          accountSectionTitle("usage.settingsConnected")
          ForEach(Array(connectedAccountKinds.enumerated()), id: \.element.rawValue) { index, kind in
            UsageAccountRow(
              kind: kind,
              provider: provider(for: kind),
              isEnabled: accountToggle(kind),
              isAvailable: provider(for: kind)?.hasUsableUsageData == true,
              language: language,
              isOrderable: true,
              previousAccountID: index > 0 ? connectedAccountKinds[index - 1].rawValue : nil,
              nextAccountID: index + 1 < connectedAccountKinds.count ? connectedAccountKinds[index + 1].rawValue : nil,
              draggedAccountID: $draggedAccountID,
              onMove: moveAccount
            )
          }
          Text(I18n.text("usage.settingsOrderHint", language: language))
            .font(.caption)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 10)
            .padding(.bottom, 4)
        }

        if !disconnectedAccountKinds.isEmpty {
          if !connectedAccountKinds.isEmpty {
            Divider().overlay(Color.white.opacity(0.08))
              .padding(.vertical, 8)
          }
          accountSectionTitle("usage.settingsNotConnected")
          ForEach(disconnectedAccountKinds, id: \.rawValue) { kind in
            UsageAccountRow(
              kind: kind,
              provider: provider(for: kind),
              isEnabled: accountToggle(kind),
              isAvailable: false,
              language: language,
              isOrderable: false,
              previousAccountID: nil,
              nextAccountID: nil,
              draggedAccountID: $draggedAccountID,
              onMove: moveAccount
            )
          }
        }
      }
    }
    .padding(.horizontal, 20)
    .background(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color.white.opacity(0.055))
    )
    .opacity(draft.enabled ? 1 : 0.42)
    .disabled(saving || !draft.enabled)
  }

  private var visibilityGroup: some View {
    VStack(alignment: .leading, spacing: 0) {
      settingRow {
        VStack(alignment: .leading, spacing: 3) {
          HStack(spacing: 12) {
            Text(I18n.text("usage.settingsEnabled", language: language))
              .font(.body.weight(.medium))
            Spacer(minLength: 12)
            Toggle("", isOn: $draft.enabled)
              .toggleStyle(.switch)
              .labelsHidden()
              .controlSize(.small)
              .accessibilityLabel(I18n.text("usage.settingsEnabled", language: language))
              .accessibilityValue(draft.enabled ? "Ativado" : "Desativado")
          }
          Text(I18n.text("usage.settingsEnabledDescription", language: language))
            .font(.caption)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
    }
    .padding(.horizontal, 20)
    .background(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color.white.opacity(0.075))
    )
  }

  private var appearanceGroup: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(I18n.text("usage.settingsAppearance", language: language))
        .font(.title3.weight(.semibold))
        .padding(.top, 14)
        .padding(.bottom, 6)

      appearanceRow {
        HStack(spacing: 12) {
          Text(I18n.text("usage.settingsDisplay", language: language))
          Spacer(minLength: 16)
          Picker("", selection: $draft.display) {
            ForEach(UsageDisplayMode.allCases) { mode in
              Text(I18n.text(mode.titleKey, language: language)).tag(mode)
            }
          }
          .pickerStyle(.menu)
          .labelsHidden()
          .accessibilityLabel(I18n.text("usage.settingsDisplay", language: language))
          .fixedSize()
        }
        .disabled(!draft.enabled)
      }

      Divider()
        .overlay(Color.white.opacity(0.08))
        .padding(.vertical, 5)

      appearanceRow {
        HStack(spacing: 12) {
          Text(I18n.text("usage.settingsReset", language: language))
          Spacer(minLength: 16)
          Picker("", selection: $draft.reset) {
            ForEach(UsageResetMode.allCases) { mode in
              Text(I18n.text(mode.titleKey, language: language)).tag(mode)
            }
          }
          .pickerStyle(.menu)
          .labelsHidden()
          .accessibilityLabel(I18n.text("usage.settingsReset", language: language))
          .fixedSize()
        }
        .disabled(!draft.enabled)
      }

      Divider()
        .overlay(Color.white.opacity(0.08))
        .padding(.vertical, 5)

      appearanceRow {
        VStack(alignment: .leading, spacing: 3) {
          HStack(spacing: 12) {
            Text(I18n.text("usage.settingsPace", language: language))
              .font(.body.weight(.medium))
            Spacer(minLength: 12)
            Toggle("", isOn: $draft.showPace)
              .toggleStyle(.switch)
              .labelsHidden()
              .controlSize(.small)
              .accessibilityLabel(I18n.text("usage.settingsPace", language: language))
              .disabled(!draft.enabled)
          }
          Text(I18n.text("usage.settingsPaceDescription", language: language))
            .font(.caption)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
    }
    .padding(.horizontal, 20)
    .background(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color.white.opacity(0.055))
    )
    .opacity(draft.enabled ? 1 : 0.42)
    .disabled(saving || !draft.enabled)
  }

  private func accountSectionTitle(_ key: String) -> some View {
    Text(I18n.text(key, language: language))
      .font(.headline.weight(.semibold))
      .padding(.top, 16)
      .padding(.bottom, 10)
  }

  private func settingRow<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    content()
      .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
  }

  private func appearanceRow<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    content()
      .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
  }

  private func scheduleSave(_ next: DokkeUsageSettings) {
    guard next != store.usageSettings else { return }
    let providersChanged = next.providers != store.usageSettings.providers
    let orderChanged = next.providerOrder != store.usageSettings.providerOrder
    pendingSave = nil
    saveTask?.cancel()
    saveTask = Task { @MainActor in
      try? await Task.sleep(nanoseconds: 180_000_000)
      guard !Task.isCancelled else { return }
      saving = true
      let confirmed = await store.updateUsageSettings(next)
      let queued = pendingSave
      pendingSave = nil
      if confirmed, providersChanged || orderChanged {
        await store.loadUsage(force: true)
      } else if !confirmed, queued == nil {
        draft = store.usageSettings
      }
      saving = false
      if let queued, queued != store.usageSettings {
        scheduleSave(queued)
      }
    }
  }

}

private struct UsageAccountRow: View {
  let kind: UsageProviderOrder
  let provider: UsageProvider?
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Binding var isEnabled: Bool
  let isAvailable: Bool
  let language: DokkeLanguage
  let isOrderable: Bool
  let previousAccountID: String?
  let nextAccountID: String?
  @Binding var draggedAccountID: String?
  let onMove: (String, String) -> Bool

  private var name: String {
    provider?.name.flatMap { $0.isEmpty ? nil : $0 }
      ?? I18n.text("usage.provider.\(kind.rawValue)", language: language)
  }

  private var isDragging: Bool {
    draggedAccountID == kind.rawValue
  }

  private var reorderAnimation: Animation? {
    reduceMotion ? nil : .snappy(duration: 0.24)
  }

  private var manageTitle: String {
    let target = kind.manageURL?.host ?? name
    return I18n.text("usage.settingsOpen", language: language) + " " + target
  }

  private var detail: String {
    guard let provider, provider.hasUsableUsageData else {
      return isEnabled
        ? I18n.text("usage.settingsAccountNeedsSignIn", language: language)
        : I18n.text("usage.settingsAccountUnavailable", language: language)
    }
    if let plan = provider.plan, !plan.isEmpty {
      return "\(plan) · " + I18n.text("usage.settingsAccountAvailable", language: language)
    }
    return I18n.text("usage.settingsAccountAvailable", language: language)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(alignment: .center, spacing: 10) {
        HStack(alignment: .center, spacing: 10) {
          Image(systemName: "line.3.horizontal")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(isOrderable ? .white.opacity(0.34) : .white.opacity(0.20))
            .frame(width: 24, height: 24, alignment: .center)
            .accessibilityHidden(!isOrderable)
            .accessibilityLabel("Reordenar \(name)")
            .accessibilityHint("Use os ajustes para mover a conta")
            .accessibilityAdjustableAction { direction in
              guard isOrderable else { return }
              switch direction {
              case .increment:
                if let previousAccountID {
                  _ = onMove(kind.rawValue, previousAccountID)
                }
              case .decrement:
                if let nextAccountID {
                  _ = onMove(kind.rawValue, nextAccountID)
                }
              @unknown default:
                break
              }
            }
          ProviderGlyphView(glyph: kind.providerGlyph, size: 28)
            .frame(width: 36, height: 36, alignment: .center)
            .foregroundStyle(isEnabled ? .primary : .tertiary)
            .accessibilityHidden(true)
          VStack(alignment: .leading, spacing: 4) {
            Text(name)
              .font(.body.weight(.medium))
              .foregroundStyle(isEnabled ? .primary : .secondary)
              .lineLimit(1)
            Text(detail)
              .font(.caption)
              .foregroundStyle(isEnabled ? .secondary : .tertiary)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
        .contentShape(Rectangle())
        .onDrag {
          guard isOrderable else { return NSItemProvider() }
          draggedAccountID = kind.rawValue
          return NSItemProvider(object: kind.rawValue as NSString)
        }
        Spacer(minLength: 8)
        if isAvailable, let url = kind.manageURL {
          Button(manageTitle) {
            NSWorkspace.shared.open(url)
          }
          .buttonStyle(.link)
          .controlSize(.small)
          .help(I18n.text("usage.settingsOpenHelp", language: language))
        }
        Toggle("", isOn: $isEnabled)
          .toggleStyle(.switch)
          .controlSize(.small)
          .labelsHidden()
          .accessibilityLabel(name)
          .help(
            isEnabled
              ? I18n.text("usage.settingsEnabled", language: language)
              : I18n.text("usage.settingsConnectHelp", language: language)
          )
      }
    }
    .contentShape(Rectangle())
    .onDrop(
      of: [.text],
      delegate: UsageAccountDropDelegate(
        targetID: kind.rawValue,
        isOrderable: isOrderable,
        draggedAccountID: $draggedAccountID,
        onMove: onMove
      )
    )
    .padding(.vertical, 10)
    .padding(.horizontal, 4)
    .scaleEffect(isDragging ? 1.02 : 1)
    .opacity(isDragging ? 0.72 : 1)
    .zIndex(isDragging ? 1 : 0)
    .animation(reorderAnimation, value: draggedAccountID)
  }
}

private struct UsageAccountDropDelegate: SwiftUI.DropDelegate {
  let targetID: String
  let isOrderable: Bool
  @Binding var draggedAccountID: String?
  let onMove: (String, String) -> Bool

  func dropEntered(info: DropInfo) {
    guard isOrderable, let draggedAccountID, draggedAccountID != targetID else { return }
    _ = onMove(draggedAccountID, targetID)
  }

  func dropUpdated(info: DropInfo) -> DropProposal? {
    DropProposal(operation: isOrderable ? .move : .forbidden)
  }

  func performDrop(info: DropInfo) -> Bool {
    defer { draggedAccountID = nil }
    guard isOrderable, draggedAccountID != nil else { return false }
    // Reordering is applied by dropEntered as the pointer crosses each row.
    // Applying it again here would undo the final movement for adjacent rows.
    return true
  }
}
