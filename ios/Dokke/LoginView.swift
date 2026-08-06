import SwiftUI

struct LoginView: View {
  @EnvironmentObject private var store: DockStore
  @State private var pin = ""
  @State private var showServer = false
  @State private var server: String

  init() {
    _server = State(initialValue: UserDefaults.standard.string(forKey: "DockServerURL") ?? "http://192.168.1.2:3000")
  }

  var body: some View {
    ZStack {
      AppBackground()

      ScrollView {
        VStack(spacing: 0) {
          Spacer(minLength: 12)

          VStack(spacing: 14) {
            DokkeIcon(size: 58)
              .frame(width: 62, height: 62)
              .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
              .overlay(
                RoundedRectangle(cornerRadius: 19, style: .continuous)
                  .strokeBorder(Color.white.opacity(0.18), lineWidth: 1)
              )
              .shadow(color: .black.opacity(0.35), radius: 14, y: 6)

            Text("Conectar ao Dokke")
              .font(.title2.bold())
              .foregroundColor(.white)

            Text("Conecte o aparelho ao seu Mac para abrir os apps.")
              .font(.subheadline)
              .foregroundColor(.white.opacity(0.6))
              .multilineTextAlignment(.center)

            GlassCard {
              VStack(alignment: .leading, spacing: 6) {
                step("1", "Conecte o Mac e este aparelho à ", bold: "mesma rede Wi-Fi.")
                step("2", "No Mac, abra o ", bold: "Dokke")
                  .padding(.bottom, 0)
                step("3", "Toque em ", bold: "Gerar novo código")
              }
            }

            // Código + botão
            VStack(spacing: 14) {
              ZStack {
                TextField("••••", text: $pin)
                  .keyboardType(.numberPad)
                  .font(.system(size: 30, weight: .bold, design: .monospaced))
                  .multilineTextAlignment(.center)
                  .foregroundColor(.white)
                  .padding(.vertical, 14)
                  .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                      .fill(Color.white.opacity(0.08))
                  )
                  .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                      .strokeBorder(Color.white.opacity(0.16), lineWidth: 1)
                  )
                  .onChange(of: pin) { _, v in
                    let filtered = v.filter { $0.isNumber }
                    if filtered.count > 4 { pin = String(filtered.prefix(4)) }
                    else if filtered != v { pin = filtered }
                  }
                  .onSubmit { submit() }
              }

              if let err = store.authError {
                Text(err)
                  .font(.footnote.weight(.semibold))
                  .foregroundColor(Color(red: 1.0, green: 0.5, blue: 0.48))
              }

              Button {
                submit()
              } label: {
                if store.authenticating {
                  ProgressView().tint(.white)
                } else {
                  Text("Conectar")
                }
              }
              .buttonStyle(ConnectButtonStyle())
              .disabled(pin.count != 4 || store.authenticating)

              // servidor (avançado)
              Button {
                withAnimation { showServer.toggle() }
              } label: {
                Label("Servidor", systemImage: "network")
                  .font(.caption)
                  .foregroundColor(.white.opacity(0.5))
              }
              .buttonStyle(.plain)

              if showServer {
                HStack {
                  TextField("http://192.168.1.2:3000", text: $server)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .font(.footnote)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.07)))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.white.opacity(0.12), lineWidth: 1))
                  Button("Salvar") {
                    store.setServer(server)
                    showServer = false
                  }
                  .font(.footnote.bold())
                  .foregroundColor(Color(red: 0.4, green: 0.7, blue: 1.0))
                  .buttonStyle(.plain)
                }
              }
            }
          }

          Spacer(minLength: 20)

          Text("Dokke by Felipe Natanael")
            .font(.caption2)
            .foregroundColor(.white.opacity(0.35))
        }
        .padding(.horizontal, 28)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
  }

  private func step(_ n: String, _ text: String, bold: String) -> some View {
    HStack(alignment: .top, spacing: 11) {
      Text(n)
        .font(.system(size: 11, weight: .bold))
        .foregroundColor(.white.opacity(0.7))
        .frame(width: 20, height: 20)
        .background(
          Circle().fill(Color.white.opacity(0.08))
            .overlay(Circle().strokeBorder(Color.white.opacity(0.14), lineWidth: 1))
        )
      (Text(text).foregroundColor(.white.opacity(0.62)) + Text(bold).fontWeight(.semibold).foregroundColor(.white))
        .font(.footnote)
        .fixedSize(horizontal: false, vertical: true)
    }
  }

  private func submit() {
    guard pin.count == 4 else { return }
    let p = pin
    pin = ""
    Task {
      await store.login(pin: p)
    }
  }
}
