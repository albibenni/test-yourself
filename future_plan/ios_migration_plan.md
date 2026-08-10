# iOS App Store Migration Plan

To get this app onto the iOS App Store, the project needs to go through an "iOS Adaptation" phase. While Tauri v2 natively supports iOS, there are a few major technical hurdles to overcome before it's ready for the App Store.

## 1. Initialization (Completed)
The iOS project has been initialized and is available under `src-tauri/gen/apple`. Start it with `make dev-ios`, optionally setting `DEVICE="iPhone 17 Pro"`, or open the generated Xcode project with `make open-ios`.

Desktop development uses port 1422 while iOS development retains port 1420, so both sessions can run concurrently.

## 2. The iOS File System Sandbox (Hard)
This will be the biggest hurdle. The app currently asks the user to pick a folder (using `@tauri-apps/plugin-dialog`) and then reads Markdown files from it using Rust's standard `std::fs`. 
- **The Problem:** On iOS, apps are strictly sandboxed. You cannot just read arbitrary folders from the user's device or iCloud Drive using standard file paths.
- **The Solution:** You will likely need to rewrite how file loading works for iOS. You'll either need to:
  - Copy the quizzes into the app's internal sandbox (`BaseDirectory::AppData`).
  - Or write custom Swift code (via a Tauri plugin) to use iOS's `UIDocumentPickerViewController` and implement "Security-Scoped Bookmarks" to retain persistent access to a folder in the Files app across app restarts.

## 3. Secrets and App Store Policies (Medium)
Apple strictly forbids apps from downloading executable code or circumventing the App Store update mechanism.
- The updater and desktop single-instance plugin are already conditionally disabled on mobile builds.
- The current Todoist credential backend uses a desktop OS keyring and explicitly does not support iOS or Android. Replace it with a Keychain-backed iOS/mobile credential-storage implementation before enabling Todoist on mobile. Do not add a plaintext fallback.

## 4. UI/UX Mobile Adaptation (Medium)
The `README.md` mentions the app is highly optimized for "keyboard-heavy workflows."
- You'll need to ensure the UI is responsive, touch-friendly, and handles the iOS safe areas (the notch/dynamic island). 
- Keyboard shortcuts won't be available on mobile, so you'll need touch gestures (like swiping) or visible buttons for all actions.

## 5. Xcode & Apple Developer Program (Administrative)
- You'll need an active Apple Developer account ($99/year).
- You'll need to open the generated Xcode project to configure your Provisioning Profiles, Certificates, and App Icons.
