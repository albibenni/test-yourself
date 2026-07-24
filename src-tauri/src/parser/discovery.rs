use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use super::markdown::parse_quiz_file;
use crate::models::Quiz;

pub fn find_markdown_files(canonical_base: &Path) -> Vec<(PathBuf, String)> {
    WalkDir::new(canonical_base)
        .follow_links(true)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("md"))
        .filter_map(|e| {
            let canonical_path = std::fs::canonicalize(e.path()).ok()?;

            if !canonical_path.starts_with(canonical_base) {
                eprintln!("Security Warning: Discovered path escapes the safe root boundary.");
                return None;
            }

            let topic = canonical_path
                .strip_prefix(canonical_base)
                .unwrap_or(&canonical_path)
                .parent()
                .unwrap_or(Path::new(""))
                .to_string_lossy()
                .to_string();

            Some((canonical_path, topic))
        })
        .collect()
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

pub async fn parse_quizzes_metadata(
    md_files: Vec<(PathBuf, String)>,
) -> Vec<crate::models::QuizMetadata> {
    let mut metadata = Vec::new();

    for (path, topic) in md_files {
        if let Some(quiz) = parse_quiz_file(&path, &topic).await {
            metadata.push(crate::models::QuizMetadata {
                title: quiz.title,
                path: quiz.path,
                topic: quiz.topic,
                last_modified: quiz.last_modified,
            });
        }
    }

    metadata
}

pub async fn get_all_quizzes_metadata(base_dir: &str) -> Vec<crate::models::QuizMetadata> {
    let Ok(canonical_base) = tokio::fs::canonicalize(base_dir).await else {
        eprintln!("Security Warning: Base directory could not be canonicalized.");
        return Vec::new();
    };

    let canonical_base_clone = canonical_base.clone();

    let md_files: Vec<(PathBuf, String)> =
        tokio::task::spawn_blocking(move || find_markdown_files(&canonical_base_clone))
            .await
            .unwrap_or_default();

    parse_quizzes_metadata(md_files).await
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

