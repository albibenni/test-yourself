# iOS App Store Migration Plan

To get this app onto the iOS App Store, the project needs to go through an "iOS Adaptation" phase. While Tauri v2 natively supports iOS, there are a few major technical hurdles to overcome before it's ready for the App Store.

## 1. Initialization (Easy)
The mobile projects haven't been initialized yet. You will need to run:
```bash
pnpm tauri ios init
```
This will generate the `src-tauri/gen/apple` folder containing the Xcode project.

## 2. The iOS File System Sandbox (Hard)
This will be the biggest hurdle. The app currently asks the user to pick a folder (using `@tauri-apps/plugin-dialog`) and then reads Markdown files from it using Rust's standard `std::fs`. 
- **The Problem:** On iOS, apps are strictly sandboxed. You cannot just read arbitrary folders from the user's device or iCloud Drive using standard file paths.
- **The Solution:** You will likely need to rewrite how file loading works for iOS. You'll either need to:
  - Copy the quizzes into the app's internal sandbox (`BaseDirectory::AppData`).
  - Or write custom Swift code (via a Tauri plugin) to use iOS's `UIDocumentPickerViewController` and implement "Security-Scoped Bookmarks" to retain persistent access to a folder in the Files app across app restarts.

## 3. App Store Policies on Updaters (Medium)
Apple strictly forbids apps from downloading executable code or circumventing the App Store update mechanism.
- You are using `@tauri-apps/plugin-updater`. You will need to ensure the updater is conditionally disabled on iOS, otherwise Apple will reject the app (and it would likely crash on iOS anyway).

## 4. UI/UX Mobile Adaptation (Medium)
The `README.md` mentions the app is highly optimized for "keyboard-heavy workflows."
- You'll need to ensure the UI is responsive, touch-friendly, and handles the iOS safe areas (the notch/dynamic island). 
- Keyboard shortcuts won't be available on mobile, so you'll need touch gestures (like swiping) or visible buttons for all actions.

## 5. Xcode & Apple Developer Program (Administrative)
- You'll need an active Apple Developer account ($99/year).
- You'll need to open the generated Xcode project to configure your Provisioning Profiles, Certificates, and App Icons.
