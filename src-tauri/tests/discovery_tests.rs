use std::fs::File;
use std::io::Write;
use tauri_app_lib::parser::discovery::get_all_quizzes;
use tempfile::tempdir;

#[tokio::test]
async fn test_discovery_finds_nested_quizzes() {
    let dir = tempdir().unwrap();

    let sub_dir = dir.path().join("Frontend");
    std::fs::create_dir(&sub_dir).unwrap();

    let quiz_path = sub_dir.join("React.md");
    let mut file = File::create(&quiz_path).unwrap();
    // A valid quiz so it doesn't get filtered out
    writeln!(
        file,
        "
1. Question?
A. Opt A
B. Opt B

Answers
1. A
Explanation: Because.
"
    )
    .unwrap();

    // Also add a non-markdown file, should be ignored
    let txt_path = sub_dir.join("ignore.txt");
    File::create(&txt_path).unwrap();

    let quizzes = get_all_quizzes(dir.path().to_str().unwrap()).await;

    assert_eq!(quizzes.len(), 1);
    assert_eq!(quizzes[0].topic, "Frontend");
    assert_eq!(quizzes[0].title, "React");
}

#[tokio::test]
async fn test_discovery_ignores_invalid_path() {
    let quizzes = get_all_quizzes("/path/that/does/not/exist/for/sure").await;
    assert!(quizzes.is_empty());
}
