use serde::{Deserialize, Serialize};

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
