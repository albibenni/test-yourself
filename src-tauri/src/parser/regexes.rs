use regex::Regex;
use std::sync::LazyLock;

pub static RE_QUESTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:Q|q|Question\s*)?(\d+)[\.\:]\s*(.+)$").unwrap());
pub static RE_OPTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:\[\s*[xX ]?\s*\]\s*)?([A-D])[\.\)]\s*(.+)$").unwrap());
pub static RE_SOLUTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)^(?:Q|q|Question\s*)?(\d+).*?\b([A-D])\b(.*)$").unwrap());
pub static RE_EXPLANATION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?is)^(?:Explanation|Spiegazione|Motivazione)\s*[:\-]?\s*(.+)$").unwrap());
pub static RE_INLINE_ANSWERS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\d+)\s*[-:]\s*([A-D])").unwrap());
