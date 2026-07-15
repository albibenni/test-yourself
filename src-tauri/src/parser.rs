use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuizOption {
    pub letter: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuizQuestion {
    pub id: String,
    pub text: String,
    pub options: Vec<QuizOption>,
    pub correct_answer: Option<String>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Quiz {
    pub title: String,
    pub path: String,
    pub topic: String,
    pub questions: Vec<QuizQuestion>,
}

pub fn parse_quiz_file(filepath: &Path, topic: &str) -> Option<Quiz> {
    let content = fs::read_to_string(filepath).ok()?;
    let lines: Vec<&str> = content.lines().collect();

    let mut quiz = Quiz {
        title: filepath.file_stem()?.to_string_lossy().to_string(),
        path: filepath.to_string_lossy().to_string(),
        topic: topic.to_string(),
        questions: Vec::new(),
    };

    let re_question = Regex::new(r"^\*\*(?:Q)?(\d+)[\.\:]\s*(.+?)\*\*.*$").unwrap();
    let re_option = Regex::new(r"^(?:[\-\*]\s*)?([A-D])[\.\)]\s*(.+)$").unwrap();
    let re_solution1 = Regex::new(r"^\*\*(?:Q)?(\d+)[^\*]*\b([A-D])\b[^\*]*\*\*\s*(.*)$").unwrap();
    let re_solution2 = Regex::new(r"^(?:Q)?(\d+)[\.\:\-\s]+(?:\*\*)?\b([A-D])\b(?:\*\*)?\s*(.*)$").unwrap();
    let re_explanation = Regex::new(r"^(?:[\-\*]\s*)?(?:\*\*)?(?i)explanation(?:[\:\-])?(?:\*\*)?(?:[\:\-])?\s*(.*)$").unwrap();

    let mut parsing_solutions = false;
    let mut current_solution_id: Option<String> = None;

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed.to_lowercase().starts_with("## solutions") || trimmed.to_lowercase().starts_with("## answer key") || trimmed.to_lowercase().starts_with("### answer key") {
            parsing_solutions = true;
            continue;
        }

        if !parsing_solutions {
            // Title
            if trimmed.starts_with("# ") {
                quiz.title = trimmed.replace("# ", "").trim().to_string();
                continue;
            }

            // Parse Question
            if let Some(caps) = re_question.captures(trimmed) {
                quiz.questions.push(QuizQuestion {
                    id: caps[1].to_string(),
                    text: caps[2].to_string(),
                    options: Vec::new(),
                    correct_answer: None,
                    explanation: None,
                });
                continue;
            }

            // Parse Option
            if let Some(caps) = re_option.captures(trimmed) {
                if let Some(last_q) = quiz.questions.last_mut() {
                    last_q.options.push(QuizOption {
                        letter: caps[1].to_string(),
                        text: caps[2].to_string(),
                    });
                }
                continue;
            }
        } else {
            // Parse Solution
            let mut matched = false;
            let mut q_id_val = String::new();
            let mut correct_letter_val = String::new();
            let mut trailing_text_val = String::new();

            if let Some(caps) = re_solution1.captures(trimmed) {
                q_id_val = caps[1].to_string();
                correct_letter_val = caps[2].to_string();
                trailing_text_val = caps[3].trim().to_string();
                matched = true;
            } else if let Some(caps) = re_solution2.captures(trimmed) {
                q_id_val = caps[1].to_string();
                correct_letter_val = caps[2].to_string();
                trailing_text_val = caps[3].trim().to_string();
                matched = true;
            }

            if matched {
                if let Some(q) = quiz.questions.iter_mut().find(|q| q.id == q_id_val) {
                    q.correct_answer = Some(correct_letter_val);
                    if !trailing_text_val.is_empty() {
                        q.explanation = Some(trailing_text_val);
                    }
                }
                current_solution_id = Some(q_id_val);
                continue;
            }

            // Parse Explanation
            if let Some(caps) = re_explanation.captures(trimmed) {
                if let Some(ref q_id) = current_solution_id {
                    if let Some(q) = quiz.questions.iter_mut().find(|q| q.id == *q_id) {
                        let new_text = caps[1].trim().to_string();
                        if let Some(ref mut expl) = q.explanation {
                            expl.push_str(" ");
                            expl.push_str(&new_text);
                        } else {
                            q.explanation = Some(new_text);
                        }
                    }
                }
                continue;
            } else if let Some(ref q_id) = current_solution_id {
                // Continuation of explanation if it doesn't match other known tags
                if !trimmed.starts_with("**Q") && !trimmed.starts_with("**1") {
                    if let Some(q) = quiz.questions.iter_mut().find(|q| q.id == *q_id) {
                        if let Some(ref mut expl) = q.explanation {
                            expl.push_str(" ");
                            expl.push_str(trimmed);
                        } else {
                            q.explanation = Some(trimmed.to_string());
                        }
                    }
                }
            }
        }
    }

    // Clean up invalid questions
    quiz.questions.retain(|q| !q.options.is_empty());

    // Only return if we actually found questions
    if quiz.questions.is_empty() {
        None
    } else {
        Some(quiz)
    }
}



pub fn get_all_quizzes(base_dir: &str) -> Vec<Quiz> {
    let mut quizzes = Vec::new();
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
