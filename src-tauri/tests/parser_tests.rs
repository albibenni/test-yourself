use std::io::Write;
use tauri_app_lib::parser::parse_quiz_file;
use tauri_app_lib::models::Quiz;
use tempfile::NamedTempFile;

fn parse_string(content: &str) -> Option<Quiz> {
    let mut file = NamedTempFile::new().unwrap();
    writeln!(file, "{}", content).unwrap();
    parse_quiz_file(file.path(), "TestTopic")
}

#[test]
fn test_normal_quiz() {
    let md = "
**Q1. What is 2+2?**
A. 3
B. 4
C. 5
D. 6

## Answer Key
**Q1. Answer: B**
Explanation: Because math.
";
    let quiz = parse_string(md).unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].id, "1");
    assert_eq!(quiz.questions[0].options.len(), 4);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(
        quiz.questions[0].explanation.as_deref(),
        Some("Because math.")
    );
}

#[test]
fn test_saga_format() {
    let md = "
**1. Why is Saga preferred?** x
- A) Reason A
- B) Reason B

### Answer Key (Check your work!)
1. **B** (It's better).
";
    let quiz = parse_string(md).unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].id, "1");
    assert_eq!(quiz.questions[0].options.len(), 2);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(
        quiz.questions[0].explanation.as_deref(),
        Some("(It's better).")
    );
}

#[test]
fn test_kafka_format() {
    let md = "
**1. What is choreography?**
- A) A
- B) B

## Solutions
**1. Correct Answer: B**
- **Explanation:** Reacting to facts.
";
    let quiz = parse_string(md).unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(
        quiz.questions[0].explanation.as_deref(),
        Some("Reacting to facts.")
    );
}

#[test]
fn test_roadmap_false_positive() {
    let md = "
**1.Mathematical Foundations:**Month 1.
- **Linear Algebra:** Focus on matrix
**2.Classical ML:**Month 3.
- **Core Paradigms:** Study
";
    let quiz = parse_string(md);
    assert!(quiz.is_none());
}

#[test]
fn test_ignores_internal_headers() {
    let md = "
**Q1. What is Java?**
A. A language
B. A coffee

# WHICH IS WHICH QUIZ
**Q2. Another question?**
A. Yes
B. No
";
    // We create a file with a specific known name to test title extraction
    use std::fs::File;
    use tempfile::tempdir;
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("Exception Quiz.md");
    let mut file = File::create(&file_path).unwrap();
    writeln!(file, "{}", md).unwrap();
    
    let quiz = parse_quiz_file(&file_path, "TestTopic").unwrap();
    
    // The title should be the filename, NOT 'WHICH IS WHICH QUIZ'
    assert_eq!(quiz.title, "Exception Quiz");
    assert_eq!(quiz.questions.len(), 2);
}

use std::path::PathBuf;

#[test]
fn test_parse_acid_quiz() {
    let path = PathBuf::from("test_fixtures/ACID_quiz.md");
    let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse ACID quiz");
    assert_eq!(quiz.questions.len(), 8);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("D"));
}

#[test]
fn test_parse_saga_quiz() {
    let path = PathBuf::from("test_fixtures/SAGA exercises-quiz.md");
    let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse SAGA quiz");
    println!("SAGA quiz parsed {} questions", quiz.questions.len());
    assert!(!quiz.questions.is_empty());
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"));
}

#[test]
fn test_parse_kafka_saga_quiz() {
    let path = PathBuf::from("test_fixtures/Kafka and SAGA vs choreography quiz.md");
    let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse Kafka SAGA quiz");
    assert_eq!(quiz.questions.len(), 8);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
}

#[test]
fn test_parse_jvm_quiz() {
    let path = PathBuf::from("test_fixtures/JVM - Compiler Quiz.md");
    let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse JVM quiz");
    assert_eq!(quiz.questions.len(), 40);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"));
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("B"));
}

#[test]
fn test_parse_exception_quiz() {
    let path = PathBuf::from("test_fixtures/Exception Quiz.md");
    let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse Exception quiz");
    // Due to the second quiz in the same file, the questions vector will contain both.
    // The first quiz has 20 questions, the second has 10. Total 30.
    assert_eq!(quiz.questions.len(), 30);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("C"));
}

#[test]
fn test_parse_static_ex_quiz() {
    let path = PathBuf::from("test_fixtures/static ex.md");
    let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse static ex quiz");
    assert_eq!(quiz.questions.len(), 8);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("C"));
}

#[test]
fn test_parse_iframe_quiz() {
    let path = PathBuf::from("test_fixtures/iFrame_quiz.md");
    let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse iframe quiz");
    assert_eq!(quiz.questions.len(), 8);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(quiz.questions[0].options.len(), 4);
}

#[test]
fn test_inline_options_parsing() {
    let md = "
1. This is a question with inline options? A) First option B) Second option C) Third option D) Fourth option

## Solutions
1. Answer: C
";
    let quiz = parse_string(md).unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].options.len(), 4);
    assert_eq!(quiz.questions[0].options[0].text, "First option");
    assert_eq!(quiz.questions[0].options[1].text, "Second option");
    assert_eq!(quiz.questions[0].options[2].text, "Third option");
    assert_eq!(quiz.questions[0].options[3].text, "Fourth option");
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"));
}

#[test]
fn test_duplicate_question_prevention() {
    let md = "
1. This is a question inside a list.
A) Option A
B) Option B
C) Option C
D) Option D

## Answers
1. Answer: B
";
    let quiz = parse_string(md).unwrap();
    // Because it's a tight/loose list in Markdown, it might trigger multiple TagEnds.
    // We already fixed this by clearing the buffer, so length should be 1.
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
}

#[test]
fn test_question_without_options_is_dropped() {
    let md = "
1. This looks like a question but has no options.
2. This is a real question?
A) Yes
B) No

## Solutions
2. Answer: A
";
    let quiz = parse_string(md).unwrap();
    // Question 1 should be dropped because it has no options.
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].id, "2");
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("A"));
}

#[test]
fn test_answer_in_question_text_prevention() {
    let md = "
1. What is the answer?
A) Option A
B) Option B

## Solutions
1. Answer: B
";
    let quiz = parse_string(md).unwrap();
    assert_eq!(quiz.questions.len(), 1);
    // Ensure that '1. Answer: B' wasn't parsed as a second question
    assert_eq!(quiz.questions[0].id, "1");
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
}

#[test]
fn test_mixed_solution_headers() {
    let headers = vec![
        "## Answer Key",
        "### Solutions",
        "## Risposte e Spiegazioni",
        "# soluzioni",
        "#### Answers and Explanations"
    ];

    for header in headers {
        let md = format!("
1. Test question?
A) A
B) B

{}
1. C
", header);
        let quiz = parse_string(&md).unwrap();
        assert_eq!(quiz.questions.len(), 1, "Failed for header: {}", header);
        assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"), "Failed for header: {}", header);
    }
}
