use std::io::Write;
use tauri_app_lib::models::Quiz;
use tauri_app_lib::parser::parse_quiz_file;
use tempfile::NamedTempFile;

async fn parse_string(content: &str) -> Option<Quiz> {
    let mut file = NamedTempFile::new().unwrap();
    writeln!(file, "{}", content).unwrap();
    parse_quiz_file(file.path(), "TestTopic").await
}

#[tokio::test]
async fn test_normal_quiz() {
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
    let quiz = parse_string(md).await.unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].id, "1");
    assert_eq!(quiz.questions[0].options.len(), 4);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(
        quiz.questions[0].explanation.as_deref(),
        Some("Because math.")
    );
}

#[tokio::test]
async fn test_saga_format() {
    let md = "
**1. Why is Saga preferred?** x
- A) Reason A
- B) Reason B

### Answer Key (Check your work!)
1. **B** (It's better).
";
    let quiz = parse_string(md).await.unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].id, "1");
    assert_eq!(quiz.questions[0].options.len(), 2);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(
        quiz.questions[0].explanation.as_deref(),
        Some("(It's better).")
    );
}

#[tokio::test]
async fn test_kafka_format() {
    let md = "
**1. What is choreography?**
- A) A
- B) B

## Solutions
**1. Correct Answer: B**
- **Explanation:** Reacting to facts.
";
    let quiz = parse_string(md).await.unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(
        quiz.questions[0].explanation.as_deref(),
        Some("Reacting to facts.")
    );
}

#[tokio::test]
async fn test_roadmap_false_positive() {
    let md = "
**1.Mathematical Foundations:**Month 1.
- **Linear Algebra:** Focus on matrix
**2.Classical ML:**Month 3.
- **Core Paradigms:** Study
";
    let quiz = parse_string(md);
    assert!(quiz.await.is_none());
}

#[tokio::test]
async fn test_ignores_internal_headers() {
    let md = "
**Q1. What is Java?**
A. A language
B. A coffee

# WHICH IS WHICH QUIZ
**Q2. Another question?**
A. Yes
B. No

## Solutions
**Q1. Answer: A**
Explanation: Yes.
**Q2. Answer: A**
Explanation: Yes.
";
    // We create a file with a specific known name to test title extraction
    use std::fs::File;
    use tempfile::tempdir;
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("Exception Quiz.md");
    let mut file = File::create(&file_path).unwrap();
    writeln!(file, "{}", md).unwrap();

    let quiz = parse_quiz_file(&file_path, "TestTopic").await.unwrap();

    // The title should be the filename, NOT 'WHICH IS WHICH QUIZ'
    assert_eq!(quiz.title, "Exception Quiz");
    assert_eq!(quiz.questions.len(), 2);
}

use std::path::PathBuf;

#[tokio::test]
async fn test_parse_acid_quiz() {
    let path = PathBuf::from("test_data/ACID_quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse ACID quiz");
    assert_eq!(quiz.questions.len(), 8);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("D"));
}

#[tokio::test]
async fn test_parse_saga_quiz() {
    let path = PathBuf::from("test_data/SAGA exercises-quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse SAGA quiz");
    println!("SAGA quiz parsed {} questions", quiz.questions.len());
    assert!(!quiz.questions.is_empty());
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"));
}

#[tokio::test]
async fn test_parse_kafka_saga_quiz() {
    let path = PathBuf::from("test_data/Kafka and SAGA vs choreography quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse Kafka SAGA quiz");
    assert_eq!(quiz.questions.len(), 8);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
}

#[tokio::test]
async fn test_parse_jvm_quiz() {
    let path = PathBuf::from("test_data/JVM - Compiler Quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse JVM quiz");
    assert_eq!(quiz.questions.len(), 40);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"));
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("B"));
}

#[tokio::test]
async fn test_parse_exception_quiz() {
    let path = PathBuf::from("test_data/Exception Quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse Exception quiz");
    // Due to the second quiz in the same file, the questions vector will contain both.
    // The first quiz has 20 questions, the second has 10. Total 30.
    assert_eq!(quiz.questions.len(), 30);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("C"));
}

#[tokio::test]
async fn test_parse_static_ex_quiz() {
    let path = PathBuf::from("test_data/static ex.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse static ex quiz");
    assert_eq!(quiz.questions.len(), 8);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("C"));
}

#[tokio::test]
async fn test_parse_iframe_quiz() {
    let path = PathBuf::from("test_data/iFrame_quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse iframe quiz");
    assert_eq!(quiz.questions.len(), 8);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(quiz.questions[0].options.len(), 4);
}

#[tokio::test]
async fn test_inline_options_parsing() {
    let md = "
1. This is a question with inline options? A) First option B) Second option C) Third option D) Fourth option

## Solutions
1. Answer: C
Explanation: This is C.
";
    let quiz = parse_string(md).await.unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].options.len(), 4);
    assert_eq!(quiz.questions[0].options[0].text, "First option");
    assert_eq!(quiz.questions[0].options[1].text, "Second option");
    assert_eq!(quiz.questions[0].options[2].text, "Third option");
    assert_eq!(quiz.questions[0].options[3].text, "Fourth option");
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"));
}

#[tokio::test]
async fn test_duplicate_question_prevention() {
    let md = "
1. This is a question inside a list.
A) Option A
B) Option B
C) Option C
D) Option D

## Answers
1. Answer: B
Explanation: Because.
";
    let quiz = parse_string(md).await.unwrap();
    // Because it's a tight/loose list in Markdown, it might trigger multiple TagEnds.
    // We already fixed this by clearing the buffer, so length should be 1.
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
}

