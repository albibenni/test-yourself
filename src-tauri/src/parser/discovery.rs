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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use tempfile::tempdir;

    #[test]
    fn test_finds_only_markdown_files() {
        let dir = tempdir().unwrap();
        let base = dir.path();

        File::create(base.join("test.md")).unwrap();
        File::create(base.join("test.txt")).unwrap();
        fs::create_dir(base.join("dir.md")).unwrap();

        let canonical_base = fs::canonicalize(base).unwrap();
        let files = find_markdown_files(&canonical_base);

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].0.file_name().unwrap(), "test.md");
        assert_eq!(files[0].1, "");
    }

    #[test]
    fn test_extracts_topic_correctly() {
        let dir = tempdir().unwrap();
        let base = dir.path();

        let topic_dir = base.join("Frontend").join("React");
        fs::create_dir_all(&topic_dir).unwrap();
        File::create(topic_dir.join("hooks.md")).unwrap();

        let canonical_base = fs::canonicalize(base).unwrap();
        let files = find_markdown_files(&canonical_base);

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].0.file_name().unwrap(), "hooks.md");

        let expected_topic = Path::new("Frontend")
            .join("React")
            .to_string_lossy()
            .into_owned();
        assert_eq!(files[0].1, expected_topic);
    }

    #[test]
    #[cfg(unix)]
    fn test_ignores_symlink_outside_safe_boundary() {
        use std::os::unix::fs::symlink;
        let safe_dir = tempdir().unwrap();
        let unsafe_dir = tempdir().unwrap();

        File::create(unsafe_dir.path().join("evil.md")).unwrap();

        let link_path = safe_dir.path().join("evil_link.md");
        symlink(unsafe_dir.path().join("evil.md"), &link_path).unwrap();

        let canonical_base = fs::canonicalize(safe_dir.path()).unwrap();
        let files = find_markdown_files(&canonical_base);

        assert_eq!(files.len(), 0);
    }
}
