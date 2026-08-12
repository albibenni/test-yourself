// swift-tools-version:6.0

import PackageDescription

let package = Package(
  name: "obsidian-folder-picker",
  platforms: [
    .iOS(.v18),
  ],
  products: [
    .library(
      name: "obsidian-folder-picker",
      type: .static,
      targets: ["obsidian-folder-picker"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "obsidian-folder-picker",
      dependencies: [.byName(name: "Tauri")],
      path: "Sources")
  ])
