use std::path::Path;
use walkdir::WalkDir;

use crate::models::Quiz;
use super::markdown::parse_quiz_file;

pub fn get_all_quizzes(base_dir: &str) -> Vec<Quiz> {
    let mut quizzes = Vec::new();

    if base_dir.contains("..") || base_dir.contains('\0') {
        eprintln!("Security Warning: Attempted path traversal or invalid characters detected.");
        return quizzes;
    }

    let base_path = Path::new(base_dir);
    if !base_path.exists() {
        return quizzes;
    }

    for entry in WalkDir::new(base_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext == "md" {
                let relative = path.strip_prefix(base_path).unwrap_or(path);
                let topic = relative
                    .parent()
                    .unwrap_or(Path::new(""))
                    .to_string_lossy()
                    .to_string();

                if let Some(quiz) = parse_quiz_file(path, &topic) {
                    quizzes.push(quiz);
                }
            }
        }
    }

    quizzes
}
