import Foundation
import SwiftUI
import AppKit

private enum UsageConnectionState {
  case online
  case stale
  case offline
}

enum UsageProviderOrder: String, CaseIterable {
  case claude
  case codex
}

private struct VisibleUsageProvider: Identifiable {
  let kind: UsageProviderOrder
  let provider: UsageProvider

  var id: String { kind.rawValue }
}

struct UsageView: View {
  @ObservedObject var store: DockStore
  @EnvironmentObject private var languageStore: LanguageStore
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var selectedProviderIndex = 0

  private var language: DokkeLanguage { languageStore.selected }

  private var connectionState: UsageConnectionState {
    guard let snapshot = store.usage, (snapshot.sourceState == "available" || snapshot.sourceState == "partial") else { return .offline }
    guard let updatedAt = snapshot.updatedAt, let date = parseDate(updatedAt) else { return .stale }
    let age = Date().timeIntervalSince(date)
    if age < -60 || age > 120 || visibleProviders.contains(where: { $0.provider.stale }) { return .stale }
    return .online
  }

  private var visibleProviders: [VisibleUsageProvider] {
    guard let snapshot = store.usage else { return [] }
    return UsageProviderOrder.allCases.compactMap { kind in
      let provider: UsageProvider?
      switch kind {
      case .claude:
        provider = snapshot.providers["claude"] ?? snapshot.providers["anthropic"]
      case .codex:
        provider = snapshot.providers["codex"]
      }
      guard let provider else { return nil }
      guard provider.hasUsableUsageData else { return nil }
      return VisibleUsageProvider(kind: kind, provider: provider)
    }
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 24) {
        header

        if store.usageLoading && store.usage == nil {
          loadingState
        } else if let snapshot = store.usage, (snapshot.sourceState == "available" || snapshot.sourceState == "partial"), !visibleProviders.isEmpty {
          UsageProviderPager(
            providers: visibleProviders,
            activity: store.usageActivity?.providers ?? [:],
            loading: store.usageLoading,
            language: language,
            reduceMotion: reduceMotion,
            selection: $selectedProviderIndex,
            onSelectionChange: { index in
              guard visibleProviders.indices.contains(index) else { return }
              let providerId = visibleProviders[index].id
              Task { await store.updateUsageProvider(providerId) }
            }
          )
        } else if let snapshot = store.usage, (snapshot.sourceState == "available" || snapshot.sourceState == "partial") {
          emptyState(
            icon: "chart.bar.xaxis",
            title: "usage.noData",
            message: "usage.noDataBody"
          )
        } else {
          emptyState(
            icon: "bolt.horizontal.circle",
            title: "usage.unavailable",
            message: "usage.unavailableBody"
          )
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 32)
      .padding(.top, 58)
      .padding(.bottom, 32)
    }
    .scrollIndicators(.hidden)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(DokkeTheme.canvas)
    .task {
      await store.loadConfig()
      await store.loadUsage(force: true)
      await store.pollUsageActivity()
    }
    .onChange(of: store.usageProviderId) { _, _ in
      synchronizeSelection()
    }
    .onChange(of: store.usage) { _, _ in
      synchronizeSelection()
    }
  }

  private func synchronizeSelection() {
    guard !visibleProviders.isEmpty else {
      selectedProviderIndex = 0
      return
    }
    if let providerId = store.usageProviderId,
       let preferredIndex = visibleProviders.firstIndex(where: { $0.id == providerId }) {
      selectedProviderIndex = preferredIndex
    } else if !visibleProviders.indices.contains(selectedProviderIndex) {
      selectedProviderIndex = 0
    }
  }

  private var header: some View {
    HStack(alignment: .top, spacing: 16) {
      VStack(alignment: .leading, spacing: 7) {
        Text(I18n.text("usage.title", language: language))
          .font(.system(size: 28, weight: .bold, design: .rounded))
          .foregroundStyle(.white)
        HStack(spacing: 7) {
          UsageConnectionIndicator(state: connectionState, reduceMotion: reduceMotion)
          Text(syncDescription)
            .font(.caption)
            .foregroundStyle(.white.opacity(0.46))
        }
      }
      Spacer(minLength: 12)
      Button {
        Task { await store.loadUsage(force: true) }
      } label: {
        Group {
          if store.usageLoading {
            ProgressView()
              .controlSize(.small)
          } else {
            Image(systemName: "arrow.clockwise")
          }
        }
        .frame(width: 30, height: 30)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .foregroundStyle(.white.opacity(0.72))
      .help(I18n.text("usage.refresh", language: language))
      .disabled(store.usageLoading)
    }
  }

  private var syncDescription: String {
    guard let updatedAt = store.usage?.updatedAt, let date = parseDate(updatedAt) else {
      return I18n.text(connectionState == .offline ? "usage.offline" : "usage.syncUnknown", language: language)
    }
    if connectionState == .offline { return I18n.text("usage.offline", language: language) }
    let minutes = max(0, Int(Date().timeIntervalSince(date) / 60.0))
    if minutes < 1 { return I18n.text("usage.updatedNow", language: language) }
    return I18n.text("usage.updatedMinutes", language: language, ["value": "\(minutes)"])
  }

  private var loadingState: some View {
    HStack(spacing: 14) {
      TokenMascot(mood: "neutral", activity: "syncing", reduceMotion: reduceMotion)
        .frame(width: 38, height: 38)
      VStack(alignment: .leading, spacing: 5) {
        ProgressView()
          .controlSize(.small)
        Text(I18n.text("usage.activitySyncing", language: language))
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.62))
      }
    }
    .frame(maxWidth: .infinity, minHeight: 260, alignment: .center)
  }

  private func emptyState(icon: String, title: String, message: String) -> some View {
    VStack(spacing: 12) {
      Image(systemName: icon)
        .font(.system(size: 28, weight: .medium))
        .foregroundStyle(.orange.opacity(0.9))
      Text(I18n.text(title, language: language))
        .font(.title3.weight(.semibold))
        .foregroundStyle(.white)
      Text(I18n.text(message, language: language))
        .font(.subheadline)
        .foregroundStyle(.white.opacity(0.52))
        .multilineTextAlignment(.center)
        .frame(maxWidth: 430)
    }
    .frame(maxWidth: .infinity, minHeight: 260)
    .padding(28)
    .background(Color(red: 0.12, green: 0.055, blue: 0.02).opacity(0.92), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
    }
  }
}

