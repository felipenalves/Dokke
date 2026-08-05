// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "Dokke",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "Dokke", targets: ["Dokke"])
  ],
  targets: [
    .executableTarget(
      name: "Dokke",
      path: "Sources"
    )
  ]
)