#[tokio::test]
async fn test_question_without_options_is_dropped() {
    let md = "
1. This looks like a question but has no options.
2. This is a real question?
A) Yes
B) No

## Solutions
2. Answer: A
Explanation: A.
";
    let quiz = parse_string(md).await.unwrap();
    // Question 1 should be dropped because it has no options.
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].id, "2");
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("A"));
}

#[tokio::test]
async fn test_answer_in_question_text_prevention() {
    let md = "
1. What is the answer?
A) Option A
B) Option B

## Solutions
1. Answer: B
Explanation: B.
";
    let quiz = parse_string(md).await.unwrap();
    assert_eq!(quiz.questions.len(), 1);
    // Ensure that '1. Answer: B' wasn't parsed as a second question
    assert_eq!(quiz.questions[0].id, "1");
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
}

#[tokio::test]
async fn test_mixed_solution_headers() {
    let headers = vec![
        "## Answer Key",
        "### Solutions",
        "## Risposte e Spiegazioni",
        "# soluzioni",
        "#### Answers and Explanations",
    ];

    for header in headers {
        let md = format!(
            "
1. Test question?
A) A
B) B

{}
1. C
Explanation: C.
",
            header
        );
        let quiz = parse_string(&md).await.unwrap();
        assert_eq!(quiz.questions.len(), 1, "Failed for header: {}", header);
        assert_eq!(
            quiz.questions[0].correct_answer.as_deref(),
            Some("C"),
            "Failed for header: {}",
            header
        );
    }
}

#[tokio::test]
async fn test_false_positive_math_formulas_not_parsed() {
    let md = "
1. **Indipendenza**: P(A ∩ B) = P(A) × P(B)
2. **Complementare**: P(A^c) = 1 - P(A)
3. **Unione**: P(A ∪ B) = P(A) + P(B) - P(A ∩ B)
4. **Leggi di De Morgan**: (A ∪ B)^c = A^c ∩ B^c
    ";
    let quiz = parse_string(md).await;
    // Because this contains no real options starting with 'A', it should be skipped
    assert!(quiz.is_none());
}

#[tokio::test]
async fn test_question_must_have_option_a() {
    let md = "
1. Is this a question?
B) Option B
C) Option C
D) Option D

## Solutions
1. Answer: B
    ";
    let quiz = parse_string(md).await;
    // It has options B, C, D, but no A. It shouldn't be considered a valid question.
    assert!(quiz.is_none());
}

#[tokio::test]
async fn test_multiline_question_text() {
    let md = "
1. Placing a Business Object (Foundational)
Where should a business object be placed in clean architecture?
And what is the exact layer?
A. Interface Adapters (Green Layer)
B. Use Cases / Interactors (Red Layer)

## Solutions
1. Answer: B
Explanation: Red Layer.
    ";
    let quiz = parse_string(md).await.unwrap();
    assert_eq!(quiz.questions.len(), 1);
    assert_eq!(quiz.questions[0].text, "Placing a Business Object (Foundational)\nWhere should a business object be placed in clean architecture?\nAnd what is the exact layer?");
    assert_eq!(quiz.questions[0].options.len(), 2);
}

#[tokio::test]
async fn test_separated_answer_and_explanation() {
    let path = PathBuf::from("test_data/separated_explanation_quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse separated_explanation_quiz.md");

    assert_eq!(quiz.questions.len(), 2);

    // Q1
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("A"));
    let expl1 = quiz.questions[0]
        .explanation
        .as_deref()
        .expect("Explanation 1 should be parsed");
    assert!(expl1.contains("What is a socket?"));
    assert!(expl1.contains("Correct: A. It is an endpoint."));

    // Q2
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("B"));
    let expl2 = quiz.questions[1]
        .explanation
        .as_deref()
        .expect("Explanation 2 should be parsed");
    assert!(expl2.contains("What is TCP?"));
    assert!(expl2.contains("Correct: B. It is a reliable connection-oriented protocol."));
}

#[tokio::test]
async fn test_parse_onboarding_quiz() {
    let path = PathBuf::from("test_data/onboarding_quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse onboarding_quiz.md");

    assert_eq!(quiz.questions.len(), 2);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    assert_eq!(
        quiz.questions[0].explanation.as_deref(),
        Some("Inline answer provided.")
    );
    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("B"));
    assert_eq!(
        quiz.questions[1].explanation.as_deref(),
        Some("Inline answer provided.")
    );
}

#[tokio::test]
async fn test_parse_diffie_hellman_quiz() {
    let path = PathBuf::from("test_data/diffie_hellman_quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse diffie_hellman_quiz.md");

    assert_eq!(quiz.questions.len(), 2);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    let expl1 = quiz.questions[0]
        .explanation
        .as_deref()
        .expect("Explanation missing");
    assert!(expl1.contains("DH only solves key agreement."));

    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("D"));
    let expl2 = quiz.questions[1]
        .explanation
        .as_deref()
        .expect("Explanation missing");
    assert!(expl2.contains("The publicly agreed Yellow maps"));
}

#[tokio::test]
async fn test_parse_bola_quiz() {
    let path = PathBuf::from("test_data/bola_quiz.md");
    let quiz = parse_quiz_file(&path, "Testing")
        .await
        .expect("Failed to parse bola_quiz.md");

    assert_eq!(quiz.questions.len(), 2);
    assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    let expl1 = quiz.questions[0]
        .explanation
        .as_deref()
        .expect("Explanation missing");
    assert!(expl1.contains("The tldr states BOLA is"));

    assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("C"));
    let expl2 = quiz.questions[1]
        .explanation
        .as_deref()
        .expect("Explanation missing");
    assert!(expl2.contains("The analogy maps authentication"));
}
