import SwiftUI
import UIKit

// MARK: - Background quente escuro (mesmo clima do PWA)

struct AppBackground: View {
  var body: some View {
    LinearGradient(
      colors: [
        Color(red: 0.11, green: 0.05, blue: 0.02),
        Color(red: 0.05, green: 0.027, blue: 0.009),
        Color(red: 0.03, green: 0.012, blue: 0.004),
      ],
      startPoint: .top,
      endPoint: .bottom
    )
    .ignoresSafeArea()
  }
}

// MARK: - Card de vidro (frosted) — padrão liquid glass

struct GlassCard<Content: View>: View {
  @ViewBuilder let content: Content
  private let radius: CGFloat

  init(radius: CGFloat = 28, @ViewBuilder content: () -> Content) {
    self.radius = radius
    self.content = content()
  }

  var body: some View {
    content
      .padding(20)
      .frame(maxWidth: .infinity)
      .background(
        RoundedRectangle(cornerRadius: radius, style: .continuous)
          .fill(Material.ultraThin)
          .overlay(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
              .strokeBorder(Color.white.opacity(0.16), lineWidth: 1)
          )
          .shadow(color: .black.opacity(0.4), radius: 24, y: 12)
      )
  }
}

// MARK: - Ícone do app Dokke

struct DokkeIcon: View {
  var size: CGFloat = 54

  var body: some View {
    if let url = Bundle.main.url(forResource: "dokke-icon", withExtension: "png"),
       let data = try? Data(contentsOf: url),
       let ui = UIImage(data: data) {
      Image(uiImage: ui)
        .resizable()
        .scaledToFill()
    } else {
      Image(systemName: "square.grid.2x2")
        .resizable()
        .scaledToFit()
        .foregroundColor(.white)
        .padding(size * 0.22)
        .background(
          RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
            .fill(LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
        )
    }
  }
}

// MARK: - Botão principal "Conectar / ações"

struct ConnectButtonStyle: ButtonStyle {
  var color: Color = Color(red: 0.0, green: 0.47, blue: 0.95)
  var maxWidth: Bool = true

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.headline)
      .foregroundColor(.white)
      .frame(maxWidth: maxWidth ? .infinity : nil)
      .padding(.vertical, 15)
      .padding(.horizontal, maxWidth ? 0 : 22)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(LinearGradient(colors: [color.opacity(1), color.opacity(0.8)], startPoint: .top, endPoint: .bottom))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .strokeBorder(Color.white.opacity(0.22), lineWidth: 1)
      )
      .shadow(color: color.opacity(0.35), radius: 12, y: 6)
      .scaleEffect(configuration.isPressed ? 0.975 : 1)
      .opacity(configuration.isPressed ? 0.9 : 1)
      .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
  }
}

// MARK: - Tile de app (launchpad)

struct AppTile: View {
  let name: String
  let isRunning: Bool
  let data: Data?
  let onTap: () -> Void

  var body: some View {
    Button(action: onTap) {
      VStack(spacing: 8) {
        ZStack(alignment: .topTrailing) {
          if let data, let ui = UIImage(data: data) {
            Image(uiImage: ui)
              .resizable()
              .scaledToFill()
              .frame(width: 64, height: 64)
              .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
          } else {
            monogram
          }
          if isRunning {
            Circle()
              .fill(Color(red: 0.19, green: 0.82, blue: 0.345))
              .frame(width: 11, height: 11)
              .overlay(Circle().stroke(.black.opacity(0.4), lineWidth: 1.5))
              .offset(x: 3, y: -3)
          }
        }
        Text(name)
          .font(.caption2)
          .foregroundColor(.white.opacity(0.9))
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.plain)
  }

  private var monogram: some View {
    Text(monogram(name))
      .font(.system(size: 26, weight: .bold))
      .foregroundColor(.white)
      .frame(width: 64, height: 64)
      .background(
        RoundedRectangle(cornerRadius: 17, style: .continuous)
          .fill(LinearGradient(colors: appGradient(name), startPoint: .topLeading, endPoint: .bottomTrailing))
      )
  }

  private func monogram(_ n: String) -> String {
    let parts = n.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: " ")
    return parts.count > 1 ? String(parts[0].prefix(1)) + String(parts[1].prefix(1)) : String(n.prefix(2)).uppercased()
  }

  private func appGradient(_ n: String) -> [Color] {
    let palettes: [[(Double, Double, Double)]] = [
      [(0.04, 0.52, 1.0), (0.37, 0.36, 0.90)],
      [(1.0, 0.22, 0.37), (1.0, 0.62, 0.04)],
      [(0.19, 0.82, 0.345), (0.04, 0.52, 1.0)],
      [(0.75, 0.35, 0.95), (1.0, 0.22, 0.37)],
      [(1.0, 0.62, 0.04), (1.0, 0.27, 0.23)],
      [(0.39, 0.82, 1.0), (0.04, 0.52, 1.0)],
      [(1.0, 0.84, 0.04), (1.0, 0.62, 0.04)],
      [(0.20, 0.84, 0.29), (0.39, 0.82, 1.0)],
    ]
    var h = 0
    for b in n.utf8.map({ Int($0) }) { h = (h &* 31 &+ b) & 0xFFFF }
    let c = palettes[h % palettes.count]
    return c.map { Color(red: $0.0, green: $0.1, blue: $0.2) }
  }
}