private struct UsageProviderPager: View {
  let providers: [VisibleUsageProvider]
  let activity: [String: UsageActivityState]
  let loading: Bool
  let language: DokkeLanguage
  let reduceMotion: Bool
  @Binding var selection: Int
  let onSelectionChange: (Int) -> Void

  private func select(_ index: Int) {
    guard providers.indices.contains(index), selection != index else { return }
    selection = index
    onSelectionChange(index)
  }

  var body: some View {
    VStack(spacing: 10) {
      ZStack {
        ForEach(providers.indices, id: \.self) { index in
          if index == selection {
            let item = providers[index]
            UsageProviderCard(
              kind: item.kind,
              provider: item.provider,
              activityState: loading ? "syncing" : (activity[item.kind.rawValue]?.state ?? item.provider.activity?.state ?? "idle"),
              language: language,
              reduceMotion: reduceMotion
            )
            .transition(.opacity.combined(with: .move(edge: selection > index ? .leading : .trailing)))
          }
        }
      }
      .frame(maxWidth: .infinity, minHeight: 344)
      .contentShape(Rectangle())
      .gesture(
        DragGesture(minimumDistance: 24)
          .onEnded { value in
            guard abs(value.translation.width) > 42 else { return }
            let next = value.translation.width < 0 ? selection + 1 : selection - 1
            guard providers.indices.contains(next) else { return }
            if reduceMotion {
              select(next)
            } else {
              withAnimation(.smooth(duration: 0.24)) {
                select(next)
              }
            }
          }
      )

      Spacer(minLength: 0)

      UsageProviderDots(
        count: providers.count,
        selection: $selection,
        language: language,
        onSelectionChange: select
      )
    }
    .frame(maxWidth: .infinity, minHeight: 430, alignment: .top)
  }
}

