use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use super::markdown::parse_quiz_file;
use crate::models::Quiz;

pub fn find_markdown_files(canonical_base: &Path) -> Vec<(PathBuf, String)> {
    let mut files = Vec::new();

    for entry in WalkDir::new(canonical_base)
        .follow_links(true)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();

        // Security check: verify that symlinks don't escape the safe root boundary
        let Ok(canonical_path) = std::fs::canonicalize(path) else {
            continue;
        };

        if !canonical_path.starts_with(canonical_base) {
            eprintln!("Security Warning: Discovered path escapes the safe root boundary.");
            continue;
        }

        if canonical_path.is_file() {
            let ext = canonical_path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            if ext == "md" {
                let relative = canonical_path
                    .strip_prefix(canonical_base)
                    .unwrap_or(&canonical_path);
                let topic = relative
                    .parent()
                    .unwrap_or(Path::new(""))
                    .to_string_lossy()
                    .to_string();

                files.push((canonical_path, topic));
            }
        }
    }
    files
}

pub async fn parse_quizzes(md_files: Vec<(PathBuf, String)>) -> Vec<Quiz> {
    let mut quizzes = Vec::new();

    for (path, topic) in md_files {
        if let Some(quiz) = parse_quiz_file(&path, &topic).await {
            quizzes.push(quiz);
        }
    }

    quizzes
}

pub async fn get_all_quizzes(base_dir: &str) -> Vec<Quiz> {
    // Deep Path Canonicalization for maximum security
    let Ok(canonical_base) = tokio::fs::canonicalize(base_dir).await else {
        eprintln!("Security Warning: Base directory could not be canonicalized.");
        return Vec::new();
    };

    let canonical_base_clone = canonical_base.clone();

    // Run the blocking directory traversal in a separate thread pool
    let md_files: Vec<(PathBuf, String)> =
        tokio::task::spawn_blocking(move || find_markdown_files(&canonical_base_clone))
            .await
            .unwrap_or_default();

    // Now process the markdown files asynchronously
    parse_quizzes(md_files).await
}
