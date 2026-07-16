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

    quiz.questions.retain(|q| {
        q.options.len() >= 2 && q.options.iter().any(|opt| opt.letter.to_uppercase() == "A")
    });

    if quiz.questions.is_empty() {
        None
    } else {
        Some(quiz)
    }
}
