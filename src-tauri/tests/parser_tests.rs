use std::io::Write;
use tauri_app_lib::parser::{parse_quiz_file, Quiz};
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
