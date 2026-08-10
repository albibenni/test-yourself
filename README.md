# Test Yourself

A local-first quiz application built with **Tauri**, **React**, and **TypeScript**. "Test Yourself" lets you point to a local folder of Markdown-based quizzes and worksheets to test your knowledge, review topics, and schedule follow-ups. Desktop is the supported release target; iOS development support is in progress—see [Mobile compatibility](#mobile-compatibility).

## Key Features

- **Local-First**: Works directly with your local directory of markdown quizzes and worksheets.
- **Interactive Quizzes & Worksheets**: Parses standard markdown into an interactive Q&A format, and `.worksheet.md` into fill-in-the-blank exercises.
- **Dark & Glassmorphic UI**: Beautiful, eye-friendly design.
- **Keyboard Navigation**: Optimized for keyboard-heavy workflows.
- **Powerful Integrations**: Built-in support for Todoist, Obsidian, and custom deep links.

## Download & Install

You can download the latest pre-compiled installers for **macOS**, **Windows**, and **Linux** directly from the [project's website](https://albertobenatti.dev/projects/test-yourself) or the [Releases page](../../releases/latest).

**Arch Linux**:
You can install and update the app directly from the AUR using `yay`:

```bash
yay -S test-yourself
```

Learn more about the app and other projects at **[albertobenatti.dev](https://albertobenatti.dev)**.

## Developer Setup

If you want to build the app from source:

1. Install dependencies: `pnpm install`
2. Run the desktop app: `make dev`
3. Build for production: `pnpm tauri build`

### Concurrent desktop and iOS development

`make dev` starts the desktop app on port **1422**. `make dev-ios` keeps the normal Tauri/Vite development URL on port **1420**. The separate ports allow the desktop app and an iOS Simulator session to run at the same time.

Useful mobile commands:

```bash
make dev-ios                 # default Simulator device
make dev-ios DEVICE="iPhone 17 Pro"
make dev-ios-open            # also open the Xcode project
```

### Secure Todoist token storage

On supported desktop platforms, the Todoist token is stored only in the operating system credential store: macOS Keychain, Windows Credential Manager, or the Linux Secret Service. Clearing the token removes that credential; the app does not fall back to plaintext browser or plugin storage.

The Rust credential test uses an in-memory keyring mock. It initializes the platform library before installing that mock, so the test does not read, change, or prompt for access to your real credential.

### Mobile compatibility

The project has a generated iOS target and a responsive settings layout, and desktop-only updater/single-instance behavior is excluded from mobile builds. It is not yet a fully supported mobile release:

- iOS/Android sandboxing prevents the current arbitrary-folder Markdown workflow from working reliably without an import flow or persistent document-access implementation.
- The desktop keyring backend intentionally does not support iOS or Android. Todoist token storage needs a mobile credential-store implementation before Todoist scheduling can work there.
- Touch/safe-area behavior and App Store packaging still need device-level verification.

See [the iOS migration plan](future_plan/ios_migration_plan.md) for the remaining work.

### Speeding Up Rust Compilation (Linux)

If you are developing on Linux (especially Arch Linux), you can drastically speed up Tauri's Rust compilation times by using **mold** (a highly parallel modern linker) and **sccache** (a compilation cache).

1. Install the tools:
   ```bash
   sudo pacman -S mold sccache
   ```
2. Configure your global Cargo config to use them by adding this to `~/.cargo/config.toml`:
   ```toml
   [build]
   rustc-wrapper = "sccache"

   [target.x86_64-unknown-linux-gnu]
   rustflags = ["-C", "link-arg=-fuse-ld=mold"]
   ```
3. The first time you run `pnpm tauri dev` after installing, it will build the initial cache. All subsequent builds will be incredibly fast.

## Documentation

For full details on how to use the app, available keyboard shortcuts, and configuring integrations, please see our [Usage Guide](docs/USAGE.md).
For a deeper dive into how the core features work under the hood, read the [Integrations & Architecture](docs/INTEGRATIONS.md) document.
