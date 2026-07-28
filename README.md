# Test Yourself

A fast, desktop-based quiz application built with **Tauri**, **React**, and **TypeScript**. "Test Yourself" allows you to point to a local folder of Markdown-based quizzes and worksheets to test your knowledge, review topics, and schedule follow-ups.

## Key Features

- **Local-First**: Works directly with your local directory of markdown quizzes and worksheets.
- **Interactive Quizzes & Worksheets**: Parses standard markdown into an interactive Q&A format, and `.worksheet.md` into fill-in-the-blank exercises.
- **Dark & Glassmorphic UI**: Beautiful, eye-friendly design.
- **Keyboard Navigation**: Optimized for keyboard-heavy workflows.
- **Powerful Integrations**: Built-in support for Todoist, Obsidian, and custom deep links.

## Download & Install

You can download the latest pre-compiled installers for **macOS**, **Windows**, and **Linux** directly from the [Releases page](../../releases/latest).

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

## Documentation

For full details on how to use the app, available keyboard shortcuts, and configuring integrations, please see our [Usage Guide](docs/USAGE.md).
For a deeper dive into how the core features work under the hood, read the [Integrations & Architecture](docs/INTEGRATIONS.md) document.