private struct UsageProviderDots: View {
  let count: Int
  @Binding var selection: Int
  let language: DokkeLanguage
  let onSelectionChange: (Int) -> Void

  var body: some View {
    HStack(spacing: 7) {
      ForEach(0..<count, id: \.self) { index in
        Button {
          onSelectionChange(index)
        } label: {
          Capsule(style: .continuous)
            .fill(index == selection ? Color.white : Color.white.opacity(0.35))
            .frame(width: index == selection ? 14 : 6, height: 6)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(index == 0 ? "Claude Code" : "Codex")
        .accessibilityAddTraits(index == selection ? .isSelected : [])
      }
    }
    .frame(maxWidth: .infinity)
  }
}

private struct UsageProviderCard: View {
  let kind: UsageProviderOrder
  let provider: UsageProvider
  let activityState: String
  let language: DokkeLanguage
  let reduceMotion: Bool

  private var primary: UsageResourceEntry? { provider.primaryResource }
  private var weekly: UsageResourceEntry? { provider.weeklyResource }

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      header
      featuredLimits

      if let trend = provider.trend {
        UsageTrendChart(trend: trend, color: statusColor, language: language)
      }

    }
    .padding(.vertical, 4)
  }

  private var header: some View {
    HStack(alignment: .center, spacing: 10) {
      UsageProviderLogo(kind: kind)
      VStack(alignment: .leading, spacing: 2) {
        Text(providerTitle)
          .font(.headline.weight(.semibold))
          .foregroundStyle(.white)
        if let plan = provider.plan {
          Text(plan)
            .font(.caption)
            .foregroundStyle(.white.opacity(0.42))
        }
      }
      Spacer()
      TokenMascot(mood: provider.mascot ?? "neutral", activity: activityState, reduceMotion: reduceMotion)
        .frame(width: 38, height: 38)
      Text(activityState == "syncing" ? I18n.text("usage.activitySyncing", language: language) :
        activityState == "working" ? I18n.text("usage.activityWorking", language: language) :
        activityState == "waiting" ? I18n.text("usage.activityWaiting", language: language) : statusText)
        .font(.caption.weight(.semibold))
        .foregroundStyle(statusColor)
    }
  }

  private var featuredLimits: some View {
    HStack(alignment: .center, spacing: 20) {
      if let primary {
        UsageLimitPanel(
          entry: primary,
          color: statusColor,
          language: language,
          isPrimary: true
        )
      }

      if let weekly, weekly.id != primary?.id {
        UsageLimitPanel(
          entry: weekly,
          color: statusColor,
          language: language,
          isPrimary: false
        )
      }
    }
    .frame(maxWidth: .infinity)
  }

  private var providerTitle: String {
    I18n.text("usage.provider.\(kind.rawValue)", language: language)
  }

  private var statusText: String {
    switch provider.status {
    case "exhausted": return I18n.text("usage.exhausted", language: language)
    case "attention": return I18n.text("usage.attention", language: language)
    case "normal": return I18n.text("usage.normal", language: language)
    default: return I18n.text("usage.unknown", language: language)
    }
  }

  private var statusColor: Color {
    switch provider.status {
    case "exhausted": return .red
    case "attention": return .orange
    case "normal": return .green
    default: return .white.opacity(0.6)
    }
  }

  private var mascotText: String {
    let key: String
    switch provider.mascot {
    case "energized": key = "usage.pet.energized"
    case "attentive": key = "usage.pet.attentive"
    case "tired": key = "usage.pet.tired"
    case "exhausted": key = "usage.pet.exhausted"
    default: key = "usage.pet.neutral"
    }
    return I18n.text(key, language: language)
  }
}

private struct UsageProviderLogo: View {
  let kind: UsageProviderOrder

  private var assetName: String {
    kind == .claude ? "anthropic-logo" : "openai-logo"
  }

  private var assetImage: NSImage? {
    guard let url = Bundle.module.url(forResource: assetName, withExtension: "svg") else {
      return nil
    }
    return NSImage(contentsOf: url)
  }

