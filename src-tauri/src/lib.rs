pub mod models;
pub mod parser;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::Emitter;

struct InteractiveSession(Mutex<Option<Box<dyn Write + Send>>>);

#[derive(serde::Serialize)]
struct CreationStatus { agy_available: bool, codex_available: bool, skills: Vec<String> }
#[derive(serde::Serialize)]
struct NoteMetadata { name: String, path: String, relative_path: String }

fn command_available(command: &str) -> bool {
    std::process::Command::new("/bin/sh").args(["-lc", &format!("command -v {command} >/dev/null 2>&1")]).status().map(|status| status.success()).unwrap_or(false)
}
fn shell_quote(value: &str) -> String { format!("'{}'", value.replace('\'', "'\"'\"'")) }

#[tauri::command]
async fn list_markdown_notes(app_handle: tauri::AppHandle) -> Result<Vec<NoteMetadata>, String> {
    let root = tokio::fs::canonicalize(configured_quiz_root(&app_handle).await?).await.map_err(|_| "Configured directory is not accessible".to_string())?;
    let mut notes = Vec::new();
    for entry in walkdir::WalkDir::new(&root).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if !entry.file_type().is_file() || path.extension().and_then(|extension| extension.to_str()) != Some("md") { continue; }
        notes.push(NoteMetadata { name: path.file_name().and_then(|name| name.to_str()).unwrap_or_default().to_string(), path: path.to_string_lossy().into_owned(), relative_path: path.strip_prefix(&root).unwrap_or(path).to_string_lossy().into_owned() });
    }
    notes.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(notes)
}

#[tauri::command]
fn creation_status() -> CreationStatus {
    let skills = std::process::Command::new("/bin/sh").args(["-lc", "find .agents ~/.agents ~/.gemini ~/.codex/skills -type f -name SKILL.md -exec dirname {} \\; 2>/dev/null | xargs -n1 basename | sort -u"]).output().map(|output| String::from_utf8_lossy(&output.stdout).lines().map(String::from).collect()).unwrap_or_default();
    CreationStatus { agy_available: command_available("agy"), codex_available: command_available("codex"), skills }
}

#[tauri::command]
fn generate_material(app: tauri::AppHandle, session: tauri::State<InteractiveSession>, engine: String, output_directory: String, source_file: String, skill: String, request: String, creation_type: String) -> Result<(), String> {
    if !matches!(engine.as_str(), "agy" | "codex") || !matches!(creation_type.as_str(), "quiz" | "worksheet" | "scenario") || skill.trim().is_empty() || request.trim().is_empty() { return Err("Invalid generation request".to_string()); }
    let output = std::fs::canonicalize(&output_directory).map_err(|_| "Output directory is not accessible".to_string())?;
    let source = std::fs::canonicalize(&source_file).map_err(|_| "Source file is not accessible".to_string())?;
    if !source.is_file() { return Err("Source must be a file".to_string()); }
    let source_directory = source.parent().ok_or("Source file has no parent directory")?;
    let instruction = format!("Create a {creation_type} using the {skill} skill if available. {request} Use this source file as context: {}. Write the Markdown result to the selected output directory.", source.display());
    let command = if engine == "codex" { format!("codex exec --sandbox workspace-write --skip-git-repo-check -C {} --add-dir {} {}", shell_quote(&output.to_string_lossy()), shell_quote(&source_directory.to_string_lossy()), shell_quote(&instruction)) } else { format!("agy --add-dir {} --add-dir {} --prompt {}", shell_quote(&output.to_string_lossy()), shell_quote(&source_directory.to_string_lossy()), shell_quote(&format!("/{skill} {instruction}"))) };
    let pty_system = portable_pty::native_pty_system();
    let pair = pty_system.openpty(portable_pty::PtySize { rows: 30, cols: 120, pixel_width: 0, pixel_height: 0 }).map_err(|error| error.to_string())?;
    let mut process = portable_pty::CommandBuilder::new("/bin/sh");
    process.args(["-lc", &command]);
    let mut child = pair.slave.spawn_command(process).map_err(|error| error.to_string())?;
    drop(pair.slave);
    let reader = pair.master.try_clone_reader().map_err(|error| error.to_string())?;
    let writer = pair.master.take_writer().map_err(|error| error.to_string())?;
    *session.0.lock().map_err(|_| "Generation session is unavailable")? = Some(writer);
    let output_app = app.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buffer = [0; 4096];
        while let Ok(count) = reader.read(&mut buffer) {
            if count == 0 { break; }
            let _ = output_app.emit("generation-output", String::from_utf8_lossy(&buffer[..count]).to_string());
        }
        let status = child.wait().map(|result| format!("Generation finished with exit code {}.", result.exit_code())).unwrap_or_else(|error| format!("Generation failed: {error}"));
        let _ = output_app.emit("generation-complete", status);
    });
    Ok(())
}

