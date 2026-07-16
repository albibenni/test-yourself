use super::regexes::{RE_EXPLANATION, RE_OPTION, RE_QUESTION, RE_SOLUTION};
use crate::models::{Quiz, QuizOption, QuizQuestion};

pub fn update_solution_mode(trimmed_lower: &str, in_heading: bool, in_solutions: &mut bool) {
    let solution_keywords = ["solution", "answer", "soluzioni", "risposte"];
    let contains_solution_kw = solution_keywords
        .iter()
        .any(|&kw| trimmed_lower.contains(kw));
    let starts_with_solution_kw = solution_keywords
        .iter()
        .any(|&kw| trimmed_lower.starts_with(kw));

    if in_heading && trimmed_lower.contains("quiz") && !contains_solution_kw {
        *in_solutions = false;
    }

    if (in_heading && contains_solution_kw) || starts_with_solution_kw {
        *in_solutions = true;
    }
}

pub fn parse_inline_options(raw_text: &str) -> (String, Vec<QuizOption>) {
    let re_inline = regex::Regex::new(r"(?:\s+|^)([A-D])[\.\)]\s+").unwrap();
    let matches: Vec<_> = re_inline.captures_iter(raw_text).collect();

    if matches.is_empty() {
        return (raw_text.to_string(), Vec::new());
    }

    let first_match = matches.first().unwrap().get(0).unwrap();
    let start_idx = first_match.start();
    let text = if raw_text.is_char_boundary(start_idx) {
        raw_text[..start_idx].trim().to_string()
    } else {
        String::new()
    };
    let mut options = Vec::new();

    for i in 0..matches.len() {
        let current_match = matches[i].get(0).unwrap();
        let letter = matches[i].get(1).unwrap().as_str().to_string();

        let start_idx = current_match.end();
        let end_idx = if i + 1 < matches.len() {
            matches[i + 1].get(0).unwrap().start()
        } else {
            raw_text.len()
        };

        let opt_text = if raw_text.is_char_boundary(start_idx) && raw_text.is_char_boundary(end_idx)
        {
            raw_text[start_idx..end_idx].trim().to_string()
        } else {
            // Fallback for extreme edge cases where regex captures mid-boundary
            // Fallback for extreme edge cases where regex captures mid-boundary
            // Approximating indices for the fallback. This is extremely rare.
            String::new() // Fallback empty if boundary violated
        };

        options.push(QuizOption {
            letter,
            text: opt_text,
        });
    }

    (text, options)
}

pub fn process_question_line(trimmed: &str, quiz: &mut Quiz) {
    if let Some(caps) = RE_QUESTION.captures(trimmed) {
        let raw_text = caps[2].to_string();

        let raw_lower = raw_text.to_lowercase();
        let solution_keywords = ["solution", "answer", "soluzioni", "risposte"];
        let is_actually_solution = solution_keywords
            .iter()
            .any(|&kw| raw_lower.starts_with(kw));

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

    if let Some(caps) = RE_OPTION.captures(trimmed) {
        if let Some(last_q) = quiz.questions.last_mut() {
            let letter = caps[1].to_string();
            let text = caps[2].trim().to_string();
            last_q.options.push(QuizOption { letter, text });
        }
    }
}

pub fn process_solution_line(
    trimmed: &str,
    quiz: &mut Quiz,
    current_solution_id: &mut Option<String>,
) {
    if let Some(caps) = RE_SOLUTION.captures(trimmed) {
        let q_id_val = &caps[1];
        let correct_letter_val = caps[2].to_string();
        let trailing_text_val = caps[3].trim().to_string();

        *current_solution_id = Some(q_id_val.to_string());

        if let Some(q) = quiz
            .questions
            .iter_mut()
            .rev()
            .find(|q| q.id == q_id_val && !q.options.is_empty())
        {
            q.correct_answer = Some(correct_letter_val);
            if !trailing_text_val.is_empty() {
                q.explanation = Some(trailing_text_val);
            }
        }
        return;
    }

    if let Some(caps) = RE_EXPLANATION.captures(trimmed) {
        if let Some(ref q_id) = current_solution_id {
            if let Some(q) = quiz
                .questions
                .iter_mut()
                .rev()
                .find(|q| q.id == *q_id && !q.options.is_empty())
            {
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
        if !RE_SOLUTION.is_match(trimmed) {
            if let Some(q) = quiz
                .questions
                .iter_mut()
                .rev()
                .find(|q| q.id == *q_id && !q.options.is_empty())
            {
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

pub struct QuizParser<'a> {
    quiz: &'a mut Quiz,
    in_solutions: bool,
    current_solution_id: Option<String>,
}

impl<'a> QuizParser<'a> {
    pub fn new(quiz: &'a mut Quiz) -> Self {
        Self {
            quiz,
            in_solutions: false,
            current_solution_id: None,
        }
    }

    pub fn process_paragraph(&mut self, paragraph_text: &str, in_heading: bool) {
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