  var body: some View {
    ZStack {
      if kind == .claude {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .fill(Color.orange.opacity(0.12))
      }
      if let assetImage {
        Image(nsImage: assetImage)
          .interpolation(.high)
          .resizable()
          .scaledToFit()
          .frame(width: 21, height: 21)
      } else {
        Image(systemName: kind == .claude ? "a.circle" : "circle.hexagongrid.circle")
          .font(.system(size: 19, weight: .medium))
          .foregroundStyle(.white.opacity(0.76))
      }
    }
    .frame(width: 34, height: 34)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(kind == .claude ? "Anthropic, Claude Code" : "OpenAI, Codex")
  }
}

private struct UsageConnectionIndicator: View {
  let state: UsageConnectionState
  let reduceMotion: Bool
  @State private var pulsing = false

  var body: some View {
    ZStack {
      Circle()
        .fill(stateColor)
        .frame(width: 8, height: 8)
        .shadow(color: stateColor.opacity(0.48), radius: 4)
      if state == .online && !reduceMotion {
        Circle()
          .stroke(stateColor.opacity(pulsing ? 0 : 0.55), lineWidth: 1)
          .frame(width: pulsing ? 17 : 8, height: pulsing ? 17 : 8)
      }
    }
    .frame(width: 17, height: 17)
    .accessibilityLabel(stateLabel)
    .onAppear {
      guard state == .online && !reduceMotion else { return }
      withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: false)) {
        pulsing = true
      }
    }
  }

  private var stateColor: Color {
    switch state {
    case .online: return .green
    case .stale: return .orange
    case .offline: return .red
    }
  }

  private var stateLabel: String {
    switch state {
    case .online: return "Online"
    case .stale: return "Stale"
    case .offline: return "Offline"
    }
  }
}

private struct UsageLimitPanel: View {
  let entry: UsageResourceEntry
  let color: Color
  let language: DokkeLanguage
  let isPrimary: Bool

  private var fraction: Double? {
    guard let value = entry.resource.utilization else { return nil }
    return min(max(value, 0), 1)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(title)
        .font(.system(size: 9, weight: .black, design: .rounded))
        .tracking(0.8)
        .foregroundStyle(.white.opacity(0.48))
        .lineLimit(1)
        Text(percentText)
          .font(.system(size: isPrimary ? 36 : 30, weight: .medium, design: .rounded))
          .foregroundStyle(fraction == nil ? .white.opacity(0.52) : color)
          .tracking(-1.5)
          .padding(.top, 9)
      UsageSegmentedMeter(fraction: fraction, color: color)
        .frame(height: 7)
        .padding(.top, 8)
      Text(resetDateText)
        .font(.system(size: 9, weight: .regular, design: .rounded))
        .foregroundStyle(.white.opacity(0.48))
        .lineLimit(1)
        .padding(.top, 13)
      Text(countdownText)
        .font(.system(size: isPrimary ? 24 : 21, weight: .medium, design: .rounded))
        .foregroundStyle(.white.opacity(0.92))
        .tracking(-0.6)
        .lineLimit(1)
        .padding(.top, 3)
    }
    .frame(maxWidth: .infinity, minHeight: isPrimary ? 220 : 170, alignment: .leading)
    .padding(.horizontal, isPrimary ? 13 : 11)
    .padding(.vertical, 12)
    .background(isPrimary ? Color(red: 0.19, green: 0.085, blue: 0.025) : Color(red: 0.145, green: 0.06, blue: 0.018), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
  }

  private var title: String {
    switch entry.id.lowercased() {
    case "session", "fivehour", "five_hour", "5h", "fivehours":
      return I18n.text("usage.fiveHourShort", language: language)
    case "weekly", "week":
      return I18n.text("usage.weekShort", language: language)
    default:
      return resourceLabel(entry.id, language: language).uppercased()
    }
  }

  private var percentText: String {
    guard let fraction else { return "--" }
    return "\(Int((fraction * 100).rounded()))%"
  }

