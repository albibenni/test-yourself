import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface QuizOption {
  letter: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  correct_answer?: string;
  explanation?: string;
}

interface Quiz {
  title: string;
  path: string;
  topic: string;
  questions: QuizQuestion[];
}

function QuestionCard({ question }: { question: QuizQuestion }) {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const isAnswered = selectedLetter !== null;
  const isCorrect = selectedLetter === question.correct_answer;

  const handleSelect = (letter: string) => {
    if (isAnswered) return;
    setSelectedLetter(letter);
  };

  return (
    <div className="question-card">
      <h3 className="question-title">
        {question.id}. {question.text}
      </h3>
      <div className="options-list">
        {question.options.map((opt) => {
          let className = "option-button";
          if (isAnswered) {
            if (opt.letter === question.correct_answer) {
              className += " correct";
            } else if (opt.letter === selectedLetter) {
              className += " incorrect";
            }
          }

          return (
            <button
              key={opt.letter}
              className={className}
              onClick={() => handleSelect(opt.letter)}
              disabled={isAnswered}
            >
              <span className="option-letter">{opt.letter}.</span>
              <span className="option-text">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div className={`feedback-block ${isCorrect ? "success" : "error"}`}>
          <div className="feedback-title">
            {isCorrect ? "✨ Correct!" : "❌ Incorrect"}
          </div>
          {question.explanation && (
            <div className="feedback-explanation">{question.explanation}</div>
          )}
          {!isCorrect && !question.explanation && (
            <div className="feedback-explanation">
              The correct answer is {question.correct_answer}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    async function loadQuizzes() {
      try {
        // We use the absolute path to SecondBrain for now.
        // In a real app, this might be configurable via a settings dialog.
        const basePath =
          "/Users/benni/benni-projects/SecondBrain/Computer Science";
        const fetchedQuizzes = await invoke<Quiz[]>("get_quizzes", {
          basePath,
        });
        setQuizzes(fetchedQuizzes);
      } catch (error) {
        console.error("Failed to load quizzes:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadQuizzes();
  }, []);

  // Group quizzes by topic
  const groupedQuizzes = quizzes.reduce(
    (acc, quiz) => {
      if (!acc[quiz.topic]) acc[quiz.topic] = [];
      acc[quiz.topic].push(quiz);
      return acc;
    },
    {} as Record<string, Quiz[]>,
  );

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2>Brain Test</h2>
        {loading ? (
          <div className="loading">Loading quizzes...</div>
        ) : (
          Object.entries(groupedQuizzes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([topic, topicQuizzes]) => (
              <div key={topic} className="topic-group">
                <div className="topic-title">{topic || "General"}</div>
                {topicQuizzes.map((quiz) => (
                  <div
                    key={quiz.path}
                    className={`quiz-item ${selectedQuiz?.path === quiz.path ? "active" : ""}`}
                    onClick={() => setSelectedQuiz(quiz)}
                  >
                    {quiz.title}
                  </div>
                ))}
              </div>
            ))
        )}
      </aside>

      <main className="main-content">
        {selectedQuiz ? (
          <div className="quiz-viewer">
            <div className="quiz-header">
              <h1>{selectedQuiz.title}</h1>
              <p>Topic: {selectedQuiz.topic || "General"}</p>
            </div>
            <div className="questions-container">
              {selectedQuiz.questions.map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h2>Select a Quiz</h2>
            <p>
              Choose a topic from the sidebar to begin testing your knowledge.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
