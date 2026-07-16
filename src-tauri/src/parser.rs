use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use regex::Regex;
use std::fs;
use std::path::Path;
use std::sync::LazyLock;
use walkdir::WalkDir;

use crate::models::{Quiz, QuizOption, QuizQuestion};

static RE_QUESTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:Q|q|Question\s*)?(\d+)[\.\:]\s*(.+)$").unwrap());
static RE_OPTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^([A-D])[\.\)]\s*(.+)$").unwrap());
static RE_SOLUTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)^(?:Q|q|Question\s*)?(\d+).*?\b([A-D])\b(.*)$").unwrap());
static RE_EXPLANATION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)^(?i)explanation(?:[\:\-])?\s*(.*)$").unwrap());


fn update_solution_mode(trimmed_lower: &str, in_heading: bool, in_solutions: &mut bool) {
    let solution_keywords = ["solution", "answer", "soluzioni", "risposte"];
    let contains_solution_kw = solution_keywords.iter().any(|&kw| trimmed_lower.contains(kw));
    let starts_with_solution_kw = solution_keywords.iter().any(|&kw| trimmed_lower.starts_with(kw));

    if in_heading && trimmed_lower.contains("quiz") && !contains_solution_kw {
        *in_solutions = false;
    }

    if (in_heading && contains_solution_kw) || starts_with_solution_kw {
        *in_solutions = true;
    }
}

fn parse_inline_options(raw_text: &str) -> (String, Vec<QuizOption>) {
    let mut text = raw_text.to_string();
    let mut options = Vec::new();

    let re_inline_a = regex::Regex::new(r"(?:\s+|^)A[\.\)]\s+").unwrap();
    if let Some(mat_a) = re_inline_a.find(raw_text) {
        text = raw_text[..mat_a.start()].trim().to_string();

        let re_inline_b = regex::Regex::new(r"\s+B[\.\)]\s+").unwrap();
        let re_inline_c = regex::Regex::new(r"\s+C[\.\)]\s+").unwrap();
        let re_inline_d = regex::Regex::new(r"\s+D[\.\)]\s+").unwrap();

        let start_a = mat_a.end();
        let mut start_b = raw_text.len();
        let mut start_c = raw_text.len();
        let mut start_d = raw_text.len();

        let mut mat_b_end = raw_text.len();
        let mut mat_c_end = raw_text.len();
        let mut mat_d_end = raw_text.len();

        if let Some(mat) = re_inline_b.find(raw_text) {
            start_b = mat.start();
            mat_b_end = mat.end();
        }
        if let Some(mat) = re_inline_c.find(raw_text) {
            start_c = mat.start();
            mat_c_end = mat.end();
        }
        if let Some(mat) = re_inline_d.find(raw_text) {
            start_d = mat.start();
            mat_d_end = mat.end();
        }

        let opt_a = raw_text[start_a..start_b].trim().to_string();
        options.push(QuizOption { letter: "A".to_string(), text: opt_a });

        if start_b < raw_text.len() {
            let opt_b = raw_text[mat_b_end..start_c].trim().to_string();
            options.push(QuizOption { letter: "B".to_string(), text: opt_b });
        }
        if start_c < raw_text.len() {
            let opt_c = raw_text[mat_c_end..start_d].trim().to_string();
            options.push(QuizOption { letter: "C".to_string(), text: opt_c });
        }
        if start_d < raw_text.len() {
            let opt_d = raw_text[mat_d_end..].trim().to_string();
            options.push(QuizOption { letter: "D".to_string(), text: opt_d });
        }
    }
    
    (text, options)
}

