import SwiftUI

struct OBSView: View {
  @EnvironmentObject private var store: DockStore

  var body: some View {
    ScrollView {
      VStack(spacing: 18) {
        if !store.obs.connected {
          VStack(spacing: 14) {
            Image(systemName: "video.slash")
              .font(.system(size: 40))
              .foregroundColor(.white.opacity(0.4))
            Text("OBS desconectado")
              .font(.headline)
              .foregroundColor(.white.opacity(0.8))
            Text("Abra o OBS Studio no Mac para controlar aqui.")
              .font(.subheadline)
              .foregroundColor(.white.opacity(0.5))
          }
          .frame(maxWidth: .infinity, minHeight: 280)
        } else {
          scenesCard
          controlsCard
        }
      }
      .padding(20)
    }
    .refreshable {
      await store.refreshAll()
    }
  }

  private var scenesCard: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Cenas")
        .font(.headline)
        .foregroundColor(.white)
      if store.obs.scenes.isEmpty {
        Text("Sem cenas.")
          .font(.subheadline)
          .foregroundColor(.white.opacity(0.5))
      } else {
        Group {
          if #available(iOS 26, *) {
            Picker("Cena", selection: sceneBinding) {
              ForEach(store.obs.scenes, id: \.self) { s in
                Text(s).tag(s)
              }
            }
            .pickerStyle(.segmented)
          } else {
            Picker("Cena", selection: sceneBinding) {
              ForEach(store.obs.scenes, id: \.self) { s in
                Text(s).tag(s)
              }
            }
            .pickerStyle(.menu)
            .tint(.white)
          }
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(18)
    .background(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .fill(Material.regular)
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
    )
  }

  private var controlsCard: some View {
    HStack(spacing: 12) {
      ctlButton("record.circle.fill", label: store.obs.recording ? "Gravando" : "Gravar",
                active: store.obs.recording, color: Color(red: 1.0, green: 0.27, blue: 0.23)) {
        store.obsAction("record")
      }
      ctlButton("dot.radiowaves.left.and.right", label: store.obs.streaming ? "Ao vivo" : "Live",
                active: store.obs.streaming, color: Color(red: 0.04, green: 0.52, blue: 1.0)) {
        store.obsAction("stream")
      }
      ctlButton("stop.fill", label: "Parar tudo", active: false, color: Color.red.opacity(0.85)) {
        store.obsAction("stop-all")
      }
    }
  }

  private func ctlButton(_ icon: String, label: String, active: Bool, color: Color, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      VStack(spacing: 8) {
        Image(systemName: icon)
          .font(.title2)
        Text(label)
          .font(.caption.weight(.semibold))
      }
      .foregroundColor(active ? .white : .white.opacity(0.75))
      .frame(maxWidth: .infinity)
      .padding(.vertical, 16)
      .background(
        RoundedRectangle(cornerRadius: 17, style: .continuous)
          .fill(active ? color.opacity(0.35) : color.opacity(0.18))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 17, style: .continuous)
          .strokeBorder(active ? color.opacity(0.8) : Color.white.opacity(0.08), lineWidth: 1)
      )
    }
    .buttonStyle(.plain)
  }

  private var sceneBinding: Binding<String> {
    Binding(
      get: { store.obs.scene ?? store.obs.scenes.first ?? "" },
      set: { store.obsScene($0) }
    )
  }
}
