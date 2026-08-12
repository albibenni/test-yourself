pub mod models;
pub mod parser;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(desktop)]
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_store::StoreExt;

struct InitialUrl(std::sync::Mutex<Option<String>>);

const CREDENTIAL_SERVICE: &str = "com.test-yourself.desktop";
const CREDENTIAL_ACCOUNT: &str = "todoist_token";

fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_secret() -> Result<Option<String>, String> {
    match credential_entry()?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn set_secret(secret: String) -> Result<(), String> {
    let entry = credential_entry()?;
    if secret.is_empty() {
        let _ = entry.delete_credential();
    } else {
        entry
            .set_password(&secret)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod credential_tests {
    use super::{get_secret, set_secret};
    use keyring_core::{mock, set_default_store};
    use std::sync::{Mutex, OnceLock};

    fn keyring_test_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    #[test]
    fn stores_reads_and_deletes_a_secret_with_the_mock_keyring() {
        let _guard = keyring_test_lock();

        // `keyring::Entry` installs the platform store lazily on its first use.
        // Initialize it before replacing the default store, otherwise it would
        // overwrite this mock and make the test read the user's real Keychain.
        keyring::Entry::store_status()
            .as_ref()
            .expect("the platform keyring should initialize");
        set_default_store(mock::Store::new().unwrap());

        assert_eq!(get_secret().unwrap(), None);
        set_secret("mock-token".to_string()).unwrap();
        assert_eq!(get_secret().unwrap(), Some("mock-token".to_string()));
        set_secret(String::new()).unwrap();
        assert_eq!(get_secret().unwrap(), None);
    }
}

#[tauri::command]
fn get_initial_url(state: tauri::State<InitialUrl>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[tauri::command]
async fn get_quizzes(app_handle: tauri::AppHandle) -> Result<Vec<models::QuizMetadata>, String> {
    let base_path = configured_quiz_root(&app_handle).await?;
    Ok(parser::discovery::get_all_quizzes_metadata(&base_path).await)
}

async fn configured_quiz_root(app_handle: &tauri::AppHandle) -> Result<String, String> {
    let store = app_handle
        .store("settings.json")
        .map_err(|e| e.to_string())?;
    let path_val = store
        .get("quiz_base_path")
        .ok_or("No base path configured")?;
    let base_path = path_val
        .as_str()
        .ok_or("Invalid base path format")?
        .to_string();
    Ok(base_path)
}

async fn resolve_quiz_path(
    app_handle: &tauri::AppHandle,
    path: &str,
) -> Result<std::path::PathBuf, String> {
    let root = tokio::fs::canonicalize(configured_quiz_root(app_handle).await?)
        .await
        .map_err(|_| "Configured quiz directory is not accessible".to_string())?;
    let candidate = tokio::fs::canonicalize(path)
        .await
        .map_err(|_| "Quiz file is not accessible".to_string())?;

    validate_quiz_path(root, candidate)
}

pub fn validate_quiz_path(
    root: std::path::PathBuf,
    candidate: std::path::PathBuf,
) -> Result<std::path::PathBuf, String> {
    if candidate
        .extension()
        .and_then(|extension| extension.to_str())
        != Some("md")
        || !candidate.starts_with(&root)
    {
        return Err(
            "Quiz file must be a Markdown file inside the configured quiz directory".to_string(),
        );
    }

    Ok(candidate)
}

#[tauri::command]
async fn get_quiz_content(
    app_handle: tauri::AppHandle,
    path: String,
    topic: String,
) -> Result<models::Quiz, String> {
    let path = resolve_quiz_path(&app_handle, &path).await?;
    get_quiz_content_inner(path.to_string_lossy().into_owned(), topic).await
}

pub async fn get_quiz_content_inner(path: String, topic: String) -> Result<models::Quiz, String> {
    let path_buf = std::path::PathBuf::from(&path);
    if let Some(quiz) = parser::parse_quiz_file(&path_buf, &topic).await {
        Ok(quiz)
    } else {
        Err(format!(
            "Could not parse quiz or it contains no questions: {}",
            path
        ))
    }
}

#[tauri::command]
async fn get_worksheet_content(
    app_handle: tauri::AppHandle,
    path: String,
    topic: String,
) -> Result<models::Worksheet, String> {
    let path_buf = resolve_quiz_path(&app_handle, &path).await?;
    if let Some(ws) = parser::markdown::parse_worksheet_file(&path_buf, &topic).await {
        Ok(ws)
    } else {
        Err(format!("Could not parse worksheet: {}", path))
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FolderItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub md_count: usize,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DirectoryListing {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub items: Vec<FolderItem>,
}

#[tauri::command]
async fn browse_directory(
    path: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<DirectoryListing, String> {
    use tauri::Manager;
    let target_path = match path {
        Some(ref p) if !p.trim().is_empty() && p != "documents" => std::path::PathBuf::from(p),
        _ => app_handle
            .path()
            .document_dir()
            .ok()
            .or_else(|| std::env::var("HOME").ok().map(std::path::PathBuf::from))
            .unwrap_or_else(|| std::path::PathBuf::from("/")),
    };

    let current_path_str = target_path.to_string_lossy().to_string();
    let parent_path_str = target_path
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    let read_dir = std::fs::read_dir(&target_path)
        .map_err(|e| format!("Cannot access directory '{}': {}", current_path_str, e))?;

    let mut items = Vec::new();

    for entry in read_dir.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }

        let entry_path = entry.path();
        let is_dir = entry_path.is_dir();

        let mut md_count = 0;
        if is_dir {
            if let Ok(sub_read) = std::fs::read_dir(&entry_path) {
                for sub in sub_read.flatten() {
                    let sub_name = sub.file_name().to_string_lossy().to_string();
                    if sub_name.ends_with(".md") && !sub_name.starts_with('.') {
                        md_count += 1;
                    }
                }
            }
        } else if file_name.ends_with(".md") {
            md_count = 1;
        } else {
            continue;
        }

        items.push(FolderItem {
            name: file_name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            md_count,
        });
    }

    items.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(DirectoryListing {
        current_path: current_path_str,
        parent_path: parent_path_str,
        items,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_os::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
                for arg in argv {
                    if arg.starts_with("test-yourself://") {
                        use tauri::Emitter;
                        let _ = app.emit("deep-link-received", arg);
                    }
                }
            }))
            .plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            let mut found_url = None;
            for arg in std::env::args() {
                if arg.starts_with("test-yourself://") {
                    found_url = Some(arg);
                }
            }
            use tauri::Manager;
            app.manage(InitialUrl(std::sync::Mutex::new(found_url)));

            // Register Rust-side URL handler so macOS open-url events reach the frontend
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    use tauri::Emitter;
                    for url in event.urls() {
                        eprintln!("[DeepLink Rust] on_open_url: {}", url);
                        let _ = handle.emit("deep-link-received", url.to_string());
                    }
                });
            }

            Ok(())
        })
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_secret,
            set_secret,
            get_quizzes,
            get_quiz_content,
            get_worksheet_content,
            get_initial_url,
            is_arch_linux,
            custom_linux_relaunch,
            browse_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn is_arch_linux() -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
            return content.contains("ID=arch") || content.contains("ID_LIKE=arch");
        }
        false
    }
    #[cfg(not(target_os = "linux"))]
    {
        false
    }
}

#[tauri::command]
fn custom_linux_relaunch(app: tauri::AppHandle) -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Ok(exe) = std::env::current_exe() {
            std::env::remove_var("APPDIR");
            let mut cmd = std::process::Command::new(exe);
            let _ = cmd.spawn();
        }
        app.exit(0);
        true
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        false
    }
}
