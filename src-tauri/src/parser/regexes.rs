use regex::Regex;
use std::sync::LazyLock;

pub static RE_QUESTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:\*|_)*(?:Q|q|Question\s*)?(\d+)[\.\:]\s*(.+)$").unwrap());
pub static RE_OPTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:\[\s*[xX ]?\s*\]\s*)?([A-D])[\.\)]\s*(.+)$").unwrap());
pub static RE_SOLUTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)^(?:\*|_)*(?:Q|q|Question\s*)?(\d+).*?\b([A-D])\b(?:\*|_)*(.*)$").unwrap());
pub static RE_EXPLANATION: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?is)^(?:\*|_)*(?:Explanation|Spiegazione|Motivazione)(?:\*|_)*\s*[:\-]?\s*(.+)$").unwrap()
});
pub static RE_INLINE_ANSWERS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\d+)\s*[-:]\s*([A-D])\b").unwrap());
pub static RE_SOLUTION_HEADING: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)^(?:Soluzione|Solution|Answer|Risposta)\s*(\d+)$").unwrap());
pub static RE_CORRECT_ANSWER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(?:Risposta corretta|Correct answer|Answer|Risposta)\s*[:\-]?\s*([A-D])\b")
        .unwrap()
});