fn process_question_line(trimmed: &str, quiz: &mut Quiz) {
    if let Some(caps) = RE_QUESTION.captures(trimmed) {
        let raw_text = caps[2].to_string();

        let raw_lower = raw_text.to_lowercase();
        let solution_keywords = ["solution", "answer", "soluzioni", "risposte"];
        let is_actually_solution = solution_keywords.iter().any(|&kw| raw_lower.starts_with(kw));

        // Prevent "1. Answer: B" from being parsed as a question
        if !is_actually_solution {
            let q_id = caps[1].to_string();
            let (text, options) = parse_inline_options(&raw_text);

            let new_q = QuizQuestion {
                id: q_id,
                text,
                options,
                correct_answer: None,
                explanation: None,
            };
            quiz.questions.push(new_q);
            return;
        }
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

fn process_solution_line(trimmed: &str, quiz: &mut Quiz, current_solution_id: &mut Option<String>) {
    // Parse Solution
    if let Some(caps) = RE_SOLUTION.captures(trimmed) {
        let q_id_val = &caps[1];
        let correct_letter_val = caps[2].to_string();
        let trailing_text_val = caps[3].trim().to_string();

        *current_solution_id = Some(q_id_val.to_string());

        if let Some(q) = quiz.questions.iter_mut().rev().find(|q| q.id == q_id_val && !q.options.is_empty()) {
            q.correct_answer = Some(correct_letter_val);
            if !trailing_text_val.is_empty() {
                q.explanation = Some(trailing_text_val);
            }
        }
        return;
    }

    // Parse Explanation
    if let Some(caps) = RE_EXPLANATION.captures(trimmed) {
        if let Some(ref q_id) = current_solution_id {
            if let Some(q) = quiz.questions.iter_mut().rev().find(|q| q.id == *q_id && !q.options.is_empty()) {
                let new_text = caps[1].trim().to_string();
                if let Some(ref mut expl) = q.explanation {
                    expl.push_str("\n\n");
                    expl.push_str(&new_text);
                } else {
                    q.explanation = Some(new_text);
                }
            }
        }
        return;
    } else if let Some(ref q_id) = current_solution_id {
        // Continuation of explanation
        if !RE_SOLUTION.is_match(trimmed) {
            if let Some(q) = quiz.questions.iter_mut().rev().find(|q| q.id == *q_id && !q.options.is_empty()) {
                if let Some(ref mut expl) = q.explanation {
                    expl.push_str("\n\n");
                    expl.push_str(trimmed);
                } else {
                    q.explanation = Some(trimmed.to_string());
                }
            }
        }
    }
}


struct QuizParser<'a> {
    quiz: &'a mut Quiz,
    in_solutions: bool,
    current_solution_id: Option<String>,
}

impl<'a> QuizParser<'a> {
    fn new(quiz: &'a mut Quiz) -> Self {
        Self {
            quiz,
            in_solutions: false,
            current_solution_id: None,
        }
    }

    fn process_paragraph(&mut self, paragraph_text: &str, in_heading: bool) {
        for line in paragraph_text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let trimmed_lower = trimmed.to_lowercase();
            update_solution_mode(&trimmed_lower, in_heading, &mut self.in_solutions);

            if self.in_solutions {
                process_solution_line(trimmed, self.quiz, &mut self.current_solution_id);
            } else {
                process_question_line(trimmed, self.quiz);
            }
        }
    }
}


pub fn parse_quiz_file(filepath: &Path, topic: &str) -> Option<Quiz> {
    let content = fs::read_to_string(filepath).ok()?;

    let metadata = fs::metadata(filepath).ok()?;
    let last_modified = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();

    let mut quiz = Quiz {
        title: filepath.file_stem()?.to_string_lossy().to_string(),
        path: filepath.to_path_buf(),
        topic: topic.to_string(),
        questions: Vec::new(),
        last_modified,
    };

    let parser = Parser::new(&content);
    
    let mut quiz_parser = QuizParser::new(&mut quiz);
    let mut current_text = String::new();
    let mut in_code_block = false;
    let mut in_heading = false;
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
            Event::Start(Tag::Heading { .. }) => {
                in_heading = true;
                current_text.clear();
                if !pending_list_prefix.is_empty() {
                    current_text.push_str(&pending_list_prefix);
                    pending_list_prefix.clear();
                }
            }
            Event::Start(Tag::Paragraph) => {
                in_heading = false;
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
                let paragraph_text_owned = current_text.trim().to_string();
                current_text.clear();

                let paragraph_text = paragraph_text_owned.as_str();
                if !paragraph_text.is_empty() {
                    quiz_parser.process_paragraph(paragraph_text, in_heading);
                }

                if in_heading {
                    in_heading = false;
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

pub fn get_all_quizzes(base_dir: &str) -> Vec<Quiz> {
    let mut quizzes = Vec::new();

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
