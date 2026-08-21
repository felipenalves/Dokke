import SwiftUI

struct DockIcon: View {
  @EnvironmentObject private var store: DockStore
  let name: String
  @State private var isHovered = false

  private let iconSize: CGFloat = 96
  private let cornerRadius: CGFloat = 18

  var body: some View {
    VStack(spacing: 8) {
      iconWithEffects

      Text(name)
        .font(.system(size: 11))
        .lineLimit(1)
        .truncationMode(.middle)
        .frame(width: 120)
        .foregroundStyle(.primary)
        .multilineTextAlignment(.center)
    }
    .frame(width: iconSize, height: iconSize + 24)
    .contentShape(Rectangle())
    .onHover { isHovered = $0 }
    .onTapGesture { /* future: launch app */ }
    .contextMenu {
      Button(I18n.removeFromDock) {
        Task { await store.unpin(name) }
      }
    }
  }

  @ViewBuilder
  private var iconWithEffects: some View {
    if #available(macOS 26, *) {
      iconImage
        .frame(width: iconSize, height: iconSize)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .shadow(color: .black.opacity(isHovered ? 0.18 : 0.1), radius: isHovered ? 8 : 4, y: isHovered ? 4 : 2)
        .scaleEffect(isHovered ? 1.08 : 1.0, anchor: .center)
        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isHovered)
        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: cornerRadius))
    } else {
      iconImage
        .frame(width: iconSize, height: iconSize)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .shadow(color: .black.opacity(isHovered ? 0.18 : 0.1), radius: isHovered ? 8 : 4, y: isHovered ? 4 : 2)
        .scaleEffect(isHovered ? 1.08 : 1.0, anchor: .center)
        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isHovered)
    }
  }

  @ViewBuilder
  private var iconImage: some View {
    if let cached = store.cachedIcon(for: name) {
      cached.resizable().scaledToFit()
    } else {
      AsyncImage(url: store.iconURL(for: name)) { phase in
        switch phase {
        case .success(let img):
          img.resizable().scaledToFit()
        default:
          ZStack {
            RoundedRectangle(cornerRadius: cornerRadius)
              .fill(.quaternary)
            Text(String(name.prefix(1)))
              .font(.title.bold())
              .foregroundStyle(.secondary)
          }
        }
      }
    }
  }
}
