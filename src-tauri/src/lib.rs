pub mod models;
pub mod parser;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri_plugin_store::StoreExt;

struct InitialUrl(std::sync::Mutex<Option<String>>);

#[tauri::command]
fn get_initial_url(state: tauri::State<InitialUrl>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[tauri::command]
async fn get_quizzes(app_handle: tauri::AppHandle) -> Result<Vec<models::QuizMetadata>, String> {
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
    Ok(parser::discovery::get_all_quizzes_metadata(&base_path).await)
}

#[tauri::command]
async fn get_quiz_content(path: String, topic: String) -> Result<models::Quiz, String> {
    get_quiz_content_inner(path, topic).await
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
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
        }));
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
            Ok(())
        })
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                use argon2::{hash_raw, Config, Variant, Version};
                let config = Config {
                    lanes: 4,
                    mem_cost: 10_000,
                    time_cost: 10,
                    variant: Variant::Argon2id,
                    version: Version::Version13,
                    ..Default::default()
                };
                let salt = b"test-yourself-secure-salt";
                let key =
                    hash_raw(password.as_ref(), salt, &config).expect("failed to hash password");
                key.to_vec()
            })
            .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_quizzes,
            get_quiz_content,
            get_initial_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
