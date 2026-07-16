use std::path::Path;

use super::markdown::parse_quiz_file;
use crate::models::Quiz;

pub async fn get_all_quizzes(base_dir: &str) -> Vec<Quiz> {
    let mut quizzes = Vec::new();

    // Deep Path Canonicalization for maximum security
    let Ok(canonical_base) = tokio::fs::canonicalize(base_dir).await else {
        eprintln!("Security Warning: Base directory could not be canonicalized.");
        return quizzes;
    };

    let mut dirs_to_visit = vec![canonical_base.clone()];

    while let Some(current_dir) = dirs_to_visit.pop() {
        if let Ok(mut entries) = tokio::fs::read_dir(&current_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();

                // Security check: verify that symlinks don't escape the safe root boundary
                let Ok(canonical_path) = tokio::fs::canonicalize(&path).await else {
                    continue;
                };
                if !canonical_path.starts_with(&canonical_base) {
                    eprintln!("Security Warning: Discovered path escapes the safe root boundary.");
                    continue;
                }

                if canonical_path.is_dir() {
                    dirs_to_visit.push(canonical_path);
                } else if canonical_path.is_file() {
                    let ext = canonical_path
                        .extension()
                        .and_then(|s| s.to_str())
                        .unwrap_or("");
                    if ext == "md" {
                        let relative = canonical_path
                            .strip_prefix(&canonical_base)
                            .unwrap_or(&canonical_path);
                        let topic = relative
                            .parent()
                            .unwrap_or(Path::new(""))
                            .to_string_lossy()
                            .to_string();

                        if let Some(quiz) = parse_quiz_file(&canonical_path, &topic).await {
                            quizzes.push(quiz);
                        }
                    }
                }
            }
        }
    }

    quizzes
}
