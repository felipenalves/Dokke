// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "Dokke",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "Dokke", targets: ["Dokke"]),
    .executable(name: "DokkeIconHelper", targets: ["DokkeIconHelper"])
  ],
  targets: [
    .executableTarget(
      name: "Dokke",
      path: "Sources"
    ),
    .executableTarget(
      name: "DokkeIconHelper",
      path: "IconHelper",
      exclude: ["Info.plist"]
    )
  ]
)
