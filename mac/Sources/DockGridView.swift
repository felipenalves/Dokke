import SwiftUI

struct DockGridView: View {
  @EnvironmentObject private var store: DockStore
  @State private var showPicker = false
  @State private var draggedItem: String?
  @State private var currentPage: Int? = 0
  @State private var draftPinned: [String]?
  @State private var isReordering = false

  private let pageSize = 8
  private let tileSize: CGFloat = 72
  private let tileSpacing: CGFloat = 22
  private let pageHeight: CGFloat = 292

  private var displayedPinned: [String] {
    draftPinned ?? store.pinned
  }

  private var pages: [[String]] {
    stride(from: 0, to: displayedPinned.count, by: pageSize).map {
      Array(displayedPinned[$0..<min($0 + pageSize, displayedPinned.count)])
    }
  }

  private var pageCount: Int {
    max(1, pages.count)
  }

  private var currentPageIndex: Int {
    min(max(currentPage ?? 0, 0), pageCount - 1)
  }

  var body: some View {
    VStack(spacing: 0) {
      if !store.online {
        offlineView
      } else if store.pinned.isEmpty {
        emptyDock
      } else {
        dockPages
      }
    }
    .padding(.horizontal, 22)
    .padding(.top, 8)
    .padding(.bottom, 18)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(DokkeTheme.canvas.ignoresSafeArea())
    .overlay(alignment: .bottomTrailing) {
      if store.online && !store.pinned.isEmpty {
        reorderButton
          .padding(.trailing, 12)
          .padding(.bottom, 8)
      }
    }
    .onChange(of: displayedPinned.count) { _, _ in
      currentPage = min(currentPageIndex, pageCount - 1)
    }
    .onChange(of: isReordering) { _, active in
      guard !active else { return }
      draggedItem = nil
      draftPinned = nil
    }
    .sheet(isPresented: $showPicker) {
      AppPickerSheet()
    }
  }

  private var dockPages: some View {
    GeometryReader { geo in
      let cardHeight = pageHeight
      let pageWidth = carouselPageWidth(for: geo.size.width)

      VStack(spacing: 18) {
        ScrollView(.horizontal) {
          LazyHStack(alignment: .center, spacing: 18) {
            ForEach(Array(pages.enumerated()), id: \.offset) { index, names in
              pageContent(names: names, isLast: index == pages.count - 1)
                .frame(width: pageWidth, height: cardHeight)
                .id(index)
            }
          }
          .scrollTargetLayout()
          .padding(.horizontal, 12)
        }
        .scrollTargetBehavior(.viewAligned)
        .scrollPosition(id: $currentPage, anchor: .leading)
        .scrollIndicators(.hidden)
        .frame(height: cardHeight)

        pageDots(count: pageCount)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private func carouselPageWidth(for availableWidth: CGFloat) -> CGFloat {
    let gap: CGFloat = 18
    let peek: CGFloat = 40
    return min(480, max(348, (availableWidth - gap - peek) / 2))
  }

  private func pageDots(count: Int) -> some View {
    HStack(spacing: 7) {
      ForEach(0..<count, id: \.self) { index in
        Button {
          selectPage(index)
        } label: {
          Circle()
            .fill(index == currentPageIndex ? Color.white.opacity(0.92) : Color.white.opacity(0.22))
            .frame(width: 7, height: 7)
        }
        .buttonStyle(.plain)
        .help("Página \(index + 1)")
        .accessibilityLabel("Página \(index + 1)")
      }
    }
    .frame(maxWidth: .infinity)
  }

  private func selectPage(_ index: Int) {
    let nextPage = min(max(index, 0), pageCount - 1)
    withAnimation(.easeOut(duration: 0.25)) {
      currentPage = nextPage
    }
  }

  @ViewBuilder
  private func pageContent(names: [String], isLast: Bool) -> some View {
    Group {
      if #available(macOS 26, *) {
        GlassEffectContainer(spacing: tileSpacing) {
          appGrid(names: names, isLast: isLast)
        }
      } else {
        appGrid(names: names, isLast: isLast)
      }
    }
    .padding(.horizontal, 28)
    .padding(.vertical, 22)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(DokkeTheme.page)
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
  }

  private func appGrid(names: [String], isLast: Bool) -> some View {
    let columns = Array(repeating: GridItem(.flexible(minimum: tileSize), spacing: tileSpacing), count: 4)
    let used = names.count + (isLast ? 1 : 0)

    return LazyVGrid(columns: columns, alignment: .center, spacing: 22) {
      ForEach(names, id: \.self) { name in
        appTile(name: name)
      }
      if isLast {
        addButtonModule()
      }
      ForEach(0..<max(0, pageSize - used), id: \.self) { _ in
        emptySlot()
      }
    }
    .frame(maxWidth: .infinity)
  }

  private func startDrag(_ name: String) {
    guard isReordering else { return }
    draggedItem = name
    draftPinned = nil
  }

  @ViewBuilder
  private func appTile(name: String) -> some View {
    if isReordering {
      DockIcon(name: name)
        .onDrag {
          startDrag(name)
          return NSItemProvider(object: name as NSString)
        }
        .onDrop(of: [.text], delegate: DropDelegate(item: name, store: store, draggedItem: $draggedItem, draft: $draftPinned))
    } else {
      DockIcon(name: name)
    }
  }

  private var reorderButton: some View {
    Button {
      withAnimation(.easeOut(duration: 0.2)) {
        isReordering.toggle()
      }
    } label: {
      Text(isReordering ? "Done" : "Reorder Pieces")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(.white.opacity(0.9))
        .padding(.horizontal, 20)
        .padding(.vertical, 11)
        .background(Color.white.opacity(isReordering ? 0.22 : 0.14))
        .clipShape(Capsule())
    }
    .buttonStyle(.plain)
    .help(isReordering ? "Concluir reorganização" : "Reorganizar apps")
  }

  @ViewBuilder
  private func addButtonModule() -> some View {
    Button { showPicker = true } label: {
      VStack(spacing: 8) {
        ZStack {
          RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(Color.black.opacity(0.28))
            .frame(width: tileSize, height: tileSize)
          Image(systemName: "plus")
            .font(.title2.weight(.medium))
            .foregroundStyle(.white.opacity(0.62))
        }
        Text("Adicionar")
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.white.opacity(0.72))
      }
    }
    .buttonStyle(.plain)
    .help("Adicionar apps ao dock")
  }

  private func emptySlot() -> some View {
    VStack(spacing: 8) {
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color.black.opacity(0.22))
        .frame(width: tileSize, height: tileSize)
      Text(" ")
        .font(.system(size: 11, weight: .medium))
    }
    .accessibilityHidden(true)
  }

  private var emptyDock: some View {
    VStack(spacing: 12) {
      Image(systemName: "app.dashed")
        .font(.system(size: 40))
        .foregroundStyle(.white.opacity(0.6))
      Text("Nenhum app fixado")
        .font(.headline)
        .foregroundStyle(.white.opacity(0.9))
      Text("Clique em + para adicionar apps ao dock")
        .font(.subheadline)
        .foregroundStyle(.white.opacity(0.56))
      Button("Adicionar Apps") { showPicker = true }
        .buttonStyle(.bordered)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var offlineView: some View {
    ContentUnavailableView(
      "Servidor Offline",
      systemImage: "wifi.slash",
      description: Text("Inicie o servidor Dokke e verifique a conexão na aba Conectar.")
    )
    .foregroundStyle(.white.opacity(0.85))
    .frame(maxWidth: .infinity, maxHeight: .infinity)
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