  private var resetDateText: String {
    guard let reset = entry.resource.resetsAt, let date = parseDate(reset) else {
      return I18n.text("usage.resetUnknown", language: language)
    }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: language.rawValue)
    formatter.dateFormat = "EEE HH:mm"
    return "\(I18n.text("usage.resetLabel", language: language)) · \(formatter.string(from: date))"
  }

  private var countdownText: String {
    guard let reset = entry.resource.resetsAt, let date = parseDate(reset) else { return "--" }
    let totalMinutes = max(0, Int(date.timeIntervalSince(Date()) / 60.0))
    let days = totalMinutes / 1440
    let hours = (totalMinutes % 1440) / 60
    let minutes = totalMinutes % 60
    return days > 0 ? "\(days)d \(hours)h" : "\(hours)h \(minutes)m"
  }
}

private struct UsageSegmentedMeter: View {
  let fraction: Double?
  let color: Color

  var body: some View {
    HStack(spacing: 3) {
      ForEach(0..<10, id: \.self) { index in
        Capsule(style: .continuous)
          .fill(index < activeSegments ? color : Color.white.opacity(0.13))
      }
    }
  }

  private var activeSegments: Int {
    guard let fraction else { return 0 }
    return Int(ceil(min(max(fraction, 0), 1) * 10))
  }
}

private struct UsageTrendChart: View {
  let trend: UsageTrend
  let color: Color
  let language: DokkeLanguage

  private var peak: UsageTrendPoint? {
    trend.points.max { $0.value < $1.value }
  }

  private var maxValue: Double {
    max(1, trend.points.map(\.value).max() ?? 1)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(I18n.text("usage.trend", language: language))
          .font(.system(size: 12, weight: .semibold, design: .rounded))
          .foregroundStyle(.white.opacity(0.9))
        Spacer(minLength: 8)
        if let peak {
          Text(I18n.text("usage.trendPeak", language: language, ["value": peak.valueLabel ?? "\(Int(peak.value.rounded())) tokens"]))
            .font(.system(size: 10, weight: .semibold, design: .rounded))
            .foregroundStyle(.white.opacity(0.52))
            .lineLimit(1)
        }
      }

      HStack(alignment: .bottom, spacing: 3) {
        ForEach(trend.points.indices, id: \.self) { index in
          Capsule(style: .continuous)
            .fill(color.opacity(0.9))
            .frame(maxWidth: .infinity)
            .frame(height: barHeight(trend.points[index].value))
        }
      }
      .frame(height: 76, alignment: .bottom)
      .padding(.top, 10)
      .overlay(alignment: .bottom) {
        Rectangle()
          .fill(Color.white.opacity(0.12))
          .frame(height: 1)
      }

      HStack {
        Text(trend.points.first?.label ?? "")
        Spacer()
        Text(trend.points.last?.label ?? "")
      }
      .font(.system(size: 9, design: .rounded))
      .foregroundStyle(.white.opacity(0.48))
      .padding(.top, 7)

      if let note = trend.note, !note.isEmpty {
        Text(note)
          .font(.system(size: 10, design: .rounded))
          .foregroundStyle(.white.opacity(0.48))
          .frame(maxWidth: .infinity)
          .multilineTextAlignment(.center)
          .padding(.top, 10)
      }
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 13)
    .background(Color(red: 0.14, green: 0.06, blue: 0.018).opacity(0.58), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    .accessibilityElement(children: .combine)
  }

  private func barHeight(_ value: Double) -> CGFloat {
    guard value > 0 else { return 2 }
    return max(5, CGFloat(76 * min(1, value / maxValue)))
  }
}

private struct UsageLimitChart: View {
  let entry: UsageResourceEntry
  let title: String
  let color: Color
  let size: CGFloat
  let lineWidth: CGFloat
  let language: DokkeLanguage
  let reduceMotion: Bool
  let isPrimary: Bool
  @State private var animatedFraction = 0.0

  private var fraction: Double? {
    guard let value = entry.resource.utilization else { return nil }
    return min(max(value, 0), 1)
  }

