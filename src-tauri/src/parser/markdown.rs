use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use std::path::Path;

use super::core::QuizParser;
use crate::models::Quiz;

pub async fn parse_quiz_file(filepath: &Path, topic: &str) -> Option<Quiz> {
    let (content, mut quiz) = read_quiz_metadata(filepath, topic).await?;

    parse_markdown_events(&content, &mut quiz);

    validate_quiz(&mut quiz);

    if quiz.questions.is_empty() {
        None
    } else {
        Some(quiz)
    }
}

pub async fn parse_quiz_metadata(
    filepath: &Path,
    topic: &str,
) -> Option<crate::models::QuizMetadata> {
    let metadata = tokio::fs::metadata(filepath).await.ok()?;
    let last_modified = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();

    let file_stem = filepath.file_stem()?.to_string_lossy().to_string();
    let title = file_stem
        .strip_suffix(".worksheet")
        .or_else(|| file_stem.strip_suffix(".question"))
        .unwrap_or(&file_stem)
        .to_string();

    Some(crate::models::QuizMetadata {
        title,
        path: filepath.to_path_buf(),
        topic: topic.to_string(),
        last_modified,
        is_worksheet: filepath.to_string_lossy().ends_with(".worksheet.md"),
        is_question: filepath.to_string_lossy().ends_with(".question.md"),
    })
}

pub async fn parse_worksheet_file(
    filepath: &Path,
    topic: &str,
) -> Option<crate::models::Worksheet> {
    let content = tokio::fs::read_to_string(filepath).await.ok()?;

    let metadata = tokio::fs::metadata(filepath).await.ok()?;
    let last_modified = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();

    let file_stem = filepath.file_stem()?.to_string_lossy().to_string();
    let title = file_stem.replace(".worksheet", "");

    // Strip YAML frontmatter if present
    let mut actual_content = content.as_str();
    if actual_content.starts_with("---") {
        // Find the second "---"
        if let Some(end_idx) = actual_content[3..].find("---") {
            actual_content = &actual_content[3 + end_idx + 3..];
        }
    }

    Some(crate::models::Worksheet {
        title,
        path: filepath.to_path_buf(),
        topic: topic.to_string(),
        content: actual_content.trim_start().to_string(),
        last_modified,
    })
}

pub async fn parse_question_file(
    filepath: &Path,
    topic: &str,
) -> Option<crate::models::QuestionDocument> {
    let content = tokio::fs::read_to_string(filepath).await.ok()?;
    let metadata = tokio::fs::metadata(filepath).await.ok()?;
    let last_modified = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();
    let file_stem = filepath.file_stem()?.to_string_lossy().to_string();
    let title = file_stem
        .strip_suffix(".question")
        .unwrap_or(&file_stem)
        .to_string();
    let actual_content = strip_frontmatter(&content);
    let (question_section, answer_section) = split_question_sections(actual_content)?;
    let question_entries = parse_numbered_entries(question_section)?;
    let answer_entries = parse_numbered_entries(answer_section)?;

    if question_entries.len() < 2 || question_entries.len() != answer_entries.len() {
        return None;
    }

    let questions = question_entries
        .into_iter()
        .zip(answer_entries)
        .enumerate()
        .map(|(index, ((question_id, question), (answer_id, answer)))| {
            let expected_id = u32::try_from(index + 1).ok()?;
            if question_id != expected_id || answer_id != expected_id {
                return None;
            }
            Some(crate::models::QuestionEntry {
                id: expected_id,
                question,
                answer,
            })
        })
        .collect::<Option<Vec<_>>>()?;

    Some(crate::models::QuestionDocument {
        title,
        path: filepath.to_path_buf(),
        topic: topic.to_string(),
        questions,
        last_modified,
    })
}

