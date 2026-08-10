use std::fs::File;
use std::io::Write;
use tauri_app_lib::{get_quiz_content_inner, validate_quiz_path};
use tempfile::tempdir;

#[tokio::test]
async fn test_get_quiz_content_inner_success() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("quiz.md");
    let mut file = File::create(&path).unwrap();
    writeln!(
        file,
        "1. Q\nA. Opt\nB. Opt\n\n## Solutions\n1. A\nExplanation: text"
    )
    .unwrap();

    let result =
        get_quiz_content_inner(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
    assert!(result.is_ok());
    let quiz = result.unwrap();
    assert_eq!(quiz.questions.len(), 1);
}

#[tokio::test]
async fn test_get_quiz_content_inner_empty_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("empty.md");
    File::create(&path).unwrap();

    let result =
        get_quiz_content_inner(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
    assert!(result.is_err());
    assert_eq!(
        result.unwrap_err(),
        format!(
            "Could not parse quiz or it contains no questions: {}",
            path.to_str().unwrap()
        )
    );
}

#[tokio::test]
async fn test_get_quiz_content_inner_nonexistent() {
    let result =
        get_quiz_content_inner("/does/not/exist.md".to_string(), "Topic".to_string()).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_quiz_content_inner_binary_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("image.md");
    let mut file = File::create(&path).unwrap();
    // Write some invalid UTF-8 bytes to simulate a binary file
    file.write_all(&[0xFF, 0xFE, 0xFD, 0x00, 0x11]).unwrap();

    let result =
        get_quiz_content_inner(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
    assert!(result.is_err());
    assert_eq!(
        result.unwrap_err(),
        format!(
            "Could not parse quiz or it contains no questions: {}",
            path.to_str().unwrap()
        )
    );
}

#[test]
fn validate_quiz_path_allows_markdown_inside_configured_root() {
    let root = std::path::PathBuf::from("/quiz-root");
    let candidate = root.join("topic/quiz.md");

    assert_eq!(validate_quiz_path(root, candidate.clone()), Ok(candidate));
}

#[test]
fn validate_quiz_path_rejects_non_markdown_or_outside_files() {
    let root = std::path::PathBuf::from("/quiz-root");

    assert!(validate_quiz_path(root.clone(), std::path::PathBuf::from("/other/quiz.md")).is_err());
    assert!(validate_quiz_path(root.clone(), root.join("quiz.txt")).is_err());
}