  var body: some View {
    VStack(spacing: 8) {
      ZStack {
        Circle()
          .stroke(Color.white.opacity(0.10), lineWidth: lineWidth)
        if fraction != nil {
          Circle()
            .trim(from: 0, to: animatedFraction)
            .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            .rotationEffect(.degrees(-90))
        }
        VStack(spacing: 2) {
          Text(percentText)
            .font(.system(size: isPrimary ? 25 : 18, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
          Text(I18n.text("usage.usedShort", language: language))
            .font(.system(size: isPrimary ? 10 : 9, weight: .semibold))
            .foregroundStyle(.white.opacity(0.44))
        }
      }
      .frame(width: size, height: size)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("\(title), \(percentText) \(I18n.text("usage.usedShort", language: language))")
      Text(title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.white.opacity(isPrimary ? 0.82 : 0.62))
        .lineLimit(1)
      Text(resetText)
        .font(.caption2)
        .foregroundStyle(.white.opacity(0.38))
        .lineLimit(1)
    }
    .frame(minWidth: size, alignment: .center)
    .onAppear { animate(to: fraction) }
    .onChange(of: fraction) { _, value in animate(to: value) }
  }

  private var percentText: String {
    guard let fraction else { return "—" }
    return "\(Int((fraction * 100).rounded()))%"
  }

  private var resetText: String {
    guard let reset = entry.resource.resetsAt, let date = parseDate(reset) else {
      return I18n.text("usage.resetUnknown", language: language)
    }
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = Locale(identifier: language.rawValue)
    return "\(I18n.text("usage.reset", language: language)) \(formatter.localizedString(for: date, relativeTo: Date()))"
  }

  private func animate(to value: Double?) {
    let target = value ?? 0
    guard !reduceMotion else {
      animatedFraction = target
      return
    }
    animatedFraction = 0
    withAnimation(.easeOut(duration: 0.7)) {
      animatedFraction = target
    }
  }
}

private struct UsageResourceRow: View {
  let entry: UsageResourceEntry
  let language: DokkeLanguage

  var body: some View {
    VStack(spacing: 7) {
      HStack(spacing: 10) {
        Text(resourceLabel(entry.id, language: language))
          .font(.caption)
          .foregroundStyle(.white.opacity(0.58))
        Spacer()
        Text(valueText)
          .font(.caption.weight(.semibold))
          .foregroundStyle(.white.opacity(0.82))
      }
      HStack(spacing: 10) {
        Text(usedText)
        Spacer()
        Text(resetText)
      }
      .font(.caption2)
      .foregroundStyle(.white.opacity(0.38))
      if let utilization = entry.resource.utilization {
        UsageMeter(fraction: min(max(utilization, 0), 1), color: .white.opacity(0.62))
          .frame(height: 5)
      }
    }
    .padding(.vertical, 8)
  }

  private var valueText: String {
    if let remaining = entry.resource.remaining { return formatValue(remaining, unit: entry.resource.unit) }
    if let available = entry.resource.available { return formatValue(available, unit: entry.resource.unit) }
    if let utilization = entry.resource.utilization { return "\(Int((utilization * 100).rounded()))%" }
    return "—"
  }

  private var usedText: String {
    guard let used = entry.resource.used, let limit = entry.resource.limit else { return "" }
    return "\(I18n.text("usage.used", language: language, ["value": formatValue(used, unit: entry.resource.unit)])) / \(formatValue(limit, unit: entry.resource.unit))"
  }

  private var resetText: String {
    guard let reset = entry.resource.resetsAt, let date = parseDate(reset) else {
      return I18n.text("usage.resetUnknown", language: language)
    }
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = Locale(identifier: language.rawValue)
    return formatter.localizedString(for: date, relativeTo: Date())
  }
}

private struct UsageMeter: View {
  let fraction: Double?
  let color: Color

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.white.opacity(0.12))
        if let fraction {
          Capsule()
            .fill(color)
            .frame(width: max(5, geometry.size.width * fraction))
        }
      }
    }
  }
}

private struct TokenMascot: View {
  let mood: String
  let activity: String
  let reduceMotion: Bool
  @State private var floating = false

