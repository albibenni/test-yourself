use crate::parser::markdown::parse_question_file;
use std::io::Write;
use tempfile::NamedTempFile;

#[tokio::test]
async fn parses_bilingual_question_sections_and_multiline_markdown() {
    let mut file = NamedTempFile::with_suffix(".question.md").unwrap();
    writeln!(
        file,
        r#"# Identity

## Domande

1. Explain the identity check.

   Include this evidence:

   ```text
   spiffe://example.org/service
   ```

2. What should happen next?

## Suggested Answers

1. Validate the identity and then apply authorization policy.

2. Deny the request when the policy does not match."#
    )
    .unwrap();

    let document = parse_question_file(file.path(), "Security").await.unwrap();

    assert_eq!(
        document.title,
        file.path()
            .file_stem()
            .unwrap()
            .to_string_lossy()
            .replace(".question", "")
    );
    assert_eq!(document.topic, "Security");
    assert_eq!(document.questions.len(), 2);
    assert_eq!(document.questions[0].id, 1);
    assert!(document.questions[0].question.contains("```text"));
    assert!(document.questions[0]
        .answer
        .contains("authorization policy"));
    assert_eq!(document.questions[1].id, 2);
}

#[tokio::test]
async fn accepts_case_insensitive_mixed_language_headings() {
    let mut file = NamedTempFile::with_suffix(".question.md").unwrap();
    writeln!(
        file,
        "## questions\n\n1. First?\n\n2. Second?\n\n## RISPOSTE SUGGERITE\n\n1. First answer.\n\n2. Second answer."
    )
    .unwrap();

    assert!(parse_question_file(file.path(), "Mixed").await.is_some());
}

#[tokio::test]
async fn rejects_non_consecutive_or_unmatched_entries() {
    for content in [
        "## Questions\n\n1. First?\n\n3. Third?\n\n## Suggested Answers\n\n1. One.\n\n3. Three.",
        "## Questions\n\n1. First?\n\n2. Second?\n\n## Suggested Answers\n\n1. Only one answer.",
        "## Questions\n\n1. Only one?\n\n## Suggested Answers\n\n1. Only one answer.",
    ] {
        let mut file = NamedTempFile::with_suffix(".question.md").unwrap();
        write!(file, "{content}").unwrap();
        assert!(parse_question_file(file.path(), "Invalid").await.is_none());
    }
}
