import SwiftUI

struct DockGridView: View {
  @EnvironmentObject private var store: DockStore
  @State private var showPicker = false
  @State private var draggedItem: String?
  @State private var currentPage: Int? = 0
  @State private var draftPositions: [String: Int]?
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
    case piece(DockPiece)
    case add(Int)
  }

  private var displayedPieces: [DockPiece] {
    guard let draftPositions else { return store.pieces }
    return store.pieces.compactMap { piece in
      guard let position = draftPositions[piece.id] else { return nil }
      return piece.atPosition(position)
    }.sorted { $0.position < $1.position }
  }

  private var slotCount: Int {
    let highestPosition = store.pieces.map(\.position).max().map { $0 + 1 } ?? 0
    let visibleSlots = max(pageSize, highestPosition)
    guard store.pieces.count < store.maxPinnedPieces else { return min(40, visibleSlots) }
    return min(40, visibleSlots % pageSize == 0 ? visibleSlots + 1 : visibleSlots)
  }

  private var pages: [[TileItem]] {
    let pageCount = max(1, (slotCount + pageSize - 1) / pageSize)
    let byPosition = Dictionary(displayedPieces.map { ($0.position, $0) }, uniquingKeysWith: { first, _ in first })

    return (0..<pageCount).map { page in
      let start = page * pageSize
      return (0..<pageSize).map { offset in
        let index = start + offset
        guard let piece = byPosition[index] else { return .add(index) }
        return .piece(piece)
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
      if store.online {
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
    .onChange(of: displayedPieces.count) { _, _ in
      currentPage = min(currentPageIndex, pageCount - 1)
    }
    .onChange(of: isReordering) { _, active in
      guard !active else { return }
      draggedItem = nil
      draftPositions = nil
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
              case .piece(let piece):
                pieceTile(piece: piece)
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
            case .piece(let piece):
              pieceTile(piece: piece)
            case .add(let index):
              addButtonModule(at: index)
            }
          }
        }
      }
    }
    .frame(maxWidth: .infinity)
  }

  private func startDrag(_ id: String) {
    guard isReordering else { return }
    draggedItem = id
    draftPositions = nil
  }

  @ViewBuilder
  private func pieceTile(piece: DockPiece) -> some View {
    if piece.type == .app {
      appTile(name: piece.name ?? piece.displayTitle, id: piece.id, position: piece.position)
    } else if isReordering {
      DockIcon(piece: piece, allowsRemoval: false, isReordering: true)
        .onDrag {
          startDrag(piece.id)
          return NSItemProvider(object: piece.id as NSString)
        }
        .onDrop(of: [.text], delegate: DropDelegate(position: piece.position, store: store, draggedItem: $draggedItem, draftPositions: $draftPositions))
    } else {
      DockIcon(piece: piece, allowsRemoval: true, isReordering: false)
    }
  }

  @ViewBuilder
  private func appTile(name: String, id: String, position: Int) -> some View {
    if isReordering {
      DockIcon(name: name, allowsRemoval: false, isReordering: true)
        .onDrag {
          startDrag(id)
          return NSItemProvider(object: id as NSString)
        }
        .onDrop(of: [.text], delegate: DropDelegate(position: position, store: store, draggedItem: $draggedItem, draftPositions: $draftPositions))
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
    let addSlot = AddSlotButton(index: index, size: tileSize) {
      pickerInsertIndex = index
      showPicker = true
    }
    if isReordering {
      addSlot
        .onDrop(of: [.text], delegate: DropDelegate(position: index, store: store, draggedItem: $draggedItem, draftPositions: $draftPositions))
        .help("Mover app para a posição \(index + 1)")
    } else {
      addSlot
        .disabled(store.isPinnedLimitReached)
        .help(store.isPinnedLimitReached ? "Limite de 5 páginas atingido" : "Adicionar app nesta posição")
    }
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
  let position: Int
  let store: DockStore
  @Binding var draggedItem: String?
  @Binding var draftPositions: [String: Int]?

  func performDrop(info: DropInfo) -> Bool {
    guard let positions = draftPositions else { return false }
    draggedItem = nil
    draftPositions = nil
    Task { await store.reorderPieces(positions) }
    return true
  }

  func dropEntered(info: DropInfo) {
    guard let dragged = draggedItem,
          let sourcePosition = (draftPositions ?? Dictionary(uniqueKeysWithValues: store.pieces.map { ($0.id, $0.position) }))[dragged],
          sourcePosition != position else { return }

    var next = draftPositions ?? Dictionary(uniqueKeysWithValues: store.pieces.map { ($0.id, $0.position) })
    withAnimation(.spring(response: 0.3)) {
      moveDragged(to: position, dragged: dragged, in: &next)
    }
    draftPositions = next
  }

  private func moveDragged(to targetPosition: Int, dragged: String, in positions: inout [String: Int]) {
    guard let sourcePosition = positions[dragged] else { return }
    if let displacedID = positions.first(where: { $0.key != dragged && $0.value == targetPosition })?.key {
      positions[displacedID] = sourcePosition
    }
    positions[dragged] = targetPosition
  }

  func dropUpdated(info: DropInfo) -> DropProposal? {
    DropProposal(operation: .move)
  }
}
