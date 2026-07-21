pub mod models;
pub mod parser;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri_plugin_store::StoreExt;

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
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_quizzes,
            get_quiz_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
