import Foundation
@preconcurrency import Tauri
import UIKit
import UniformTypeIdentifiers

private let bookmarkKey = "test-yourself.obsidian-folder-bookmark"

private final class FolderPickerDelegate: NSObject, UIDocumentPickerDelegate {
  let completion: (URL?, String?) -> Void

  init(completion: @escaping (URL?, String?) -> Void) {
    self.completion = completion
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else {
      completion(nil, nil)
      return
    }

    guard url.startAccessingSecurityScopedResource() else {
      completion(nil, "The selected folder could not be accessed.")
      return
    }

    do {
      // iOS document-picker URLs already carry the scoped entitlement. The
      // security-scope bookmark flags are macOS-only, so persist a normal iOS
      // bookmark and reacquire access when resolving it.
      let bookmark = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
      UserDefaults.standard.set(bookmark, forKey: bookmarkKey)
      completion(url, nil)
    } catch {
      url.stopAccessingSecurityScopedResource()
      completion(nil, "The selected folder could not be retained: \(error.localizedDescription)")
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    completion(nil, nil)
  }
}

final class ObsidianFolderPickerPlugin: Plugin {
  private var pickerDelegate: FolderPickerDelegate?
  private var activeFolder: URL?

  override init() {
    super.init()
    restoreBookmark()
  }

  @objc func pickFolder(_ invoke: Invoke) throws {
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        invoke.reject("The folder picker is unavailable.")
        return
      }

      guard #available(iOS 14.0, *) else {
        invoke.reject("Folder selection requires iOS 14 or newer.")
        return
      }

      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
      picker.allowsMultipleSelection = false
      picker.modalPresentationStyle = .fullScreen

      let delegate = FolderPickerDelegate { [weak self, weak picker] url, error in
        guard let self else { return }
        self.pickerDelegate = nil
        picker?.dismiss(animated: true)

        if let error {
          invoke.reject(error)
        } else if let url {
          self.activeFolder?.stopAccessingSecurityScopedResource()
          self.activeFolder = url
          invoke.resolve(["path": url.path])
        } else {
          invoke.resolve(["path": nil])
        }
      }

      self.pickerDelegate = delegate
      picker.delegate = delegate
      self.manager.viewController?.present(picker, animated: true)
    }
  }

  private func restoreBookmark() {
    guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else { return }

    var isStale = false
    do {
      let url = try URL(
        resolvingBookmarkData: data,
        options: [.withoutUI],
        relativeTo: nil,
        bookmarkDataIsStale: &isStale
      )
      guard url.startAccessingSecurityScopedResource() else { return }
      activeFolder = url

      if isStale,
         let refreshed = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) {
        UserDefaults.standard.set(refreshed, forKey: bookmarkKey)
      }
    } catch {
      UserDefaults.standard.removeObject(forKey: bookmarkKey)
    }
  }
}

// Tauri invokes the plugin from its IPC task, while UIKit requires picker
// presentation on the main actor. The plugin's mutable state is only touched
// by that main-actor callback, so this is the explicit boundary for Swift 6's
// sendability checker.
extension ObsidianFolderPickerPlugin: @unchecked Sendable {}

@_cdecl("init_plugin_obsidian_folder_picker")
func initPluginObsidianFolderPicker() -> Plugin {
  return ObsidianFolderPickerPlugin()
}
