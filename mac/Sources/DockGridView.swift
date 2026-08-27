import SwiftUI

struct DockGridView: View {
  @EnvironmentObject private var store: DockStore
  @State private var showPicker = false
  @State private var draggedItem: String?
  @State private var currentPage: Int? = 0
  @State private var draftPinned: [String]?
  @State private var isReordering = false
  @State private var pickerInsertIndex: Int?

  private let pageSize = 8
  private let tileSize: CGFloat = 80
  private let tileSpacing: CGFloat = 22
  private let pageHeight: CGFloat = 288
  private let carouselGap: CGFloat = 24
  private let carouselVerticalOffset: CGFloat = 22
  private let carouselPeekRatio: CGFloat = 0.55
  private let carouselMaxPageWidth: CGFloat = 458
  private let carouselMinPageWidth: CGFloat = 450

  private enum TileItem: Hashable {
    case app(String)
    case add(Int)
  }

  private var displayedPinned: [String] {
    draftPinned ?? store.pinned
  }

  private var pages: [[TileItem]] {
    guard !displayedPinned.isEmpty else { return [] }
    let pageCount = max(1, (displayedPinned.count / pageSize) + 1)

    return (0..<pageCount).map { page in
      let start = page * pageSize
      return (0..<pageSize).map { offset in
        let index = start + offset
        guard index < displayedPinned.count else { return .add(index) }
        return .app(displayedPinned[index])
      }
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
    .padding(.leading, 20)
    .padding(.top, 8)
    .padding(.bottom, 18)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(DokkeTheme.canvas.ignoresSafeArea())
    .overlay(alignment: .bottom) {
      if store.online && !store.pinned.isEmpty {
        HStack(spacing: 0) {
          if isReordering {
            HStack(spacing: 6) {
              Image(systemName: "arrow.up.left.and.arrow.down.right")
                .font(.system(size: 11, weight: .medium))
              Text("Arraste para mover um ícone de posição.")
                .font(.system(size: 12))
            }
            .foregroundStyle(.white.opacity(0.85))
            .padding(.leading, 24)
            Spacer()
          } else {
            Spacer()
          }
          reorderButton
            .padding(.trailing, isReordering ? 24 : 12)
            .padding(.bottom, isReordering ? 12 : 8)
        }
        .frame(maxWidth: .infinity)
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
    .sheet(isPresented: $showPicker, onDismiss: { pickerInsertIndex = nil }) {
      AppPickerSheet(insertAt: pickerInsertIndex)
    }
  }

  private var dockPages: some View {
    GeometryReader { geo in
      let cardHeight = pageHeight
      let pageWidth = carouselPageWidth(for: geo.size.width)
      let trailingFadeStart = max(0, 1 - 16 / max(geo.size.width, 1))

      VStack(spacing: 18) {
        ScrollView(.horizontal) {
          LazyHStack(alignment: .center, spacing: carouselGap) {
            ForEach(Array(pages.enumerated()), id: \.offset) { index, items in
              pageContent(items: items)
                .frame(width: pageWidth, height: cardHeight)
                .id(index)
            }
          }
          .scrollTargetLayout()
          .padding(.leading, 12)
        }
        .scrollTargetBehavior(.viewAligned)
        .scrollPosition(id: $currentPage, anchor: .leading)
        .scrollIndicators(.hidden)
        .frame(height: cardHeight)
        .mask(
          LinearGradient(
            stops: [
              .init(color: .black, location: 0),
              .init(color: .black, location: trailingFadeStart),
              .init(color: .clear, location: 1),
            ],
            startPoint: .leading,
            endPoint: .trailing
          )
        )

        pageDots(count: pageCount)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
      .offset(y: carouselVerticalOffset)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private func carouselPageWidth(for availableWidth: CGFloat) -> CGFloat {
    let dominant = (availableWidth - carouselGap) / (1 + carouselPeekRatio)
    return min(carouselMaxPageWidth, max(carouselMinPageWidth, dominant))
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
  private func pageContent(items: [TileItem]) -> some View {
    appGrid(items: items)
      .padding(.horizontal, 32)
      .padding(.vertical, 29)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background {
        if #available(macOS 26, *) {
          RoundedRectangle(cornerRadius: 40, style: .continuous)
            .fill(DokkeTheme.page)
            .glassEffect(.regular, in: .rect(cornerRadius: 40))
        } else {
          RoundedRectangle(cornerRadius: 40, style: .continuous)
            .fill(DokkeTheme.page)
        }
      }
  }

  private func appGrid(items: [TileItem]) -> some View {
    let columns = Array(repeating: GridItem(.flexible(minimum: tileSize), spacing: tileSpacing), count: 4)
    return Group {
      if #available(macOS 26, *) {
        GlassEffectContainer(spacing: tileSpacing) {
          LazyVGrid(columns: columns, alignment: .center, spacing: tileSpacing) {
            ForEach(items, id: \.self) { item in
              switch item {
              case .app(let name):
                appTile(name: name)
              case .add(let index):
                addButtonModule(at: index)
              }
            }
          }
        }
      } else {
        LazyVGrid(columns: columns, alignment: .center, spacing: tileSpacing) {
          ForEach(items, id: \.self) { item in
            switch item {
            case .app(let name):
              appTile(name: name)
            case .add(let index):
              addButtonModule(at: index)
            }
          }
        }
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
      DockIcon(name: name, allowsRemoval: false, isReordering: true)
        .onDrag {
          startDrag(name)
          return NSItemProvider(object: name as NSString)
        }
        .onDrop(of: [.text], delegate: DropDelegate(item: name, store: store, draggedItem: $draggedItem, draft: $draftPinned))
    } else {
      DockIcon(name: name, allowsRemoval: true, isReordering: false)
    }
  }

  private var reorderButton: some View {
    Button {
      withAnimation(.easeOut(duration: 0.2)) {
        isReordering.toggle()
      }
    } label: {
        Text(isReordering ? "Concluir" : "Reorganizar apps")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(isReordering ? Color.white : Color.white.opacity(0.9))
        .padding(.horizontal, 20)
        .padding(.vertical, 11)
        .background(isReordering ? DokkeTheme.selection : Color.white.opacity(0.14))
        .clipShape(Capsule())
    }
    .buttonStyle(.plain)
    .help(isReordering ? "Concluir reorganização" : "Reorganizar apps")
  }

  @ViewBuilder
  private func addButtonModule(at index: Int) -> some View {
    AddSlotButton(index: index, size: tileSize) {
      pickerInsertIndex = index
      showPicker = true
    }
    .disabled(store.isPinnedLimitReached)
    .help(store.isPinnedLimitReached ? "Limite de 5 páginas atingido" : "Adicionar app nesta posição")
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

private struct AddSlotButton: View {
  let index: Int
  let size: CGFloat
  let action: () -> Void
  @State private var isHovered = false

  var body: some View {
    Button(action: action) {
      VStack(spacing: 8) {
        ZStack {
          RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(Color.black.opacity(isHovered ? 0.38 : 0.30))
            .frame(width: size, height: size)

          if isHovered {
            Image(systemName: "plus")
              .font(.system(size: 18, weight: .semibold))
              .foregroundStyle(.white.opacity(0.88))
          }
        }

        Text(isHovered ? "Add" : " ")
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.white.opacity(0.78))
          .frame(height: 13)
      }
      .frame(width: size, height: size + 24)
    }
    .buttonStyle(.plain)
    .onHover { isHovered = $0 }
    .help("Adicionar app na posição \(index + 1)")
    .accessibilityLabel("Adicionar app na posição \(index + 1)")
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