  var body: some View {
    let writing = activity == "working" || activity == "syncing"
    ZStack {
      Circle()
        .fill(Color.white.opacity(0.16))
        .blur(radius: 7)
      Circle()
        .fill(
          LinearGradient(
            colors: [Color.white.opacity(0.86), Color.white.opacity(0.28)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
        .overlay(Circle().strokeBorder(Color.white.opacity(0.62), lineWidth: 1))
        .shadow(color: Color.white.opacity(0.18), radius: 8)
      if writing {
        WorkingMascotAnimation(reduceMotion: reduceMotion)
      } else {
        StaticMascotFace(mood: mood)
      }
    }
    .offset(y: reduceMotion || writing ? 0 : (floating ? -1 : 1))
    .onAppear {
      guard !reduceMotion, !writing else { return }
      withAnimation(.easeInOut(duration: 1.7).repeatForever(autoreverses: true)) {
        floating = true
      }
    }
    .accessibilityLabel(moodAccessibilityLabel)
  }

  private var moodAccessibilityLabel: String {
    switch mood {
    case "exhausted": return "Token exhausted"
    case "tired": return "Token tired"
    case "attentive": return "Token attentive"
    case "energized": return "Token energized"
    default: return "Token waiting"
    }
  }
}

private struct StaticMascotFace: View {
  let mood: String

  var body: some View {
    VStack(spacing: 5) {
      HStack(spacing: 8) {
        Capsule()
          .fill(.black.opacity(0.76))
          .frame(width: 4, height: 8)
        Capsule()
          .fill(.black.opacity(0.76))
          .frame(width: 4, height: 8)
      }
      Capsule()
        .fill(.black.opacity(0.68))
        .frame(width: 14, height: 2.5)
        .rotationEffect(.degrees(mood == "exhausted" || mood == "tired" ? 180 : 0))
    }
  }
}

private struct WorkingMascotAnimation: View {
  let reduceMotion: Bool

  var body: some View {
    TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { context in
      let writingPhase = WritingMascotPose.phase(at: context.date)
      let pose = WritingMascotPose.sample(at: writingPhase)
      ZStack {
        StaticWritingEyes()
        WritingHand(progress: pose.handProgress)
          .frame(width: 27, height: 17)
          .offset(x: pose.handX, y: 8)
      }
    }
  }
}

private struct StaticWritingEyes: View {
  var body: some View {
    HStack(spacing: 8) {
      Capsule()
        .fill(.black.opacity(0.76))
        .frame(width: 4.6, height: 14)
      Capsule()
        .fill(.black.opacity(0.76))
        .frame(width: 4.6, height: 14)
    }
  }
}

private struct WritingMascotPose {
  let handX: CGFloat
  let handProgress: CGFloat

  private static let frames: [WritingMascotPose] = [
    WritingMascotPose(handX: 3.5, handProgress: 0.86),
    WritingMascotPose(handX: -1.0, handProgress: 0.48),
    WritingMascotPose(handX: -3.2, handProgress: 0.14),
    WritingMascotPose(handX: 1.5, handProgress: 0.68),
  ]

  static func phase(at date: Date) -> CGFloat {
    let cycleDuration: TimeInterval = 2.8
    let elapsed = date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: cycleDuration)
    return CGFloat(elapsed / cycleDuration)
  }

  static func sample(at phase: CGFloat) -> WritingMascotPose {
    let normalized = min(max(phase, 0), 0.999999)
    let position = normalized * CGFloat(frames.count)
    let index = Int(position.rounded(.down))
    let amount = smoothStep(position - CGFloat(index))
    return interpolate(frames[index], frames[(index + 1) % frames.count], amount)
  }

  private static func smoothStep(_ value: CGFloat) -> CGFloat {
    let clamped = min(max(value, 0), 1)
    return clamped * clamped * (3 - 2 * clamped)
  }

  private static func interpolate(_ from: WritingMascotPose, _ to: WritingMascotPose,
                                  _ amount: CGFloat) -> WritingMascotPose {
    func mix(_ a: CGFloat, _ b: CGFloat) -> CGFloat { a + (b - a) * amount }
    return WritingMascotPose(
      handX: mix(from.handX, to.handX),
      handProgress: mix(from.handProgress, to.handProgress)
    )
  }
}

private struct WritingHand: View {
  let progress: CGFloat

  var body: some View {
    Canvas { context, size in
      let amount = min(max(progress, 0), 1)
      let baseline = size.height * 0.76
      let handX = size.width * (0.42 + amount * 0.45)
      let lineStart = size.width * 0.06
      let lineEnd = max(lineStart, handX - size.width * 0.18)

      var writingLine = Path()
      let samples = 12
      for index in 0...samples {
        let t = CGFloat(index) / CGFloat(samples)
        let x = lineStart + (lineEnd - lineStart) * t
        let y = baseline + sin(t * .pi * 5) * size.height * 0.075
        if index == 0 {
          writingLine.move(to: CGPoint(x: x, y: y))
        } else {
          writingLine.addLine(to: CGPoint(x: x, y: y))
        }
      }
      context.stroke(
        writingLine,
        with: .color(.black.opacity(0.68)),
        style: StrokeStyle(lineWidth: max(1, size.width * 0.045), lineCap: .round, lineJoin: .round)
      )

      var hand = Path()
      let handWidth = size.width * 0.24
      let handHeight = size.height * 0.52
      hand.move(to: CGPoint(x: handX - handWidth * 0.9, y: baseline + handHeight * 0.22))
      hand.addCurve(
        to: CGPoint(x: handX + handWidth * 0.4, y: baseline - handHeight * 0.75),
        control1: CGPoint(x: handX - handWidth * 0.1, y: baseline + handHeight * 0.1),
        control2: CGPoint(x: handX - handWidth * 0.05, y: baseline - handHeight * 0.65)
      )
      hand.addCurve(
        to: CGPoint(x: handX + handWidth * 0.78, y: baseline + handHeight * 0.5),
        control1: CGPoint(x: handX + handWidth * 0.95, y: baseline - handHeight * 0.45),
        control2: CGPoint(x: handX + handWidth, y: baseline + handHeight * 0.18)
      )
      hand.addCurve(
        to: CGPoint(x: handX - handWidth * 0.9, y: baseline + handHeight * 0.22),
        control1: CGPoint(x: handX + handWidth * 0.3, y: baseline + handHeight * 0.72),
        control2: CGPoint(x: handX - handWidth * 0.68, y: baseline + handHeight * 0.7)
      )
      context.fill(hand, with: .color(.black.opacity(0.74)))

      var pen = Path()
      pen.move(to: CGPoint(x: handX + handWidth * 0.05, y: baseline - handHeight * 0.12))
      pen.addLine(to: CGPoint(x: handX + handWidth * 0.72, y: baseline - handHeight * 0.86))
      context.stroke(
        pen,
        with: .color(.black.opacity(0.82)),
        style: StrokeStyle(lineWidth: max(1, size.width * 0.055), lineCap: .round)
      )
    }
    .shadow(color: .black.opacity(0.24), radius: 1)
  }
}

private func parseDate(_ value: String) -> Date? {
  ISO8601DateFormatter().date(from: value)
}

private func resourceDetail(_ entry: UsageResourceEntry, language: DokkeLanguage) -> String {
  let resource = entry.resource
  if let remaining = resource.remaining {
    return "\(formatValue(remaining, unit: resource.unit)) \(I18n.text("usage.remaining", language: language))"
  }
  if let available = resource.available {
    return "\(formatValue(available, unit: resource.unit)) \(I18n.text("usage.available", language: language))"
  }
  return I18n.text("usage.noData", language: language)
}

private func resourceLabel(_ id: String, language: DokkeLanguage) -> String {
  switch id.lowercased() {
  case "session", "fivehour", "five_hour", "5h", "fivehours":
    return I18n.text("usage.fiveHour", language: language)
  case "weekly", "week":
    return I18n.text("usage.weekly", language: language)
  case "monthly":
    return I18n.text("usage.monthly", language: language)
  case "credits", "premiumcredits":
    return I18n.text("usage.credits", language: language)
  case "balance", "extrausagebalance":
    return I18n.text("usage.balance", language: language)
  default:
    return id.replacingOccurrences(of: "([a-z])([A-Z])", with: "$1 $2", options: .regularExpression).capitalized
  }
}

private func formatValue(_ value: Double, unit: String?) -> String {
  switch unit {
  case "usd": return String(format: "$%.2f", value)
  case "percent": return "\(Int(value.rounded()))%"
  default:
    if value.rounded() == value { return String(Int(value)) }
    return String(format: "%.1f", value)
  }
}
