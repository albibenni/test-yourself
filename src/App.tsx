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

  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

  // Filter quizzes by search query
  const filteredQuizzes = quizzes.filter((quiz) =>
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered quizzes by topic
  const groupedQuizzes = filteredQuizzes.reduce(
    (acc, quiz) => {
      if (!acc[quiz.topic]) acc[quiz.topic] = [];
      acc[quiz.topic].push(quiz);
      return acc;
    },
    {} as Record<string, Quiz[]>,
  );

  return (
    <div className="app-wrapper">
      <div className="top-bar" data-tauri-drag-region>
        <button
          className="top-bar-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title="Toggle Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
      </div>
      <div className="app-container">
        <aside className={`sidebar ${isSidebarOpen ? "" : "closed"}`}>
          <div className="sidebar-header">
            <h2>Brain Test</h2>
          </div>
        <hr className="sidebar-divider" />
        <div className="search-container">
          <svg
            className="search-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search by topic or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <hr className="sidebar-divider" />
        <div className="sidebar-content">
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
        </div>
      </aside>

      <main className="main-content">
        {selectedQuiz ? (
          <div className="quiz-viewer">
            <div className="quiz-header">
              <div className="header-title-row">
                <h1>{selectedQuiz.title}</h1>
              </div>
              <p>Topic: {selectedQuiz.topic || "General"}</p>
            </div>
            <div className="questions-container">
              {selectedQuiz.questions.map((q) => (
                <QuestionCard key={`${selectedQuiz.path}-${q.id}`} question={q} />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="header-title-row" style={{ justifyContent: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Select a Quiz</h2>
            </div>
            <p>
              Choose a topic from the sidebar to begin testing your knowledge.
            </p>
          </div>
        )}
      </main>
    </div>
    </div>
  );
}

export default App;
