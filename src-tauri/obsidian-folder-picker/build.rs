fn main() {
    tauri_plugin::Builder::new(&["pickFolder"])
        .ios_path("ios")
        .try_build()
        .expect("failed to build the Obsidian folder picker plugin");
}
