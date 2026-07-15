use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use regex::Regex;
use std::fs;
use std::path::Path;
use std::sync::LazyLock;
use walkdir::WalkDir;

use crate::models::{Quiz, QuizOption, QuizQuestion};

// Since we use an AST parser, the extracted text is stripped of Markdown formatting (like **).
// These Regexes now match plain text, making them vastly more robust!
static RE_QUESTION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(?:Q|q|Question\s*)?(\d+)[\.\:]\s*(.+)$").unwrap());
static RE_OPTION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^([A-D])[\.\)]\s*(.+)$").unwrap());
static RE_SOLUTION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?s)^(?:Q|q|Question\s*)?(\d+).*?\b([A-D])\b(.*)$").unwrap());
static RE_EXPLANATION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?s)^(?i)explanation(?:[\:\-])?\s*(.*)$").unwrap());

pub fn parse_quiz_file(filepath: &Path, topic: &str) -> Option<Quiz> {
    let content = fs::read_to_string(filepath).ok()?;

    let mut quiz = Quiz {
        title: filepath.file_stem()?.to_string_lossy().to_string(),
        path: filepath.to_path_buf(),
        topic: topic.to_string(),
        questions: Vec::new(),
    };

    let parser = Parser::new(&content);
    let mut in_solutions = false;
    let mut current_text = String::new();
    let mut current_solution_id: Option<String> = None;
    let mut in_code_block = false;
    let mut current_list_index: Option<u64> = None;
    let mut pending_list_prefix = String::new();

    for event in parser {
        match event {
            Event::Start(Tag::List(Some(start_num))) => {
                current_list_index = Some(start_num);
            }
            Event::End(TagEnd::List(_)) => {
                current_list_index = None;
            }
            Event::Start(Tag::CodeBlock(_)) => in_code_block = true,
            Event::End(TagEnd::CodeBlock) => in_code_block = false,
            Event::Start(Tag::Paragraph | Tag::Heading { .. }) => {
                current_text.clear();
                if !pending_list_prefix.is_empty() {
                    current_text.push_str(&pending_list_prefix);
                    pending_list_prefix.clear();
                }
            }
            Event::Start(Tag::Item) => {
                current_text.clear();
                pending_list_prefix.clear();
                if let Some(ref mut idx) = current_list_index {
                    pending_list_prefix = format!("{}. ", idx);
                    *idx += 1;
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if !in_code_block {
                    current_text.push('\n');
                }
            }
            Event::Text(text) | Event::Code(text) => {
                if !in_code_block {
                    if !pending_list_prefix.is_empty() {
                        current_text.push_str(&pending_list_prefix);
                        pending_list_prefix.clear();
                    }
                    current_text.push_str(&text);
                }
            }
            Event::End(TagEnd::Paragraph | TagEnd::Heading(_) | TagEnd::Item) => {
                let paragraph_text = current_text.trim();

                if paragraph_text.is_empty() {
                    continue;
                }

                // Process the paragraph line by line to handle items separated by SoftBreaks
                for line in paragraph_text.lines() {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    if trimmed.to_lowercase().contains("solutions") || trimmed.to_lowercase().contains("answer key") {
                        in_solutions = true;
                        continue;
                    }

                    if in_solutions {
                        // Parse Solution
                        if let Some(caps) = RE_SOLUTION.captures(trimmed) {
                            let q_id_val = &caps[1];
                            let correct_letter_val = caps[2].to_string();
                            let trailing_text_val = caps[3].trim().to_string();

                            current_solution_id = Some(q_id_val.to_string());

                            if let Some(q) = quiz.questions.iter_mut().find(|q| q.id == q_id_val) {
                                q.correct_answer = Some(correct_letter_val);
                                if !trailing_text_val.is_empty() {
                                    q.explanation = Some(trailing_text_val);
                                }
                            }
                            continue;
                        }

                        // Parse Explanation
                        if let Some(caps) = RE_EXPLANATION.captures(trimmed) {
                            if let Some(ref q_id) = current_solution_id {
                                if let Some(q) = quiz.questions.iter_mut().find(|q| q.id == *q_id) {
                                    let new_text = caps[1].trim().to_string();
                                    if let Some(ref mut expl) = q.explanation {
                                        expl.push_str("\n\n");
                                        expl.push_str(&new_text);
                                    } else {
                                        q.explanation = Some(new_text);
                                    }
                                }
                            }
                            continue;
                        } else if let Some(ref q_id) = current_solution_id {
                            // Continuation of explanation
                            if !RE_SOLUTION.is_match(trimmed) {
                                if let Some(q) = quiz.questions.iter_mut().find(|q| q.id == *q_id) {
                                    if let Some(ref mut expl) = q.explanation {
                                        expl.push_str("\n\n");
                                        expl.push_str(trimmed);
                                    } else {
                                        q.explanation = Some(trimmed.to_string());
                                    }
                                }
                            }
                        }
                    } else {
                        // Parse Question
                        if let Some(caps) = RE_QUESTION.captures(trimmed) {
                            let q_id = caps[1].to_string();
                            let text = caps[2].to_string();
                            let new_q = QuizQuestion {
                                id: q_id,
                                text,
                                options: Vec::new(),
                                correct_answer: None,
                                explanation: None,
                            };
                            quiz.questions.push(new_q);
                            continue;
                        }

                        // Parse Option
                        if let Some(caps) = RE_OPTION.captures(trimmed) {
                            if let Some(last_q) = quiz.questions.last_mut() {
                                let letter = caps[1].to_string();
                                let text = caps[2].trim().to_string();
                                last_q.options.push(QuizOption { letter, text });
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    quiz.questions.retain(|q| !q.options.is_empty());

    if quiz.questions.is_empty() {
        None
    } else {
        Some(quiz)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_parse_acid_quiz() {
        let path = PathBuf::from("../../SecondBrain/Computer Science/Design and Systems/Design Pattern/Exercises and quizes/ACID_quiz.md");
        let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse ACID quiz");
        assert_eq!(quiz.questions.len(), 8);
        assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
        assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("D"));
    }

    #[test]
    fn test_parse_saga_quiz() {
        let path = PathBuf::from("../../SecondBrain/Computer Science/Design and Systems/Design Pattern/Exercises and quizes/SAGA exercises-quiz.md");
        let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse SAGA quiz");
        assert!(!quiz.questions.is_empty());
        assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"));
    }

    #[test]
    fn test_parse_kafka_saga_quiz() {
        let path = PathBuf::from("../../SecondBrain/Computer Science/Design and Systems/Design Pattern/Exercises and quizes/Kafka and SAGA vs choreography quiz.md");
        let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse Kafka SAGA quiz");
        assert_eq!(quiz.questions.len(), 8);
        assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("B"));
    }

    #[test]
    fn test_parse_jvm_quiz() {
        let path = PathBuf::from("../../SecondBrain/Computer Science/Languages/Java/Basic/Exercises - quiz/JVM - Compiler Quiz.md");
        let quiz = parse_quiz_file(&path, "Testing").expect("Failed to parse JVM quiz");
        assert_eq!(quiz.questions.len(), 40);
        assert_eq!(quiz.questions[0].correct_answer.as_deref(), Some("C"));
        assert_eq!(quiz.questions[1].correct_answer.as_deref(), Some("B"));
    }
}



pub fn get_all_quizzes(base_dir: &str) -> Vec<Quiz> {
    let mut quizzes = Vec::new();

    // SECURITY: Prevent basic path traversal and null-byte injection.
    // In a fully generalized app, this should be enforced via Tauri's `fs::Scope`.
    if base_dir.contains("..") || base_dir.contains('\0') {
        eprintln!("Security Warning: Attempted path traversal or invalid characters detected.");
        return quizzes;
    }

    let base_path = Path::new(base_dir);

    if !base_path.exists() {
        return quizzes;
    }

    for entry in WalkDir::new(base_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext == "md" {
                // Determine topic based on folder structure relative to base_dir
                let relative = path.strip_prefix(base_path).unwrap_or(path);
                let topic = relative
                    .parent()
                    .unwrap_or(Path::new(""))
                    .to_string_lossy()
                    .to_string();

                if let Some(quiz) = parse_quiz_file(path, &topic) {
                    quizzes.push(quiz);
                }
            }
        }
    }

    quizzes
}
