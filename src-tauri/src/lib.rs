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
            get_quiz_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_get_quiz_content_success() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("quiz.md");
        let mut file = File::create(&path).unwrap();
        writeln!(file, "1. Q\nA. Opt\nB. Opt\n\n## Solutions\n1. A\nExplanation: text").unwrap();

        let result = get_quiz_content(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
        assert!(result.is_ok());
        let quiz = result.unwrap();
        assert_eq!(quiz.questions.len(), 1);
    }

    #[tokio::test]
    async fn test_get_quiz_content_empty_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("empty.md");
        File::create(&path).unwrap();

        let result = get_quiz_content(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            format!("Could not parse quiz or it contains no questions: {}", path.to_str().unwrap())
        );
    }

    #[tokio::test]
    async fn test_get_quiz_content_nonexistent() {
        let result = get_quiz_content("/does/not/exist.md".to_string(), "Topic".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_quiz_content_binary_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("image.md");
        let mut file = File::create(&path).unwrap();
        // Write some invalid UTF-8 bytes to simulate a binary file
        file.write_all(&[0xFF, 0xFE, 0xFD, 0x00, 0x11]).unwrap();

        let result = get_quiz_content(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            format!("Could not parse quiz or it contains no questions: {}", path.to_str().unwrap())
        );
    }
}
