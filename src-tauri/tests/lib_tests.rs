use std::fs::File;
use std::io::Write;
use tauri_app_lib::get_quiz_content_inner;
use tempfile::tempdir;

#[tokio::test]
async fn test_get_quiz_content_inner_success() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("quiz.md");
    let mut file = File::create(&path).unwrap();
    writeln!(file, "1. Q\nA. Opt\nB. Opt\n\n## Solutions\n1. A\nExplanation: text").unwrap();

    let result = get_quiz_content_inner(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
    assert!(result.is_ok());
    let quiz = result.unwrap();
    assert_eq!(quiz.questions.len(), 1);
}

#[tokio::test]
async fn test_get_quiz_content_inner_empty_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("empty.md");
    File::create(&path).unwrap();

    let result = get_quiz_content_inner(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
    assert!(result.is_err());
    assert_eq!(
        result.unwrap_err(),
        format!("Could not parse quiz or it contains no questions: {}", path.to_str().unwrap())
    );
}

#[tokio::test]
async fn test_get_quiz_content_inner_nonexistent() {
    let result = get_quiz_content_inner("/does/not/exist.md".to_string(), "Topic".to_string()).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_quiz_content_inner_binary_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("image.md");
    let mut file = File::create(&path).unwrap();
    // Write some invalid UTF-8 bytes to simulate a binary file
    file.write_all(&[0xFF, 0xFE, 0xFD, 0x00, 0x11]).unwrap();

    let result = get_quiz_content_inner(path.to_str().unwrap().to_string(), "Topic".to_string()).await;
    assert!(result.is_err());
    assert_eq!(
        result.unwrap_err(),
        format!("Could not parse quiz or it contains no questions: {}", path.to_str().unwrap())
    );
}
