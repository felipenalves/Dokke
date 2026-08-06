import SwiftUI

struct RootView: View {
  @EnvironmentObject private var store: DockStore

  var body: some View {
    Group {
      if store.authed {
        MainView()
          .transition(.opacity)
      } else {
        LoginView()
          .transition(.opacity)
      }
    }
    .animation(.easeInOut(duration: 0.25), value: store.authed)
  }
}