fn split_question_sections(content: &str) -> Option<(&str, &str)> {
    let mut questions_heading = None;
    let mut answers_heading = None;
    let mut offset = 0;
    let mut in_fence = false;

    for line in content.split_inclusive('\n') {
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.trim_start().starts_with("```") {
            in_fence = !in_fence;
        } else if !in_fence {
            let heading = trimmed.strip_prefix("## ").map(str::trim);
            if let Some(heading) = heading {
                if heading.eq_ignore_ascii_case("questions")
                    || heading.eq_ignore_ascii_case("domande")
                {
                    if questions_heading
                        .replace((offset, offset + line.len()))
                        .is_some()
                    {
                        return None;
                    }
                } else if heading.eq_ignore_ascii_case("suggested answers")
                    || heading.eq_ignore_ascii_case("risposte suggerite")
                {
                    if answers_heading
                        .replace((offset, offset + line.len()))
                        .is_some()
                    {
                        return None;
                    }
                }
            }
        }
        offset += line.len();
    }

    let (questions_start, questions_content_start) = questions_heading?;
    let (answers_start, answers_content_start) = answers_heading?;
    if questions_start >= answers_start {
        return None;
    }

    Some((
        &content[questions_content_start..answers_start],
        &content[answers_content_start..],
    ))
}

fn parse_numbered_entries(section: &str) -> Option<Vec<(u32, String)>> {
    let mut entries = Vec::new();
    let mut current_id = None;
    let mut current_lines = Vec::new();
    let mut in_fence = false;

    for line in section.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") {
            in_fence = !in_fence;
        }

        let entry = if !in_fence && line.len() == trimmed.len() {
            trimmed
                .split_once(". ")
                .and_then(|(id, content)| id.parse::<u32>().ok().map(|id| (id, content)))
        } else {
            None
        };

        if let Some((id, entry_content)) = entry {
            if let Some(previous_id) = current_id.take() {
                let content = current_lines.join("\n").trim().to_string();
                if content.is_empty() {
                    return None;
                }
                entries.push((previous_id, content));
                current_lines.clear();
            } else if current_lines
                .iter()
                .any(|line: &String| !line.trim().is_empty())
            {
                return None;
            }
            current_id = Some(id);
            current_lines.push(entry_content.to_string());
        } else {
            current_lines.push(line.to_string());
        }
    }

    let id = current_id?;
    let content = current_lines.join("\n").trim().to_string();
    if content.is_empty() {
        return None;
    }
    entries.push((id, content));
    Some(entries)
}

fn strip_frontmatter(content: &str) -> &str {
    if content.starts_with("---") {
        if let Some(end_idx) = content[3..].find("---") {
            return &content[3 + end_idx + 3..];
        }
    }
    content
}

async fn read_quiz_metadata(filepath: &Path, topic: &str) -> Option<(String, Quiz)> {
    let content = tokio::fs::read_to_string(filepath).await.ok()?;

    let metadata = tokio::fs::metadata(filepath).await.ok()?;
    let last_modified = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();

    let quiz = Quiz {
        title: filepath.file_stem()?.to_string_lossy().to_string(),
        path: filepath.to_path_buf(),
        topic: topic.to_string(),
        questions: Vec::new(),
        last_modified,
    };

    Some((content, quiz))
}

fn parse_markdown_events(content: &str, quiz: &mut Quiz) {
    let mut options = pulldown_cmark::Options::empty();
    options.insert(pulldown_cmark::Options::ENABLE_TABLES);
    let parser = Parser::new_ext(content, options);

    let mut processor = MarkdownEventProcessor::new(quiz);

    for event in parser {
        processor.process_event(event);
    }
}

struct MarkdownEventProcessor<'a> {
    quiz_parser: QuizParser<'a>,
    current_text: String,
    in_code_block: bool,
    in_heading: bool,
    list_index_stack: Vec<Option<u64>>,
    pending_list_prefix: String,
}

impl<'a> MarkdownEventProcessor<'a> {
    fn new(quiz: &'a mut Quiz) -> Self {
        Self {
            quiz_parser: QuizParser::new(quiz),
            current_text: String::new(),
            in_code_block: false,
            in_heading: false,
            list_index_stack: Vec::new(),
            pending_list_prefix: String::new(),
        }
    }

