import AppKit
import Darwin
import Foundation

enum IconHelperError: LocalizedError {
  case usage
  case invalidOutputSize
  case appNotFound(String)
  case iconUnavailable(String)
  case conversionFailed

  var errorDescription: String? {
    switch self {
    case .usage:
      return "usage: DokkeIconHelper <app-path> <output-png> <max-pixels>"
    case .invalidOutputSize:
      return "max-pixels must be an integer between 16 and 2048"
    case .appNotFound(let path):
      return "app bundle not found: \(path)"
    case .iconUnavailable(let path):
      return "icon unavailable for: \(path)"
    case .conversionFailed:
      return "could not convert the AppKit icon to PNG"
    }
  }
}

func renderIcon(appPath: String, outputPath: String, maxPixels: Int) throws {
  // Alguns apps de sistema, como o Safari, aparecem em /Applications como
  // symlink para um Cryptex. Pedir o ícone pelo link faz o AppKit adicionar o
  // badge de atalho; o caminho real preserva o ícone limpo do bundle.
  let iconPath = URL(fileURLWithPath: appPath).resolvingSymlinksInPath().path
  guard FileManager.default.fileExists(atPath: iconPath) else {
    throw IconHelperError.appNotFound(appPath)
  }

  let icon = NSWorkspace.shared.icon(forFile: iconPath)
  guard icon.size.width > 0, icon.size.height > 0 else {
    throw IconHelperError.iconUnavailable(appPath)
  }

  let outputURL = URL(fileURLWithPath: outputPath)
  let outputDirectory = outputURL.deletingLastPathComponent()
  try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
  let canvas = NSRect(x: 0, y: 0, width: CGFloat(maxPixels), height: CGFloat(maxPixels))
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: maxPixels,
    pixelsHigh: maxPixels,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bitmapFormat: [],
    bytesPerRow: 0,
    bitsPerPixel: 0
  ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    throw IconHelperError.conversionFailed
  }

  // O ícone do NSWorkspace pode ter variantes ligadas à aparência atual do
  // macOS. Desenhá-lo no contexto efetivo do AppKit preserva essa escolha,
  // em vez de achatar uma representação TIFF arbitrária.
  application.effectiveAppearance.performAsCurrentDrawingAppearance {
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    NSColor.clear.setFill()
    canvas.fill()
    icon.draw(
      in: canvas,
      from: NSRect(origin: .zero, size: icon.size),
      operation: .copy,
      fraction: 1
    )
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
  }

  guard let png = bitmap.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) else {
    throw IconHelperError.conversionFailed
  }
  try png.write(to: outputURL)
}

let application = NSApplication.shared
application.setActivationPolicy(.prohibited)
application.finishLaunching()

do {
  guard CommandLine.arguments.count == 4 else { throw IconHelperError.usage }
  let appPath = CommandLine.arguments[1]
  let outputPath = CommandLine.arguments[2]
  guard let maxPixels = Int(CommandLine.arguments[3]), (16...2048).contains(maxPixels) else {
    throw IconHelperError.invalidOutputSize
  }
  try renderIcon(appPath: appPath, outputPath: outputPath, maxPixels: maxPixels)
} catch {
  let message = "DokkeIconHelper: \(error.localizedDescription)\n"
  FileHandle.standardError.write(Data(message.utf8))
  exit(EXIT_FAILURE)
}
