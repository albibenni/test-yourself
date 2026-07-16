use std::path::{Path, PathBuf};

use crate::models::Quiz;
use super::markdown::parse_quiz_file;

pub async fn get_all_quizzes(base_dir: &str) -> Vec<Quiz> {
    let mut quizzes = Vec::new();

    if base_dir.contains("..") || base_dir.contains('\0') {
        eprintln!("Security Warning: Attempted path traversal or invalid characters detected.");
        return quizzes;
    }

    let base_path = PathBuf::from(base_dir);
    if !base_path.exists() {
        return quizzes;
    }

    let mut dirs_to_visit = vec![base_path.clone()];

    while let Some(current_dir) = dirs_to_visit.pop() {
        if let Ok(mut entries) = tokio::fs::read_dir(&current_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if path.is_dir() {
                    dirs_to_visit.push(path);
                } else if path.is_file() {
                    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                    if ext == "md" {
                        let relative = path.strip_prefix(&base_path).unwrap_or(&path);
                        let topic = relative
                            .parent()
                            .unwrap_or(Path::new(""))
                            .to_string_lossy()
                            .to_string();

                        if let Some(quiz) = parse_quiz_file(&path, &topic).await {
                            quizzes.push(quiz);
                        }
                    }
                }
            }
        }
    }

    quizzes
}