    fn process_event(&mut self, event: Event) {
        match event {
            Event::Start(tag) => self.handle_start_tag(tag),
            Event::End(tag_end) => self.handle_end_tag(tag_end),
            Event::Text(text) | Event::Code(text) => self.handle_text(&text),
            Event::SoftBreak | Event::HardBreak => self.handle_break(),
            _ => {}
        }
    }

    fn handle_start_tag(&mut self, tag: Tag) {
        match tag {
            Tag::List(start_num) => self.list_index_stack.push(start_num),
            Tag::CodeBlock(_) => self.in_code_block = true,
            Tag::Heading { .. } => {
                self.in_heading = true;
                self.flush_pending_prefix();
            }
            Tag::Paragraph => {
                self.in_heading = false;
                self.flush_pending_prefix();
            }
            Tag::Item => {
                self.current_text.clear();
                self.pending_list_prefix.clear();
                if let Some(Some(ref mut idx)) = self.list_index_stack.last_mut() {
                    self.pending_list_prefix = format!("{}. ", idx);
                    *idx += 1;
                }
            }
            _ => {}
        }
    }

    fn handle_end_tag(&mut self, tag_end: TagEnd) {
        match tag_end {
            TagEnd::List(_) => {
                self.list_index_stack.pop();
            }
            TagEnd::CodeBlock => self.in_code_block = false,
            TagEnd::TableCell => {
                if !self.in_code_block {
                    self.current_text.push_str(" | ");
                }
            }
            TagEnd::Paragraph
            | TagEnd::Heading(_)
            | TagEnd::Item
            | TagEnd::TableRow
            | TagEnd::TableHead => {
                self.flush_current_paragraph();
            }
            _ => {}
        }
    }

    fn handle_text(&mut self, text: &str) {
        if !self.in_code_block {
            if !self.pending_list_prefix.is_empty() {
                self.current_text.push_str(&self.pending_list_prefix);
                self.pending_list_prefix.clear();
            }
            self.current_text.push_str(text);
        }
    }

    fn handle_break(&mut self) {
        if !self.in_code_block {
            self.current_text.push('\n');
        }
    }

    fn flush_pending_prefix(&mut self) {
        self.current_text.clear();
        if !self.pending_list_prefix.is_empty() {
            self.current_text.push_str(&self.pending_list_prefix);
            self.pending_list_prefix.clear();
        }
    }

    fn flush_current_paragraph(&mut self) {
        let mut paragraph_text_owned = self.current_text.trim().to_string();
        if paragraph_text_owned.ends_with(" |") {
            paragraph_text_owned.truncate(paragraph_text_owned.len() - 2);
            paragraph_text_owned = paragraph_text_owned.trim().to_string();
        }
        self.current_text.clear();

        let paragraph_text = paragraph_text_owned.as_str();
        if !paragraph_text.is_empty() {
            self.quiz_parser
                .process_paragraph(paragraph_text, self.in_heading);
        }

        if self.in_heading {
            self.in_heading = false;
        }
    }
}

fn validate_quiz(quiz: &mut Quiz) {
    let title = quiz.title.clone();
    quiz.questions.retain(|q| is_valid_question(q, &title));
}

fn is_valid_question(q: &crate::models::QuizQuestion, quiz_title: &str) -> bool {
    let has_valid_options =
        q.options.len() >= 2 && q.options.iter().any(|opt| opt.letter.to_uppercase() == "A");

    if !has_valid_options {
        return false;
    }

    let has_answer = q.correct_answer.is_some();
    let has_explanation = q.explanation.is_some();

    if has_answer && has_explanation {
        return true;
    }

    let mut missing = Vec::new();
    if !has_answer {
        missing.push("correct answer");
    }
    if !has_explanation {
        missing.push("explanation");
    }

    eprintln!(
        "Warning in quiz '{}': Question '{}' is missing: {}. This question will be skipped.",
        quiz_title,
        q.id,
        missing.join(" and ")
    );

    false
}
