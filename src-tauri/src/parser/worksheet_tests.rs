#[cfg(test)]
mod tests {
    use crate::parser::markdown::parse_worksheet_file;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_parse_worksheet_with_frontmatter() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "---").unwrap();
        writeln!(file, "type: worksheet").unwrap();
        writeln!(file, "topic: PKCE").unwrap();
        writeln!(file, "---").unwrap();
        writeln!(file, "This is a {{{{test}}}}").unwrap();

        let worksheet = parse_worksheet_file(file.path(), "Auth").await.unwrap();

        assert_eq!(worksheet.topic, "Auth");
        assert_eq!(worksheet.content.trim(), "This is a {{test}}");
    }

    #[tokio::test]
    async fn test_parse_worksheet_without_frontmatter() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "This is another {{{{test}}}}").unwrap();

        let worksheet = parse_worksheet_file(file.path(), "Basic").await.unwrap();

        assert_eq!(worksheet.content.trim(), "This is another {{test}}");
    }

    #[tokio::test]
    async fn test_parse_worksheet_not_found() {
        let path = std::path::Path::new("/path/that/does/not/exist.worksheet.md");
        let result = parse_worksheet_file(path, "None").await;

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_parse_worksheet_empty() {
        let file = NamedTempFile::new().unwrap();
        let worksheet = parse_worksheet_file(file.path(), "Empty").await.unwrap();

        assert_eq!(worksheet.content.trim(), "");
    }
}
