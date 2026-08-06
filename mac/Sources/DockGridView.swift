import SwiftUI

struct DockGridView: View {
  @EnvironmentObject private var store: DockStore
  @State private var showPicker = false
  @State private var draggedItem: String?
  @State private var currentPage: Int?
  @State private var draftPinned: [String]?

  private let tileSize: CGFloat = 104
  private let spacing: CGFloat = 24

  private var displayedPinned: [String] {
    draftPinned ?? store.pinned
  }

  private func pagedPinned(width: CGFloat, height: CGFloat) -> [[String]] {
    let pageSize = 8
    return stride(from: 0, to: displayedPinned.count, by: pageSize).map {
      Array(displayedPinned[$0..<min($0 + pageSize, displayedPinned.count)])
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text("Apps fixados")
          .font(.title2.bold())
        Spacer()
        if store.loading {
          ProgressView().controlSize(.small)
        }
        Button {
          Task { await store.refreshAll() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .buttonStyle(.borderless)
        .help("Refresh")
      }

      if !store.online {
        offlineView
      } else if store.pinned.isEmpty {
        emptyDock
      } else {
        dockPages
      }

      if let note = store.lastSyncNote {
        Text(note)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }

  private var dockPages: some View {
    VStack(spacing: 0) {
      GeometryReader { geo in
        let pages = pagedPinned(width: geo.size.width, height: geo.size.height)
        ScrollView(.horizontal) {
          LazyHStack(spacing: 0) {
            ForEach(Array(pages.enumerated()), id: \.offset) { idx, names in
              pageContent(names: names, isLast: idx == pages.count - 1, width: geo.size.width)
                .containerRelativeFrame(.horizontal)
            }
          }
          .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $currentPage)
        .scrollIndicators(.hidden)
        .frame(height: geo.size.height)
      }
      .padding(.horizontal, 20)
      .padding(.vertical, 24)
      .background(
        RoundedRectangle(cornerRadius: 24)
          .fill(Color(nsColor: .controlBackgroundColor))
          .overlay(
            RoundedRectangle(cornerRadius: 24)
              .stroke(.quaternary, lineWidth: 1)
          )
          .shadow(color: .black.opacity(0.06), radius: 8, y: 2)
      )

      if let pages = Optional(pagedPinned(width: 0, height: 0)), pages.count > 1 {
        dots(count: pages.count)
          .padding(.top, 12)
      }
    }
    .frame(maxWidth: .infinity)
    .sheet(isPresented: $showPicker) {
      AppPickerSheet()
    }
  }

  private func dots(count: Int) -> some View {
    HStack(spacing: 6) {
      ForEach(0..<count, id: \.self) { i in
        Circle()
          .fill(i == currentPage ? Color.white : Color.secondary.opacity(0.35))
          .frame(width: 7, height: 7)
          .scaleEffect(i == currentPage ? 1.2 : 1.0)
          .animation(.spring(response: 0.25), value: currentPage)
      }
    }
  }

  @ViewBuilder
  private func pageContent(names: [String], isLast: Bool, width: CGFloat) -> some View {
    if #available(macOS 26, *) {
      GlassEffectContainer(spacing: spacing) {
        appGrid(names: names, isLast: isLast)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else {
      appGrid(names: names, isLast: isLast)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private func appGrid(names: [String], isLast: Bool) -> some View {
    let columns = Array(repeating: GridItem(.fixed(tileSize), spacing: spacing), count: 4)
    return LazyVGrid(columns: columns, spacing: spacing) {
      ForEach(names, id: \.self) { name in
        DockIcon(name: name)
          .onDrag {
            startDrag(name)
            return NSItemProvider(object: name as NSString)
          }
          .onDrop(of: [.text], delegate: DropDelegate(item: name, store: store, draggedItem: $draggedItem, draft: $draftPinned))
      }
      if isLast { addButtonModule() }
    }
  }

  private func startDrag(_ name: String) {
    draggedItem = name
    draftPinned = nil
  }

  @ViewBuilder
  private func addButtonModule() -> some View {
    Button { showPicker = true } label: {
      VStack(spacing: 6) {
        ZStack {
          RoundedRectangle(cornerRadius: 18)
            .fill(.quaternary)
            .frame(width: 96, height: 96)
          Image(systemName: "plus")
            .font(.title)
            .foregroundStyle(.secondary)
        }
        Text("Adicionar")
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
    }
    .buttonStyle(.plain)
    .help("Adicionar apps ao dock")
  }

  private var emptyDock: some View {
    VStack(spacing: 12) {
      Image(systemName: "app.dashed")
        .font(.system(size: 40))
        .foregroundStyle(.secondary)
      Text("Nenhum app fixado")
        .font(.headline)
      Text("Clique em + para adicionar apps ao dock")
        .font(.subheadline)
        .foregroundStyle(.secondary)
      Button("Adicionar Apps") { showPicker = true }
        .buttonStyle(.bordered)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .sheet(isPresented: $showPicker) {
      AppPickerSheet()
    }
  }

  private var offlineView: some View {
    ContentUnavailableView(
      "Servidor Offline",
      systemImage: "wifi.slash",
      description: Text("Inicie o servidor j5-dock e verifique o URL em About.")
    )
  }
}

struct DropDelegate: SwiftUI.DropDelegate {
  let item: String
  let store: DockStore
  @Binding var draggedItem: String?
  @Binding var draft: [String]?

  func performDrop(info: DropInfo) -> Bool {
    guard let d = draft else { return false }
    store.pinned = d
    draggedItem = nil
    draft = nil
    Task { await store.persistPinnedOrder() }
    return true
  }

  func dropEntered(info: DropInfo) {
    guard let dragged = draggedItem,
          dragged != item else { return }

    let base = draft ?? store.pinned
    guard let fromIndex = base.firstIndex(of: dragged),
          let toIndex = base.firstIndex(of: item) else { return }

    var next = base
    withAnimation(.spring(response: 0.3)) {
      next.move(fromOffsets: IndexSet(integer: fromIndex), toOffset: toIndex > fromIndex ? toIndex + 1 : toIndex)
    }
    draft = next
  }

  func dropUpdated(info: DropInfo) -> DropProposal? {
    DropProposal(operation: .move)
  }
}
