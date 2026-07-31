# Test Yourself

A fast, desktop-based quiz application built with **Tauri**, **React**, and **TypeScript**. "Test Yourself" allows you to point to a local folder of Markdown-based quizzes and worksheets to test your knowledge, review topics, and schedule follow-ups.

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
2. Run the development server: `pnpm tauri dev`
3. Build for production: `pnpm tauri build`

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
