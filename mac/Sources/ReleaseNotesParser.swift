import Foundation

enum ReleaseNotesBlock {
  case heading(level: Int, content: AttributedString)
  case paragraph(AttributedString)
  case listItem(marker: String, content: AttributedString)
}

enum ReleaseNotesParser {
  static func parse(_ markdown: String) -> [ReleaseNotesBlock] {
    var blocks: [ReleaseNotesBlock] = []
    var paragraphLines: [String] = []

    func flushParagraph() {
      guard !paragraphLines.isEmpty else { return }
      blocks.append(.paragraph(inline(paragraphLines.joined(separator: " "))))
      paragraphLines.removeAll(keepingCapacity: true)
    }

    for rawLine in markdown.components(separatedBy: .newlines) {
      let line = rawLine.trimmingCharacters(in: .whitespaces)
      guard !line.isEmpty else {
        flushParagraph()
        continue
      }

      if let heading = heading(in: line) {
        flushParagraph()
        blocks.append(.heading(level: heading.level, content: inline(heading.content)))
      } else if let item = listItem(in: line) {
        flushParagraph()
        blocks.append(.listItem(marker: item.marker, content: inline(item.content)))
      } else {
        paragraphLines.append(line)
      }
    }

    flushParagraph()
    return blocks
  }

  private static func heading(in line: String) -> (level: Int, content: String)? {
    let level = line.prefix(while: { $0 == "#" }).count
    guard (1...6).contains(level) else { return nil }

    let remainder = line.dropFirst(level)
    guard remainder.first?.isWhitespace == true else { return nil }
    return (level, String(remainder.drop(while: { $0.isWhitespace })))
  }

  private static func listItem(in line: String) -> (marker: String, content: String)? {
    if let first = line.first, "-*+".contains(first) {
      let remainder = line.dropFirst()
      guard remainder.first?.isWhitespace == true else { return nil }
      return ("•", String(remainder.drop(while: { $0.isWhitespace })))
    }

    let digitEnd = line.firstIndex(where: { !$0.isNumber }) ?? line.endIndex
    guard digitEnd > line.startIndex, digitEnd < line.endIndex else { return nil }
    let punctuation = line[digitEnd]
    guard punctuation == "." || punctuation == ")" else { return nil }

    let markerEnd = line.index(after: digitEnd)
    guard markerEnd < line.endIndex, line[markerEnd].isWhitespace else { return nil }
    let content = line[markerEnd...].drop(while: { $0.isWhitespace })
    return (String(line[..<markerEnd]), String(content))
  }

  private static func inline(_ markdown: String) -> AttributedString {
    (try? AttributedString(
      markdown: markdown,
      options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
    )) ?? AttributedString(markdown)
  }
}
