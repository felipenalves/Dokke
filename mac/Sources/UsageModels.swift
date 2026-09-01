import Foundation

struct UsageSnapshot: Decodable, Equatable {
  let ok: Bool
  let source: String
  let sourceState: String
  let updatedAt: String?
  let providers: [String: UsageProvider]
  let errors: [UsageError]

  private enum CodingKeys: String, CodingKey {
    case ok, source, sourceState, updatedAt, providers, errors
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    ok = try container.decodeIfPresent(Bool.self, forKey: .ok) ?? false
    source = try container.decodeIfPresent(String.self, forKey: .source) ?? "openusage"
    sourceState = try container.decodeIfPresent(String.self, forKey: .sourceState) ?? "invalid"
    updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    providers = try container.decodeIfPresent([String: UsageProvider].self, forKey: .providers) ?? [:]
    errors = try container.decodeIfPresent([UsageError].self, forKey: .errors) ?? []
  }
}

struct UsageError: Decodable, Equatable {
  let code: String?
  let message: String?
}

struct UsageProvider: Decodable, Equatable {
  let name: String?
  let plan: String?
  let status: String?
  let mascot: String?
  let stale: Bool
  let refreshedAt: String?
  let resources: [String: UsageResource]
  let trend: UsageTrend?

  private enum CodingKeys: String, CodingKey {
    case name, plan, status, mascot, stale, refreshedAt, resources, trend
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    name = try container.decodeIfPresent(String.self, forKey: .name)
    plan = try container.decodeIfPresent(String.self, forKey: .plan)
    status = try container.decodeIfPresent(String.self, forKey: .status)
    mascot = try container.decodeIfPresent(String.self, forKey: .mascot)
    stale = try container.decodeIfPresent(Bool.self, forKey: .stale) ?? false
    refreshedAt = try container.decodeIfPresent(String.self, forKey: .refreshedAt)
    resources = try container.decodeIfPresent([String: UsageResource].self, forKey: .resources) ?? [:]
    trend = try container.decodeIfPresent(UsageTrend.self, forKey: .trend)
  }

  var highestUtilization: Double? {
    resources.values
      .filter { $0.kind == "consumption" }
      .compactMap(\.utilization)
      .max()
  }

  var resourceEntries: [UsageResourceEntry] {
    let priority = ["session", "fivehour", "five_hour", "5h", "weekly", "week", "monthly"]
    return resources.keys.sorted { lhs, rhs in
      let leftIndex = priority.firstIndex(of: lhs.lowercased()) ?? Int.max
      let rightIndex = priority.firstIndex(of: rhs.lowercased()) ?? Int.max
      if leftIndex != rightIndex { return leftIndex < rightIndex }
      return lhs.localizedCaseInsensitiveCompare(rhs) == .orderedAscending
    }.compactMap { id in
      guard let resource = resources[id] else { return nil }
      return UsageResourceEntry(id: id, resource: resource)
    }
  }

  var fiveHourResource: UsageResourceEntry? {
    resourceEntries.first { entry in
      ["session", "fivehour", "five_hour", "5h", "fivehours"].contains(entry.id.lowercased())
        && entry.resource.kind == "consumption"
    }
  }

  var weeklyResource: UsageResourceEntry? {
    resourceEntries.first { entry in
      ["weekly", "week"].contains(entry.id.lowercased())
        && entry.resource.kind == "consumption"
    }
  }

  var primaryResource: UsageResourceEntry? {
    fiveHourResource ?? weeklyResource ?? resourceEntries.first(where: { $0.resource.kind == "consumption" })
      ?? resourceEntries.first
  }

  var secondaryResource: UsageResourceEntry? {
    guard let primaryResource else { return weeklyResource }
    return weeklyResource?.id != primaryResource.id ? weeklyResource : nil
  }

  var additionalResourceEntries: [UsageResourceEntry] {
    let featuredIDs = Set([fiveHourResource?.id, weeklyResource?.id].compactMap { $0 })
    return resourceEntries.filter { !featuredIDs.contains($0.id) }
  }
}

struct UsageResource: Decodable, Equatable {
  let label: String?
  let kind: String?
  let unit: String?
  let used: Double?
  let limit: Double?
  let remaining: Double?
  let available: Double?
  let utilization: Double?
  let resetsAt: String?
  let estimated: Bool
}

struct UsageResourceEntry: Identifiable, Equatable {
  let id: String
  let resource: UsageResource
}

struct UsageTrend: Decodable, Equatable {
  let points: [UsageTrendPoint]
  let note: String?
}

struct UsageTrendPoint: Decodable, Equatable {
  let label: String
  let value: Double
  let valueLabel: String?
}
