import SwiftUI

struct RecentsView: View {
  @EnvironmentObject private var store: DockStore
  private let rowColors: [(Double, Double, Double)] = [
    (0.04, 0.52, 1.0), (1.0, 0.62, 0.04), (0.19, 0.82, 0.345), (0.75, 0.35, 0.95)
  ]

  var body: some View {
    ScrollView {
      if store.running.isEmpty {
        VStack(spacing: 14) {
          Image(systemName: "clock")
            .font(.system(size: 40))
            .foregroundColor(.white.opacity(0.4))
          Text("Nenhum app aberto")
            .font(.headline)
            .foregroundColor(.white.opacity(0.8))
          Text("Os apps que estão rodando no Mac aparecem aqui.")
            .font(.subheadline)
            .foregroundColor(.white.opacity(0.5))
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 320)
      } else {
        VStack(spacing: 12) {
          ForEach(store.running) { app in
            Button {
              store.activate(app.name)
            } label: {
              row(app)
            }
            .buttonStyle(.plain)
          }
        }
        .padding(20)
      }
    }
    .refreshable {
      await store.refreshAll()
    }
  }

  private func row(_ app: RunningApp) -> some View {
    HStack(spacing: 14) {
      ZStack(alignment: .topTrailing) {
        if let icon = store.icon(app.name), let ui = UIImage(data: icon) {
          Image(uiImage: ui).resizable().scaledToFill()
        } else {
          Color.gray.opacity(0.3)
        }
      }
      .frame(width: 46, height: 46)
      .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

      VStack(alignment: .leading, spacing: 3) {
        Text(app.name)
          .font(.headline)
          .foregroundColor(.white)
          .lineLimit(1)
        if let pid = app.pid {
          Text("PID \(pid)")
            .font(.caption)
            .foregroundColor(.white.opacity(0.45))
        }
      }
      Spacer()
      Circle()
        .fill(Color(red: 0.19, green: 0.82, blue: 0.345))
        .frame(width: 9, height: 9)
    }
    .padding(14)
    .background(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(Material.regular)
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
    )
  }
}
