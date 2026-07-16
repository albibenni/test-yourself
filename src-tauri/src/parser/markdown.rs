use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use std::path::Path;

use super::core::QuizParser;
use crate::models::Quiz;

pub async fn parse_quiz_file(filepath: &Path, topic: &str) -> Option<Quiz> {
    let content = tokio::fs::read_to_string(filepath).await.ok()?;

    let metadata = tokio::fs::metadata(filepath).await.ok()?;
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

    let mut options = pulldown_cmark::Options::empty();
    options.insert(pulldown_cmark::Options::ENABLE_TABLES);
    let parser = Parser::new_ext(&content, options);

    let mut quiz_parser = QuizParser::new(&mut quiz);
    let mut current_text = String::new();
    let mut in_code_block = false;
    let mut in_heading = false;
    let mut list_index_stack: Vec<Option<u64>> = Vec::new();
    let mut pending_list_prefix = String::new();

    for event in parser {
        match event {
            Event::Start(Tag::List(start_num)) => {
                list_index_stack.push(start_num);
            }
            Event::End(TagEnd::List(_)) => {
                list_index_stack.pop();
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
                if let Some(Some(ref mut idx)) = list_index_stack.last_mut() {
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
            Event::End(TagEnd::TableCell) => {
                if !in_code_block {
                    current_text.push_str(" | ");
                }
            }
            Event::End(
                TagEnd::Paragraph | TagEnd::Heading(_) | TagEnd::Item | TagEnd::TableRow | TagEnd::TableHead,
            ) => {
                let mut paragraph_text_owned = current_text.trim().to_string();
                if paragraph_text_owned.ends_with(" |") {
                    paragraph_text_owned.truncate(paragraph_text_owned.len() - 2);
                    paragraph_text_owned = paragraph_text_owned.trim().to_string();
                }
                current_text.clear();

                let paragraph_text = paragraph_text_owned.as_str();
                if !paragraph_text.is_empty() {
                    println!("DEBUG PROCESS: {:?}", paragraph_text);
                    quiz_parser.process_paragraph(paragraph_text, in_heading);
                }

                if in_heading {
                    in_heading = false;
                }
            }
            _ => {}
        }
    }

    quiz.questions.retain(|q| {
        let has_valid_options =
            q.options.len() >= 2 && q.options.iter().any(|opt| opt.letter.to_uppercase() == "A");

        if has_valid_options {
            let has_answer = q.correct_answer.is_some();
            let has_explanation = q.explanation.is_some();

            if !has_answer || !has_explanation {
                let mut missing = Vec::new();
                if !has_answer {
                    missing.push("correct answer");
                }
                if !has_explanation {
                    missing.push("explanation");
                }
                eprintln!(
                    "Warning in quiz '{}': Question '{}' is missing: {}. This question will be skipped.",
                    quiz.title,
                    q.id,
                    missing.join(" and ")
                );
                false
            } else {
                true
            }
        } else {
            false
        }
    });

    if quiz.questions.is_empty() {
        None
    } else {
        Some(quiz)
    }
}