#[tauri::command]
fn send_generation_input(session: tauri::State<InteractiveSession>, input: String) -> Result<(), String> {
    let mut guard = session.0.lock().map_err(|_| "Generation session is unavailable")?;
    let writer = guard.as_mut().ok_or("No generation is running")?;
    writer.write_all(format!("{input}\n").as_bytes()).map_err(|error| error.to_string())?;
    writer.flush().map_err(|error| error.to_string())
}

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

#[cfg(target_os = "ios")]
#[tauri::command]
async fn pick_ios_folder(
    picker: tauri::State<'_, obsidian_folder_picker::ObsidianFolderPicker<tauri::Wry>>,
) -> Result<Option<String>, String> {
    picker.pick().await
}

#[cfg(not(target_os = "ios"))]
#[tauri::command]
fn pick_ios_folder() -> Result<Option<String>, String> {
    Err("The iOS folder picker is only available on iOS".to_string())
}

#[cfg(not(target_os = "ios"))]
fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT).map_err(|error| error.to_string())
}

#[cfg(target_os = "ios")]
fn credential_entry() -> Result<keyring_core::Entry, String> {
    use apple_native_keyring_store::protected::Store;
    use std::sync::OnceLock;

    static STORE_RESULT: OnceLock<Result<(), String>> = OnceLock::new();
    STORE_RESULT
        .get_or_init(|| {
            let store = Store::new().map_err(|error| error.to_string())?;
            keyring_core::set_default_store(store);
            Ok(())
        })
        .as_ref()
        .map_err(Clone::clone)?;

    keyring_core::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT)
        .map_err(|error| error.to_string())
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

#[tauri::command]
async fn get_scenario_content(
    app_handle: tauri::AppHandle,
    path: String,
    topic: String,
) -> Result<models::Scenario, String> {
    let path_buf = resolve_quiz_path(&app_handle, &path).await?;
    parser::markdown::parse_scenario_file(&path_buf, &topic)
        .await
        .ok_or_else(|| format!("Could not parse scenario: {}", path))
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

#[tauri::command]
async fn import_quiz_files(
    app_handle: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<String, String> {
    use tauri::Manager;

    let document_dir = app_handle
        .path()
        .document_dir()
        .map_err(|error| format!("Cannot locate the app Documents directory: {error}"))?;
    tokio::fs::create_dir_all(&document_dir)
        .await
        .map_err(|error| format!("Cannot create the app Documents directory: {error}"))?;

    let mut imported = 0usize;
    for source in paths {
        let source_path = std::path::PathBuf::from(&source);
        if source_path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }
        let file_name = source_path
            .file_name()
            .ok_or_else(|| format!("Invalid quiz file path: {source}"))?;
        let destination = document_dir.join(file_name);
        tokio::fs::copy(&source_path, &destination)
            .await
            .map_err(|error| format!("Cannot import {source}: {error}"))?;
        imported += 1;
    }

    if imported == 0 {
        return Err("No Markdown quiz files were selected".to_string());
    }

    Ok(document_dir.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_os::init());
    builder = builder.plugin(obsidian_folder_picker::init());

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
            app.manage(InteractiveSession(Mutex::new(None)));

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
            get_scenario_content,
            get_initial_url,
            is_arch_linux,
            custom_linux_relaunch,
            browse_directory,
            import_quiz_files,
            pick_ios_folder,
            list_markdown_notes,
            creation_status,
            generate_material,
            send_generation_input,
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
